const MENU = [
  { page: 'dashboard',    href: '/admin/dashboard.html',    icon: iconDashboard,    label: 'Dashboard' },
  { page: 'buku',         href: '/admin/buku.html',         icon: iconBook,         label: 'Kelola Buku' },
  { page: 'peminjam',     href: '/admin/peminjam.html',     icon: iconUsers,        label: 'Data Peminjam' },
  { page: 'peminjaman',   href: '/admin/peminjaman.html',   icon: iconClipboard,    label: 'Peminjaman' },
  { page: 'pengembalian', href: '/admin/pengembalian.html', icon: iconReturn,       label: 'Pengembalian' },
  { page: 'antrian',      href: '/admin/antrian.html',      icon: iconList,         label: 'Antrian' },
  { page: 'laporan',      href: '/admin/laporan.html',      icon: iconChart,        label: 'Laporan' },
  { page: 'ebook',        href: '/admin/ebook.html',        icon: iconEbook,        label: 'E-Book' },
];

/* ── Icon set: Heroicons Outline (24px, stroke-width 1.75) ── */
function iconDashboard() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
  </svg>`;
}

function toggleSidebar() {
  document
    .getElementById('sidebar')
    .classList.toggle('open');

  document
    .getElementById('sidebar-overlay')
    .classList.toggle('show');

  document.body.classList.toggle('sidebar-open');
}

function closeSidebar() {
  document
    .getElementById('sidebar')
    .classList.remove('open');

  document
    .getElementById('sidebar-overlay')
    .classList.remove('show');

  document.body.classList.remove('sidebar-open');
}


function iconBook() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    <line x1="10" y1="7" x2="16" y2="7"/>
    <line x1="10" y1="11" x2="14" y2="11"/>
  </svg>`;
}
function iconUsers() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>`;
}
function iconClipboard() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1"/>
    <line x1="9" y1="12" x2="15" y2="12"/>
    <line x1="9" y1="16" x2="13" y2="16"/>
  </svg>`;
}
function iconReturn() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
  </svg>`;
}
function iconList() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <line x1="9" y1="6"  x2="20" y2="6"/>
    <line x1="9" y1="12" x2="20" y2="12"/>
    <line x1="9" y1="18" x2="20" y2="18"/>
    <circle cx="4" cy="6"  r="1" fill="currentColor" stroke="none"/>
    <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/>
    <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/>
  </svg>`;
}
function iconChart() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="12" width="4" height="9" rx="1"/>
    <rect x="10" y="6" width="4" height="15" rx="1"/>
    <rect x="18" y="2" width="4" height="19" rx="1"/>
  </svg>`;
}
function iconEbook() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <path d="M12 4v16M8 8h2M8 12h2"/>
  </svg>`;
}
function iconLogout() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>`;
}

function initSidebar(activePage) {
  if (!API.requireAuth()) return;
  const user = API.getUser();

  const nav = MENU.map(m => `
    <a href="${m.href}" class="nav-item ${m.page === activePage ? 'active' : ''}">
      ${m.icon()}
      <span>${m.label}</span>
    </a>`).join('');

  const initial = (user?.nama || 'A').charAt(0).toUpperCase();

  document.getElementById('sidebar').innerHTML = `
      <div class="sidebar-header">
        <img src="/assets/js/logo-sma-pesat.png" alt="SMA PESAT" class="sidebar-logo-img">
        <span class="sidebar-brand-tagline">Sistem Perpustakaan</span>
      </div>
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">Menu</div>
        ${nav}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-user-avatar">${initial}</div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${user?.nama || 'Admin'}</div>
            <div class="sidebar-user-role">Administrator</div>
          </div>
        </div>
        <button class="btn-logout" onclick="doLogout()">
          ${iconLogout()}
          Keluar
        </button>
      </div>`;
}

function doLogout() {
  if (confirmDialog('Yakin ingin keluar?')) {
    API.removeToken();
    window.location.href = '/admin/login.html';
  }
}