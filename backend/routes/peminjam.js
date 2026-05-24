const router = require('express').Router();
const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse');
const db   = require('../db');
const auth = require('../middleware/auth');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const upload = multer({ storage: multer.memoryStorage() });
const path = require('path');
const QRCode = require('qrcode');
const crypto = require('crypto');


// router.use(cookieParser());

router.use('/static', express.static('frontend'));

router.post('/login', async (req, res) => {
   const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username dan password wajib diisi' });

  try {
    const { rows } = await db.query('SELECT * FROM peminjam WHERE nomor_induk=$1', [username]);
    if (!rows.length)
      return res.status(401).json({ message: 'Username atau password salah' });

    const peminjam  = rows[0];
    const valid = await bcrypt.compare(password, peminjam.password);
    if (!valid)
      return res.status(401).json({ message: 'Username atau password salah' });

    const token = jwt.sign(
      { id: peminjam.id, username: peminjam.username, nama: peminjam.nama },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    // res.json({ token, peminjam: { id: peminjam.id, username: peminjam.username, nama: peminjam.nama } });

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({success: true});
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
    console.log(err.message);
  }
});


// GET /api/peminjam/me - return current user info (for static HTML pages like ebook.html)
router.get('/me', auth, (req, res) => {
  res.json({
    id: req.user.id,
    nama: req.user.nama,
    kelas: req.user.kelas || '',
    tipe: req.user.tipe || 'siswa'
  });
});

router.get('/logout', (req, res) => {
  res.clearCookie('token');
  console.log('PEMINJAM LOGOUT');
  res.redirect('/peminjam/login');
});

router.get('/dashboard', auth, async (req, res) => {
  const id = req.user.id;
  const namaUser = await db.query(`SELECT nama FROM peminjam WHERE id = $1`, [id]);
  const nama = namaUser.rows[0].nama;
  try{
    res.render("peminjam/dashboard", {
    user: req.user,
    nama
  });
  }catch(err){
    console.log("ERROR: ", err.message);
  }
  
});

// GET /api/peminjam
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

// GET /api/peminjam/:id
// router.get('/:id', auth, async (req, res) => {
//   const { rows } = await db.query('SELECT * FROM peminjam WHERE id=$1', [req.params.id]);
//   if (!rows.length) return res.status(404).json({ message: 'Peminjam tidak ditemukan' });
//   res.json(rows[0]);
// });

// POST /api/peminjam
router.post('/', auth, async (req, res) => {
  const { nomor_induk, nama, tipe, kelas, email, password } = req.body;
  if (!nomor_induk || !nama || !tipe || !password)
    return res.status(400).json({ message: 'Nomor induk, nama, password dan tipe wajib diisi' });
  try {
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);
    const { rows } = await db.query(
      'INSERT INTO peminjam (nomor_induk,nama,tipe,kelas,email,password) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [nomor_induk, nama, tipe, kelas||null, email||null, hashPassword]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Nomor induk sudah terdaftar' });
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/peminjam/:id
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

// DELETE /api/peminjam/:id
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

// POST /api/peminjam/import
router.post('/import', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });
  const records = [];
  const parser  = parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true, trim: true });
  parser.on('readable', () => { let r; while ((r = parser.read()) !== null) records.push(r); });
  parser.on('error',  (e) => res.status(400).json({ message: e.message }));
  parser.on('end', async () => {
    let ok = 0, skip = 0;
    for (const r of records) {
      if (!r.nomor_induk || !r.nama || !r.tipe || !r.password) { skip++; continue; }
      try {
        await db.query(
          'INSERT INTO peminjam (nomor_induk,nama,tipe,kelas,email,password) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
          [r.nomor_induk, r.nama, r.tipe, r.kelas||null, r.email||null, r.password]
        );
        ok++;
      } catch { skip++; }
    }
    res.json({ message: `${ok} berhasil, ${skip} dilewati`, inserted: ok, skipped: skip });
  });
});


router.post('/ajukanPinjaman', auth, async (req, res) => {
    const id = req.user.id;

    try {
      const { tanggalKembaliExpected, idBuku } = req.body;
      const today = new Date().toISOString().split('T')[0];
      const status = "menunggu";
      const token = crypto.randomBytes(20).toString('hex');
      const expired = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const result = await db.query(
        `INSERT INTO transaksi_peminjaman 
        (peminjam_id, buku_id, tgl_pengajuan, tgl_kembali_rencana, status, qr_token, qr_expired_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id, qr_token`,
        [id, idBuku, today, tanggalKembaliExpected, status, token, expired]
);

      const borrowed = result.rows[0];
      console.log('PEMINJAMAN DIAJUKAN: ', borrowed.id);
      const url = `${req.protocol}://${req.get('host')}/admin/scan?token=${borrowed.qr_token}`;
      const qr = await QRCode.toDataURL(url);

      res.render('peminjam/qr', { qr });

    } catch(err){
      console.log('ERROR: ', err.message);
    }
});

router.get('/formaja', auth, async (req, res) => {
   res.sendFile(
    path.join(process.cwd(), 'frontend/peminjam/formPeminjaman.html')
  );
});

