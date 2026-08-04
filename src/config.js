const path = require('path');
require('dotenv').config();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');
const PDF_DIR = process.env.PDF_DIR || path.join(__dirname, 'public', 'pdf');

module.exports = {
  PORT: process.env.PORT || 3000,
  SESSION_SECRET: process.env.SESSION_SECRET || 'bitte-in-.env-aendern-mitteilungsblatt-secret',
  DATA_DIR,
  UPLOAD_DIR,
  PDF_DIR,
  SESSIONS_DIR: path.join(DATA_DIR, 'sessions'),
  DB_FILE: path.join(DATA_DIR, 'db.json')
};
