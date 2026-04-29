CREATE DATABASE perpustakaan_sma;
\c perpustakaan_sma;

CREATE TABLE IF NOT EXISTS users (
  id        SERIAL PRIMARY KEY,
  username  VARCHAR(100) UNIQUE NOT NULL,
  password  VARCHAR(255) NOT NULL,
  nama      VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS peminjam (
  id           SERIAL PRIMARY KEY,
  nomor_induk  VARCHAR(50) UNIQUE NOT NULL,
  nama         VARCHAR(200) NOT NULL,
  tipe         VARCHAR(10) NOT NULL CHECK (tipe IN ('siswa','guru')),
  kelas        VARCHAR(50),
  email        VARCHAR(150),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buku (
  id             SERIAL PRIMARY KEY,
  judul          VARCHAR(300) NOT NULL,
  pengarang      VARCHAR(200),
  penerbit       VARCHAR(200),
  tahun_terbit   INTEGER,
  isbn           VARCHAR(50),
  kategori       VARCHAR(100),
  jumlah_stok    INTEGER NOT NULL DEFAULT 1,
  stok_tersedia  INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaksi_peminjaman (
  id                  SERIAL PRIMARY KEY,
  peminjam_id         INTEGER NOT NULL REFERENCES peminjam(id),
  buku_id             INTEGER NOT NULL REFERENCES buku(id),
  tgl_pengajuan       DATE NOT NULL DEFAULT CURRENT_DATE,
  tgl_pinjam          DATE,
  tgl_kembali_rencana DATE,
  tgl_kembali_aktual  DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'menunggu'
                        CHECK (status IN ('menunggu','dipinjam','selesai','ditolak','dibatalkan')),
  catatan             TEXT,
  admin_id            INTEGER REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS antrian (
  id             SERIAL PRIMARY KEY,
  peminjam_id    INTEGER NOT NULL REFERENCES peminjam(id),
  buku_id        INTEGER NOT NULL REFERENCES buku(id),
  tgl_daftar     DATE NOT NULL DEFAULT CURRENT_DATE,
  nomor_antrian  INTEGER NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'menunggu'
                   CHECK (status IN ('menunggu','diproses','dibatalkan')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaksi_status ON transaksi_peminjaman(status);
CREATE INDEX IF NOT EXISTS idx_transaksi_peminjam ON transaksi_peminjaman(peminjam_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_buku ON transaksi_peminjaman(buku_id);
CREATE INDEX IF NOT EXISTS idx_antrian_buku ON antrian(buku_id);

INSERT INTO users (username, password, nama)
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin Perpustakaan')
ON CONFLICT (username) DO NOTHING;
