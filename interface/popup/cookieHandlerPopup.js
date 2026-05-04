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
    return new Promise((resolve) => {
      chrome.cookies.set(cookie, (result) => {
        resolve(result);
      });
    });
  }

  removeCookie(name, url) {
    return new Promise((resolve) => {
      chrome.cookies.remove({ url: url, name: name }, (result) => {
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
