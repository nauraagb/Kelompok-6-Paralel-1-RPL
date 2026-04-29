const MENU = [
  { page: 'dashboard',    href: '/admin/dashboard.html',    icon: iconDashboard,    label: 'Dashboard' },
  { page: 'buku',         href: '/admin/buku.html',         icon: iconBook,         label: 'Kelola Buku' },
  { page: 'peminjam',     href: '/admin/peminjam.html',     icon: iconUsers,        label: 'Data Peminjam' },
  { page: 'peminjaman',   href: '/admin/peminjaman.html',   icon: iconClipboard,    label: 'Peminjaman' },
  { page: 'pengembalian', href: '/admin/pengembalian.html', icon: iconReturn,       label: 'Pengembalian' },
  { page: 'antrian',      href: '/admin/antrian.html',      icon: iconList,         label: 'Antrian' },
  { page: 'laporan',      href: '/admin/laporan.html',      icon: iconChart,        label: 'Laporan' },
  { page: 'ebook',        href: '/admin/ebook.html',        icon: iconEbook,        label: 'E-Book Gutenberg' },
];

function iconDashboard() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`; }
function iconBook()      { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`; }
function iconUsers()     { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`; }
function iconClipboard() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`; }
function iconReturn()    { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>`; }
function iconList()      { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`; }
function iconChart()     { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`; }
function iconEbook()     { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`; }

function initSidebar(activePage) {
  if (!API.requireAuth()) return;
  const user = API.getUser();
  const nav  = MENU.map(m => `
    <a href="${m.href}" class="nav-item ${m.page === activePage ? 'active' : ''}">
      ${m.icon()}
      <span>${m.label}</span>
    </a>`).join('');

  document.getElementById('sidebar').innerHTML = `
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">📚</div>
        <div>
          <div class="sidebar-name">Perpustakaan</div>
          <div class="sidebar-sub">SMA Pesat Bogor</div>
        </div>
      </div>
      <nav class="sidebar-nav">${nav}</nav>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-user-name">${user?.nama || 'Admin'}</div>
          <div class="sidebar-user-role">Administrator</div>
        </div>
        <button class="btn-logout" onclick="doLogout()">Keluar</button>
      </div>
    </div>`;
}

function doLogout() {
  if (confirmDialog('Yakin ingin keluar?')) {
    API.removeToken();
    window.location.href = '/login.html';
  }
}
