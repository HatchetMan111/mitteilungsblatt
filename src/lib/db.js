const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { DATA_DIR, DB_FILE } = require('../config');
const { deleteUploadedFile } = require('./upload');

// Feste Rubriken für Meldungen, in der Reihenfolge, in der sie in der
// veröffentlichten Ausgabe erscheinen (angelehnt an klassische Mitteilungsblätter).
const NEWS_RUBRIKEN = [
  'Amtliche Bekanntmachung',
  'Standesamtliche Nachricht',
  'Vereinsnachricht',
  'Kirchengemeinde',
  'Schule & Kindergarten',
  'Pressemitteilung',
  'Allgemein'
];

function id() {
  return crypto.randomBytes(6).toString('hex');
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultDb() {
  const adminUser = process.env.ADMIN_USER || 'admin';
  // Fester Standard-Login (admin/admin) für einen einfachen ersten Zugang.
  // Kann über ADMIN_PASSWORD in der .env überschrieben werden.
  const adminPasswordPlain = process.env.ADMIN_PASSWORD || 'admin';
  const adminPasswordHash = bcrypt.hashSync(adminPasswordPlain, 10);

  // Hinweisdatei mit den Zugangsdaten, damit sie im Container jederzeit
  // nachlesbar sind (z.B. per `pct exec ... cat data/admin-zugangsdaten.txt`).
  try {
    ensureDataDir();
    fs.writeFileSync(
      path.join(DATA_DIR, 'admin-zugangsdaten.txt'),
      `Mitteilungsblatt - Admin-Zugangsdaten (Standard)\n` +
      `Benutzername: ${adminUser}\n` +
      `Passwort:     ${adminPasswordPlain}\n` +
      `\nACHTUNG: Das ist ein fester Standard-Login und daher leicht zu erraten.\n` +
      `Bitte gleich nach dem ersten Login unter "Einstellungen" ein eigenes,\n` +
      `sicheres Passwort vergeben, vor allem wenn diese App aus dem Internet\n` +
      `erreichbar ist. Diese Datei danach loeschen.\n`,
      { mode: 0o600 }
    );
  } catch (e) {
    // nicht kritisch
  }

  return {
    settings: {
      gemeindeName: 'Meine Gemeinde',
      untertitel: 'Amtliches Mitteilungsblatt',
      logoPath: null,
      titelbildPath: null,
      adminUser,
      adminPasswordHash,
      naechsteAusgabenNummer: 1,
      erscheinungsjahr: new Date().getFullYear()
    },
    ortsteile: [],
    veranstaltungen: [],
    news: [],
    anzeigen: [],
    // Feste Service-Rubriken: Infos, die sich selten ändern (Notfallnummern,
    // Öffnungszeiten, Impressum ...). Werden in jede Ausgabe übernommen,
    // ohne dass man sie jedes Mal neu eintragen muss.
    servicerubriken: [
      {
        id: id(),
        titel: 'Notfallnummern',
        inhalt:
          'Feuerwehr und Rettungsdienst: 112\n' +
          'Polizei: 110\n' +
          'Ärztlicher Bereitschaftsdienst: 116 117',
        order: 1
      },
      {
        id: id(),
        titel: 'Störungsnummern Strom / Gas / Wasser',
        inhalt:
          'Bitte hier die Rufnummern eurer örtlichen Versorger eintragen,\n' +
          'z. B. Stromnetz-Störungsstelle, Gas-Störungsstelle, Wasserversorgung.',
        order: 2
      },
      {
        id: id(),
        titel: 'Öffnungszeiten Rathaus / Verwaltung',
        inhalt:
          'Montag: 8.00 – 12.00 Uhr\n' +
          'Dienstag: 8.00 – 12.00 Uhr und 14.00 – 18.00 Uhr\n' +
          'Mittwoch: 8.00 – 12.00 Uhr\n' +
          'Donnerstag: 8.00 – 12.00 Uhr und 14.00 – 16.00 Uhr\n' +
          'Freitag: 8.00 – 12.30 Uhr',
        order: 3
      },
      {
        id: id(),
        titel: 'Impressum',
        inhalt:
          'Herausgeber: Gemeindeverwaltung\n' +
          'Verantwortlich für den amtlichen Inhalt: (Name Bürgermeister/in)\n' +
          'Redaktionsschluss: dienstags, 12:00 Uhr\n' +
          'Erscheinungstermin: wöchentlich',
        order: 4
      }
    ],
    // Sponsoren des Mitteilungsblatts: staendige Liste (kein Pool wie
    // Anzeigen), erscheint automatisch in jeder Ausgabe als Dankeschoen-Seite.
    sponsoren: [],
    ausgaben: []
  };
}

function migrate(db) {
  // Bestandsinstallationen (Update von einer älteren Version) bekommen
  // die neuen Felder automatisch ergänzt, ohne bestehende Daten zu verlieren.
  if (!Array.isArray(db.anzeigen)) db.anzeigen = [];
  if (!Array.isArray(db.servicerubriken)) db.servicerubriken = [];
  if (!Array.isArray(db.sponsoren)) db.sponsoren = [];
  (db.news || []).forEach(n => {
    if (typeof n.rubrik !== 'string') n.rubrik = 'Allgemein';
    if (typeof n.organisation !== 'string') n.organisation = '';
  });
  (db.veranstaltungen || []).forEach(v => {
    if (typeof v.organisation !== 'string') v.organisation = '';
  });
  return db;
}

let cache = null;

function load() {
  if (cache) return cache;
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    cache = defaultDb();
    save(cache);
    return cache;
  }
  try {
    cache = migrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  } catch (e) {
    throw new Error('db.json konnte nicht gelesen werden: ' + e.message);
  }
  return cache;
}

