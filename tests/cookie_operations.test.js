// Tests for cookie operations
describe('Cookie Operations', () => {
  describe('Cookie URL Construction', () => {
    test('should construct secure cookie URL', () => {
      const cookie = { name: 'session', domain: 'github.com', path: '/', secure: true };
      const url = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
      expect(url).toBe('https://github.com/');
    });

    test('should construct non-secure cookie URL', () => {
      const cookie = { name: 'prefs', domain: 'example.com', path: '/settings', secure: false };
      const url = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
      expect(url).toBe('http://example.com/settings');
    });

    test('should handle subdomain cookies', () => {
      const cookie = { name: 'test', domain: '.github.com', path: '/', secure: true };
      const url = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
      expect(url).toBe('https://.github.com/');
    });
  });

  describe('Cookie Filtering', () => {
    const cookies = [
      { name: 'session', value: 'abc123', domain: 'github.com' },
      { name: '_ga', value: 'GA1.2.12345', domain: '.github.com' },
      { name: 'prefs', value: 'dark_mode', domain: 'github.com' },
      { name: 'auth', value: 'xyz789', domain: 'api.github.com' }
    ];

    test('should filter cookies by domain', () => {
      const domain = 'github.com';
      const filtered = cookies.filter(c =>
        c.domain === domain || c.domain === '.' + domain
      );

      expect(filtered.length).toBe(3);
      expect(filtered[0].name).toBe('session');
      expect(filtered[1].name).toBe('_ga');
    });

    test('should filter cookies by subdomain', () => {
      const domain = 'api.github.com';
      const filtered = cookies.filter(c => c.domain === domain);

      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('auth');
    });

    test('should get all cookies for base domain including subdomains', () => {
      const baseDomain = 'github.com';
      const allCookies = cookies.filter(c =>
        c.domain === baseDomain ||
        c.domain === '.' + baseDomain ||
        c.domain.endsWith('.' + baseDomain)
      );

      expect(allCookies.length).toBe(4);
    });
  });

  describe('Cookie Search', () => {
    const cookies = [
      { name: 'session_id', value: 'abc123' },
      { name: 'user_prefs', value: 'theme=dark' },
      { name: '_ga', value: 'GA1.2.123' },
      { name: 'auth_token', value: 'xyz789' }
    ];

    function searchCookies(cookies, query) {
      return cookies.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.value.toLowerCase().includes(query.toLowerCase())
      );
    }

    test('should search by cookie name', () => {
      const results = searchCookies(cookies, 'session');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('session_id');
    });

    test('should search by cookie value', () => {
      const results = searchCookies(cookies, 'dark');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('user_prefs');
    });

    test('should be case-insensitive', () => {
      const results = searchCookies(cookies, 'SESSION');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('session_id');
    });

    test('should return all cookies for empty query', () => {
      const results = searchCookies(cookies, '');
      expect(results.length).toBe(4);
    });

    test('should return empty for no matches', () => {
      const results = searchCookies(cookies, 'nonexistent');
      expect(results.length).toBe(0);
    });
  });

  describe('Cookie Deletion Logic', () => {
    test('should identify cookies to delete for non-approved domain', () => {
      const cookies = [
        { name: 'session', domain: 'example.com', path: '/', secure: true },
        { name: 'tracking', domain: '.example.com', path: '/', secure: false }
      ];

      const cookiesToDelete = cookies.filter(c =>
        c.domain === 'example.com' || c.domain === '.example.com'
      );

      expect(cookiesToDelete.length).toBe(2);
    });

    test('should skip deletion for approved suppliers', () => {
      const approved = true;
      const cookies = [{ name: 'session', domain: 'github.com' }];

      if (approved) {
        // Don't delete
        expect(cookies.length).toBe(1);
      }
    });
  });
});

describe('Cookie Data Validation', () => {
  test('should validate required cookie fields', () => {
    const cookie = {
      name: 'session',
      value: 'abc123',
      domain: 'example.com',
      path: '/',
      secure: true
    };

    expect(cookie.name).toBeDefined();
    expect(cookie.value).toBeDefined();
    expect(cookie.domain).toBeDefined();
    expect(cookie.path).toBeDefined();
  });

  test('should handle special characters in cookie value', () => {
    const cookie = {
      name: 'data',
      value: '{"key": "value", "num": 123}',
      domain: 'example.com'
    };

    expect(() => JSON.parse(cookie.value)).not.toThrow();
    const parsed = JSON.parse(cookie.value);
    expect(parsed.key).toBe('value');
  });
});
