const router = require('express').Router();
const axios  = require('axios');
const auth   = require('../middleware/auth');

const GUTENDEX = 'https://gutendex.com/books';

router.get('/search', auth, async (req, res) => {
  const { q = '', lang = '', page = 1 } = req.query;
  try {
    const params = new URLSearchParams({ search: q, page });
    if (lang) params.append('languages', lang);
    const resp = await axios.get(`${GUTENDEX}?${params}`, { timeout: 8000 });
    const books = resp.data.results.map(b => ({
      id:       b.id,
      judul:    b.title,
      pengarang: b.authors.map(a => a.name).join(', ') || 'Tidak diketahui',
      bahasa:   b.languages.join(', '),
      subjek:   b.subjects.slice(0, 3),
      cover:    b.formats['image/jpeg'] || null,
      download: {
        epub: b.formats['application/epub+zip'] || null,
        pdf:  b.formats['application/pdf']      || null,
        html: b.formats['text/html']             || null,
        txt:  b.formats['text/plain']            || null,
      },
      unduhan: b.download_count,
    }));
    res.json({ data: books, total: resp.data.count, next: !!resp.data.next, page: parseInt(page) });
  } catch (err) {
    res.status(502).json({ message: 'Gagal menghubungi Gutenberg API', error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const resp = await axios.get(`${GUTENDEX}/${req.params.id}`, { timeout: 8000 });
    const b = resp.data;
    res.json({
      id:       b.id,
      judul:    b.title,
      pengarang: b.authors.map(a => a.name).join(', '),
      bahasa:   b.languages.join(', '),
      subjek:   b.subjects,
      cover:    b.formats['image/jpeg'] || null,
      download: {
        epub: b.formats['application/epub+zip'] || null,
        pdf:  b.formats['application/pdf']      || null,
        html: b.formats['text/html']             || null,
        txt:  b.formats['text/plain']            || null,
      },
      unduhan: b.download_count,
    });
  } catch (err) {
    res.status(404).json({ message: 'Buku tidak ditemukan di Gutenberg' });
  }
});

module.exports = router;
