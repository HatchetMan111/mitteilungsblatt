const express = require('express');
const router = express.Router();
const { checkCredentials } = require('../lib/auth');
const db = require('../lib/db');

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/admin');
  res.render('admin/login', { error: null, gemeindeName: db.getSettings().gemeindeName });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (checkCredentials(username, password)) {
    req.session.userId = username;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Benutzername oder Passwort ist falsch.', gemeindeName: db.getSettings().gemeindeName });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

module.exports = router;
