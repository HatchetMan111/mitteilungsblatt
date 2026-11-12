const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const os = require('os');
const db = require('../lib/db');
const { requireAuth, checkCredentials } = require('../lib/auth');
const { upload, publicPath, deleteUploadedFile } = require('../lib/upload');
const { generateAusgabePdf } = require('../lib/pdf');
const { PDF_DIR } = require('../config');

// Einfache serverseitige Pflichtfeld-Pruefung (das HTML-'required'-Attribut
// bzw. die clientseitige Pruefung laesst sich umgehen).
function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function publicSettings() {
  const s = db.getSettings();
  return {
    gemeindeName: s.gemeindeName,
    untertitel: s.untertitel,
    logoPath: s.logoPath,
    titelbildPath: s.titelbildPath
  };
}

function adminSettings() {
  const s = db.getSettings();
  return { ...s, adminPasswordHash: undefined }; // Hash nie an den Client
}

// Reichert eine Ausgabe um vorgruppierte Meldungen (nach Rubrik) an, damit
// Frontend und PDF-Generator identisch gruppieren. WICHTIG: arbeitet auf
// einer Kopie — das db.js-Objekt ist eine Referenz auf den In-Memory-Cache,
// eine Mutation wuerde berechnete Felder beim naechsten Schreiben dauerhaft
// in db.json einschleusen.
function withGroupedNews(ausgabeOriginal) {
  if (!ausgabeOriginal) return ausgabeOriginal;
  const ausgabe = { ...ausgabeOriginal };
  ausgabe.gemeindeweitNewsGruppiert = db.groupNewsByRubrik(ausgabe.gemeindeweitNews);
  ausgabe.ortsteile = (ausgabe.ortsteile || []).map(ot => ({
    ...ot,
    newsGruppiert: db.groupNewsByRubrik(ot.news)
  }));
  return ausgabe;
}

// ============================================================
// Auth
// ============================================================

// Brute-Force-Schutz: max. 8 Login-Versuche pro 15 Minuten und IP-Adresse.
// Erfolgreiche Logins zaehlen nicht mit (skipSuccessfulRequests).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Zu viele fehlgeschlagene Anmeldeversuche. Bitte in ein paar Minuten erneut versuchen.' });
  }
});

router.get('/session', (req, res) => {
  res.json({
    authenticated: !!(req.session && req.session.userId),
    settings: publicSettings()
  });
});

router.post('/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!checkCredentials(username, password)) {
    return res.status(401).json({ error: 'Benutzername oder Passwort ist falsch.' });
  }
  // Session regenerieren (Fixierung verhindern), danach erst einloggen.
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Login fehlgeschlagen.' });
    req.session.userId = String(username);
    res.json({ ok: true });
  });
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ============================================================
// Öffentliche Daten
// ============================================================

router.get('/public/aktuell', (req, res) => {
  const ausgabe = withGroupedNews(db.getLatestPublishedAusgabe());
  res.json({ ausgabe, settings: publicSettings() });
});