router.get('/katalog', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        judul,
        pengarang,
        penerbit,
        isbn,
        tahun_terbit,
        jumlah_stok,
        stok_tersedia,
        kategori,
        cover
      FROM buku
      ORDER BY judul ASC
    `);
    const nama = req.user?.nama || 'Pengguna';
    res.render('peminjam/katalog', {
      buku: result.rows,
      results: [],
      keyword: '',
      kategori: '',
      user: req.user,
      nama
    });
  } catch (err){
    console.log('ERROR: ', err.message);
    res.status(500).send('Terjadi kesalahan: ' + err.message);
  }
});


router.get('/detail/:id', auth, async(req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`SELECT 
        id,
        judul,
        pengarang,
        penerbit,
        isbn,
        tahun_terbit,
        jumlah_stok,
        stok_tersedia,
        kategori
      FROM buku
      WHERE id = $1`, [id]);
    if(result.rows.length == 0){
       return res.status(404).send("Buku tidak ditemukan");
    }
    res.render('peminjam/detailBuku', {
      detail: result.rows[0]
    });
  } catch (err){
    console.log('ERROR: ', err.message);
  }
});

router.get('/searchBook', auth, async(req, res) => {
  const kategori = req.query.kategori || '';
  const keyword = req.query.q || '';
  let results = [];

  try {
    let sql = `
      SELECT *
      FROM buku
      WHERE 1=1
    `;

    const values = [];
    let index = 1;

    if (keyword) {
       sql += `
        AND (
          judul ILIKE $${index}
          OR pengarang ILIKE $${index}
        )
      `;

      values.push(`%${keyword}%`);
      index++;
    }
    if (kategori) {

      sql += `
        AND kategori ILIKE $${index}
      `;

      values.push(kategori);
      index++;
    }

    sql += `
      ORDER BY judul ASC
    `;

    const query = await db.query(sql, values);

    results = query.rows;

    const nama = req.user?.nama || 'Pengguna';
    res.render("peminjam/katalog", {
      results,
      keyword,
      kategori,
      user: req.user,
      nama
    });

  } catch(err) {
    console.log('ERROR: ', err.message);
    res.send("Terjadi error");
  }
});

router.post('/antri/:id', auth, async(req, res) => {
    const client = await db.connect();
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const buku = await client.query(`SELECT stok_tersedia FROM buku WHERE id = $1`, [id]);
      if (buku.rows[0].stok_tersedia > 0) {
      throw new Error('Stok masih ada, tidak perlu antri');
    }

      const cekAntri = await client.query(`SELECT * FROM antrian WHERE peminjam_id = $1 AND buku_id = $2 AND status = 'menunggu'`, [userId, id]);
      if(cekAntri.rows.length > 0){
        throw new Error("Anda sudah dalam antrian.");
        
      }

      const last = await client.query(
      `SELECT MAX(nomor_antrian) as max 
       FROM antrian 
       WHERE buku_id = $1`,
      [id]
    );

      const nomor = (last.rows[0].max || 0) + 1;

    
      await client.query(`
        INSERT INTO antrian (peminjam_id, buku_id, nomor_antrian)
        VALUES ($1, $2, $3)
      `, [userId, id, nomor]);

      await client.query('COMMIT');
      res.redirect("/api/peminjam/dashboard");
      } catch(err){
        console.log("ERROR: ", err.message);
      }
});

router.get("/antrianPage/:id", auth, async(req, res) => {
  const { id } = req.params;
  res.render('peminjam/antrian', {
    bookId: id
  })
});

router.get("/antrianSaya", auth, async(req, res) => {
  const id = req.user.id;

  try{
    const result = await db.query(`SELECT a.id, a.tgl_daftar, a.nomor_antrian, a.status, b.judul 
                    FROM antrian a
                    JOIN buku b ON a.buku_id = b.id 
                    WHERE a.peminjam_id = $1`, [id]);
    const nama = req.user?.nama || 'Pengguna';
    res.render("peminjam/daftarAntrian", {
      antrian: result.rows,
      user: req.user,
      nama
    });
  }catch(err){
    console.log('ERROR: ', err.message);
  }
})

router.get("/riwayat", auth, async(req, res) => {
  const id = req.user.id;
  try{
    const result = await db.query(`SELECT 
        tp.id,
        b.judul AS judul,
        tp.tgl_pengajuan,
        tp.tgl_kembali_rencana,
        tp.tgl_kembali_aktual,
        tp.status
      FROM transaksi_peminjaman tp
      JOIN buku b ON tp.buku_id = b.id
      WHERE tp.peminjam_id = $1;`, [id]);
    const nama = req.user?.nama || 'Pengguna';
    res.render("peminjam/riwayat", {
      peminjaman: result.rows,
      user: req.user,
      nama
    });
  } catch (err){
    console.log("ERROR: ", err.message);
  }
});

router.get('/akun', auth, async (req, res) => {
  try {
    const id = req.user.id;

    const result = await db.query(`
      SELECT nomor_induk, nama, tipe, kelas, email, created_at
      FROM peminjam
      WHERE id = $1
    `, [id]);

    if (!result.rows.length) {
      return res.send("User tidak ditemukan");
    }

    const nama = req.user?.nama || result.rows[0]?.nama || 'Pengguna';
    res.render('peminjam/akun', {
      user: result.rows[0],
      nama
    });

  } catch (err) {
    console.log(err);
    res.send("Error");
  }
});

module.exports = router;