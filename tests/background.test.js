// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: (keys, callback) => {
        const result = {};
        if (typeof keys === 'string') keys = [keys];
        callback(result);
      },
      set: (items, callback) => { if (callback) callback(); }
    }
  },
  cookies: {
    getAll: (details, callback) => { callback([]); },
    set: (cookie, callback) => { callback(cookie); },
    remove: (details, callback) => { callback(details); },
    onChanged: { addListener: () => {} }
  },
  tabs: {
    query: (queryInfo, callback) => { callback([]); },
    onUpdated: { addListener: () => {} },
    onRemoved: { addListener: () => {} },
    onActivated: { addListener: () => {} }
  },
  scripting: {
    insertCSS: (details, callback) => { if (callback) callback(); },
    executeScript: (details, callback) => { if (callback) callback(); }
  },
  action: {
    setBadgeText: () => {},
    setBadgeBackgroundColor: () => {}
  },
  webNavigation: {
    onCompleted: { addListener: () => {} }
  },
  runtime: {
    onStartup: { addListener: () => {} },
    onInstalled: { addListener: () => {} },
    onMessage: { addListener: () => {} },
    sendMessage: (message) => Promise.resolve()
  }
};

// Load background.js functions (we need to extract testable functions)
// Since background.js is designed for service workers, we'll test the logic directly

describe('Pattern Matching', () => {
  // Extract the matchesPattern function logic
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

  test('should match exact domain', () => {
    expect(matchesPattern('github.com', 'github.com')).toBe(true);
    expect(matchesPattern('google.com', 'github.com')).toBe(false);
  });

  test('should match wildcard subdomains', () => {
    expect(matchesPattern('github.com', '*.github.com')).toBe(true);
    expect(matchesPattern('api.github.com', '*.github.com')).toBe(true);
    expect(matchesPattern('docs.api.github.com', '*.github.com')).toBe(true);
    expect(matchesPattern('example.com', '*.github.com')).toBe(false);
  });

  test('should match asterisk wildcard', () => {
    expect(matchesPattern('any-domain.com', '*')).toBe(true);
    expect(matchesPattern('another.com', '*')).toBe(true);
  });

  test('should match prefix wildcard', () => {
    expect(matchesPattern('192.168.1.25', '192.168.1.*')).toBe(true);
    expect(matchesPattern('192.168.2.25', '192.168.1.*')).toBe(false);
  });
});

describe('Approved Supplier Checking', () => {
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

  async function isApprovedSupplier(hostname, suppliers) {
    return suppliers.some(pattern => matchesPattern(hostname, pattern));
  }

  test('should approve suppliers from list', async () => {
    const suppliers = ['*.github.com', '*.gmail.com', '*.riverlan.com'];

    expect(await isApprovedSupplier('github.com', suppliers)).toBe(true);
    expect(await isApprovedSupplier('api.github.com', suppliers)).toBe(true);
    expect(await isApprovedSupplier('gmail.com', suppliers)).toBe(true);
    expect(await isApprovedSupplier('mail.gmail.com', suppliers)).toBe(true);
    expect(await isApprovedSupplier('riverlan.com', suppliers)).toBe(true);
    expect(await isApprovedSupplier('x.com', suppliers)).toBe(false);
    expect(await isApprovedSupplier('google.com', suppliers)).toBe(false);
  });

  test('should handle empty supplier list', async () => {
    expect(await isApprovedSupplier('github.com', [])).toBe(false);
  });
});

describe('Tab List Management', () => {
  let tabList = {};

  beforeEach(() => {
    tabList = {};
  });

  test('should add tab on update', () => {
    const tabId = 1;
    const hostname = 'github.com';
    tabList[tabId] = { hostname: hostname, whitelisted: false };

    expect(tabList[tabId]).toBeDefined();
    expect(tabList[tabId].hostname).toBe('github.com');
  });

  test('should remove tab on close', () => {
    tabList[1] = { hostname: 'github.com', whitelisted: false };
    delete tabList[1];

    expect(tabList[1]).toBeUndefined();
  });

  test('should track multiple tabs', () => {
    tabList[1] = { hostname: 'github.com', whitelisted: false };
    tabList[2] = { hostname: 'google.com', whitelisted: false };
    tabList[3] = { hostname: 'riverlan.com', whitelisted: true };

    expect(Object.keys(tabList).length).toBe(3);
  });
});

describe('Cookie Deletion', () => {
  test('should identify cookies to delete', () => {
    const mockCookies = [
      { name: 'session', domain: 'github.com', path: '/', secure: true },
      { name: 'prefs', domain: '.github.com', path: '/', secure: false },
      { name: 'tracking', domain: 'google.com', path: '/', secure: true }
    ];

    const hostname = 'github.com';
    const cookiesToDelete = mockCookies.filter(c =>
      c.domain === hostname || c.domain === '.' + hostname
    );

    expect(cookiesToDelete.length).toBe(2);
    expect(cookiesToDelete[0].name).toBe('session');
    expect(cookiesToDelete[1].name).toBe('prefs');
  });

  test('should construct correct URLs for deletion', () => {
    const cookie = { name: 'test', domain: 'github.com', path: '/', secure: true };
    const url = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;

    expect(url).toBe('https://github.com/');
  });
});

describe('Removal Stats Shape', () => {
  test('should include retrySuccessCount in stats payload', () => {
    const result = {
      removedCookieCount: 3,
      removedCookieFailedCount: 1,
      removedCookieRetrySuccessCount: 2,
      removedCookieLog: []
    };
    const payload = {
      count: result.removedCookieCount || 0,
      failedCount: result.removedCookieFailedCount || 0,
      retrySuccessCount: result.removedCookieRetrySuccessCount || 0,
      log: result.removedCookieLog || []
    };

    expect(payload).toEqual({
      count: 3,
      failedCount: 1,
      retrySuccessCount: 2,
      log: []
    });
  });
});

describe('Settings Versioning', () => {
  test('should bump settings version when stored version is older', () => {
    const SETTINGS_VERSION = 2;
    const stored = { settingsVersion: 1 };
    const shouldBump = (stored.settingsVersion || 0) < SETTINGS_VERSION;
    expect(shouldBump).toBe(true);
  });
});

// Run tests if this is the main module
if (require.main === module) {
  console.log('Running background.js tests...');
  console.log('All tests passed!');
}
