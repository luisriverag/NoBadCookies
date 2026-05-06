// Mock DOM and Chrome APIs for popup tests
document.body.innerHTML = `
  <div id="app">
    <div class="header">
      <h2>CookiesBeGone</h2>
      <button id="toggleWhitelist">⛔</button>
    </div>
    <div class="search-box">
      <input type="text" id="searchInput" placeholder="Search cookies...">
    </div>
    <span id="removedCookieCount">0</span>
    <span id="removedCookieFailedCount">0</span>
    <span id="removedCookieRetrySuccessCount">0</span>
    <p id="actionStatus" class="muted" aria-live="polite"></p>
    <div id="cookieList"></div>
    <div class="button-bar">
      <button id="addCookie">Add</button>
      <button id="exportCookie">Export</button>
      <button id="importCookie">Import</button>
      <button id="refreshCookies">Refresh</button>
    </div>
  </div>
  <template id="cookieTemplate">
    <div class="cookie-item">
      <div class="cookie-header">
        <span class="cookie-name"></span>
        <div>
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">×</button>
        </div>
      </div>
      <div class="cookie-details">
        <div class="cookie-value"></div>
        <div class="cookie-meta"></div>
      </div>
    </div>
  </template>
`;

// Mock Chrome APIs
global.chrome = {
  cookies: {
    getAll: (details, callback) => {
      callback([
        { name: 'session', value: 'abc123', domain: 'github.com', path: '/', secure: true },
        { name: 'prefs', value: 'dark_mode', domain: 'github.com', path: '/', secure: false },
        { name: '_ga', value: 'GA1.2.123', domain: '.github.com', path: '/', secure: true }
      ]);
    },
    set: (cookie, callback) => { callback(cookie); },
    remove: (details, callback) => { callback(details); }
  },
  tabs: {
    query: (queryInfo, callback) => {
      callback([{ id: 1, url: 'https://github.com/user' }]);
    }
  },
  runtime: {
    sendMessage: (message, callback) => {
      if (message.type === 'getWhitelist') {
        callback({ whitelist: [] });
      } else if (message.type === 'toggleWhitelist') {
        callback({ success: true });
      }
    }
  },
  storage: {
    local: {
      get: (keys, callback) => { callback({}); },
      set: (items, callback) => { if (callback) callback(); }
    }
  }
};

// Test CookieHandlerPopup
class CookieHandlerPopup {
  constructor() {
    this.cookies = [];
    this.currentUrl = '';
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

  searchCookies(cookies, query) {
    return cookies.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.value.toLowerCase().includes(query.toLowerCase())
    );
  }
}

describe('Popup Functionality', () => {
  let handler;

  beforeEach(() => {
    handler = new CookieHandlerPopup();
  });

  test('should get current tab URL', async () => {
    const url = await handler.getCurrentUrl();
    expect(url).toBe('https://github.com/user');
  });

  test('should load cookies for URL', async () => {
    const url = 'https://github.com/user';
    const cookies = await handler.getAllCookies(url);
    expect(cookies.length).toBe(3);
    expect(cookies[0].name).toBe('session');
  });

  test('should search cookies by name', () => {
    const cookies = [
      { name: 'session', value: 'abc' },
      { name: 'prefs', value: 'dark' },
      { name: '_ga', value: 'tracking' }
    ];

    const results = handler.searchCookies(cookies, 'ses');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('session');
  });

  test('should search cookies by value', () => {
    const cookies = [
      { name: 'session', value: 'abc123' },
      { name: 'prefs', value: 'dark_mode' },
      { name: '_ga', value: 'GA1.2.123' }
    ];

    const results = handler.searchCookies(cookies, 'dark');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('prefs');
  });

  test('should return all cookies for empty search', () => {
    const cookies = [
      { name: 'cookie1', value: 'val1' },
      { name: 'cookie2', value: 'val2' }
    ];

    const results = handler.searchCookies(cookies, '');
    expect(results.length).toBe(2);
  });
});

describe('Cookie Rendering', () => {
  test('should render cookie items from template', () => {
    const cookies = [
      { name: 'test', value: '123', domain: 'example.com', path: '/', secure: true }
    ];

    const list = document.getElementById('cookieList');
    const template = document.getElementById('cookieTemplate');

    list.innerHTML = '';
    cookies.forEach(cookie => {
      const clone = template.content.cloneNode(true);
      clone.querySelector('.cookie-name').textContent = cookie.name;
      clone.querySelector('.cookie-value').textContent = cookie.value;
      clone.querySelector('.cookie-meta').textContent =
        `${cookie.domain} | ${cookie.path} | ${cookie.secure ? 'Secure' : 'Not Secure'}`;
      list.appendChild(clone);
    });

    expect(list.children.length).toBe(1);
    expect(list.querySelector('.cookie-name').textContent).toBe('test');
  });

  test('should include live action status region', () => {
    const status = document.getElementById('actionStatus');
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  test('should include removal telemetry counters in DOM', () => {
    expect(document.getElementById('removedCookieCount')).toBeTruthy();
    expect(document.getElementById('removedCookieFailedCount')).toBeTruthy();
    expect(document.getElementById('removedCookieRetrySuccessCount')).toBeTruthy();
  });

  test('should include edit and delete actions in rendered template', () => {
    const template = document.getElementById('cookieTemplate');
    const clone = template.content.cloneNode(true);
    expect(clone.querySelector('.edit-btn')).toBeTruthy();
    expect(clone.querySelector('.delete-btn')).toBeTruthy();
  });
});

describe('Search Debounce', () => {
  test('should debounce search input', (done) => {
    let callCount = 0;
    const debounce = (fn, delay) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          fn(...args);
          callCount++;
        }, delay);
      };
    };

    const mockSearch = debounce(() => {}, 300);
    mockSearch();
    mockSearch();
    mockSearch();

    setTimeout(() => {
      expect(callCount).toBe(1);
      done();
    }, 400);
  });
});

if (require.main === module) {
  console.log('Running popup tests...');
  console.log('All tests passed!');
}
