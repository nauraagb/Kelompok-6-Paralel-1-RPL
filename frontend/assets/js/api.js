const API = {
  base: '/api',

  getToken() { return localStorage.getItem('token'); },
  setToken(t) { localStorage.setItem('token', t); },
  removeToken() { localStorage.removeItem('token'); localStorage.removeItem('user'); },
  getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } },
  setUser(u) { localStorage.setItem('user', JSON.stringify(u)); },

  async fetch(endpoint, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${this.base}${endpoint}`, { ...opts, headers });
    if (res.status === 401) {
      this.removeToken();
      window.location.href = '/login.html';
      return;
    }
    return res;
  },

  async get(ep)          { return this.fetch(ep); },
  async post(ep, body)   { return this.fetch(ep, { method: 'POST',   body: JSON.stringify(body) }); },
  async put(ep, body)    { return this.fetch(ep, { method: 'PUT',    body: JSON.stringify(body) }); },
  async delete(ep)       { return this.fetch(ep, { method: 'DELETE' }); },

  async upload(ep, formData) {
    const headers = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${this.base}${ep}`, { method: 'POST', headers, body: formData });
  },

  requireAuth() {
    if (!this.getToken()) { window.location.href = '/login.html'; return false; }
    return true;
  },
};

const Toast = {
  container: null,
  init() {
    if (!document.getElementById('toast-container')) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    } else { this.container = document.getElementById('toast-container'); }
  },
  show(msg, type = 'info', duration = 3500) {
    if (!this.container) this.init();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    this.container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, duration);
  },
  success(m) { this.show(m, 'success'); },
  error(m)   { this.show(m, 'error');   },
  info(m)    { this.show(m, 'info');    },
};
Toast.init();

function statusBadge(status) {
  const map = {
    menunggu:    ['badge-yellow',  'Menunggu'],
    dipinjam:    ['badge-orange',  'Dipinjam'],
    selesai:     ['badge-green',   'Selesai'],
    ditolak:     ['badge-red',     'Ditolak'],
    dibatalkan:  ['badge-gray',    'Dibatalkan'],
    diproses:    ['badge-blue',    'Diproses'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}

function confirmDialog(msg) { return window.confirm(msg); }

function renderPagination(containerId, total, page, limit, onPageChange) {
  const el    = document.getElementById(containerId);
  if (!el) return;
  const pages = Math.ceil(total / limit);
  if (pages <= 1) { el.innerHTML = ''; return; }
  let html = `<span class="text-muted text-sm">${total} data</span>`;
  html += `<button class="page-btn" ${page<=1?'disabled':''} onclick="(${onPageChange})(${page-1})">‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && Math.abs(i - page) > 2 && i !== 1 && i !== pages) {
      if (i === 2 || i === pages - 1) html += '<span class="text-muted">…</span>';
      continue;
    }
    html += `<button class="page-btn ${i===page?'active':''}" onclick="(${onPageChange})(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" ${page>=pages?'disabled':''} onclick="(${onPageChange})(${page+1})">›</button>`;
  el.innerHTML = html;
}
