const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { checkCredentials } = require('../lib/auth');
const db = require('../lib/db');

// Brute-Force-Schutz: max. 8 Login-Versuche pro 15 Minuten und IP-Adresse.
// Erfolgreiche Logins zaehlen nicht mit (skipSuccessfulRequests).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: undefined, // wird unten per handler individuell gerendert
  handler: (req, res) => {
    res.status(429).render('admin/login', {
      error: 'Zu viele fehlgeschlagene Anmeldeversuche. Bitte in ein paar Minuten erneut versuchen.',
      gemeindeName: db.getSettings().gemeindeName
    });
  }
});

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/admin');
  res.render('admin/login', { error: null, gemeindeName: db.getSettings().gemeindeName });
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (checkCredentials(username, password)) {
    req.session.userId = username;
    return res.redirect('/admin');
  }
  res.status(401).render('admin/login', { error: 'Benutzername oder Passwort ist falsch.', gemeindeName: db.getSettings().gemeindeName });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

module.exports = router;
