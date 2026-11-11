const bcrypt = require('bcryptjs');
const db = require('./db');

// API-Guard: antwortet mit 401-JSON statt Redirect, damit das React-
// Frontend den Zustand "nicht angemeldet" sauber erkennen kann.
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Nicht angemeldet.' });
}

function checkCredentials(username, password) {
  if (!username || !password) return false;
  const settings = db.getSettings();
  if (username !== settings.adminUser) return false;
  return bcrypt.compareSync(password, settings.adminPasswordHash);
}

module.exports = { requireAuth, checkCredentials };
