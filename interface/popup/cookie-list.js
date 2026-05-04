let cookieHandler = new CookieHandlerPopup();
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  cookieHandler.showCookiesForTab();

  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      cookieHandler.searchCookies(e.target.value);
    }, 300);
  });

  document.getElementById('refreshCookies').addEventListener('click', () => {
    cookieHandler.showCookiesForTab();
  });

  document.getElementById('toggleWhitelist').addEventListener('click', async () => {
    const url = await cookieHandler.getCurrentUrl();
    const hostname = new URL(url).hostname;
    await cookieHandler.toggleWhitelist(hostname);
    location.reload();
  });

  document.getElementById('addCookie').addEventListener('click', async () => {
    const currentUrl = await cookieHandler.getCurrentUrl();
    const defaultDomain = new URL(currentUrl).hostname;

    const name = prompt('Cookie name:');
    if (!name) return;

    const value = prompt('Cookie value:', '');
    if (value === null) return;

    const path = prompt('Cookie path:', '/') || '/';
    const secure = confirm('Should this cookie be Secure?');

    await cookieHandler.saveCookie({
      url: currentUrl,
      name: name.trim(),
      value: value,
      domain: defaultDomain,
      path: path,
      secure: secure
    });

    cookieHandler.showCookiesForTab();
  });

  document.getElementById('exportCookie').addEventListener('click', () => {
    const json = JSON.stringify(cookieHandler.cookies, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cookies.json';
    a.click();
  });

  document.getElementById('importCookie').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const cookies = JSON.parse(ev.target.result);
        cookies.forEach(c => cookieHandler.saveCookie(c));
        cookieHandler.showCookiesForTab();
      };
      reader.readAsText(file);
    };
    input.click();
  });
});
