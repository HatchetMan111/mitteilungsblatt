const express = require('express');
const router = express.Router();
const db = require('../lib/db');

// Reichert eine geladene Ausgabe um vorgruppierte Meldungen (nach Rubrik)
// an, damit die Templates (Web + PDF) nicht selbst gruppieren müssen.
// WICHTIG: erstellt dabei bewusst eine Kopie statt das von db.js gelieferte
// Objekt direkt zu veraendern - das ist eine Referenz auf den In-Memory-
// Cache, und eine Mutation wuerde die berechneten Felder beim naechsten
// Schreibvorgang dauerhaft in db.json einschleusen.
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

router.get('/', (req, res) => {
  const ausgabe = withGroupedNews(db.getLatestPublishedAusgabe());
  const settings = db.getSettings();
  if (!ausgabe) {
    return res.render('public/keine-ausgabe', { settings });
  }
  res.render('public/ausgabe', { ausgabe, settings, isPreview: false });
});

// Baut einen durchsuchbaren Text aus allen relevanten Feldern einer Ausgabe
// (Titel, Texte, Organisationen ...), damit die Archiv-Suche auch Inhalte
// findet, nicht nur die Ausgaben-Nummer.
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

router.get('/archiv', (req, res) => {
  const alleAusgaben = db.listAusgaben();
  const jahre = [...new Set(alleAusgaben.map(a => a.jahr))].sort((a, b) => b - a);
  const q = (req.query.q || '').trim();
  const jahrFilter = req.query.jahr ? parseInt(req.query.jahr, 10) : null;

  let ausgaben = alleAusgaben;
  if (jahrFilter) ausgaben = ausgaben.filter(a => a.jahr === jahrFilter);
  if (q) {
    const qLower = q.toLowerCase();
    ausgaben = ausgaben.filter(a => ausgabeSearchText(a).includes(qLower));
  }

  res.render('public/archiv', {
    ausgaben,
    settings: db.getSettings(),
    q,
    jahrFilter: req.query.jahr || '',
    jahre,
    gefiltert: !!(q || jahrFilter),
    gesamtAnzahl: alleAusgaben.length
  });
});

router.get('/ausgabe/:id', (req, res) => {
  const ausgabe = withGroupedNews(db.getAusgabe(req.params.id));
  if (!ausgabe) return res.status(404).render('public/keine-ausgabe', { settings: db.getSettings() });
  res.render('public/ausgabe', { ausgabe, settings: db.getSettings(), isPreview: false });
});

module.exports = router;
