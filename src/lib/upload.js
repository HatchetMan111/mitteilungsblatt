const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOAD_DIR } = require('../config');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED.has(ext) ? ext : '.jpg';
    cb(null, crypto.randomBytes(8).toString('hex') + safeExt);
  }
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED.has(ext)) return cb(new Error('Nur Bilddateien (jpg, png, webp, gif) sind erlaubt.'));
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 } // 8 MB
});

// Liefert den web-relativen Pfad (fuer <img src>) aus dem multer-Dateiobjekt
function publicPath(file) {
  if (!file) return null;
  return '/uploads/' + file.filename;
}

// Loescht eine zuvor hochgeladene Datei anhand ihres web-relativen Pfads
// (z.B. '/uploads/abc123.jpg'). Wird beim Loeschen/Ersetzen von Datensaetzen
// aufgerufen, damit keine verwaisten Dateien liegen bleiben. Der Dateiname
// wird ueber path.basename() bereinigt, sodass ausschliesslich Dateien
// innerhalb von UPLOAD_DIR geloescht werden koennen (kein Path-Traversal).
function deleteUploadedFile(webPath) {
  if (!webPath || typeof webPath !== 'string') return;
  const filename = path.basename(webPath);
  const full = path.join(UPLOAD_DIR, filename);
  fs.unlink(full, () => { /* Datei existierte evtl. schon nicht mehr - kein Problem */ });
}

module.exports = { upload, publicPath, deleteUploadedFile };
