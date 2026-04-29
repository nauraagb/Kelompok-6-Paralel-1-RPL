const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse');
const db   = require('../db');
const auth = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

router.get('/kategori', auth, async (req, res) => {
  const { rows } = await db.query("SELECT DISTINCT kategori FROM buku WHERE kategori IS NOT NULL ORDER BY kategori");
  res.json(rows.map(r => r.kategori));
});

router.get('/:id', auth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM buku WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Buku tidak ditemukan' });
  res.json(rows[0]);
});

router.post('/', auth, async (req, res) => {
  const { judul, pengarang, penerbit, tahun_terbit, isbn, kategori, jumlah_stok } = req.body;
  if (!judul) return res.status(400).json({ message: 'Judul wajib diisi' });
  const stok = parseInt(jumlah_stok) || 1;
  try {
    const { rows } = await db.query(
      `INSERT INTO buku (judul,pengarang,penerbit,tahun_terbit,isbn,kategori,jumlah_stok,stok_tersedia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
      [judul, pengarang||null, penerbit||null, tahun_terbit||null, isbn||null, kategori||null, stok]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { judul, pengarang, penerbit, tahun_terbit, isbn, kategori, jumlah_stok } = req.body;
  try {
    const old = await db.query('SELECT * FROM buku WHERE id=$1', [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ message: 'Buku tidak ditemukan' });
    const b = old.rows[0];
    const stokBaru = parseInt(jumlah_stok) || b.jumlah_stok;
    const diff = stokBaru - b.jumlah_stok;
    const tersedia = Math.max(0, b.stok_tersedia + diff);
    const { rows } = await db.query(
      `UPDATE buku SET judul=$1,pengarang=$2,penerbit=$3,tahun_terbit=$4,isbn=$5,
       kategori=$6,jumlah_stok=$7,stok_tersedia=$8 WHERE id=$9 RETURNING *`,
      [judul||b.judul, pengarang??b.pengarang, penerbit??b.penerbit,
       tahun_terbit??b.tahun_terbit, isbn??b.isbn, kategori??b.kategori,
       stokBaru, tersedia, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
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

router.post('/import', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File CSV tidak ditemukan' });
  const records = [];
  const parser  = parse(req.file.buffer.toString(), {
    columns: true, skip_empty_lines: true, trim: true
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
      } catch { skipped++; }
    }
    res.json({ message: `Import selesai: ${inserted} berhasil, ${skipped} dilewati`, inserted, skipped });
  });
});

module.exports = router;
