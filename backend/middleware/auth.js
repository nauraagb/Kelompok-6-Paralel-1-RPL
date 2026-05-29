const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  let token = null;

  // Bearer token
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  }

  // Cookie
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  // Query param (?token=...)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid' });
  }
}


module.exports = authMiddleware;