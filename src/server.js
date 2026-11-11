const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const FileStore = require('session-file-store')(session);

const config = require('./config');
const { requireAuth } = require('./lib/auth');

[config.DATA_DIR, config.UPLOAD_DIR, config.PDF_DIR, config.SESSIONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const PUBLIC_DIR = path.join(__dirname, 'public');
const APP_DIR = path.join(PUBLIC_DIR, 'app'); // gebauter React-Frontend-Code (web/ → npm run build)

const app = express();

// Falls die App hinter einem Reverse-Proxy (nginx/Caddy fuer HTTPS) laeuft,
// sorgt das dafuer, dass req.ip die echte Client-IP liefert (wichtig fuer
// das Rate-Limiting beim Login) statt der Proxy-IP.
app.set('trust proxy', 1);

// Sicherheits-Header. Die React-SPA wird als normale Dateien ausgeliefert,
// daher kann die CSP jetzt aktiv sein (nur Inline-Styles bleiben erlaubt,
// weil React style-Attribute direkt setzt).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// ---- CSRF-Zusatzsicherung (neben SameSite=Lax-Cookie) ----
// Schreibende API-Anfragen mit fremdem Origin-Header ablehnen. Ein Header
// dieser Form kann von einem b oesartigen Cross-Site-Formular nicht gesetzt
// werden; fehlt der Header (curl, alte Browser), greift ohnehin SameSite=Lax.
app.use('/api', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        return res.status(403).json({ error: 'Anfrage abgelehnt (fremder Origin).', code: 'CSRF' });
      }
    } catch (e) {
      return res.status(403).json({ error: 'Anfrage abgelehnt (ungültiger Origin).', code: 'CSRF' });
    }
  }
  next();
});

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12h

const sessionStore = new FileStore({
  path: config.SESSIONS_DIR,
  logFn: () => {},
  // Abgelaufene Session-Dateien automatisch aufraeumen (sonst sammeln sie
  // sich unbegrenzt in data/sessions/ an). ttl in Sekunden, an die
  // Cookie-Lebensdauer angeglichen; reapInterval prueft stuendlich.
  ttl: SESSION_MAX_AGE_MS / 1000,
  reapInterval: 3600
});

// Beim Start einmalig sofort aufraeumen, statt bis zu eine Stunde auf den
// ersten automatischen Reap-Durchlauf der Bibliothek zu warten (relevant
// z.B. nach einem Neustart/Update des Dienstes).
sessionStore.list((err, files) => {
  if (err || !files) return;
  // list() liefert volle Dateinamen (z.B. "abc123.json"), expired()/destroy()
  // erwarten dagegen die reine Session-ID ohne Endung - daher hier entfernen.
  const ids = (Array.isArray(files) ? files : Object.keys(files)).map(f => f.replace(/\.json$/, ''));
  ids.forEach(id => {
    sessionStore.expired(id, (err2, isExpired) => {
      if (!err2 && isExpired) sessionStore.destroy(id, () => {});
    });
  });
});

app.use(session({
  store: sessionStore,
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: SESSION_MAX_AGE_MS,
    sameSite: 'lax', // blockt die meisten CSRF-Angriffe bereits browserseitig
    httpOnly: true
  }
}));

// ---- JSON-API (Auth, Redaktion, öffentliche Daten) ----
app.use('/api', require('./routes/api'));

app.locals.requireAuth = requireAuth; // (fuer spaetere serverseitige Erweiterungen)

// ---- SPA-Auslieferung ----
// Alle Nicht-API-GETs bekommen die React-App; das Routing (/, /archiv,
// /ausgabe/:id, /admin/...) uebernimmt der React-Router im Browser.
app.get('*', (req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  const indexFile = path.join(APP_DIR, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  res.status(503).send(`
    <!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Mitteilungsblatt</title></head>
    <body style="font-family:sans-serif;max-width:40rem;margin:4rem auto;line-height:1.6">
      <h1>Frontend nicht gebaut</h1>
      <p>Die React-Oberfläche wurde noch nicht erstellt. Im Projektordner ausführen:</p>
      <pre><code>cd web &amp;&amp; npm install &amp;&amp; npm run build</code></pre>
      <p>Alternativ das fertige Installer-Skript verwenden — es bringt den gebauten
      Frontend-Code bereits mit.</p>
    </body></html>
  `);
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.status(404).send('Seite nicht gefunden.');
});

app.use((err, req, res, next) => {
  console.error(err);

  // Datei-Upload-Fehler (falscher Typ ueber den fileFilter in lib/upload.js,
  // oder zu grosse Datei ueber Multer selbst) verstaendlich melden.
  const isUploadError = err.code === 'LIMIT_FILE_SIZE' || /Nur Bilddateien/.test(err.message || '');
  if (isUploadError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Die Datei ist zu groß (maximal 8 MB erlaubt).'
      : err.message;
    if (req.path.startsWith('/api/')) return res.status(400).json({ error: message });
    return res.status(400).send(message);
  }

  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Serverfehler: ' + err.message });
  res.status(500).send('Ein Fehler ist aufgetreten: ' + err.message);
});

app.listen(config.PORT, () => {
  console.log(`Mitteilungsblatt laeuft auf Port ${config.PORT}`);
});
