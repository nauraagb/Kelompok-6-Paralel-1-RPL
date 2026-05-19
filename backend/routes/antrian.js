const router = require('express').Router();
const db   = require('../db');
const auth = require('../middleware/auth');

const JOIN = `
  SELECT a.*, p.nama AS peminjam_nama, p.nomor_induk, b.judul AS buku_judul
  FROM antrian a
  JOIN peminjam p ON p.id=a.peminjam_id
  JOIN buku     b ON b.id=a.buku_id
`;

// GET /api/antrian
router.get('/', auth, async (req, res) => {
  const { buku_id, status = 'menunggu' } = req.query;
  let where = "WHERE a.status=$1"; const params = [status];
  if (buku_id) { params.push(buku_id); where += ` AND a.buku_id=$${params.length}`; }
  try {
    const { rows } = await db.query(`${JOIN} ${where} ORDER BY a.nomor_antrian ASC`, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/antrian  – tambah ke antrian
router.post('/', auth, async (req, res) => {
  const { peminjam_id, buku_id } = req.body;
  if (!peminjam_id || !buku_id) return res.status(400).json({ message: 'peminjam_id dan buku_id wajib' });
  try {
    // Cek duplikat
    const dup = await db.query(
      "SELECT id FROM antrian WHERE peminjam_id=$1 AND buku_id=$2 AND status='menunggu'",
      [peminjam_id, buku_id]
    );
    if (dup.rows.length) return res.status(400).json({ message: 'Peminjam sudah ada di antrian buku ini' });
    // Nomor antrian berikutnya
    const nomorResult = await db.query(`
      SELECT MIN(t1.nomor_antrian + 1) AS next
      FROM antrian t1
      WHERE t1.buku_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM antrian t2
          WHERE t2.buku_id = t1.buku_id
            AND t2.status = 'menunggu'
            AND t2.nomor_antrian = t1.nomor_antrian + 1
        )
    `, [buku_id]);

    let nextNomor = nomorResult.rows[0].next;

    if (!nextNomor) {
      nextNomor = 1;
    }
    const { rows } = await db.query(
      'INSERT INTO antrian (peminjam_id,buku_id,nomor_antrian) VALUES ($1,$2,$3) RETURNING *',
      [peminjam_id, buku_id, nextNomor]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/antrian/:id  – batalkan
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query("UPDATE antrian SET status='dibatalkan' WHERE id=$1", [req.params.id]);
    res.json({ message: 'Antrian dibatalkan' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