function save(db) {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function persist() {
  save(load());
}

// ---------- Settings ----------
function getSettings() {
  return load().settings;
}
function updateSettings(patch) {
  const db = load();
  // Wird ein Logo/Titelbild ersetzt, die zuvor hochgeladene alte Datei loeschen
  if (patch.logoPath && db.settings.logoPath && patch.logoPath !== db.settings.logoPath) {
    deleteUploadedFile(db.settings.logoPath);
  }
  if (patch.titelbildPath && db.settings.titelbildPath && patch.titelbildPath !== db.settings.titelbildPath) {
    deleteUploadedFile(db.settings.titelbildPath);
  }
  db.settings = { ...db.settings, ...patch };
  persist();
  return db.settings;
}

// ---------- Ortsteile ----------
function listOrtsteile() {
  return load().ortsteile.slice().sort((a, b) => a.order - b.order);
}
function getOrtsteil(oid) {
  return load().ortsteile.find(o => o.id === oid) || null;
}
function createOrtsteil(data) {
  const db = load();
  const maxOrder = db.ortsteile.reduce((m, o) => Math.max(m, o.order || 0), 0);
  const o = { id: id(), name: data.name, beschreibung: data.beschreibung || '', order: maxOrder + 1 };
  db.ortsteile.push(o);
  persist();
  return o;
}
function updateOrtsteil(oid, data) {
  const db = load();
  const o = db.ortsteile.find(x => x.id === oid);
  if (!o) return null;
  Object.assign(o, data);
  persist();
  return o;
}
function deleteOrtsteil(oid) {
  const db = load();
  db.ortsteile = db.ortsteile.filter(o => o.id !== oid);
  // Inhalte des Ortsteils werden auf "gemeindeweit" zurueckgesetzt statt geloescht
  db.veranstaltungen.forEach(v => { if (v.ortsteilId === oid) v.ortsteilId = null; });
  db.news.forEach(n => { if (n.ortsteilId === oid) n.ortsteilId = null; });
  persist();
}
function reorderOrtsteile(orderedIds) {
  const db = load();
  orderedIds.forEach((oid, idx) => {
    const o = db.ortsteile.find(x => x.id === oid);
    if (o) o.order = idx + 1;
  });
  persist();
}

// ---------- Veranstaltungen ----------
function listVeranstaltungen({ onlyAktuell = false } = {}) {
  const items = load().veranstaltungen;
  const filtered = onlyAktuell ? items.filter(v => v.status === 'aktuell') : items;
  return filtered.slice().sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
}
function getVeranstaltung(vid) {
  return load().veranstaltungen.find(v => v.id === vid) || null;
}
function createVeranstaltung(data) {
  const db = load();
  const v = {
    id: id(),
    titel: data.titel,
    datum: data.datum || '',
    uhrzeit: data.uhrzeit || '',
    ort: data.ort || '',
    beschreibung: data.beschreibung || '',
    bildPath: data.bildPath || null,
    featured: !!data.featured,
    ortsteilId: data.ortsteilId || null,
    organisation: data.organisation || '',
    status: 'aktuell',
    erstelltAm: new Date().toISOString()
  };
  db.veranstaltungen.push(v);
  persist();
  return v;
}
function updateVeranstaltung(vid, data) {
  const db = load();
  const v = db.veranstaltungen.find(x => x.id === vid);
  if (!v) return null;
  if (data.bildPath && v.bildPath && data.bildPath !== v.bildPath) {
    deleteUploadedFile(v.bildPath);
  }
  Object.assign(v, data);
  persist();
  return v;
}
function deleteVeranstaltung(vid) {
  const db = load();
  const v = db.veranstaltungen.find(x => x.id === vid);
  if (v && v.bildPath) deleteUploadedFile(v.bildPath);
  db.veranstaltungen = db.veranstaltungen.filter(x => x.id !== vid);
  persist();
}

// ---------- News ----------
function listNews({ onlyAktuell = false } = {}) {
  const items = load().news;
  const filtered = onlyAktuell ? items.filter(n => n.status === 'aktuell') : items;
  return filtered.slice().sort((a, b) => (b.erstelltAm || '').localeCompare(a.erstelltAm || ''));
}
function getNews(nid) {
  return load().news.find(n => n.id === nid) || null;
}
function createNews(data) {
  const db = load();
  const n = {
    id: id(),
    titel: data.titel,
    inhalt: data.inhalt || '',
    bildPath: data.bildPath || null,
    ortsteilId: data.ortsteilId || null,
    organisation: data.organisation || '',
    rubrik: NEWS_RUBRIKEN.includes(data.rubrik) ? data.rubrik : 'Allgemein',
    status: 'aktuell',
    erstelltAm: new Date().toISOString()
  };
  db.news.push(n);
  persist();
  return n;
}
function updateNews(nid, data) {
  const db = load();
  const n = db.news.find(x => x.id === nid);
  if (!n) return null;
  if (data.bildPath && n.bildPath && data.bildPath !== n.bildPath) {
    deleteUploadedFile(n.bildPath);
  }
  Object.assign(n, data);
  persist();
  return n;
}
function deleteNews(nid) {
  const db = load();
  const n = db.news.find(x => x.id === nid);
  if (n && n.bildPath) deleteUploadedFile(n.bildPath);
  db.news = db.news.filter(x => x.id !== nid);
  persist();
}

// ---------- Anzeigen (lokale Werbung / Kleinanzeigen) ----------
function listAnzeigen({ onlyAktuell = false } = {}) {
  const items = load().anzeigen;
  const filtered = onlyAktuell ? items.filter(a => a.status === 'aktuell') : items;
  return filtered.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
}
function getAnzeige(aid) {
  return load().anzeigen.find(a => a.id === aid) || null;
}
function createAnzeige(data) {
  const db = load();
  const maxOrder = db.anzeigen.reduce((m, a) => Math.max(m, a.order || 0), 0);
  const a = {
    id: id(),
    titel: data.titel,
    typ: data.typ === 'bild' ? 'bild' : 'klein',
    text: data.text || '',
    bildPath: data.bildPath || null,
    kontakt: data.kontakt || '',
    ortsteilId: data.ortsteilId || null,
    order: maxOrder + 1,
    status: 'aktuell',
    erstelltAm: new Date().toISOString()
  };
  db.anzeigen.push(a);
  persist();
  return a;
}
function updateAnzeige(aid, data) {
  const db = load();
  const a = db.anzeigen.find(x => x.id === aid);
  if (!a) return null;
  if (data.bildPath && a.bildPath && data.bildPath !== a.bildPath) {
    deleteUploadedFile(a.bildPath);
  }
  Object.assign(a, data);
  persist();
  return a;
}
function deleteAnzeige(aid) {
  const db = load();
  const a = db.anzeigen.find(x => x.id === aid);
  if (a && a.bildPath) deleteUploadedFile(a.bildPath);
  db.anzeigen = db.anzeigen.filter(x => x.id !== aid);
  persist();
}
function moveAnzeige(aid, direction) {
  const db = load();
  const list = listAnzeigen();
  const idx = list.findIndex(a => a.id === aid);
  if (idx === -1) return;
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= list.length) return;
  const a1 = db.anzeigen.find(x => x.id === list[idx].id);
  const a2 = db.anzeigen.find(x => x.id === list[swapWith].id);
  const tmp = a1.order;
  a1.order = a2.order;
  a2.order = tmp;
  persist();
}

