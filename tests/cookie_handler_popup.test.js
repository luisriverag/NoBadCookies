describe('CookieHandlerPopup removeCookie details', () => {
  function buildRemoveDetails(cookie) {
    const host = (cookie.domain || '').replace(/^\./, '');
    const path = cookie.path || '/';
    const url = `http${cookie.secure ? 's' : ''}://${host}${path}`;
    const details = { url: url, name: cookie.name };
    if (cookie.storeId) {
      details.storeId = cookie.storeId;
    }
    return details;
  }

  test('should normalize dot-domain and include secure scheme', () => {
    const details = buildRemoveDetails({
      name: 'session',
      domain: '.github.com',
      path: '/',
      secure: true
    });

    expect(details.url).toBe('https://github.com/');
    expect(details.name).toBe('session');
  });

  test('should include storeId when present', () => {
    const details = buildRemoveDetails({
      name: 'prefs',
      domain: 'example.com',
      path: '/settings',
      secure: false,
      storeId: '1'
    });

    expect(details.url).toBe('http://example.com/settings');
    expect(details.storeId).toBe('1');
  });

  test('should default to root path when path missing', () => {
    const details = buildRemoveDetails({
      name: 'token',
      domain: 'example.com',
      secure: false
    });

    expect(details.url).toBe('http://example.com/');
  });
});
