const defaultSuppliers = [
  '*.github.com',
  '*.gmail.com',
  '*.x.com',
  '*.chatgpt.com',
  '*.mksmad.org'
];

document.addEventListener('DOMContentLoaded', () => {
  loadSuppliers();

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
    div.innerHTML = `
      <span class="supplier-text">${supplier}</span>
      <button class="remove-btn" data-index="${index}">Remove</button>
    `;
    list.appendChild(div);
  });

  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      removeSupplier(index);
    });
  });
}

function addSupplier() {
  const input = document.getElementById('newSupplier');
  const newSupplier = input.value.trim();

  if (!newSupplier) return;

  chrome.storage.local.get(['approved_cookie_supplier'], (result) => {
    const suppliers = result.approved_cookie_supplier || [];
    if (!suppliers.includes(newSupplier)) {
      suppliers.push(newSupplier);
      chrome.storage.local.set({ approved_cookie_supplier: suppliers }, () => {
        input.value = '';
        loadSuppliers();
      });
    }
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