// ---------- Servicerubriken (feste, selten geänderte Infoblöcke) ----------
function listServicerubriken() {
  return load().servicerubriken.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
}
function getServicerubrik(rid) {
  return load().servicerubriken.find(r => r.id === rid) || null;
}
function createServicerubrik(data) {
  const db = load();
  const maxOrder = db.servicerubriken.reduce((m, r) => Math.max(m, r.order || 0), 0);
  const r = { id: id(), titel: data.titel, inhalt: data.inhalt || '', order: maxOrder + 1 };
  db.servicerubriken.push(r);
  persist();
  return r;
}
function updateServicerubrik(rid, data) {
  const db = load();
  const r = db.servicerubriken.find(x => x.id === rid);
  if (!r) return null;
  Object.assign(r, data);
  persist();
  return r;
}
function deleteServicerubrik(rid) {
  const db = load();
  db.servicerubriken = db.servicerubriken.filter(r => r.id !== rid);
  persist();
}
function moveServicerubrik(rid, direction) {
  const db = load();
  const list = listServicerubriken();
  const idx = list.findIndex(r => r.id === rid);
  if (idx === -1) return;
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= list.length) return;
  const r1 = db.servicerubriken.find(x => x.id === list[idx].id);
  const r2 = db.servicerubriken.find(x => x.id === list[swapWith].id);
  const tmp = r1.order;
  r1.order = r2.order;
  r2.order = tmp;
  persist();
}

