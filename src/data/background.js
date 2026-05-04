let tabList = {};

chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.url) {
        const hostname = new URL(tab.url).hostname;
        tabList[tab.id] = { hostname: hostname, whitelisted: false };
      }
    }
  });
  checkWhitelist();
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['whitelist', 'showBadge', 'approved_cookie_supplier'], (result) => {
    if (!result.whitelist) {
      chrome.storage.local.set({ whitelist: [] });
    }
    if (result.showBadge === undefined) {
      chrome.storage.local.set({ showBadge: true });
    }
    if (!result.approved_cookie_supplier) {
      chrome.storage.local.set({
        approved_cookie_supplier: [
          '*.github.com',
          '*.gmail.com',
          '*.x.com',
          '*.chatgpt.com',
          '*.mksmad.org'
        ]
      });
    }
  });
});

function checkWhitelist() {
  chrome.storage.local.get(['whitelist'], (result) => {
    const whitelist = result.whitelist || [];
    for (const tabId in tabList) {
      const hostname = tabList[tabId].hostname;
      tabList[tabId].whitelisted = whitelist.includes(hostname);
      updateBadge(tabId);
    }
  });
}

function updateBadge(tabId) {
  chrome.storage.local.get(['showBadge'], (result) => {
    if (!result.showBadge) {
      chrome.action.setBadgeText({ tabId: tabId, text: '' });
      return;
    }
    if (tabList[tabId] && tabList[tabId].whitelisted) {
      chrome.action.setBadgeText({ tabId: tabId, text: '⛔' });
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#FF0000' });
    } else {
      chrome.action.setBadgeText({ tabId: tabId, text: '✅' });
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#00AA00' });
    }
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const hostname = new URL(tab.url).hostname;
    tabList[tabId] = { hostname: hostname, whitelisted: false };
    chrome.storage.local.get(['whitelist'], (result) => {
      const whitelist = result.whitelist || [];
      tabList[tabId].whitelisted = whitelist.includes(hostname);
      updateBadge(tabId);
      if (!tabList[tabId].whitelisted) {
        doTheMagic(tabId);
      }
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const tabInfo = tabList[tabId];
  if (tabInfo && tabInfo.hostname) {
    autoRemoveCookies(tabInfo.hostname);
  }
  delete tabList[tabId];
});

function matchesPattern(hostname, pattern) {
  if (pattern === '*') return true;
  if (pattern.startsWith('*.')) {
    const domain = pattern.slice(2);
    return hostname === domain || hostname.endsWith('.' + domain);
  }
  return hostname === pattern;
}

function isApprovedSupplier(hostname) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['approved_cookie_supplier'], (result) => {
      const suppliers = result.approved_cookie_supplier || [];
      const approved = suppliers.some(pattern => matchesPattern(hostname, pattern));
      resolve(approved);
    });
  });
}

async function autoRemoveCookies(hostname) {
  const approved = await isApprovedSupplier(hostname);
  if (approved) return;

  chrome.cookies.getAll({ domain: hostname }, (cookies) => {
    cookies.forEach(cookie => {
      const url = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
      chrome.cookies.remove({ url: url, name: cookie.name });
    });
  });

  chrome.cookies.getAll({ domain: '.' + hostname }, (cookies) => {
    cookies.forEach(cookie => {
      const url = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
      chrome.cookies.remove({ url: url, name: cookie.name });
    });
  });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  updateBadge(activeInfo.tabId);
});

function doTheMagic(tabId) {
  chrome.scripting.insertCSS({
    target: { tabId: tabId },
    files: ['src/data/css/common.css']
  }).catch(() => {});

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['src/data/js/embedsHandler.js']
  }).catch(() => {});

  chrome.tabs.get(tabId, (tab) => {
    if (tab.url) {
      const hostname = new URL(tab.url).hostname;
      fetch(chrome.runtime.getURL('src/data/rules.js'))
        .then(r => r.text())
        .then(text => {
          eval(text);
          if (rules[hostname]) {
            const rule = rules[hostname];
            if (rule.s) {
              chrome.scripting.insertCSS({
                target: { tabId: tabId },
                css: rule.s
              }).catch(() => {});
            }
            if (rule.j) {
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: [`src/data/js/${rule.j}_clickHandler.js`]
              }).catch(() => {});
            }
          }
        }).catch(() => {});
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getAllCookies') {
    chrome.cookies.getAll({ url: request.url }, (cookies) => {
      sendResponse(cookies);
    });
    return true;
  }
  if (request.type === 'saveCookie') {
    chrome.cookies.set(request.cookie, (cookie) => {
      sendResponse(cookie);
    });
    return true;
  }
  if (request.type === 'removeCookie') {
    const url = `http${request.secure ? 's' : ''}://${request.domain}${request.path}`;
    chrome.cookies.remove({ url: url, name: request.name }, (details) => {
      sendResponse(details);
    });
    return true;
  }
  if (request.type === 'toggleWhitelist') {
    chrome.storage.local.get(['whitelist'], (result) => {
      let whitelist = result.whitelist || [];
      const hostname = request.hostname;
      if (whitelist.includes(hostname)) {
        whitelist = whitelist.filter(h => h !== hostname);
      } else {
        whitelist.push(hostname);
      }
      chrome.storage.local.set({ whitelist: whitelist }, () => {
        checkWhitelist();
        sendResponse({ success: true });
      });
    });
    return true;
  }
  if (request.type === 'getWhitelist') {
    chrome.storage.local.get(['whitelist'], (result) => {
      sendResponse({ whitelist: result.whitelist || [] });
    });
    return true;
  }
  if (request.type === 'getApprovedSuppliers') {
    chrome.storage.local.get(['approved_cookie_supplier'], (result) => {
      sendResponse({ suppliers: result.approved_cookie_supplier || [] });
    });
    return true;
  }
  if (request.type === 'saveApprovedSuppliers') {
    chrome.storage.local.set({ approved_cookie_supplier: request.suppliers }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  if (request.type === 'isApprovedSupplier') {
    isApprovedSupplier(request.hostname).then((approved) => {
      sendResponse({ approved: approved });
    });
    return true;
  }
});

chrome.cookies.onChanged.addListener((changeInfo) => {
  chrome.runtime.sendMessage({
    type: 'cookiesChanged',
    changeInfo: changeInfo
  }).catch(() => {});
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameType === 'main_frame') {
    doTheMagic(details.tabId);
  }
}, { url: [{ schemes: ['http', 'https'] }] });
