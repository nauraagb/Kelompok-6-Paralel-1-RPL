const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse');
const db   = require('../db');
const auth = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', auth, async (req, res) => {
  const { q, tipe, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1'; const params = [];
  if (q)    { params.push(`%${q}%`); where += ` AND (nama ILIKE $${params.length} OR nomor_induk ILIKE $${params.length})`; }
  if (tipe) { params.push(tipe);     where += ` AND tipe=$${params.length}`; }
  try {
    const countRes = await db.query(`SELECT COUNT(*) FROM peminjam ${where}`, params);
    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT * FROM peminjam ${where} ORDER BY nama ASC LIMIT $${params.length-1} OFFSET $${params.length}`, params
    );
    res.json({ data: rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM peminjam WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Peminjam tidak ditemukan' });
  res.json(rows[0]);
});

router.post('/', auth, async (req, res) => {
  const { nomor_induk, nama, tipe, kelas, email } = req.body;
  if (!nomor_induk || !nama || !tipe)
    return res.status(400).json({ message: 'Nomor induk, nama, dan tipe wajib diisi' });
  try {
    const { rows } = await db.query(
      'INSERT INTO peminjam (nomor_induk,nama,tipe,kelas,email) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [nomor_induk, nama, tipe, kelas||null, email||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Nomor induk sudah terdaftar' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { nomor_induk, nama, tipe, kelas, email } = req.body;
  try {
    const old = await db.query('SELECT * FROM peminjam WHERE id=$1', [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ message: 'Peminjam tidak ditemukan' });
    const p = old.rows[0];
    const { rows } = await db.query(
      'UPDATE peminjam SET nomor_induk=$1,nama=$2,tipe=$3,kelas=$4,email=$5 WHERE id=$6 RETURNING *',
      [nomor_induk||p.nomor_induk, nama||p.nama, tipe||p.tipe, kelas??p.kelas, email??p.email, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Nomor induk sudah terdaftar' });
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const check = await db.query(
      "SELECT COUNT(*) FROM transaksi_peminjaman WHERE peminjam_id=$1 AND status='dipinjam'",
      [req.params.id]
    );
    if (parseInt(check.rows[0].count) > 0)
      return res.status(400).json({ message: 'Peminjam masih memiliki pinjaman aktif' });
    await db.query('DELETE FROM peminjam WHERE id=$1', [req.params.id]);
    res.json({ message: 'Peminjam berhasil dihapus' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/import', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });
  const records = [];
  const parser  = parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true, trim: true });
  parser.on('readable', () => { let r; while ((r = parser.read()) !== null) records.push(r); });
  parser.on('error',  (e) => res.status(400).json({ message: e.message }));
  parser.on('end', async () => {
    let ok = 0, skip = 0;
    for (const r of records) {
      if (!r.nomor_induk || !r.nama || !r.tipe) { skip++; continue; }
      try {
        await db.query(
          'INSERT INTO peminjam (nomor_induk,nama,tipe,kelas,email) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
          [r.nomor_induk, r.nama, r.tipe, r.kelas||null, r.email||null]
        );
        ok++;
      } catch { skip++; }
    }
    res.json({ message: `${ok} berhasil, ${skip} dilewati`, inserted: ok, skipped: skip });
  });
});

module.exports = router;