// ---------- Sponsoren (staendige Liste, erscheint in jeder Ausgabe) ----------
function listSponsoren() {
  return load().sponsoren.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
}
function getSponsor(sid) {
  return load().sponsoren.find(s => s.id === sid) || null;
}
function createSponsor(data) {
  const db = load();
  const maxOrder = db.sponsoren.reduce((m, s) => Math.max(m, s.order || 0), 0);
  const s = {
    id: id(),
    name: data.name,
    website: data.website || '',
    beschreibung: data.beschreibung || '',
    logoPath: data.logoPath || null,
    order: maxOrder + 1
  };
  db.sponsoren.push(s);
  persist();
  return s;
}
function updateSponsor(sid, data) {
  const db = load();
  const s = db.sponsoren.find(x => x.id === sid);
  if (!s) return null;
  if (data.logoPath && s.logoPath && data.logoPath !== s.logoPath) {
    deleteUploadedFile(s.logoPath);
  }
  Object.assign(s, data);
  persist();
  return s;
}
function deleteSponsor(sid) {
  const db = load();
  const s = db.sponsoren.find(x => x.id === sid);
  if (s && s.logoPath) deleteUploadedFile(s.logoPath);
  db.sponsoren = db.sponsoren.filter(x => x.id !== sid);
  persist();
}
function moveSponsor(sid, direction) {
  const db = load();
  const list = listSponsoren();
  const idx = list.findIndex(s => s.id === sid);
  if (idx === -1) return;
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= list.length) return;
  const s1 = db.sponsoren.find(x => x.id === list[idx].id);
  const s2 = db.sponsoren.find(x => x.id === list[swapWith].id);
  const tmp = s1.order;
  s1.order = s2.order;
  s2.order = tmp;
  persist();
}

// ---------- Ausgaben ----------
function listAusgaben() {
  return load().ausgaben.slice().sort((a, b) => b.nummer - a.nummer);
}
function getAusgabe(aid) {
  return load().ausgaben.find(a => a.id === aid) || null;
}
function getLatestPublishedAusgabe() {
  const items = load().ausgaben.filter(a => a.status === 'published');
  if (!items.length) return null;
  return items.sort((a, b) => b.nummer - a.nummer)[0];
}