// Baut einen durchsuchbaren Text aus allen relevanten Feldern einer Ausgabe,
// damit die Archiv-Suche auch Inhalte findet, nicht nur die Ausgaben-Nummer.
function ausgabeSearchText(a) {
  const parts = [
    a.gemeindeName, a.untertitel, String(a.nummer), String(a.jahr),
    ...(a.featuredVeranstaltungen || []).flatMap(v => [v.titel, v.beschreibung, v.organisation, v.ort]),
    ...(a.gemeindeweitVeranstaltungen || []).flatMap(v => [v.titel, v.beschreibung, v.organisation, v.ort]),
    ...(a.gemeindeweitNews || []).flatMap(n => [n.titel, n.inhalt, n.organisation]),
    ...(a.ortsteile || []).flatMap(ot => [
      ot.name,
      ...(ot.veranstaltungen || []).flatMap(v => [v.titel, v.beschreibung, v.organisation, v.ort]),
      ...(ot.news || []).flatMap(n => [n.titel, n.inhalt, n.organisation])
    ]),
    ...(a.anzeigen || []).flatMap(z => [z.titel, z.text]),
    ...(a.sponsoren || []).flatMap(s => [s.name])
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

router.get('/public/archiv', (req, res) => {
  const alleAusgaben = db.listAusgaben();
  const jahre = [...new Set(alleAusgaben.map(a => a.jahr))].sort((a, b) => b - a);
  const q = (req.query.q || '').trim();
  const jahr = req.query.jahr ? parseInt(req.query.jahr, 10) : null;

  let ausgaben = alleAusgaben;
  if (jahr) ausgaben = ausgaben.filter(a => a.jahr === jahr);
  if (q) {
    const qLower = q.toLowerCase();
    ausgaben = ausgaben.filter(a => ausgabeSearchText(a).includes(qLower));
  }

  // Listen-Payload schlank halten (keine Inhalts-Snapshots zum Client)
  res.json({
    ausgaben: ausgaben.map(a => ({
      id: a.id, nummer: a.nummer, jahr: a.jahr, datum: a.datum,
      pdfPath: a.pdfPath, gemeindeName: a.gemeindeName
    })),
    jahre,
    q,
    jahrFilter: req.query.jahr || '',
    gefiltert: !!(q || jahr),
    gesamtAnzahl: alleAusgaben.length,
    settings: publicSettings()
  });
});

router.get('/public/ausgabe/:id', (req, res) => {
  const ausgabe = withGroupedNews(db.getAusgabe(req.params.id));
  if (!ausgabe) return res.status(404).json({ error: 'Ausgabe nicht gefunden.' });
  res.json({ ausgabe, settings: publicSettings() });
});

// ============================================================
// Admin: alles darunter nur mit Login
// ============================================================
router.use('/admin', requireAuth);

// ---------- Übersicht ----------
router.get('/admin/overview', (req, res) => {
  const ortsteile = db.listOrtsteile();
  const veranstaltungen = db.listVeranstaltungen({ onlyAktuell: true });
  const news = db.listNews({ onlyAktuell: true });
  const anzeigen = db.listAnzeigen({ onlyAktuell: true });
  const sponsoren = db.listSponsoren();
  const ausgaben = db.listAusgaben();
  res.json({
    settings: adminSettings(),
    counts: {
      ortsteile: ortsteile.length,
      veranstaltungen: veranstaltungen.length,
      news: news.length,
      anzeigen: anzeigen.length,
      sponsoren: sponsoren.length,
      ausgaben: ausgaben.length
    },
    letzteAusgabe: ausgaben[0] || null
  });
});

// ---------- Einstellungen ----------
router.get('/admin/settings', (req, res) => {
  res.json({ settings: adminSettings() });
});

router.put('/admin/settings',
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'titelbild', maxCount: 1 }]),
  (req, res) => {
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
    if (!hasText(patch.gemeindeName)) {
      return res.status(400).json({ error: 'Der Gemeinde-Name darf nicht leer sein.' });
    }
    // Jahreswechsel: Bei neuem Erscheinungsjahr startet die Ausgaben-Zählung
    // wieder bei 1 (sonst würde die erste Ausgabe des neuen Jahres als
    // "Nr. 53/2027" durchlaufen, weil der alte Zähler stehen bleibt).
    if (patch.erscheinungsjahr !== db.getSettings().erscheinungsjahr) {
      patch.naechsteAusgabenNummer = 1;
    }
    db.updateSettings(patch);
    res.json({ settings: adminSettings() });
  }
);

