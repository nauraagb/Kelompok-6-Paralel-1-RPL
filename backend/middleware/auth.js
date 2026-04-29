const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  const token = (header && header.startsWith('Bearer ') ? header.slice(7) : null)
    || req.query.token || null;
  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid atau sudah kadaluarsa' });
  }
}

module.exports = authMiddleware;
