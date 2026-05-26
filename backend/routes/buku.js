const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse');
const db   = require('../db');
const auth = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
// const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const uploadDir = path.join(process.cwd(), 'frontend/uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// GET /api/buku  – list + search
router.get('/', auth, async (req, res) => {
  const { q, kategori, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params = [];
  if (q) { params.push(`%${q}%`); where += ` AND (b.judul ILIKE $${params.length} OR b.pengarang ILIKE $${params.length})`; }
  if (kategori) { params.push(kategori); where += ` AND b.kategori=$${params.length}`; }
  try {
    const countRes = await db.query(`SELECT COUNT(*) FROM buku b ${where}`, params);
    const total = parseInt(countRes.rows[0].count);
    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT * FROM buku b ${where} ORDER BY b.judul ASC LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/buku/kategori – daftar kategori unik
router.get('/kategori', auth, async (req, res) => {
  const { rows } = await db.query("SELECT DISTINCT kategori FROM buku WHERE kategori IS NOT NULL ORDER BY kategori");
  res.json(rows.map(r => r.kategori));
});

// GET /api/buku/:id
router.get('/:id', auth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM buku WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Buku tidak ditemukan' });
  res.json(rows[0]);
});

// POST /api/buku
router.post('/', auth, upload.single('cover'), async (req, res) => {
   const {
    judul,
    pengarang,
    penerbit,
    tahun_terbit,
    isbn,
    kategori,
    jumlah_stok
  } = req.body;

  if (!judul)
    return res.status(400).json({ message: 'Judul wajib diisi' });

  const stok = parseInt(jumlah_stok) || 1;

  const cover = req.file
    ? `/uploads/${req.file.filename}`
    : null;

  try {
    const { rows } = await db.query(
      `INSERT INTO buku
      (judul,pengarang,penerbit,tahun_terbit,isbn,kategori,jumlah_stok,stok_tersedia,cover)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8)
      RETURNING *`,
      [
        judul,
        pengarang || null,
        penerbit || null,
        tahun_terbit || null,
        isbn || null,
        kategori || null,
        stok,
        cover
      ]
    );

    res.status(201).json(rows[0]);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/buku/:id
router.put('/:id', auth, upload.single('cover'), async (req, res) => {
  const { judul, pengarang, penerbit, tahun_terbit, isbn, kategori, jumlah_stok } = req.body;
  try {
    const old = await db.query('SELECT * FROM buku WHERE id=$1', [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ message: 'Buku tidak ditemukan' });
    const b = old.rows[0];
    const stokBaru = parseInt(jumlah_stok) || b.jumlah_stok;
    const diff = stokBaru - b.jumlah_stok;
    const dipinjam = b.jumlah_stok - b.stok_tersedia;
    if (stokBaru < dipinjam) {
      return res.status(400).json({
        message:
          'Stok baru lebih kecil dari jumlah buku yang sedang dipinjam'
      });
    }

    const tersedia = stokBaru - dipinjam;
    let cover = b.cover;
    if (req.file) {
      cover = `/uploads/${req.file.filename}`;
    }
    const { rows } = await db.query(
      `UPDATE buku SET judul=$1,pengarang=$2,penerbit=$3,tahun_terbit=$4,isbn=$5,
       kategori=$6,jumlah_stok=$7,stok_tersedia=$8,cover=$9 WHERE id=$10 RETURNING *`,
      [judul||b.judul, pengarang??b.pengarang, penerbit??b.penerbit,
       tahun_terbit??b.tahun_terbit, isbn??b.isbn, kategori??b.kategori,
       stokBaru, tersedia, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/buku/:id
router.delete('/:id', auth, async (req, res) => {
  const old = await db.query(
  'SELECT * FROM buku WHERE id=$1',
  [req.params.id]
);

if (old.rows.length && old.rows[0].cover) {
      const imgPath = path.join(
        process.cwd(),
        'frontend',
        old.rows[0].cover
      );

      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }
  try {
    const check = await db.query(
      "SELECT COUNT(*) FROM transaksi_peminjaman WHERE buku_id=$1 AND status='dipinjam'",
      [req.params.id]
    );
    if (parseInt(check.rows[0].count) > 0)
      return res.status(400).json({ message: 'Buku sedang dipinjam, tidak bisa dihapus' });
    await db.query('DELETE FROM buku WHERE id=$1', [req.params.id]);
    res.json({ message: 'Buku berhasil dihapus' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/buku/import  – upload CSV
router.post('/import', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File CSV tidak ditemukan' });
  const records = [];
  const csvContent = fs.readFileSync(req.file.path, 'utf8');

  const parser = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  parser.on('readable', () => {
    let r;
    while ((r = parser.read()) !== null) records.push(r);
  });
  parser.on('error', (err) => res.status(400).json({ message: 'Format CSV tidak valid: ' + err.message }));
  parser.on('end', async () => {
    let inserted = 0, skipped = 0;
    for (const r of records) {
      if (!r.judul) { skipped++; continue; }
      const stok = parseInt(r.jumlah_stok) || 1;
      try {
        await db.query(
          `INSERT INTO buku (judul,pengarang,penerbit,tahun_terbit,isbn,kategori,jumlah_stok,stok_tersedia)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
          [r.judul, r.pengarang||null, r.penerbit||null, r.tahun_terbit||null,
           r.isbn||null, r.kategori||null, stok]
        );
        inserted++;
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch { skipped++; }
    }
    res.json({ message: `Import selesai: ${inserted} berhasil, ${skipped} dilewati`, inserted, skipped });
  });
});

module.exports = router;
