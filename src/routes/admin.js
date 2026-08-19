const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { upload, publicPath, deleteUploadedFile } = require('../lib/upload');
const { generateAusgabePdf } = require('../lib/pdf');
const path = require('path');
const fs = require('fs');
const { PDF_DIR } = require('../config');

router.use(requireAuth);

// Einfache serverseitige Pflichtfeld-Pruefung (das HTML-'required'-Attribut
// laesst sich umgehen, z.B. bei einem direkten POST ohne Formular).
function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// ---------- Dashboard ----------
router.get('/', (req, res) => {
  const ortsteile = db.listOrtsteile();
  const veranstaltungen = db.listVeranstaltungen({ onlyAktuell: true });
  const news = db.listNews({ onlyAktuell: true });
  const anzeigen = db.listAnzeigen({ onlyAktuell: true });
  const sponsoren = db.listSponsoren();
  const ausgaben = db.listAusgaben();
  res.render('admin/dashboard', {
    settings: db.getSettings(),
    ortsteile, veranstaltungen, news, anzeigen, sponsoren, ausgaben,
    letzteAusgabe: ausgaben[0] || null
  });
});

// ---------- Einstellungen ----------
router.get('/einstellungen', (req, res) => {
  res.render('admin/settings', { settings: db.getSettings(), success: req.query.success, error: null });
});

router.post('/einstellungen', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'titelbild', maxCount: 1 }]), (req, res) => {
  const patch = {
    gemeindeName: req.body.gemeindeName || 'Meine Gemeinde',
    untertitel: req.body.untertitel || '',
    erscheinungsjahr: parseInt(req.body.erscheinungsjahr, 10) || new Date().getFullYear()
  };
  if (req.files && req.files.logo && req.files.logo[0]) {
    patch.logoPath = publicPath(req.files.logo[0]);
  }
  if (req.files && req.files.titelbild && req.files.titelbild[0]) {
    patch.titelbildPath = publicPath(req.files.titelbild[0]);
  }
  db.updateSettings(patch);
  res.redirect('/admin/einstellungen?success=1');
});

router.post('/einstellungen/passwort', (req, res) => {
  const { aktuellesPasswort, neuesPasswort, neuesPasswortWiederholen } = req.body;
  const settings = db.getSettings();
  if (!aktuellesPasswort || !bcrypt.compareSync(aktuellesPasswort, settings.adminPasswordHash)) {
    return res.status(401).render('admin/settings', { settings, success: null, error: 'Aktuelles Passwort ist falsch.' });
  }
  if (!neuesPasswort || neuesPasswort.length < 6) {
    return res.render('admin/settings', { settings, success: null, error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.' });
  }
  if (neuesPasswort !== neuesPasswortWiederholen) {
    return res.render('admin/settings', { settings, success: null, error: 'Die Passwoerter stimmen nicht ueberein.' });
  }
  db.updateSettings({ adminPasswordHash: bcrypt.hashSync(neuesPasswort, 10) });
  res.render('admin/settings', { settings: db.getSettings(), success: 'passwort', error: null });
});

// ---------- Ortsteile ----------
router.get('/ortsteile', (req, res) => {
  res.render('admin/ortsteile', { ortsteile: db.listOrtsteile() });
});

router.post('/ortsteile', (req, res) => {
  if (req.body.name && req.body.name.trim()) {
    db.createOrtsteil({ name: req.body.name.trim(), beschreibung: req.body.beschreibung || '' });
  }
  res.redirect('/admin/ortsteile');
});

router.post('/ortsteile/:id', (req, res) => {
  if (hasText(req.body.name)) {
    db.updateOrtsteil(req.params.id, { name: req.body.name.trim(), beschreibung: req.body.beschreibung || '' });
  }
  res.redirect('/admin/ortsteile');
});

router.post('/ortsteile/:id/delete', (req, res) => {
  db.deleteOrtsteil(req.params.id);
  res.redirect('/admin/ortsteile');
});

router.post('/ortsteile/:id/move', (req, res) => {
  const dir = req.body.direction;
  const list = db.listOrtsteile();
  const idx = list.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.redirect('/admin/ortsteile');
  const swapWith = dir === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= list.length) return res.redirect('/admin/ortsteile');
  const ids = list.map(o => o.id);
  [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
  db.reorderOrtsteile(ids);
  res.redirect('/admin/ortsteile');
});

// ---------- Veranstaltungen ----------
router.get('/veranstaltungen', (req, res) => {
  res.render('admin/veranstaltungen', {
    veranstaltungen: db.listVeranstaltungen({ onlyAktuell: true }),
    ortsteile: db.listOrtsteile()
  });
});

router.get('/veranstaltungen/neu', (req, res) => {
  res.render('admin/veranstaltung-form', { v: null, ortsteile: db.listOrtsteile() });
});

router.post('/veranstaltungen', upload.single('bild'), (req, res) => {
  if (!hasText(req.body.titel)) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.redirect('/admin/veranstaltungen/neu');
  }
  db.createVeranstaltung({
    titel: req.body.titel.trim(),
    datum: req.body.datum,
    uhrzeit: req.body.uhrzeit,
    ort: req.body.ort,
    beschreibung: req.body.beschreibung,
    featured: req.body.featured === 'on',
    ortsteilId: req.body.ortsteilId || null,
    organisation: req.body.organisation || '',
    bildPath: publicPath(req.file)
  });
  res.redirect('/admin/veranstaltungen');
});

router.get('/veranstaltungen/:id/bearbeiten', (req, res) => {
  const v = db.getVeranstaltung(req.params.id);
  if (!v) return res.redirect('/admin/veranstaltungen');
  res.render('admin/veranstaltung-form', { v, ortsteile: db.listOrtsteile() });
});

router.post('/veranstaltungen/:id', upload.single('bild'), (req, res) => {
  if (!hasText(req.body.titel)) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.redirect('/admin/veranstaltungen/' + req.params.id + '/bearbeiten');
  }
  const patch = {
    titel: req.body.titel.trim(),
    datum: req.body.datum,
    uhrzeit: req.body.uhrzeit,
    ort: req.body.ort,
    beschreibung: req.body.beschreibung,
    featured: req.body.featured === 'on',
    ortsteilId: req.body.ortsteilId || null,
    organisation: req.body.organisation || ''
  };
  if (req.file) patch.bildPath = publicPath(req.file);
  db.updateVeranstaltung(req.params.id, patch);
  res.redirect('/admin/veranstaltungen');
});