router.post('/admin/settings/password', (req, res) => {
  const { aktuellesPasswort, neuesPasswort, neuesPasswortWiederholen } = req.body || {};
  const settings = db.getSettings();
  if (!aktuellesPasswort || !bcrypt.compareSync(aktuellesPasswort, settings.adminPasswordHash)) {
    return res.status(401).json({ error: 'Aktuelles Passwort ist falsch.' });
  }
  if (!neuesPasswort || neuesPasswort.length < 6) {
    return res.status(400).json({ error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.' });
  }
  if (neuesPasswort !== neuesPasswortWiederholen) {
    return res.status(400).json({ error: 'Die Passwörter stimmen nicht überein.' });
  }
  db.updateSettings({ adminPasswordHash: bcrypt.hashSync(neuesPasswort, 10) });
  res.json({ ok: true });
});

// ---------- Ortsteile ----------
router.get('/admin/ortsteile', (req, res) => res.json({ ortsteile: db.listOrtsteile() }));

router.post('/admin/ortsteile', (req, res) => {
  if (!hasText(req.body.name)) return res.status(400).json({ error: 'Bitte einen Namen angeben.' });
  res.json({ ortsteil: db.createOrtsteil({ name: req.body.name.trim(), beschreibung: req.body.beschreibung || '' }) });
});

router.put('/admin/ortsteile/:id', (req, res) => {
  if (!hasText(req.body.name)) return res.status(400).json({ error: 'Bitte einen Namen angeben.' });
  const o = db.updateOrtsteil(req.params.id, { name: req.body.name.trim(), beschreibung: req.body.beschreibung || '' });
  if (!o) return res.status(404).json({ error: 'Ortsteil nicht gefunden.' });
  res.json({ ortsteil: o });
});

router.delete('/admin/ortsteile/:id', (req, res) => {
  db.deleteOrtsteil(req.params.id);
  res.json({ ok: true });
});

router.post('/admin/ortsteile/:id/move', (req, res) => {
  moveInList(db.listOrtsteile(), req.params.id, req.body.direction, ids => db.reorderOrtsteile(ids));
  res.json({ ortsteile: db.listOrtsteile() });
});

function moveInList(list, id, direction, commit) {
  const idx = list.findIndex(x => x.id === id);
  if (idx === -1) return;
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= list.length) return;
  const ids = list.map(x => x.id);
  [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
  commit(ids);
}

// ---------- Veranstaltungen ----------
router.get('/admin/veranstaltungen', (req, res) => {
  res.json({
    veranstaltungen: db.listVeranstaltungen({ onlyAktuell: true }),
    ortsteile: db.listOrtsteile()
  });
});

router.post('/admin/veranstaltungen', upload.single('bild'), (req, res) => {
  if (!hasText(req.body.titel)) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.status(400).json({ error: 'Bitte einen Titel angeben.' });
  }
  const v = db.createVeranstaltung({
    titel: req.body.titel.trim(),
    datum: req.body.datum || '',
    uhrzeit: req.body.uhrzeit || '',
    ort: req.body.ort || '',
    beschreibung: req.body.beschreibung || '',
    featured: req.body.featured === true || req.body.featured === 'true' || req.body.featured === 'on',
    ortsteilId: req.body.ortsteilId || null,
    organisation: req.body.organisation || '',
    bildPath: publicPath(req.file)
  });
  res.json({ veranstaltung: v });
});

router.put('/admin/veranstaltungen/:id', upload.single('bild'), (req, res) => {
  if (!hasText(req.body.titel)) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.status(400).json({ error: 'Bitte einen Titel angeben.' });
  }
  const patch = {
    titel: req.body.titel.trim(),
    datum: req.body.datum || '',
    uhrzeit: req.body.uhrzeit || '',
    ort: req.body.ort || '',
    beschreibung: req.body.beschreibung || '',
    featured: req.body.featured === true || req.body.featured === 'true' || req.body.featured === 'on',
    ortsteilId: req.body.ortsteilId || null,
    organisation: req.body.organisation || ''
  };
  if (req.file) patch.bildPath = publicPath(req.file);
  const v = db.updateVeranstaltung(req.params.id, patch);
  if (!v) return res.status(404).json({ error: 'Veranstaltung nicht gefunden.' });
  res.json({ veranstaltung: v });
});

router.delete('/admin/veranstaltungen/:id', (req, res) => {
  db.deleteVeranstaltung(req.params.id);
  res.json({ ok: true });
});

// ---------- News (Meldungen) ----------
router.get('/admin/news', (req, res) => {
  res.json({
    news: db.listNews({ onlyAktuell: true }),
    ortsteile: db.listOrtsteile(),
    rubriken: db.NEWS_RUBRIKEN
  });
});

function newsPayload(req) {
  return {
    titel: (req.body.titel || '').trim(),
    inhalt: req.body.inhalt || '',
    ortsteilId: req.body.ortsteilId || null,
    organisation: req.body.organisation || '',
    rubrik: db.NEWS_RUBRIKEN.includes(req.body.rubrik) ? req.body.rubrik : 'Allgemein'
  };
}

router.post('/admin/news', upload.single('bild'), (req, res) => {
  const data = newsPayload(req);
  if (!data.titel) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.status(400).json({ error: 'Bitte einen Titel angeben.' });
  }
  res.json({ news: db.createNews({ ...data, bildPath: publicPath(req.file) }) });
});

router.put('/admin/news/:id', upload.single('bild'), (req, res) => {
  const data = newsPayload(req);
  if (!data.titel) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.status(400).json({ error: 'Bitte einen Titel angeben.' });
  }
  if (req.file) data.bildPath = publicPath(req.file);
  const n = db.updateNews(req.params.id, data);
  if (!n) return res.status(404).json({ error: 'Meldung nicht gefunden.' });
  res.json({ news: n });
});

