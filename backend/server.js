require('dotenv').config();
const express = require('express');
const path    = require('path');
const cors    = require('cors');

const authRoute      = require('./routes/auth');
const bukuRoute      = require('./routes/buku');
const peminjamRoute  = require('./routes/peminjam');
const peminjamanRoute= require('./routes/peminjaman');
const antrianRoute   = require('./routes/antrian');
const laporanRoute   = require('./routes/laporan');
const ebookRoute     = require('./routes/ebook');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth',       authRoute);
app.use('/api/buku',       bukuRoute);
app.use('/api/peminjam',   peminjamRoute);
app.use('/api/peminjaman', peminjamanRoute);
app.use('/api/antrian',    antrianRoute);
app.use('/api/laporan',    laporanRoute);
app.use('/api/ebook',      ebookRoute);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nPerpustakaan SMA Pesat Bogor`);
  console.log(`   Server  : http://localhost:${PORT}`);
  console.log(`   Login   : http://localhost:${PORT}/login.html`);
  console.log(`   Default : admin / admin123\n`);
});