// Erstellt eine neue Ausgabe als Momentaufnahme aller "aktuellen" Veranstaltungen/News,
// veroeffentlicht sie sofort und archiviert die verwendeten Inhalte.
function createAndPublishAusgabe({ titelbildPath } = {}) {
  const db = load();
  const settings = db.settings;

  const veranstaltungen = db.veranstaltungen.filter(v => v.status === 'aktuell');
  const news = db.news.filter(n => n.status === 'aktuell');
  const anzeigen = db.anzeigen.filter(a => a.status === 'aktuell');
  const ortsteile = listOrtsteile();

  const nummer = typeof settings.naechsteAusgabenNummer === 'number' ? settings.naechsteAusgabenNummer : 1;

  const ausgabe = {
    id: id(),
    nummer,
    jahr: settings.erscheinungsjahr || new Date().getFullYear(),
    datum: new Date().toISOString().slice(0, 10),
    gemeindeName: settings.gemeindeName,
    untertitel: settings.untertitel,
    titelbildPath: titelbildPath || settings.titelbildPath || null,
    status: 'published',
    publishedAt: new Date().toISOString(),
    // Momentaufnahme: featured Veranstaltungen fuer die Titelseite
    featuredVeranstaltungen: veranstaltungen.filter(v => v.featured).map(v => ({ ...v })),
    // Feste Service-Infos (Notfallnummern, Impressum ...) zum Zeitpunkt der Veroeffentlichung
    servicerubriken: listServicerubriken().map(r => ({ ...r })),
    sponsoren: listSponsoren().map(s => ({ ...s })),
    // Alle Veranstaltungen/News gruppiert je Ortsteil (null = gemeindeweit)
    ortsteile: ortsteile.map(o => ({
      id: o.id,
      name: o.name,
      veranstaltungen: veranstaltungen.filter(v => v.ortsteilId === o.id).map(v => ({ ...v })),
      news: news.filter(n => n.ortsteilId === o.id).map(n => ({ ...n }))
    })),
    gemeindeweitVeranstaltungen: veranstaltungen.filter(v => !v.ortsteilId).map(v => ({ ...v })),
    gemeindeweitNews: news.filter(n => !n.ortsteilId).map(n => ({ ...n })),
    anzeigen: anzeigen.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(a => ({ ...a })),
    pdfPath: null
  };

  db.ausgaben.push(ausgabe);

  // verwendete Inhalte archivieren, damit die naechste Ausgabe wieder leer startet
  veranstaltungen.forEach(v => { v.status = 'archiviert'; v.ausgabeId = ausgabe.id; });
  news.forEach(n => { n.status = 'archiviert'; n.ausgabeId = ausgabe.id; });
  anzeigen.forEach(a => { a.status = 'archiviert'; a.ausgabeId = ausgabe.id; });

  db.settings.naechsteAusgabenNummer = nummer + 1;

  persist();
  return ausgabe;
}

function setAusgabePdfPath(aid, pdfPath) {
  const db = load();
  const a = db.ausgaben.find(x => x.id === aid);
  if (!a) return null;
  a.pdfPath = pdfPath;
  persist();
  return a;
}

// Gruppiert eine Liste von Meldungen nach Rubrik (in fester Reihenfolge),
// leere Rubriken werden weggelassen. Wird von der Web-Ansicht und dem
// PDF-Generator gleichermaßen genutzt, damit beide identisch aussehen.
function groupNewsByRubrik(newsArray) {
  const byRubrik = {};
  NEWS_RUBRIKEN.forEach(r => { byRubrik[r] = []; });
  (newsArray || []).forEach(n => {
    const r = NEWS_RUBRIKEN.includes(n.rubrik) ? n.rubrik : 'Allgemein';
    byRubrik[r].push(n);
  });
  return NEWS_RUBRIKEN
    .map(r => ({ rubrik: r, items: byRubrik[r] }))
    .filter(g => g.items.length > 0);
}

module.exports = {
  id,
  NEWS_RUBRIKEN,
  getSettings, updateSettings,
  listOrtsteile, getOrtsteil, createOrtsteil, updateOrtsteil, deleteOrtsteil, reorderOrtsteile,
  listVeranstaltungen, getVeranstaltung, createVeranstaltung, updateVeranstaltung, deleteVeranstaltung,
  listNews, getNews, createNews, updateNews, deleteNews,
  listAnzeigen, getAnzeige, createAnzeige, updateAnzeige, deleteAnzeige, moveAnzeige,
  listServicerubriken, getServicerubrik, createServicerubrik, updateServicerubrik, deleteServicerubrik, moveServicerubrik,
  listSponsoren, getSponsor, createSponsor, updateSponsor, deleteSponsor, moveSponsor,
  listAusgaben, getAusgabe, getLatestPublishedAusgabe, createAndPublishAusgabe, setAusgabePdfPath,
  groupNewsByRubrik
};