router.delete('/admin/news/:id', (req, res) => {
  db.deleteNews(req.params.id);
  res.json({ ok: true });
});

// ---------- Anzeigen ----------
router.get('/admin/anzeigen', (req, res) => {
  res.json({
    anzeigen: db.listAnzeigen({ onlyAktuell: true }),
    ortsteile: db.listOrtsteile()
  });
});

function anzeigePayload(req) {
  return {
    titel: (req.body.titel || '').trim(),
    typ: req.body.typ === 'bild' ? 'bild' : 'klein',
    text: req.body.text || '',
    kontakt: req.body.kontakt || '',
    ortsteilId: req.body.ortsteilId || null
  };
}

router.post('/admin/anzeigen', upload.single('bild'), (req, res) => {
  const data = anzeigePayload(req);
  if (!data.titel) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.status(400).json({ error: 'Bitte einen Titel angeben.' });
  }
  res.json({ anzeige: db.createAnzeige({ ...data, bildPath: publicPath(req.file) }) });
});

router.put('/admin/anzeigen/:id', upload.single('bild'), (req, res) => {
  const data = anzeigePayload(req);
  if (!data.titel) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.status(400).json({ error: 'Bitte einen Titel angeben.' });
  }
  if (req.file) data.bildPath = publicPath(req.file);
  const a = db.updateAnzeige(req.params.id, data);
  if (!a) return res.status(404).json({ error: 'Anzeige nicht gefunden.' });
  res.json({ anzeige: a });
});

router.delete('/admin/anzeigen/:id', (req, res) => {
  db.deleteAnzeige(req.params.id);
  res.json({ ok: true });
});

router.post('/admin/anzeigen/:id/move', (req, res) => {
  db.moveAnzeige(req.params.id, req.body.direction);
  res.json({ anzeigen: db.listAnzeigen({ onlyAktuell: true }) });
});

// ---------- Servicerubriken (Standard-Infos) ----------
router.get('/admin/servicerubriken', (req, res) => {
  res.json({ rubriken: db.listServicerubriken() });
});

router.post('/admin/servicerubriken', (req, res) => {
  if (!hasText(req.body.titel)) return res.status(400).json({ error: 'Bitte einen Titel angeben.' });
  res.json({ rubrik: db.createServicerubrik({ titel: req.body.titel.trim(), inhalt: req.body.inhalt || '' }) });
});

router.put('/admin/servicerubriken/:id', (req, res) => {
  if (!hasText(req.body.titel)) return res.status(400).json({ error: 'Bitte einen Titel angeben.' });
  const r = db.updateServicerubrik(req.params.id, { titel: req.body.titel.trim(), inhalt: req.body.inhalt || '' });
  if (!r) return res.status(404).json({ error: 'Rubrik nicht gefunden.' });
  res.json({ rubrik: r });
});

router.delete('/admin/servicerubriken/:id', (req, res) => {
  db.deleteServicerubrik(req.params.id);
  res.json({ ok: true });
});

router.post('/admin/servicerubriken/:id/move', (req, res) => {
  db.moveServicerubrik(req.params.id, req.body.direction);
  res.json({ rubriken: db.listServicerubriken() });
});

// ---------- Sponsoren ----------
router.get('/admin/sponsoren', (req, res) => {
  res.json({ sponsoren: db.listSponsoren() });
});

function sponsorPayload(req) {
  return {
    name: (req.body.name || '').trim(),
    website: req.body.website || '',
    beschreibung: req.body.beschreibung || ''
  };
}

router.post('/admin/sponsoren', upload.single('logo'), (req, res) => {
  const data = sponsorPayload(req);
  if (!data.name) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.status(400).json({ error: 'Bitte einen Namen angeben.' });
  }
  res.json({ sponsor: db.createSponsor({ ...data, logoPath: publicPath(req.file) }) });
});

router.put('/admin/sponsoren/:id', upload.single('logo'), (req, res) => {
  const data = sponsorPayload(req);
  if (!data.name) {
    if (req.file) deleteUploadedFile(publicPath(req.file));
    return res.status(400).json({ error: 'Bitte einen Namen angeben.' });
  }
  if (req.file) data.logoPath = publicPath(req.file);
  const s = db.updateSponsor(req.params.id, data);
  if (!s) return res.status(404).json({ error: 'Sponsor nicht gefunden.' });
  res.json({ sponsor: s });
});

