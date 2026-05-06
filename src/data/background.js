let tabList = {};
const SETTINGS_VERSION = 2;

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
  const defaultSuppliers = [
    '*.github.com',
    '*.gmail.com',
    '*.chatgpt.com',
    '*.mksmad.org',
    '*.riverlan.com',
    '*.luisriverag.com',
    '*.amazon.es',
    '*.printables.com',
    '192.168.1.*',
    '*.aliexpress.com',
    '*.archive.today',
    '*.archive.ph',
    '*.archive.is'
  ];

  chrome.storage.local.get(['settingsVersion', 'whitelist', 'showBadge', 'approved_cookie_supplier', 'removedCookieCount', 'removedCookieFailedCount', 'removedCookieRetrySuccessCount', 'removedCookieLog'], (result) => {
    if ((result.settingsVersion || 0) < SETTINGS_VERSION) {
      chrome.storage.local.set({ settingsVersion: SETTINGS_VERSION });
    }
    if (!result.whitelist) {
      chrome.storage.local.set({ whitelist: [] });
    }
    if (result.showBadge === undefined) {
      chrome.storage.local.set({ showBadge: true });
    }
    if (result.removedCookieCount === undefined) {
      chrome.storage.local.set({ removedCookieCount: 0 });
    }
    if (result.removedCookieFailedCount === undefined) {
      chrome.storage.local.set({ removedCookieFailedCount: 0 });
    }
    if (result.removedCookieRetrySuccessCount === undefined) {
      chrome.storage.local.set({ removedCookieRetrySuccessCount: 0 });
    }
    if (!result.removedCookieLog) {
      chrome.storage.local.set({ removedCookieLog: [] });
    }
    if (!result.approved_cookie_supplier) {
      chrome.storage.local.set({
        approved_cookie_supplier: defaultSuppliers
      });
    } else {
      const mergedSuppliers = [...new Set([...(result.approved_cookie_supplier || []), ...defaultSuppliers])];
      if (mergedSuppliers.length !== result.approved_cookie_supplier.length) {
        chrome.storage.local.set({ approved_cookie_supplier: mergedSuppliers });
      }
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
  chrome.action.setBadgeText({ tabId: tabId, text: '' });
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


function logCookieRemoval(entry) {
  chrome.storage.local.get(['removedCookieCount', 'removedCookieLog'], (result) => {
    const removedCookieCount = (result.removedCookieCount || 0) + 1;
    const removedCookieLog = result.removedCookieLog || [];

    removedCookieLog.unshift({
      ...entry,
      removedAt: new Date().toISOString()
    });

    chrome.storage.local.set({
      removedCookieCount: removedCookieCount,
      removedCookieLog: removedCookieLog.slice(0, 100)
    });
  });
}

function logCookieRemovalFailure(entry) {
  chrome.storage.local.get(['removedCookieFailedCount', 'removedCookieLog'], (result) => {
    const removedCookieFailedCount = (result.removedCookieFailedCount || 0) + 1;
    const removedCookieLog = result.removedCookieLog || [];

    removedCookieLog.unshift({
      ...entry,
      removedAt: new Date().toISOString(),
      failed: true
    });

    chrome.storage.local.set({
      removedCookieFailedCount: removedCookieFailedCount,
      removedCookieLog: removedCookieLog.slice(0, 100)
    });
  });
}

function logCookieRemovalRetrySuccess(entry) {
  chrome.storage.local.get(['removedCookieRetrySuccessCount', 'removedCookieLog'], (result) => {
    const removedCookieRetrySuccessCount = (result.removedCookieRetrySuccessCount || 0) + 1;
    const removedCookieLog = result.removedCookieLog || [];

    removedCookieLog.unshift({
      ...entry,
      removedAt: new Date().toISOString(),
      retried: true
    });

    chrome.storage.local.set({
      removedCookieRetrySuccessCount: removedCookieRetrySuccessCount,
      removedCookieLog: removedCookieLog.slice(0, 100)
    });
  });
}

function matchesPattern(hostname, pattern) {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -1);
    return hostname.startsWith(prefix);
  }
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

  function removeCookieWithRetry(cookie, source) {
    const initialUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
    chrome.cookies.remove({ url: initialUrl, name: cookie.name }, (details) => {
      if (details) {
        logCookieRemoval({ name: cookie.name, domain: cookie.domain, path: cookie.path, source: source });
        return;
      }

      const normalizedDomain = (cookie.domain || '').replace(/^\./, '');
      const normalizedPath = cookie.path || '/';
      const retryUrl = `https://${normalizedDomain}${normalizedPath}`;
      chrome.cookies.remove({ url: retryUrl, name: cookie.name }, (retryDetails) => {
        if (retryDetails) {
          logCookieRemoval({ name: cookie.name, domain: cookie.domain, path: cookie.path, source: `${source}-retry` });
          logCookieRemovalRetrySuccess({ name: cookie.name, domain: cookie.domain, path: cookie.path, source: `${source}-retry` });
        } else {
          logCookieRemovalFailure({ name: cookie.name, domain: cookie.domain, path: cookie.path, source: source });
        }
      });
    });
  }

  chrome.cookies.getAll({ domain: hostname }, (cookies) => {
    cookies.forEach(cookie => {
      removeCookieWithRetry(cookie, 'auto');
    });
  });

  chrome.cookies.getAll({ domain: '.' + hostname }, (cookies) => {
    cookies.forEach(cookie => {
      removeCookieWithRetry(cookie, 'auto');
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

  // Run broad consent-manager handler on every non-whitelisted page.
  // This brings back the wider coverage behavior users expect from
  // I-Still-Dont-Care-About-Cookies style blocking/clicking rules.
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['src/data/js/5_clickHandler.js']
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
      if (details) {
        logCookieRemoval({ name: request.name, domain: request.domain, path: request.path, source: 'manual' });
      }
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
  if (request.type === 'getRemovalStats') {
    chrome.storage.local.get(['removedCookieCount', 'removedCookieFailedCount', 'removedCookieRetrySuccessCount', 'removedCookieLog'], (result) => {
      sendResponse({
        count: result.removedCookieCount || 0,
        failedCount: result.removedCookieFailedCount || 0,
        retrySuccessCount: result.removedCookieRetrySuccessCount || 0,
        log: result.removedCookieLog || []
      });
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
