const defaultSuppliers = [
  '*.github.com',
  '*.gmail.com',
  '*.x.com',
  '*.chatgpt.com',
  '*.mksmad.org',
  '*.amazon.es',
  '*.printables.com',
  '192.168.1.*',
  '*.aliexpress.com',
  '*.archive.today',
  '*.archive.ph',
  '*.archive.is'
];

function loadRemovalStats() {
  chrome.runtime.sendMessage({ type: 'getRemovalStats' }, (response) => {
    const count = response?.count || 0;
    const failedCount = response?.failedCount || 0;
    const retrySuccessCount = response?.retrySuccessCount || 0;
    const log = response?.log || [];

    const countEl = document.getElementById('removedCookieCount');
    const failedCountEl = document.getElementById('removedCookieFailedCount');
    const retrySuccessCountEl = document.getElementById('removedCookieRetrySuccessCount');
    const logEl = document.getElementById('removedCookieLog');
    if (!countEl || !failedCountEl || !retrySuccessCountEl || !logEl) return;

    countEl.textContent = String(count);
    failedCountEl.textContent = String(failedCount);
    const retryRate = failedCount > 0 ? Math.round((retrySuccessCount / failedCount) * 100) : 0;
    retrySuccessCountEl.textContent = `${retrySuccessCount} (${retryRate}% of failures recovered)`;
    const recent = log.slice(0, 20);
    logEl.innerHTML = '';

    if (!recent.length) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No cookies removed yet.';
      logEl.appendChild(li);
      return;
    }

    recent.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = `${item.name} @ ${item.domain}`;
      logEl.appendChild(li);
    });
  });
}

let cookieHandler = new CookieHandlerPopup();
let searchTimeout = null;
let editingCookie = null;
let editingOriginalName = null;

function setActionStatus(message, type = 'info') {
  const el = document.getElementById('actionStatus');
  if (!el) return;
  el.textContent = message;
  el.style.color = type === 'error' ? '#b91c1c' : '#6b7280';
}

document.addEventListener('DOMContentLoaded', () => {
  cookieHandler.onEditCookie = (cookie) => {
    editingCookie = cookie;
    editingOriginalName = cookie.name || null;
    document.getElementById('cookieNameInput').value = cookie.name || '';
    document.getElementById('cookieValueInput').value = cookie.value || '';
    document.getElementById('cookiePathInput').value = cookie.path || '/';
    document.getElementById('cookieSecureInput').checked = Boolean(cookie.secure);
    setEditMode(true, cookie.name || '');
    document.querySelector('[data-tab="createTab"]').click();
  };

  cookieHandler.showCookiesForTab();
  cookieHandler.onCookieDeleted = (cookie, success) => {
    if (success) {
      setActionStatus(`Deleted cookie: ${cookie.name}`);
    } else {
      setActionStatus(`Failed to delete cookie: ${cookie.name}`, 'error');
    }
  };
  loadRemovalStats();
  loadSuppliers();

  bindTabs();

  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      cookieHandler.searchCookies(e.target.value);
    }, 300);
  });

  document.getElementById('refreshCookies').addEventListener('click', () => {
    cookieHandler.showCookiesForTab();
    loadRemovalStats();
  });

  document.getElementById('toggleWhitelist').addEventListener('click', async () => {
    const url = await cookieHandler.getCurrentUrl();
    const hostname = new URL(url).hostname;
    await cookieHandler.toggleWhitelist(hostname);
    location.reload();
  });

  document.getElementById('createCookieBtn').addEventListener('click', createCookieFromForm);
  document.getElementById('cancelEditBtn').addEventListener('click', () => {
    editingCookie = null;
    editingOriginalName = null;
    clearCookieForm();
    setEditMode(false);
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
        loadRemovalStats();
      };
      reader.readAsText(file);
    };
    input.click();
  });

  document.getElementById('addSupplier').addEventListener('click', addSupplier);
  document.getElementById('newSupplier').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSupplier();
  });

  document.getElementById('resetDefault').addEventListener('click', () => {
    if (confirm('Reset to default supplier list?')) {
      chrome.storage.local.set({ approved_cookie_supplier: defaultSuppliers }, () => {
        loadSuppliers();
      });
    }
  });
});

function bindTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabContents.forEach((content) => content.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

function setEditMode(isEditing, cookieName = '') {
  const banner = document.getElementById('editModeBanner');
  const cancelBtn = document.getElementById('cancelEditBtn');
  const createBtn = document.getElementById('createCookieBtn');
  if (!banner || !cancelBtn || !createBtn) return;

  banner.style.display = isEditing ? 'block' : 'none';
  banner.textContent = isEditing ? `Editing cookie: ${cookieName}` : '';
  cancelBtn.style.display = isEditing ? 'inline-block' : 'none';
  createBtn.textContent = isEditing ? 'Save Cookie' : 'Create Cookie';
}

function clearCookieForm() {
  document.getElementById('cookieNameInput').value = '';
  document.getElementById('cookieValueInput').value = '';
  document.getElementById('cookiePathInput').value = '/';
  document.getElementById('cookieSecureInput').checked = false;
}

async function createCookieFromForm() {
  const currentUrl = await cookieHandler.getCurrentUrl();
  const defaultDomain = new URL(currentUrl).hostname;
  const targetDomain = editingCookie?.domain?.replace(/^\./, '') || defaultDomain;
  const targetUrl = `http${document.getElementById('cookieSecureInput').checked ? 's' : ''}://${targetDomain}${document.getElementById('cookiePathInput').value || '/'}`;

  const name = document.getElementById('cookieNameInput').value.trim();
  const value = document.getElementById('cookieValueInput').value;
  const path = document.getElementById('cookiePathInput').value || '/';
  const secure = document.getElementById('cookieSecureInput').checked;

  if (!name) {
    alert('Cookie name is required.');
    return;
  }

  if (!path.startsWith('/')) {
    alert('Cookie path must start with /.');
    return;
  }

  try {
    await cookieHandler.saveCookie({
      url: targetUrl,
      name,
      value,
      domain: targetDomain,
      path,
      secure
    });

    if (editingCookie && editingOriginalName && editingOriginalName !== name) {
      await cookieHandler.removeCookie({
        ...editingCookie,
        name: editingOriginalName
      });
    }
    setActionStatus(`Saved cookie: ${name}`);
  } catch (error) {
    setActionStatus(`Failed to save cookie: ${error.message}`, 'error');
    return;
  }

  clearCookieForm();
  editingCookie = null;
  editingOriginalName = null;
  setEditMode(false);

  cookieHandler.showCookiesForTab();
  loadRemovalStats();
}

function loadSuppliers() {
  chrome.storage.local.get(['approved_cookie_supplier'], (result) => {
    const suppliers = result.approved_cookie_supplier || defaultSuppliers;
    renderSuppliers(suppliers);
  });
}

function renderSuppliers(suppliers) {
  const list = document.getElementById('supplierList');
  list.innerHTML = '';

  suppliers.forEach((supplier, index) => {
    const div = document.createElement('div');
    div.className = 'supplier-item';

    const text = document.createElement('span');
    text.className = 'supplier-text';
    text.textContent = supplier;

    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.dataset.index = String(index);
    remove.textContent = 'Remove';

    div.appendChild(text);
    div.appendChild(remove);
    list.appendChild(div);
  });

  document.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index, 10);
      removeSupplier(index);
    });
  });
}

function addSupplier() {
  const input = document.getElementById('newSupplier');
  const newSupplier = input.value.trim();

  const feedbackEl = document.getElementById('supplierFeedback');
  if (!newSupplier) {
    feedbackEl.textContent = 'Please enter a supplier domain pattern.';
    return;
  }

  if (!/^(\*|(\*\.)?[a-z0-9.-]+|[a-z0-9.-]+\.\*)$/i.test(newSupplier)) {
    feedbackEl.textContent = 'Invalid supplier format. Example: *.example.com';
    return;
  }

  chrome.storage.local.get(['approved_cookie_supplier'], (result) => {
    const suppliers = result.approved_cookie_supplier || [];
    if (!suppliers.includes(newSupplier)) {
      suppliers.push(newSupplier);
      chrome.storage.local.set({ approved_cookie_supplier: suppliers }, () => {
        input.value = '';
        feedbackEl.textContent = 'Supplier added.';
        loadSuppliers();
      });
      return;
    }

    feedbackEl.textContent = 'Supplier already exists.';
  });
}

function removeSupplier(index) {
  chrome.storage.local.get(['approved_cookie_supplier'], (result) => {
    const suppliers = result.approved_cookie_supplier || [];
    suppliers.splice(index, 1);
    chrome.storage.local.set({ approved_cookie_supplier: suppliers }, () => {
      loadSuppliers();
    });
  });
}
