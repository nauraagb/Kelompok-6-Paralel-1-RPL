const router  = require('express').Router();
const PDFDoc  = require('pdfkit');
const path    = require('path');
const db      = require('../db');
const auth    = require('../middleware/auth');

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtTgl(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtTglShort(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const LOGO_SEKOLAH = path.join(__dirname, '../assets/logo-sekolah.png');
const LOGO_PESAT   = path.join(__dirname, '../assets/logo-pesat.png');

// ─── GET /api/laporan ──────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const {
    dari   = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    sampai = new Date().toISOString().split('T')[0],
  } = req.query;
  try {
    const params = [dari, sampai];
    const transaksi      = await db.query(`
      SELECT tp.*, p.nama AS peminjam_nama, p.nomor_induk, p.tipe AS peminjam_tipe,
             b.judul AS buku_judul, b.pengarang
      FROM transaksi_peminjaman tp
      JOIN peminjam p ON p.id = tp.peminjam_id
      JOIN buku     b ON b.id = tp.buku_id
      WHERE tp.tgl_pengajuan BETWEEN $1 AND $2
      ORDER BY tp.tgl_pengajuan DESC
    `, params);
    const stats          = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='dipinjam') AS aktif,
        COUNT(*) FILTER (WHERE status='selesai')  AS selesai,
        COUNT(*) FILTER (WHERE status='ditolak')  AS ditolak,
        COUNT(*) FILTER (WHERE status='menunggu') AS menunggu,
        COUNT(*)                                  AS total
      FROM transaksi_peminjaman WHERE tgl_pengajuan BETWEEN $1 AND $2
    `, params);
    const bukuTerpopuler = await db.query(`
      SELECT b.judul, b.pengarang, COUNT(*) AS jumlah
      FROM transaksi_peminjaman tp JOIN buku b ON b.id = tp.buku_id
      WHERE tp.tgl_pengajuan BETWEEN $1 AND $2
      GROUP BY b.id, b.judul, b.pengarang ORDER BY jumlah DESC LIMIT 5
    `, params);
    res.json({ transaksi: transaksi.rows, stats: stats.rows[0], bukuTerpopuler: bukuTerpopuler.rows, dari, sampai });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET /api/laporan/pdf ──────────────────────────────────────────────────
router.get('/pdf', auth, async (req, res) => {
  const {
    dari   = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    sampai = new Date().toISOString().split('T')[0],
  } = req.query;

  try {
    const { rows: transaksi } = await db.query(`
      SELECT tp.tgl_pengajuan, tp.tgl_pinjam, tp.tgl_kembali_rencana,
             tp.tgl_kembali_aktual, tp.status,
             p.nama AS peminjam_nama, p.nomor_induk, b.judul AS buku_judul
      FROM transaksi_peminjaman tp
      JOIN peminjam p ON p.id = tp.peminjam_id
      JOIN buku     b ON b.id = tp.buku_id
      WHERE tp.tgl_pengajuan BETWEEN $1 AND $2
      ORDER BY tp.tgl_pengajuan DESC
    `, [dari, sampai]);

    const { rows: [stats] } = await db.query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status='dipinjam') AS aktif,
             COUNT(*) FILTER (WHERE status='selesai')  AS selesai,
             COUNT(*) FILTER (WHERE status='menunggu') AS menunggu,
             COUNT(*) FILTER (WHERE status='ditolak')  AS ditolak
      FROM transaksi_peminjaman WHERE tgl_pengajuan BETWEEN $1 AND $2
    `, [dari, sampai]);

    // ── Setup ────────────────────────────────────────────────────────────
    const doc = new PDFDoc({ margin: 0, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="laporan-${dari}-${sampai}.pdf"`);
    doc.pipe(res);

    const PW = doc.page.width;    // 595.28
    const PH = doc.page.height;   // 841.89
    const ML = 50;                // margin kiri
    const MR = 50;                // margin kanan
    const CW = PW - ML - MR;     // lebar konten

    // ── Palet (tanpa oranye) ─────────────────────────────────────────────
    const C_NAVY   = '#1E3A5F';
    const C_SLATE  = '#1F2937';
    const C_GRAY   = '#6B7280';
    const C_LGRAY  = '#9CA3AF';
    const C_BGROW  = '#F3F4F6';
    const C_BORDER = '#D1D5DB';
    const C_GREEN  = '#15803D';
    const C_RED    = '#B91C1C';
    const C_AMBER  = '#92400E';
    const C_BLUE   = '#1D4ED8';

    // ════════════════════════════════════════════════════════════════════
    //  KOP SURAT
    // ════════════════════════════════════════════════════════════════════
    function renderKop(isLanjutan = false) {
      if (isLanjutan) {
        doc.rect(0, 0, PW, 5).fill(C_NAVY);
        doc.fillColor(C_SLATE).fontSize(12).font('Helvetica-Bold')
           .text('SMA PESAT — Perpustakaan', ML, 14, { width: CW, align: 'center' });
        doc.fillColor(C_LGRAY).fontSize(8.5).font('Helvetica')
           .text('Laporan Peminjaman Buku (Lanjutan)', ML, 30, { width: CW, align: 'center' });
        doc.moveTo(ML, 46).lineTo(PW - MR, 46).lineWidth(0.5).stroke(C_BORDER);
        return 62;
      }

      // Garis atas tebal
      doc.rect(0, 0, PW, 5).fill(C_NAVY);

      const LOGO_SIZE = 68;         // kotak tempat logo
      const KOP_TOP   = 12;
      const KOP_H     = LOGO_SIZE + 20; // total tinggi area kop

      // ── Logo kiri — fit dalam kotak persegi (jaga aspek rasio) ──────
      try {
        doc.image(LOGO_SEKOLAH, ML, KOP_TOP, { fit: [LOGO_SIZE, LOGO_SIZE], align: 'center', valign: 'center' });
      } catch (_) {
        doc.rect(ML, KOP_TOP, LOGO_SIZE, LOGO_SIZE).stroke(C_BORDER);
      }

      // ── Logo kanan — fit dalam kotak persegi (jaga aspek rasio) ─────
      try {
        doc.image(LOGO_PESAT, PW - MR - LOGO_SIZE, KOP_TOP, { fit: [LOGO_SIZE, LOGO_SIZE], align: 'center', valign: 'center' });
      } catch (_) {
        doc.rect(PW - MR - LOGO_SIZE, KOP_TOP, LOGO_SIZE, LOGO_SIZE).stroke(C_BORDER);
      }

      // ── Teks tengah ─────────────────────────────────────────────────
      const TX = ML + LOGO_SIZE + 10;
      const TW = CW - LOGO_SIZE * 2 - 20;

      // "YAYASAN PESAT BIRRUL WALIDAIN" — bold, medium
      doc.fillColor(C_SLATE).fontSize(11).font('Helvetica-Bold')
         .text('YAYASAN PESAT BIRRUL WALIDAIN', TX, KOP_TOP + 2, { width: TW, align: 'center' });

      // "SMA PESAT" — extra large, extra bold
      doc.fillColor(C_NAVY).fontSize(30).font('Helvetica-Bold')
         .text('SMA PESAT', TX, KOP_TOP + 16, { width: TW, align: 'center' });

      // "TERAKREDITASI A" — bold
      doc.fillColor(C_SLATE).fontSize(10).font('Helvetica-Bold')
         .text('TERAKREDITASI A', TX, KOP_TOP + 50, { width: TW, align: 'center' });

      // Alamat — regular
      doc.fillColor(C_GRAY).fontSize(8).font('Helvetica')
         .text('Jl. Poras No. 7 Sindang Barang Loji  \u260E 0877 8981 4768  Kota Bogor', TX, KOP_TOP + 64, { width: TW, align: 'center' })
         .text('Email: smapesat@yahoo.com  |  Website: www.smapesatbogor.com',           TX, KOP_TOP + 76, { width: TW, align: 'center' });

      // ── Garis bawah kop (tebal + tipis) ────────────────────────────
      const LINE_Y = KOP_TOP + KOP_H + 4;
      doc.moveTo(ML, LINE_Y).lineTo(PW - MR, LINE_Y).lineWidth(2.5).stroke(C_NAVY);
      doc.moveTo(ML, LINE_Y + 5).lineTo(PW - MR, LINE_Y + 5).lineWidth(0.7).stroke(C_NAVY);

      return LINE_Y + 18; // y awal konten
    }

    // ════════════════════════════════════════════════════════════════════
    //  HALAMAN 1 — mulai
    // ════════════════════════════════════════════════════════════════════
    let y = renderKop(false);

    // ── Judul laporan ─────────────────────────────────────────────────
    y += 4;
    doc.fillColor(C_NAVY).fontSize(15).font('Helvetica-Bold')
       .text('LAPORAN PEMINJAMAN BUKU', ML, y, { width: CW, align: 'center' });
    y += 22;
    doc.fillColor(C_GRAY).fontSize(9.5).font('Helvetica')
       .text('Sistem Informasi Perpustakaan SMA Pesat Bogor', ML, y, { width: CW, align: 'center' });
    y += 14;
    doc.fillColor(C_SLATE).fontSize(9.5).font('Helvetica')
       .text(`Periode: ${fmtTgl(dari)}  s/d  ${fmtTgl(sampai)}`, ML, y, { width: CW, align: 'center' });
    y += 10;

    doc.moveTo(ML, y).lineTo(PW - MR, y).lineWidth(0.4).stroke(C_BORDER);
    y += 18;

    // ════════════════════════════════════════════════════════════════════
    //  I. RINGKASAN STATISTIK
    // ════════════════════════════════════════════════════════════════════
    doc.fillColor(C_NAVY).fontSize(10).font('Helvetica-Bold')
       .text('I.  RINGKASAN DATA PEMINJAMAN', ML, y);
    y += 16;

    const statItems = [
      { label: 'Total Pengajuan',      val: stats.total    || 0 },
      { label: 'Sedang Dipinjam',      val: stats.aktif    || 0 },
      { label: 'Selesai Dikembalikan', val: stats.selesai  || 0 },
      { label: 'Menunggu Konfirmasi',  val: stats.menunggu || 0 },
      { label: 'Ditolak',              val: stats.ditolak  || 0 },
    ];

    const COL_COUNT = 3;
    const GAP       = 8;
    const CELL_W    = (CW - GAP * (COL_COUNT - 1)) / COL_COUNT;
    const CELL_H    = 48;

    statItems.forEach((item, idx) => {
      const col = idx % COL_COUNT;
      const row = Math.floor(idx / COL_COUNT);
      const sx  = ML + col * (CELL_W + GAP);
      const sy  = y + row * (CELL_H + GAP);

      doc.rect(sx, sy, CELL_W, CELL_H).fill(C_BGROW).stroke(C_BORDER);

      // Angka besar
      doc.fillColor(C_NAVY).fontSize(24).font('Helvetica-Bold')
         .text(String(item.val), sx + 12, sy + 8, { width: 40 });

      // Label
      doc.fillColor(C_GRAY).fontSize(8.5).font('Helvetica')
         .text(item.label, sx + 12, sy + 34, { width: CELL_W - 20 });
    });

    const statRows = Math.ceil(statItems.length / COL_COUNT);
    y += statRows * (CELL_H + GAP) + 4;

    // ════════════════════════════════════════════════════════════════════
    //  II. TABEL TRANSAKSI
    // ════════════════════════════════════════════════════════════════════
    y += 10;
    doc.moveTo(ML, y).lineTo(PW - MR, y).lineWidth(0.4).stroke(C_BORDER);
    y += 16;

    doc.fillColor(C_NAVY).fontSize(10).font('Helvetica-Bold')
       .text('II.  DETAIL TRANSAKSI PEMINJAMAN', ML, y);
    y += 16;

    // Kolom tabel
    const COLS = [
      { label: 'No',            w: 26  },
      { label: 'Tgl Pengajuan', w: 80  },
      { label: 'Judul Buku',    w: 0   }, // auto
      { label: 'Peminjam',      w: 96  },
      { label: 'NIS/NIP',       w: 66  },
      { label: 'Status',        w: 66  },
    ];
    COLS[2].w = CW - COLS.reduce((a, c) => a + c.w, 0);

    const ROW_H = 22;

    function drawTableHeader(yh) {
      doc.rect(ML, yh, CW, 22).fill(C_NAVY);
      let cx = ML;
      COLS.forEach(col => {
        doc.fillColor('white').fontSize(8.5).font('Helvetica-Bold')
           .text(col.label, cx + 5, yh + 7, { width: col.w - 10 });
        cx += col.w;
      });
      return yh + 22;
    }

    y = drawTableHeader(y);

    if (transaksi.length === 0) {
      doc.rect(ML, y, CW, 32).fill(C_BGROW).stroke(C_BORDER);
      doc.fillColor(C_LGRAY).fontSize(9.5).font('Helvetica')
         .text('Tidak ada data peminjaman pada periode ini.', ML, y + 11, { width: CW, align: 'center' });
      y += 32;
    } else {
      transaksi.forEach((t, idx) => {
        if (y + ROW_H > PH - 52) {
          renderFooter(doc, ML, CW, PH);
          doc.addPage({ margin: 0, size: 'A4' });
          y = renderKop(true);
          y = drawTableHeader(y);
        }

        const rowBg = idx % 2 === 0 ? '#FFFFFF' : C_BGROW;
        doc.rect(ML, y, CW, ROW_H).fill(rowBg).stroke(C_BORDER);

        const statusColor = {
          dipinjam  : C_BLUE,
          selesai   : C_GREEN,
          ditolak   : C_RED,
          menunggu  : C_AMBER,
          dibatalkan: C_LGRAY,
        }[t.status] || C_GRAY;

        const rowVals = [
          String(idx + 1),
          fmtTglShort(t.tgl_pengajuan),
          (t.buku_judul    || '-').slice(0, 40),
          (t.peminjam_nama || '-').slice(0, 22),
          t.nomor_induk || '-',
          t.status,
        ];

        let cx = ML;
        rowVals.forEach((val, ci) => {
          doc.fillColor(ci === 5 ? statusColor : C_SLATE)
             .fontSize(8)
             .font(ci === 5 ? 'Helvetica-Bold' : 'Helvetica')
             .text(val, cx + 5, y + 7, { width: COLS[ci].w - 10 });
          cx += COLS[ci].w;
        });
        y += ROW_H;
      });
    }

    y += 4;
    doc.moveTo(ML, y).lineTo(PW - MR, y).lineWidth(0.7).stroke(C_NAVY);

    // ── Footer semua halaman ──────────────────────────────────────────
    renderFooter(doc, ML, CW, PH);
    doc.end();

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function renderFooter(doc, ML, CW, PH) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fillColor('#9CA3AF').fontSize(8).font('Helvetica')
       .text(
         `Halaman ${i + 1} dari ${range.count}  \u2014  Dicetak pada: ${new Date().toLocaleString('id-ID')}  \u2014  Perpustakaan SMA Pesat Bogor`,
         ML, PH - 32, { width: CW, align: 'center' }
       );
  }
}

// ─── GET /api/laporan/dashboard ────────────────────────────────────────────
router.get('/dashboard', auth, async (req, res) => {
  try {
    const stats  = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM buku) AS total_buku,
        (SELECT COALESCE(SUM(stok_tersedia),0) FROM buku) AS stok_tersedia,
        (SELECT COUNT(*) FROM peminjam) AS total_peminjam,
        (SELECT COUNT(*) FROM transaksi_peminjaman WHERE status='dipinjam')  AS pinjaman_aktif,
        (SELECT COUNT(*) FROM transaksi_peminjaman WHERE status='menunggu')  AS menunggu_konfirmasi,
        (SELECT COUNT(*) FROM antrian WHERE status='menunggu') AS antrian_aktif
    `);
    const recent = await db.query(`
      SELECT tp.id, tp.status, tp.tgl_pengajuan, tp.tgl_kembali_rencana,
             p.nama AS peminjam_nama, b.judul AS buku_judul
      FROM transaksi_peminjaman tp
      JOIN peminjam p ON p.id = tp.peminjam_id
      JOIN buku     b ON b.id = tp.buku_id
      ORDER BY tp.created_at DESC LIMIT 8
    `);
    res.json({ stats: stats.rows[0], recent: recent.rows });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;