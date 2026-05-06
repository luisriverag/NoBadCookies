class CookieHandlerPopup extends GenericCookieHandler {
  constructor() {
    super();
    this.currentTab = null;
  }

  getCurrentUrl() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          this.currentTab = tabs[0];
          resolve(tabs[0].url);
        }
      });
    });
  }

  getAllCookies(url) {
    return new Promise((resolve) => {
      chrome.cookies.getAll({ url: url }, (cookies) => {
        resolve(cookies);
      });
    });
  }

  saveCookie(cookie) {
    return new Promise((resolve, reject) => {
      chrome.cookies.set(cookie, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result);
      });
    });
  }

  removeCookie(cookie) {
    return new Promise((resolve, reject) => {
      const host = (cookie.domain || '').replace(/^\./, '');
      const path = cookie.path || '/';
      const url = `http${cookie.secure ? 's' : ''}://${host}${path}`;
      const details = { url: url, name: cookie.name };
      if (cookie.storeId) {
        details.storeId = cookie.storeId;
      }
      chrome.cookies.remove(details, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!result) {
          reject(new Error('Cookie not removed.'));
          return;
        }
        resolve(result);
      });
    });
  }

  checkWhitelist(hostname) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'getWhitelist' }, (response) => {
        resolve(response.whitelist.includes(hostname));
      });
    });
  }

  toggleWhitelist(hostname) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'toggleWhitelist', hostname: hostname }, (response) => {
        resolve(response);
      });
    });
  }
}
