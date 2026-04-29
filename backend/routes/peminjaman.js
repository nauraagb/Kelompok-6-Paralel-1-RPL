const router = require('express').Router();
const db   = require('../db');
const auth = require('../middleware/auth');

const JOIN = `
  SELECT tp.*,
         p.nama AS peminjam_nama, p.nomor_induk, p.tipe AS peminjam_tipe, p.kelas,
         b.judul AS buku_judul, b.pengarang, b.stok_tersedia
  FROM transaksi_peminjaman tp
  JOIN peminjam p ON p.id = tp.peminjam_id
  JOIN buku     b ON b.id = tp.buku_id
`;

router.get('/', auth, async (req, res) => {
  const { status, q, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1'; const params = [];
  if (status) { params.push(status); where += ` AND tp.status=$${params.length}`; }
  if (q) { params.push(`%${q}%`); where += ` AND (p.nama ILIKE $${params.length} OR b.judul ILIKE $${params.length})`; }
  try {
    const countRes = await db.query(`SELECT COUNT(*) FROM transaksi_peminjaman tp JOIN peminjam p ON p.id=tp.peminjam_id JOIN buku b ON b.id=tp.buku_id ${where}`, params);
    params.push(limit, offset);
    const { rows } = await db.query(`${JOIN} ${where} ORDER BY tp.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
    res.json({ data: rows, total: parseInt(countRes.rows[0].count), page: parseInt(page) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  const { rows } = await db.query(`${JOIN} WHERE tp.id=$1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Data tidak ditemukan' });
  res.json(rows[0]);
});

router.post('/', auth, async (req, res) => {
  const { peminjam_id, buku_id, tgl_kembali_rencana } = req.body;
  if (!peminjam_id || !buku_id || !tgl_kembali_rencana)
    return res.status(400).json({ message: 'peminjam_id, buku_id, dan tgl_kembali_rencana wajib diisi' });
  try {
    const buku = await db.query('SELECT * FROM buku WHERE id=$1', [buku_id]);
    if (!buku.rows.length) return res.status(404).json({ message: 'Buku tidak ditemukan' });
    if (buku.rows[0].stok_tersedia < 1)
      return res.status(400).json({ message: 'Stok buku habis', stok: 0 });
    const cek = await db.query(
      "SELECT id FROM transaksi_peminjaman WHERE peminjam_id=$1 AND buku_id=$2 AND status IN ('menunggu','dipinjam')",
      [peminjam_id, buku_id]
    );
    if (cek.rows.length)
      return res.status(400).json({ message: 'Peminjam sudah memiliki pinjaman atau pengajuan untuk buku ini' });

    const { rows } = await db.query(
      `INSERT INTO transaksi_peminjaman (peminjam_id,buku_id,tgl_kembali_rencana,admin_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [peminjam_id, buku_id, tgl_kembali_rencana, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/setujui', auth, async (req, res) => {
  const client = await require('../db').connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM transaksi_peminjaman WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!rows.length) throw new Error('Data tidak ditemukan');
    if (rows[0].status !== 'menunggu') throw new Error('Status bukan menunggu');
    const buku = await client.query('SELECT stok_tersedia FROM buku WHERE id=$1 FOR UPDATE', [rows[0].buku_id]);
    if (buku.rows[0].stok_tersedia < 1) throw new Error('Stok buku habis');
    await client.query('UPDATE buku SET stok_tersedia=stok_tersedia-1 WHERE id=$1', [rows[0].buku_id]);
    const updated = await client.query(
      `UPDATE transaksi_peminjaman SET status='dipinjam', tgl_pinjam=CURRENT_DATE, admin_id=$1
       WHERE id=$2 RETURNING *`, [req.user.id, req.params.id]
    );
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ message: err.message });
  } finally { client.release(); }
});

router.put('/:id/tolak', auth, async (req, res) => {
  const { catatan } = req.body;
  try {
    const { rows } = await db.query('SELECT * FROM transaksi_peminjaman WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Tidak ditemukan' });
    if (rows[0].status !== 'menunggu') return res.status(400).json({ message: 'Status bukan menunggu' });
    const updated = await db.query(
      `UPDATE transaksi_peminjaman SET status='ditolak', catatan=$1, admin_id=$2
       WHERE id=$3 RETURNING *`, [catatan||null, req.user.id, req.params.id]
    );
    res.json(updated.rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/kembalikan', auth, async (req, res) => {
  const client = await require('../db').connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM transaksi_peminjaman WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!rows.length) throw new Error('Tidak ditemukan');
    if (rows[0].status !== 'dipinjam') throw new Error('Buku belum dalam status dipinjam');
    await client.query('UPDATE buku SET stok_tersedia=stok_tersedia+1 WHERE id=$1', [rows[0].buku_id]);
    const updated = await client.query(
      `UPDATE transaksi_peminjaman SET status='selesai', tgl_kembali_aktual=CURRENT_DATE, admin_id=$1
       WHERE id=$2 RETURNING *`, [req.user.id, req.params.id]
    );
    const antrian = await client.query(
      `SELECT * FROM antrian WHERE buku_id=$1 AND status='menunggu' ORDER BY nomor_antrian ASC LIMIT 1`,
      [rows[0].buku_id]
    );
    if (antrian.rows.length) {
      await client.query(
        `INSERT INTO transaksi_peminjaman (peminjam_id,buku_id,tgl_kembali_rencana,catatan)
         VALUES ($1,$2,CURRENT_DATE+14,'Dari antrian')`,
        [antrian.rows[0].peminjam_id, rows[0].buku_id]
      );
      await client.query("UPDATE antrian SET status='diproses' WHERE id=$1", [antrian.rows[0].id]);
    }
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ message: err.message });
  } finally { client.release(); }
});

module.exports = router;
