class GenericCookieHandler {
  constructor() {
    this.cookies = [];
    this.currentUrl = '';
  }

  async showCookiesForTab() {
    const url = await this.getCurrentUrl();
    this.currentUrl = url;
    const cookies = await this.getAllCookies(url);
    this.cookies = cookies;
    this.renderCookies(cookies);
  }

  renderCookies(cookies) {
    const list = document.getElementById('cookieList');
    list.innerHTML = '';
    const template = document.getElementById('cookieTemplate');

    cookies.forEach(cookie => {
      const clone = template.content.cloneNode(true);
      clone.querySelector('.cookie-name').textContent = cookie.name;
      clone.querySelector('.cookie-value').textContent = cookie.value;
      clone.querySelector('.cookie-meta').textContent =
        `${cookie.domain} | ${cookie.path} | ${cookie.secure ? 'Secure' : 'Not Secure'}`;

      clone.querySelector('.delete-btn').addEventListener('click', () => {
        this.removeCookie(cookie)
          .then(() => {
            if (typeof this.onCookieDeleted === 'function') {
              this.onCookieDeleted(cookie, true);
            }
            this.showCookiesForTab();
          })
          .catch(() => {
            if (typeof this.onCookieDeleted === 'function') {
              this.onCookieDeleted(cookie, false);
            }
          });
      });
      const editBtn = clone.querySelector('.edit-btn');
      if (editBtn && typeof this.onEditCookie === 'function') {
        editBtn.addEventListener('click', () => this.onEditCookie(cookie));
      }

      list.appendChild(clone);
    });
  }

  searchCookies(query) {
    const filtered = this.cookies.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.value.toLowerCase().includes(query.toLowerCase())
    );
    this.renderCookies(filtered);
  }
}