router.post('/veranstaltungen/:id/delete', (req, res) => {
  db.deleteVeranstaltung(req.params.id);
  res.redirect('/admin/veranstaltungen');
});

// ---------- News ----------
router.get('/news', (req, res) => {
  res.render('admin/news', {
    newsListe: db.listNews({ onlyAktuell: true }),
    ortsteile: db.listOrtsteile()
  });
});

router.get('/news/neu', (req, res) => {
  res.render('admin/news-form', { n: null, ortsteile: db.listOrtsteile(), rubriken: db.NEWS_RUBRIKEN });
});

router.post('/news', upload.single('bild'), (req, res) => {
  if (!hasText(req.body.titel)) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.redirect('/admin/news/neu');
  }
  db.createNews({
    titel: req.body.titel.trim(),
    inhalt: req.body.inhalt,
    ortsteilId: req.body.ortsteilId || null,
    organisation: req.body.organisation || '',
    rubrik: req.body.rubrik,
    bildPath: publicPath(req.file)
  });
  res.redirect('/admin/news');
});

router.get('/news/:id/bearbeiten', (req, res) => {
  const n = db.getNews(req.params.id);
  if (!n) return res.redirect('/admin/news');
  res.render('admin/news-form', { n, ortsteile: db.listOrtsteile(), rubriken: db.NEWS_RUBRIKEN });
});

router.post('/news/:id', upload.single('bild'), (req, res) => {
  if (!hasText(req.body.titel)) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.redirect('/admin/news/' + req.params.id + '/bearbeiten');
  }
  const patch = {
    titel: req.body.titel.trim(),
    inhalt: req.body.inhalt,
    ortsteilId: req.body.ortsteilId || null,
    organisation: req.body.organisation || '',
    rubrik: db.NEWS_RUBRIKEN.includes(req.body.rubrik) ? req.body.rubrik : 'Allgemein'
  };
  if (req.file) patch.bildPath = publicPath(req.file);
  db.updateNews(req.params.id, patch);
  res.redirect('/admin/news');
});

router.post('/news/:id/delete', (req, res) => {
  db.deleteNews(req.params.id);
  res.redirect('/admin/news');
});

// ---------- Anzeigen (lokale Werbung / Kleinanzeigen) ----------
router.get('/anzeigen', (req, res) => {
  res.render('admin/anzeigen', {
    anzeigenListe: db.listAnzeigen({ onlyAktuell: true }),
    ortsteile: db.listOrtsteile()
  });
});

router.get('/anzeigen/neu', (req, res) => {
  res.render('admin/anzeige-form', { a: null, ortsteile: db.listOrtsteile() });
});

router.post('/anzeigen', upload.single('bild'), (req, res) => {
  if (!hasText(req.body.titel)) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.redirect('/admin/anzeigen/neu');
  }
  db.createAnzeige({
    titel: req.body.titel.trim(),
    typ: req.body.typ,
    text: req.body.text,
    kontakt: req.body.kontakt,
    ortsteilId: req.body.ortsteilId || null,
    bildPath: publicPath(req.file)
  });
  res.redirect('/admin/anzeigen');
});

router.get('/anzeigen/:id/bearbeiten', (req, res) => {
  const a = db.getAnzeige(req.params.id);
  if (!a) return res.redirect('/admin/anzeigen');
  res.render('admin/anzeige-form', { a, ortsteile: db.listOrtsteile() });
});

