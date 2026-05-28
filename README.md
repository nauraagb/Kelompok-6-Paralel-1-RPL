# Sistem Informasi Perpustakaan SMA Pesat Bogor

Aplikasi web manajemen perpustakaan berbasis Node.js + Express + PostgreSQL dengan integrasi Project Gutenberg API untuk e-book.

## Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Frontend Admin | HTML/CSS/JS Vanilla (tema putih-oranye) |
| Frontend Peminjam | EJS (server-side rendering) |
| Auth Admin | JWT via `localStorage` |
| Auth Peminjam | JWT via `httpOnly cookie` |
| PDF | PDFKit |
| E-Book API | Project Gutenberg (gutendex.com) |

## Struktur Project

```
perpustakaan-sma/
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── middleware/
│   │   └── auth.js
│   └── routes/
│       ├── auth.js          – login & ganti password admin
│       ├── buku.js          – CRUD buku + import CSV
│       ├── peminjam.js      – CRUD peminjam + EJS routes
│       ├── peminjaman.js    – transaksi (setujui/tolak/kembalikan)
│       ├── antrian.js       – kelola antrian buku
│       ├── laporan.js       – ekspor laporan PDF
│       └── ebook.js         – integrasi Gutenberg API
├── frontend/
│   ├── assets/
│   │   ├── css/
│   │   └── js/
│   │       ├── api.js
│   │       └── sidebar.js
│   ├── admin/
│   │   ├── dashboard.html
│   │   ├── buku.html
│   │   ├── peminjam.html
│   │   ├── peminjaman.html
│   │   ├── pengembalian.html
│   │   ├── antrian.html
│   │   ├── laporan.html
│   │   └── ebook.html
│   └── peminjam/
│       ├── ebook.html
│       └── formPeminjaman.html
├── views/
│   └── peminjam/            – EJS templates (dashboard, katalog, dll)
├── database/
│   └── schema.sql
├── package.json
├── .env.example
└── .env                     – JANGAN di-commit ke Git
```

## Cara Setup

### 1. Clone & install dependencies

```bash
git clone https://github.com/nauraagb/Kelompok-6-Paralel-1-RPL.git
cd Kelompok-6-Paralel-1-RPL
npm install
```

### 2. Setup environment

```bash
cp .env.example .env
```

