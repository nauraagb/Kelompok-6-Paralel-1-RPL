-- =============================================================
-- Sistem Informasi Perpustakaan SMA Pesat Bogor
-- Schema PostgreSQL — v2
-- =============================================================

CREATE DATABASE IF NOT EXISTS perpustakaan_sma;
\c perpustakaan_sma;

-- -------------------------------------------------------------
-- USERS (admin)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(100)  UNIQUE NOT NULL,
  password   VARCHAR(255)  NOT NULL,
  nama       VARCHAR(200)  NOT NULL,
  created_at TIMESTAMPTZ   DEFAULT NOW()
);

-- -------------------------------------------------------------
-- PEMINJAM
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS peminjam (
  id           SERIAL PRIMARY KEY,
  nomor_induk  VARCHAR(50)   UNIQUE NOT NULL,
  password     VARCHAR(255)  NOT NULL,
  nama         VARCHAR(200)  NOT NULL,
  tipe         VARCHAR(10)   NOT NULL CHECK (tipe IN ('siswa','guru')),
  kelas        VARCHAR(50),
  email        VARCHAR(150)  CHECK (
                 email IS NULL
                 OR email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
               ),
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- -------------------------------------------------------------
-- BUKU
-- cover disertakan langsung di CREATE TABLE (bukan ALTER TABLE)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buku (
  id            SERIAL PRIMARY KEY,
  judul         VARCHAR(300)  NOT NULL,
  pengarang     VARCHAR(200),
  penerbit      VARCHAR(200),
  tahun_terbit  INTEGER       CHECK (tahun_terbit BETWEEN 1000 AND 9999),
  isbn          VARCHAR(50),
  kategori      VARCHAR(100),
  jumlah_stok   INTEGER       NOT NULL DEFAULT 1 CHECK (jumlah_stok  >= 0),
  stok_tersedia INTEGER       NOT NULL DEFAULT 1 CHECK (stok_tersedia >= 0),
  cover         TEXT,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),

  CONSTRAINT check_stok_valid
    CHECK (stok_tersedia <= jumlah_stok)
);

-- ISBN unique hanya jika diisi (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS unique_isbn
  ON buku (isbn)
  WHERE isbn IS NOT NULL AND isbn <> '';

-- -------------------------------------------------------------
-- TRANSAKSI PEMINJAMAN
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transaksi_peminjaman (
  id                  SERIAL PRIMARY KEY,
  peminjam_id         INTEGER       NOT NULL REFERENCES peminjam(id) ON DELETE RESTRICT,
  buku_id             INTEGER       NOT NULL REFERENCES buku(id)     ON DELETE RESTRICT,
  tgl_pengajuan       DATE          NOT NULL DEFAULT CURRENT_DATE,
  tgl_pinjam          DATE,
  tgl_kembali_rencana DATE,
  tgl_kembali_aktual  DATE,
  status              VARCHAR(20)   NOT NULL DEFAULT 'menunggu'
                        CHECK (status IN ('menunggu','dipinjam','selesai','ditolak','dibatalkan')),
  catatan             TEXT,
  admin_id            INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  qr_token            VARCHAR(255)  UNIQUE,
  qr_expired_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   DEFAULT NOW(),

  -- tanggal kembali tidak boleh lebih awal dari tanggal pinjam
  CONSTRAINT check_tanggal_valid
    CHECK (
      tgl_kembali_rencana IS NULL
      OR tgl_pinjam IS NULL
      OR tgl_kembali_rencana >= tgl_pinjam
    )
);

-- Satu peminjam tidak boleh punya dua transaksi aktif untuk buku yang sama
-- (partial unique index — hanya berlaku untuk status aktif)
CREATE UNIQUE INDEX IF NOT EXISTS unique_pinjam_aktif
  ON transaksi_peminjaman (peminjam_id, buku_id)
  WHERE status IN ('menunggu', 'dipinjam');

-- -------------------------------------------------------------
-- ANTRIAN
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antrian (
  id            SERIAL PRIMARY KEY,
  peminjam_id   INTEGER      NOT NULL REFERENCES peminjam(id) ON DELETE RESTRICT,
  buku_id       INTEGER      NOT NULL REFERENCES buku(id)     ON DELETE RESTRICT,
  tgl_daftar    DATE         NOT NULL DEFAULT CURRENT_DATE,
  nomor_antrian INTEGER      NOT NULL CHECK (nomor_antrian > 0),
  status        VARCHAR(20)  NOT NULL DEFAULT 'menunggu'
                  CHECK (status IN ('menunggu','diproses','dibatalkan')),
  qr_token      VARCHAR(255) UNIQUE,
  qr_expired_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Satu peminjam hanya boleh punya satu antrian aktif per buku
CREATE UNIQUE INDEX IF NOT EXISTS unique_antrian_aktif
  ON antrian (peminjam_id, buku_id)
  WHERE status = 'menunggu';

-- nomor antrian unik per buku (tidak boleh dua orang punya nomor sama di buku yang sama)
CREATE UNIQUE INDEX IF NOT EXISTS unique_nomor_antrian_per_buku
  ON antrian (buku_id, nomor_antrian)
  WHERE status = 'menunggu';

-- -------------------------------------------------------------
-- INDEX (query performance)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transaksi_status    ON transaksi_peminjaman (status);
CREATE INDEX IF NOT EXISTS idx_transaksi_peminjam  ON transaksi_peminjaman (peminjam_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_buku      ON transaksi_peminjaman (buku_id);
CREATE INDEX IF NOT EXISTS idx_antrian_buku        ON antrian (buku_id);
CREATE INDEX IF NOT EXISTS idx_antrian_peminjam    ON antrian (peminjam_id);
CREATE INDEX IF NOT EXISTS idx_buku_kategori       ON buku (kategori);
CREATE INDEX IF NOT EXISTS idx_buku_judul          ON buku USING gin (to_tsvector('indonesian', judul));

-- -------------------------------------------------------------
-- DEFAULT ADMIN
-- password: password
-- GANTI HASH INI SEBELUM DEPLOY KE PRODUCTION
-- -------------------------------------------------------------
INSERT INTO users (username, password, nama)
VALUES (
  'admin',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Admin Perpustakaan'
)
ON CONFLICT (username) DO NOTHING;