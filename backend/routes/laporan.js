const router  = require('express').Router();
const PDFDoc  = require('pdfkit');
const db      = require('../db');
const auth    = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { dari = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
          sampai = new Date().toISOString().split('T')[0] } = req.query;
  try {
    const params = [dari, sampai];
    const transaksi = await db.query(`
      SELECT tp.*, p.nama AS peminjam_nama, p.nomor_induk, p.tipe AS peminjam_tipe,
             b.judul AS buku_judul, b.pengarang
      FROM transaksi_peminjaman tp
      JOIN peminjam p ON p.id=tp.peminjam_id
      JOIN buku     b ON b.id=tp.buku_id
      WHERE tp.tgl_pengajuan BETWEEN $1 AND $2
      ORDER BY tp.tgl_pengajuan DESC
    `, params);

    const stats = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='dipinjam')  AS aktif,
        COUNT(*) FILTER (WHERE status='selesai')   AS selesai,
        COUNT(*) FILTER (WHERE status='ditolak')   AS ditolak,
        COUNT(*) FILTER (WHERE status='menunggu')  AS menunggu,
        COUNT(*) AS total
      FROM transaksi_peminjaman
      WHERE tgl_pengajuan BETWEEN $1 AND $2
    `, params);

    const bukuTerpopuler = await db.query(`
      SELECT b.judul, b.pengarang, COUNT(*) AS jumlah
      FROM transaksi_peminjaman tp JOIN buku b ON b.id=tp.buku_id
      WHERE tp.tgl_pengajuan BETWEEN $1 AND $2
      GROUP BY b.id, b.judul, b.pengarang
      ORDER BY jumlah DESC LIMIT 5
    `, params);

    res.json({ transaksi: transaksi.rows, stats: stats.rows[0], bukuTerpopuler: bukuTerpopuler.rows, dari, sampai });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/pdf', auth, async (req, res) => {
  const { dari = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
          sampai = new Date().toISOString().split('T')[0] } = req.query;
  try {
    const { rows: transaksi } = await db.query(`
      SELECT tp.tgl_pengajuan, tp.tgl_pinjam, tp.tgl_kembali_rencana, tp.tgl_kembali_aktual, tp.status,
             p.nama AS peminjam_nama, p.nomor_induk, b.judul AS buku_judul
      FROM transaksi_peminjaman tp
      JOIN peminjam p ON p.id=tp.peminjam_id
      JOIN buku     b ON b.id=tp.buku_id
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

    const doc = new PDFDoc({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="laporan-${dari}-${sampai}.pdf"`);
    doc.pipe(res);

    const ORANGE = '#F97316';
    const DARK   = '#1C1917';
    const GRAY   = '#6B7280';
    const W      = doc.page.width - 80;

    doc.rect(0, 0, doc.page.width, 90).fill(ORANGE);
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
       .text('LAPORAN PEMINJAMAN BUKU', 40, 25, { align: 'center' });
    doc.fontSize(11).font('Helvetica')
       .text('Sistem Informasi Perpustakaan SMA Pesat Bogor', 40, 48, { align: 'center' });
    doc.fontSize(10).text(`Periode: ${dari} s/d ${sampai}`, 40, 66, { align: 'center' });

    doc.fillColor(DARK).rect(40, 110, W, 70).fill('#FFF7ED').stroke();
    const statItems = [
      { label: 'Total', val: stats.total },
      { label: 'Dipinjam', val: stats.aktif },
      { label: 'Selesai', val: stats.selesai },
      { label: 'Menunggu', val: stats.menunggu },
      { label: 'Ditolak', val: stats.ditolak },
    ];
    statItems.forEach((s, i) => {
      const x = 40 + i * (W / 5);
      doc.fillColor(ORANGE).fontSize(20).font('Helvetica-Bold')
         .text(s.val, x, 122, { width: W/5, align: 'center' });
      doc.fillColor(GRAY).fontSize(9).font('Helvetica')
         .text(s.label, x, 148, { width: W/5, align: 'center' });
    });

    let y = 200;
    const cols = [{ w: 30 }, { w: 80 }, { w: 140 }, { w: 90 }, { w: 70 }, { w: 80 }];
    const headers = ['No', 'Tgl Pengajuan', 'Buku', 'Peminjam', 'NIS/NIP', 'Status'];

    doc.rect(40, y, W, 22).fill(ORANGE);
    let cx = 40;
    headers.forEach((h, i) => {
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
         .text(h, cx + 4, y + 7, { width: cols[i].w - 8, align: 'left' });
      cx += cols[i].w;
    });

    y += 22;
    transaksi.forEach((t, idx) => {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 40;
      }
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#FFF7ED';
      doc.rect(40, y, W, 20).fill(bg);
      const statusColor = { dipinjam: ORANGE, selesai: '#16A34A', ditolak: '#DC2626', menunggu: '#CA8A04', dibatalkan: GRAY }[t.status] || GRAY;
      const rowData = [
        String(idx + 1),
        t.tgl_pengajuan?.toString().slice(0, 10) || '-',
        t.buku_judul?.slice(0, 28) || '-',
        t.peminjam_nama?.slice(0, 16) || '-',
        t.nomor_induk || '-',
        t.status,
      ];
      cx = 40;
      rowData.forEach((d, i) => {
        const color = i === 5 ? statusColor : DARK;
        doc.fillColor(color).fontSize(8).font(i === 5 ? 'Helvetica-Bold' : 'Helvetica')
           .text(d, cx + 4, y + 6, { width: cols[i].w - 8, align: 'left' });
        cx += cols[i].w;
      });
      y += 20;
    });

    if (!transaksi.length) {
      doc.fillColor(GRAY).fontSize(11).font('Helvetica')
         .text('Tidak ada data peminjaman pada periode ini.', 40, y + 20, { align: 'center', width: W });
    }

    doc.fillColor(GRAY).fontSize(8)
       .text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}  —  Admin Perpustakaan SMA Pesat Bogor`,
              40, doc.page.height - 40, { align: 'center', width: W });

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/dashboard', auth, async (req, res) => {
  try {
    const stats = await db.query(`
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
      JOIN peminjam p ON p.id=tp.peminjam_id
      JOIN buku     b ON b.id=tp.buku_id
      ORDER BY tp.created_at DESC LIMIT 8
    `);
    res.json({ stats: stats.rows[0], recent: recent.rows });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
