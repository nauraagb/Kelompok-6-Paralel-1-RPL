require('dotenv').config();
const express = require('express');
const path    = require('path');
const cors    = require('cors');
const cookieParser = require('cookie-parser');

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
app.use(cookieParser());

// Static frontend files
app.use('/vendor/jsqr', express.static(path.join(__dirname, '../node_modules/jsqr/dist')));
app.use(express.static(path.join(__dirname, '../frontend')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use('/uploads', express.static(
  path.join(process.cwd(), 'frontend/uploads')
));

// API routes
app.use('/api/auth',       authRoute);
app.use('/api/buku',       bukuRoute);
app.use('/api/peminjam',   peminjamRoute);
app.use('/api/peminjaman', peminjamanRoute);
app.use('/api/antrian',    antrianRoute);
app.use('/api/laporan',    laporanRoute);
app.use('/api/ebook',      ebookRoute);
app.use('/uploads', express.static(path.join(process.cwd(), 'frontend/uploads')));


// Fallback to login
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/login.html'));
});

app.get('/peminjam/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/peminjam/login.html'));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nPerpustakaan SMA Pesat Bogor`);
  console.log(`   Server  : http://localhost:${PORT}`);
  console.log(`   Login   : http://localhost:${PORT}/index.html`);
  console.log(`   Default : admin / password\n`);
});