Edit `.env` sesuai konfigurasi PostgreSQL kamu:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=perpustakaan_sma
DB_USER=postgres
DB_PASSWORD=password_kamu
JWT_SECRET=isi_dengan_string_random_minimal_32_karakter
JWT_EXPIRES_IN=8h
```

Generate JWT secret yang aman:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Setup database

Buat database dan jalankan schema:

```bash
psql -U postgres -c "CREATE DATABASE perpustakaan_sma;"
psql -U postgres -d perpustakaan_sma -f database/schema.sql
```

Atau lewat DBeaver / pgAdmin: buat database `perpustakaan_sma`, lalu jalankan isi `schema.sql`.

### 4. Jalankan server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

### 5. Akses aplikasi

| Halaman | URL |
|---------|-----|
| Login Admin | http://localhost:3000/admin/login |
| Login Peminjam | http://localhost:3000/peminjam/login.html |

**Login default admin:**
- Username: `admin`
- Password: `admin123`

> ⚠️ Segera ganti password setelah login pertama!

---

## Fitur

### Admin

| Halaman | Fitur |
|---------|-------|
| Dashboard | Statistik ringkasan + transaksi terbaru |
| Kelola Buku | CRUD buku + upload cover + import CSV |
| Data Peminjam | CRUD siswa & guru + import CSV |
| Peminjaman | Buat pengajuan, setujui, tolak |
| Pengembalian | Proses pengembalian + deteksi keterlambatan |
| Antrian | Kelola antrian buku habis stok |
| Laporan | Laporan periode + download PDF |
| E-Book | Cari & unduh e-book dari Project Gutenberg |

### Peminjam (Siswa/Guru)

| Halaman | Fitur |
|---------|-------|
| Dashboard | Ringkasan peminjaman aktif |
| Katalog | Cari & lihat detail buku |
| Ajukan Pinjam | Form pengajuan + QR Code tiket |
| Antrian | Daftar antrian buku habis stok |
| Riwayat | Riwayat semua peminjaman |
| Akun | Lihat profil |
| E-Book | Baca & unduh e-book gratis |

---

## Format CSV Import

### Import Buku

```csv
judul,pengarang,penerbit,tahun_terbit,isbn,kategori,jumlah_stok
Matematika Wajib Kelas X,Sukino,Erlangga,2022,978-602-298-101-1,Matematika,3
Fisika Untuk SMA Kelas X,Marthen Kanginan,Erlangga,2021,,Fisika,2
```

> Kolom wajib: `judul`, `jumlah_stok`. Kolom lain boleh dikosongkan.

### Import Peminjam

```csv
nomor_induk,nama,password,tipe,kelas,email
202300001,Andi Firmansyah,andi001,siswa,X-IPA-1,andi001@siswa.smapesat.sch.id
GTK00001,Ahmad Fauzi,ahmad001,guru,,ahmad001@guru.smapesat.sch.id
```

> Kolom wajib: `nomor_induk`, `nama`, `password`, `tipe`.  
> `password` diisi plaintext — akan otomatis di-hash oleh sistem.  
> `tipe` hanya boleh: `siswa` atau `guru`.  
> `kelas` boleh kosong untuk guru.

---

## API Endpoints

### Auth Admin
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/api/auth/login` | Login admin |
| GET | `/api/auth/me` | Data admin saat ini |
| PUT | `/api/auth/password` | Ganti password |

### Buku
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/buku` | List buku (query: `q`, `kategori`, `page`, `limit`) |
| GET | `/api/buku/:id` | Detail buku |
| GET | `/api/buku/kategori` | Daftar kategori |
| POST | `/api/buku` | Tambah buku |
| PUT | `/api/buku/:id` | Edit buku |
| DELETE | `/api/buku/:id` | Hapus buku |
| POST | `/api/buku/import` | Import CSV |

### Peminjaman
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/peminjaman` | List transaksi (query: `status`, `q`, `page`) |
| GET | `/api/peminjaman/:id` | Detail transaksi |
| POST | `/api/peminjaman` | Buat pengajuan |
| PUT | `/api/peminjaman/:id/setujui` | Setujui peminjaman |
| PUT | `/api/peminjaman/:id/tolak` | Tolak peminjaman |
| PUT | `/api/peminjaman/:id/kembalikan` | Proses pengembalian |

### Peminjam (EJS Routes)
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/api/peminjam/login` | Login peminjam |
| GET | `/api/peminjam/logout` | Logout |
| GET | `/api/peminjam/me` | Data peminjam saat ini (JSON) |
| GET | `/api/peminjam/dashboard` | Halaman dashboard |
| GET | `/api/peminjam/katalog` | Halaman katalog |
| GET | `/api/peminjam/detail/:id` | Detail buku |
| POST | `/api/peminjam/ajukanPinjaman` | Ajukan peminjaman |
| GET | `/api/peminjam/riwayat` | Riwayat peminjaman |
| GET | `/api/peminjam/antrianSaya` | Daftar antrian |
| POST | `/api/peminjam/antri/:id` | Daftar antrian buku |
| GET | `/api/peminjam/akun` | Halaman akun |

### Laporan
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/laporan` | Data laporan JSON (query: `dari`, `sampai`) |
| GET | `/api/laporan/pdf` | Download PDF (query: `dari`, `sampai`) |
| GET | `/api/laporan/dashboard` | Statistik dashboard |

### E-Book
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/ebook/search` | Cari e-book (query: `q`, `lang`, `page`) |
| GET | `/api/ebook/:id` | Detail e-book |

---


```bash
npm install express-rate-limit helmet
```