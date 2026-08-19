const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const FileStore = require('session-file-store')(session);

const config = require('./config');
const { attachLocals } = require('./lib/auth');

[config.DATA_DIR, config.UPLOAD_DIR, config.PDF_DIR, config.SESSIONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();

// Falls die App hinter einem Reverse-Proxy (nginx/Caddy fuer HTTPS) laeuft,
// sorgt das dafuer, dass req.ip die echte Client-IP liefert (wichtig fuer
// das Rate-Limiting beim Login) statt der Proxy-IP.
app.set('trust proxy', 1);

// Sicherheits-Header (CSP bewusst deaktiviert, da einige Templates noch
// inline style-Attribute nutzen; die uebrigen Header - u.a. X-Frame-Options
// gegen Clickjacking, X-Content-Type-Options - greifen trotzdem).
app.use(helmet({ contentSecurityPolicy: false }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.use(attachLocals);

app.locals.formatDatum = (iso) => {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
};
app.locals.formatTag = (iso) => {
  if (!iso) return { tag: '', rest: '' };
  const parts = String(iso).split('-');
  if (parts.length !== 3) return { tag: '', rest: '' };
  const monate = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const [y, m, d] = parts;
  return { tag: d, rest: monate[parseInt(m, 10) - 1] || '' };
};

app.use('/admin', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/public'));

app.use((req, res) => {
  res.status(404).send('Seite nicht gefunden.');
});

app.use((err, req, res, next) => {
  console.error(err);

  // Datei-Upload-Fehler (falscher Typ ueber den fileFilter in lib/upload.js,
  // oder zu grosse Datei ueber Multer selbst) bekommen eine verstaendliche,
  // zur App passende Fehlerseite statt eines rohen Stacktrace-Texts.
  const isUploadError = err.code === 'LIMIT_FILE_SIZE' || /Nur Bilddateien/.test(err.message || '');
  if (isUploadError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Die Datei ist zu groß (maximal 8 MB erlaubt).'
      : err.message;
    return res.status(400).send(`
      <!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
      <link rel="stylesheet" href="/css/style.css"></head>
      <body><div class="login-shell"><div class="login-card">
        <h1>Datei-Upload fehlgeschlagen</h1>
        <p class="sub">${message}</p>
        <button onclick="history.back()" class="btn btn-accent" style="width:100%">Zurück zum Formular</button>
      </div></div></body></html>
    `);
  }

  res.status(500).send('Ein Fehler ist aufgetreten: ' + err.message);
});

app.listen(config.PORT, () => {
  console.log(`Mitteilungsblatt laeuft auf Port ${config.PORT}`);
});
