# Sistem Informasi Perpustakaan SMA Pesat Bogor

Aplikasi web manajemen perpustakaan dengan integrasi Project Gutenberg API untuk e-book.

## Stack
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Frontend**: HTML/CSS/JS Vanilla
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **PDF**: PDFKit
- **E-Book API**: Project Gutenberg

## Struktur Project
```
perpustakaan-sma/
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── middleware/auth.js
│   └── routes/
│       ├── auth.js
│       ├── buku.js
│       ├── peminjam.js
│       ├── peminjaman.js
│       ├── antrian.js
│       ├── laporan.js
│       └── ebook.js
├── frontend/
│   ├── login.html
│   ├── assets/css/style.css
│   ├── assets/js/api.js
│   ├── assets/js/sidebar.js
│   └── admin/
│       ├── dashboard.html
│       ├── buku.html
│       ├── peminjam.html
│       ├── peminjaman.html
│       ├── pengembalian.html
│       ├── antrian.html
│       ├── laporan.html
│       └── ebook.html
├── database/schema.sql
├── package.json
└── .env.example
```

## Cara Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Setup PostgreSQL
Pastikan PostgreSQL berjalan, lalu buat database dan jalankan schema:
```bash
psql -U postgres -f database/schema.sql
```
Atau buat database manual:
```sql
CREATE DATABASE perpustakaan_sma;
\c perpustakaan_sma
-- lalu paste isi schema.sql
```

### 3. Konfigurasi environment
```bash
cp .env.example .env
```
Edit `.env` sesuai konfigurasi PostgreSQL kamu:
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=perpustakaan_sma
DB_USER=postgres
DB_PASSWORD=passwordkamu
JWT_SECRET=secret_panjang_dan_aman_minimal_32_karakter
JWT_EXPIRES_IN=8h
```

### 4. Jalankan server
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

### 5. Akses aplikasi
Buka browser: **http://localhost:3000**

**Login default:**
- Username: `admin`
- Password: `password`


## Fitur Admin

| Halaman | Fitur |
|---------|-------|
| Dashboard | Statistik ringkasan + transaksi terbaru |
| Kelola Buku | CRUD buku fisik + import CSV |
| Data Peminjam | CRUD siswa & guru + import CSV |
| Peminjaman | Buat pengajuan, setujui, tolak |
| Pengembalian | Proses pengembalian + deteksi keterlambatan |
| Antrian | Kelola antrian buku habis stok |
| Laporan | Laporan periode + **download PDF** |
| E-Book | Cari & unduh e-book dari Project Gutenberg |

## Format CSV Import Buku
```
judul,pengarang,penerbit,tahun_terbit,isbn,kategori,jumlah_stok
Matematika Kelas X,Budi Santoso,Erlangga,2023,978-xxx,Matematika,3
Fisika Dasar,Ahmad Yani,Grafindo,2022,,Fisika,2
```

## Format CSV Import Peminjam
```
nomor_induk,nama,tipe,kelas,email
12345,Budi Raharjo,siswa,XI IPA 1,budi@sekolah.id
67890,Siti Aminah,guru,,siti@sekolah.id
```

## API Endpoints

### Auth
- `POST /api/auth/login` — login
- `GET /api/auth/me` — data user saat ini
- `PUT /api/auth/password` — ganti password

### Buku
- `GET /api/buku` — list buku (query: q, kategori, page, limit)
- `POST /api/buku` — tambah buku
- `PUT /api/buku/:id` — edit buku
- `DELETE /api/buku/:id` — hapus buku
- `POST /api/buku/import` — import CSV

### Peminjaman
- `GET /api/peminjaman` — list transaksi (query: status, q, page)
- `POST /api/peminjaman` — buat pengajuan
- `PUT /api/peminjaman/:id/setujui` — setujui
- `PUT /api/peminjaman/:id/tolak` — tolak
- `PUT /api/peminjaman/:id/kembalikan` — proses pengembalian

### Laporan
- `GET /api/laporan?dari=&sampai=` — data laporan JSON
- `GET /api/laporan/pdf?dari=&sampai=` — download PDF
- `GET /api/laporan/dashboard` — statistik dashboard

### E-Book (Gutenberg)
- `GET /api/ebook/search?q=&lang=&page=` — cari e-book
- `GET /api/ebook/:id` — detail e-book
