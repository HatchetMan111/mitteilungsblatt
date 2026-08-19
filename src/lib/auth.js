const bcrypt = require('bcryptjs');
const db = require('./db');

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect('/admin/login');
}

function checkCredentials(username, password) {
  if (!username || !password) return false;
  const settings = db.getSettings();
  if (username !== settings.adminUser) return false;
  return bcrypt.compareSync(password, settings.adminPasswordHash);
}

function attachLocals(req, res, next) {
  res.locals.isAuthenticated = !!(req.session && req.session.userId);
  res.locals.currentUser = req.session ? req.session.userId : null;
  next();
}

module.exports = { requireAuth, checkCredentials, attachLocals };