router.delete('/admin/sponsoren/:id', (req, res) => {
  db.deleteSponsor(req.params.id);
  res.json({ ok: true });
});

router.post('/admin/sponsoren/:id/move', (req, res) => {
  db.moveSponsor(req.params.id, req.body.direction);
  res.json({ sponsoren: db.listSponsoren() });
});

// ---------- Ausgaben ----------
router.get('/admin/ausgaben', (req, res) => {
  res.json({
    ausgaben: db.listAusgaben().map(a => ({
      id: a.id, nummer: a.nummer, jahr: a.jahr, datum: a.datum, pdfPath: a.pdfPath
    })),
    entwurf: {
      veranstaltungen: db.listVeranstaltungen({ onlyAktuell: true }),
      news: db.listNews({ onlyAktuell: true }),
      anzeigen: db.listAnzeigen({ onlyAktuell: true }),
      ortsteile: db.listOrtsteile(),
      servicerubriken: db.listServicerubriken(),
      sponsoren: db.listSponsoren()
    },
    settings: adminSettings()
  });
});

router.post('/admin/ausgaben', upload.single('titelbild'), async (req, res) => {
  const ausgabe = db.createAndPublishAusgabe({ titelbildPath: publicPath(req.file) });
  let pdfError = null;
  try {
    if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
    const filename = `ausgabe-${ausgabe.nummer}-${ausgabe.jahr}.pdf`;
    const outPath = path.join(PDF_DIR, filename);
    await generateAusgabePdf(ausgabe, outPath);
    db.setAusgabePdfPath(ausgabe.id, '/pdf/' + filename);
  } catch (e) {
    console.error('PDF-Erstellung fehlgeschlagen:', e);
    pdfError = 'Die Ausgabe wurde veröffentlicht, aber die PDF-Erstellung ist fehlgeschlagen. Die Web-Ansicht ist trotzdem online.';
  }
  res.json({
    ok: true,
    ausgabe: { id: ausgabe.id, nummer: ausgabe.nummer, jahr: ausgabe.jahr, datum: ausgabe.datum },
    pdfError
  });
});

// ---------- Vorschau (Web + PDF), OHNE zu veroeffentlichen ----------
function entwurfCount() {
  return db.listVeranstaltungen({ onlyAktuell: true }).length + db.listNews({ onlyAktuell: true }).length;
}

router.get('/admin/vorschau', (req, res) => {
  if (entwurfCount() === 0) return res.status(404).json({ error: 'Keine Inhalte für eine Vorschau vorgemerkt.' });
  res.json({
    ausgabe: vorschauSnapshot(),
    settings: publicSettings(),
    isPreview: true
  });
});

// Snapshot für die Web-Vorschau: die internen Referenzfelder (_quell*)
// haben in der Antwort nichts verloren — sie gehören nur der Veröffentlichung.
function vorschauSnapshot() {
  const { _quellVeranstaltungen: _v, _quellNews: _n, _quellAnzeigen: _a, ...ausgabe } =
    db.buildAusgabeSnapshot({ previewId: 'vorschau' });
  return withGroupedNews(ausgabe);
}

router.get('/admin/vorschau/pdf', async (req, res) => {
  if (entwurfCount() === 0) return res.status(404).json({ error: 'Keine Inhalte für eine Vorschau vorgemerkt.' });
  const snapshot = db.buildAusgabeSnapshot({ previewId: 'vorschau' });
  const tmpPath = path.join(os.tmpdir(), `mitteilungsblatt-vorschau-${Date.now()}.pdf`);
  try {
    await generateAusgabePdf(snapshot, tmpPath);
    res.setHeader('Content-Disposition', 'inline; filename="vorschau.pdf"');
    res.sendFile(tmpPath, err => {
      fs.unlink(tmpPath, () => {}); // Temp-Datei danach entfernen, egal ob Erfolg oder Fehler
      if (err && !res.headersSent) res.status(500).json({ error: 'Vorschau-PDF konnte nicht erstellt werden.' });
    });
  } catch (e) {
    console.error('Vorschau-PDF fehlgeschlagen:', e);
    res.status(500).json({ error: 'Vorschau-PDF konnte nicht erstellt werden: ' + e.message });
  }
});

module.exports = router;
module.exports.withGroupedNews = withGroupedNews;
