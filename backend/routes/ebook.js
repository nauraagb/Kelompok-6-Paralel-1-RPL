const router = require('express').Router();
const axios  = require('axios');
const auth   = require('../middleware/auth');

const GUTENDEX = 'https://gutendex.com/books';

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5; 

// GET /api/ebook/search?q=keyword&lang=en&page=1
router.get('/search', auth, async (req, res) => {

  const { q = '', lang = '', page = 1 } = req.query;

  try {

    const params = new URLSearchParams({
      search: q,
      page: String(page)
    });

    if (lang) {
      params.append('languages', lang);
    }

    const response = await fetch(
      `${GUTENDEX}?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error('Gagal fetch Gutendex');
    }

    const raw = await response.json();

    const books = raw.results
      .slice(0, 12)
      .map(b => ({

        id: b.id,

        judul: b.title,

        pengarang:
          b.authors?.map(a => a.name).join(', ')
          || 'Tidak diketahui',

        bahasa:
          b.languages?.join(', ')
          || '-',

        subjek:
          b.subjects?.slice(0, 3)
          || [],

        cover:
          b.formats['image/jpeg']
          || null,

        download: {
          epub:
            b.formats['application/epub+zip']
            || null,

          pdf:
            b.formats['application/pdf']
            || null,

          html:
            b.formats['text/html']
            || null,

          txt:
            b.formats['text/plain']
            || null,
        },

        unduhan:
          b.download_count || 0

      }));

    res.json({
      data: books,
      total: raw.count,
      next: !!raw.next,
      page: Number(page)
    });

  } catch(err) {

    console.log(err);

    res.status(502).json({
      message: 'Gagal menghubungi Gutenberg API',
      error: err.message
    });
  }
});

// GET /api/ebook/:id  – detail satu buku
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