router.post('/anzeigen/:id', upload.single('bild'), (req, res) => {
  if (!hasText(req.body.titel)) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.redirect('/admin/anzeigen/' + req.params.id + '/bearbeiten');
  }
  const patch = {
    titel: req.body.titel.trim(),
    typ: req.body.typ,
    text: req.body.text,
    kontakt: req.body.kontakt,
    ortsteilId: req.body.ortsteilId || null
  };
  if (req.file) patch.bildPath = publicPath(req.file);
  db.updateAnzeige(req.params.id, patch);
  res.redirect('/admin/anzeigen');
});

router.post('/anzeigen/:id/delete', (req, res) => {
  db.deleteAnzeige(req.params.id);
  res.redirect('/admin/anzeigen');
});

router.post('/anzeigen/:id/move', (req, res) => {
  db.moveAnzeige(req.params.id, req.body.direction);
  res.redirect('/admin/anzeigen');
});

// ---------- Standard-Infos (Servicerubriken) ----------
router.get('/standardrubriken', (req, res) => {
  res.render('admin/standardrubriken', { rubriken: db.listServicerubriken() });
});

router.post('/standardrubriken', (req, res) => {
  if (req.body.titel && req.body.titel.trim()) {
    db.createServicerubrik({ titel: req.body.titel.trim(), inhalt: req.body.inhalt || '' });
  }
  res.redirect('/admin/standardrubriken');
});

router.post('/standardrubriken/:id', (req, res) => {
  if (hasText(req.body.titel)) {
    db.updateServicerubrik(req.params.id, { titel: req.body.titel.trim(), inhalt: req.body.inhalt || '' });
  }
  res.redirect('/admin/standardrubriken');
});

router.post('/standardrubriken/:id/delete', (req, res) => {
  db.deleteServicerubrik(req.params.id);
  res.redirect('/admin/standardrubriken');
});

router.post('/standardrubriken/:id/move', (req, res) => {
  db.moveServicerubrik(req.params.id, req.body.direction);
  res.redirect('/admin/standardrubriken');
});

// ---------- Sponsoren ----------
router.get('/sponsoren', (req, res) => {
  res.render('admin/sponsoren', { sponsoren: db.listSponsoren() });
});

router.get('/sponsoren/neu', (req, res) => {
  res.render('admin/sponsor-form', { s: null });
});

router.post('/sponsoren', upload.single('logo'), (req, res) => {
  if (!hasText(req.body.name)) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.redirect('/admin/sponsoren/neu');
  }
  db.createSponsor({
    name: req.body.name.trim(),
    website: req.body.website,
    beschreibung: req.body.beschreibung,
    logoPath: publicPath(req.file)
  });
  res.redirect('/admin/sponsoren');
});

router.get('/sponsoren/:id/bearbeiten', (req, res) => {
  const s = db.getSponsor(req.params.id);
  if (!s) return res.redirect('/admin/sponsoren');
  res.render('admin/sponsor-form', { s });
});

router.post('/sponsoren/:id', upload.single('logo'), (req, res) => {
  if (!hasText(req.body.name)) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.redirect('/admin/sponsoren/' + req.params.id + '/bearbeiten');
  }
  const patch = {
    name: req.body.name.trim(),
    website: req.body.website,
    beschreibung: req.body.beschreibung
  };
  if (req.file) patch.logoPath = publicPath(req.file);
  db.updateSponsor(req.params.id, patch);
  res.redirect('/admin/sponsoren');
});

router.post('/sponsoren/:id/delete', (req, res) => {
  db.deleteSponsor(req.params.id);
  res.redirect('/admin/sponsoren');
});

router.post('/sponsoren/:id/move', (req, res) => {
  db.moveSponsor(req.params.id, req.body.direction);
  res.redirect('/admin/sponsoren');
});

// ---------- Ausgaben ----------
router.get('/ausgaben', (req, res) => {
  res.render('admin/ausgaben', {
    ausgaben: db.listAusgaben(),
    settings: db.getSettings(),
    pdfError: req.query.pdf_error === '1',
    entwurf: {
      veranstaltungen: db.listVeranstaltungen({ onlyAktuell: true }),
      news: db.listNews({ onlyAktuell: true }),
      anzeigen: db.listAnzeigen({ onlyAktuell: true }),
      ortsteile: db.listOrtsteile(),
      servicerubriken: db.listServicerubriken(),
      sponsoren: db.listSponsoren()
    }
  });
});

router.post('/ausgaben', upload.single('titelbild'), async (req, res) => {
  const ausgabe = db.createAndPublishAusgabe({ titelbildPath: publicPath(req.file) });
  let pdfFailed = false;
  try {
    if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
    const filename = `ausgabe-${ausgabe.nummer}-${ausgabe.jahr}.pdf`;
    const outPath = path.join(PDF_DIR, filename);
    await generateAusgabePdf(ausgabe, outPath);
    db.setAusgabePdfPath(ausgabe.id, '/pdf/' + filename);
  } catch (e) {
    console.error('PDF-Erstellung fehlgeschlagen:', e);
    pdfFailed = true;
  }
  res.redirect('/admin/ausgaben' + (pdfFailed ? '?pdf_error=1' : ''));
});

module.exports = router;
