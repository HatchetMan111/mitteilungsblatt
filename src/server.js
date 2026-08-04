const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

const config = require('./config');
const { attachLocals } = require('./lib/auth');

[config.DATA_DIR, config.UPLOAD_DIR, config.PDF_DIR, config.SESSIONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new FileStore({ path: config.SESSIONS_DIR, logFn: () => {} }),
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 } // 12h
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
  res.status(500).send('Ein Fehler ist aufgetreten: ' + err.message);
});

app.listen(config.PORT, () => {
  console.log(`Mitteilungsblatt laeuft auf Port ${config.PORT}`);
});
