const express = require('express');
const router = express.Router();
const db = require('../lib/db');

// Reichert eine geladene Ausgabe um vorgruppierte Meldungen (nach Rubrik)
// an, damit die Templates (Web + PDF) nicht selbst gruppieren müssen.
function withGroupedNews(ausgabe) {
  if (!ausgabe) return ausgabe;
  ausgabe.gemeindeweitNewsGruppiert = db.groupNewsByRubrik(ausgabe.gemeindeweitNews);
  (ausgabe.ortsteile || []).forEach(ot => {
    ot.newsGruppiert = db.groupNewsByRubrik(ot.news);
  });
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

router.get('/archiv', (req, res) => {
  res.render('public/archiv', { ausgaben: db.listAusgaben(), settings: db.getSettings() });
});

router.get('/ausgabe/:id', (req, res) => {
  const ausgabe = withGroupedNews(db.getAusgabe(req.params.id));
  if (!ausgabe) return res.status(404).render('public/keine-ausgabe', { settings: db.getSettings() });
  res.render('public/ausgabe', { ausgabe, settings: db.getSettings(), isPreview: false });
});

module.exports = router;
