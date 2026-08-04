const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { UPLOAD_DIR } = require('../config');
const { groupNewsByRubrik } = require('./db');

// ============================================================
// Layout-Konstanten (Zeitungssatz: zwei Spalten, laufender Kopf/Fuß)
// Farbwerte an das Web-Design angeglichen (siehe public/css/style.css)
// ============================================================
const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const MARGIN = 40;
const HEADER_H = 26;   // Platz fuer laufenden Kopf auf Inhaltsseiten
const FOOTER_H = 22;   // Platz fuer Fusszeile
const COL_GAP = 16;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const COL_W = (CONTENT_W - COL_GAP) / 2;
const COL_X = [MARGIN, MARGIN + COL_W + COL_GAP];
const CONTENT_TOP = MARGIN + HEADER_H;
const CONTENT_BOTTOM = PAGE_H - MARGIN - FOOTER_H;

const C_INK = '#1f2a24';
const C_ACCENT = '#7a2e2e';
const C_SLATE = '#2f4858';
const C_MUTED = '#6b6459';
const C_RULE = '#c9bfa8';
const C_BAR_BG = '#e7e2d4';
const C_PAPER = '#fffdf8';

function fsPathFromWeb(webPath) {
  if (!webPath) return null;
  const filename = path.basename(webPath);
  const full = path.join(UPLOAD_DIR, filename);
  return fs.existsSync(full) ? full : null;
}

function formatDatum(iso) {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}

// ============================================================
// Spalten-Engine: verwaltet fortlaufenden zweispaltigen Textfluss
// ============================================================
function createEngine(doc, ausgabe) {
  let col = 0;
  let y = CONTENT_TOP;
  let contentStartY = CONTENT_TOP; // Y-Position, an der BEIDE Spalten beginnen (unterhalb eines evtl. Rubrik-Balkens)
  let sectionLabel = '';

  function drawRunningHeader(continuation) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_MUTED)
      .text((ausgabe.gemeindeName || '').toUpperCase(), MARGIN, MARGIN - 2, { width: CONTENT_W * 0.6, characterSpacing: 0.4, lineBreak: false });
    doc.font('Courier').fontSize(7.5).fillColor(C_MUTED)
      .text(`Nr. ${ausgabe.nummer}/${ausgabe.jahr} \u00b7 ${formatDatum(ausgabe.datum)}`, MARGIN, MARGIN - 2, { width: CONTENT_W, align: 'right', lineBreak: false });
    doc.moveTo(MARGIN, MARGIN + 12).lineTo(MARGIN + CONTENT_W, MARGIN + 12)
      .lineWidth(1).strokeColor(C_ACCENT).stroke();
    if (continuation) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(C_MUTED)
        .text(`Fortsetzung: ${continuation}`, MARGIN, MARGIN + 15, { width: CONTENT_W, lineBreak: false });
    }
  }

  function drawColumnDivider() {
    const xMid = MARGIN + COL_W + COL_GAP / 2;
    doc.moveTo(xMid, CONTENT_TOP).lineTo(xMid, CONTENT_BOTTOM)
      .lineWidth(0.5).strokeColor(C_RULE).stroke();
  }

  function newContentPage(continuation) {
    doc.addPage();
    drawRunningHeader(continuation);
    drawColumnDivider();
    col = 0;
    contentStartY = continuation ? CONTENT_TOP + 18 : CONTENT_TOP;
    y = contentStartY;
  }

  function ensureSpace(h) {
    if (y + h <= CONTENT_BOTTOM) return;
    if (col === 0) {
      col = 1;
      y = contentStartY;
    } else {
      newContentPage(sectionLabel);
    }
  }

  function colX() { return COL_X[col]; }

  // Full-width Rubrik-Balken: startet immer eine frische Seite,
  // damit der Balken ueber beide Spalten sauber sitzt.
  function sectionBar(title) {
    sectionLabel = title;
    newContentPage(null);
    const barH = 22;
    doc.rect(MARGIN, y, CONTENT_W, barH).fill(C_BAR_BG);
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor(C_INK)
      .text(title.toUpperCase(), MARGIN + 8, y + 5.5, { width: CONTENT_W - 16, characterSpacing: 0.4, lineBreak: false });
    y += barH + 10;
    contentStartY = y; // beide Spalten beginnen erst unterhalb des Balkens
  }

  function subHeading(text) {
    ensureSpace(16);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C_SLATE)
      .text(text.toUpperCase(), colX(), y, { width: COL_W, characterSpacing: 0.3 });
    y += doc.heightOfString(text.toUpperCase(), { width: COL_W, characterSpacing: 0.3 }) + 4;
    doc.moveTo(colX(), y).lineTo(colX() + COL_W, y).lineWidth(0.5).strokeColor(C_RULE).stroke();
    y += 6;
  }

  function orgLabel(text) {
    if (!text) return;
    doc.font('Helvetica-Bold').fontSize(7.5);
    const h = doc.heightOfString(text.toUpperCase(), { width: COL_W, characterSpacing: 0.3 });
    ensureSpace(h + 2);
    doc.fillColor(C_SLATE).text(text.toUpperCase(), colX(), y, { width: COL_W, characterSpacing: 0.3 });
    y += h + 2;
  }

  function paragraph(text, opts = {}) {
    const font = opts.font || 'Times-Roman';
    const size = opts.size || 9.3;
    const color = opts.color || C_INK;
    const align = opts.align || 'justify';
    const gapAfter = opts.gapAfter != null ? opts.gapAfter : 5;
    doc.font(font).fontSize(size);
    const h = doc.heightOfString(text, { width: COL_W, align, lineGap: 1.2 });
    ensureSpace(h);
    doc.fillColor(color).text(text, colX(), y, { width: COL_W, align, lineGap: 1.2 });
    y += h + gapAfter;
  }

  function heading(text, opts = {}) {
    const font = opts.font || 'Times-Bold';
    const size = opts.size || 10.5;
    doc.font(font).fontSize(size);
    const h = doc.heightOfString(text, { width: COL_W });
    ensureSpace(h + 2);
    doc.fillColor(C_INK).text(text, colX(), y, { width: COL_W });
    y += h + 2;
  }

  function metaLine(parts, opts = {}) {
    const text = parts.filter(Boolean).join('  \u00b7  ');
    if (!text) return;
    doc.font('Helvetica-Oblique').fontSize(7.8);
    const h = doc.heightOfString(text, { width: COL_W });
    ensureSpace(h + 3);
    doc.fillColor(C_MUTED).text(text, colX(), y, { width: COL_W });
    y += h + 3;
  }

  function image(imgPath, maxH) {
    if (!imgPath) return;
    try {
      const dims = doc.openImage(imgPath);
      const scale = Math.min(COL_W / dims.width, maxH / dims.height, 1);
      const w = dims.width * scale, h = dims.height * scale;
      ensureSpace(h + 4);
      doc.image(imgPath, colX(), y, { width: w, height: h });
      y += h + 6;
    } catch (e) { /* Bild ignorieren, falls defekt */ }
  }

  function itemSeparator() {
    ensureSpace(8);
    doc.moveTo(colX(), y).lineTo(colX() + COL_W * 0.35, y).lineWidth(0.5).strokeColor(C_RULE).stroke();
    y += 8;
  }

  function box(drawInner, totalHeight, borderColor) {
    ensureSpace(totalHeight);
    doc.rect(colX(), y, COL_W, totalHeight).lineWidth(0.75).strokeColor(borderColor || C_RULE).stroke();
    drawInner(colX() + 8, y + 8, COL_W - 16);
    y += totalHeight + 8;
  }

  return {
    newContentPage, sectionBar, subHeading, orgLabel, paragraph, heading,
    metaLine, image, itemSeparator, box,
    get y() { return y; }, set y(v) { y = v; },
    get col() { return col; }
  };
}

// ============================================================
// Inhaltsbausteine
// ============================================================
function renderVeranstaltung(E, doc, v) {
  E.heading(v.titel || '(ohne Titel)');
  E.metaLine([v.organisation, formatDatum(v.datum), v.uhrzeit, v.ort]);
  if (v.beschreibung) E.paragraph(v.beschreibung, { gapAfter: 4 });
  const img = fsPathFromWeb(v.bildPath);
  if (img) E.image(img, 120);
  E.itemSeparator();
}

function renderNews(E, doc, n) {
  if (n.organisation) E.orgLabel(n.organisation);
  E.heading(n.titel || '(ohne Titel)');
  if (n.inhalt) E.paragraph(n.inhalt, { gapAfter: 4 });
  const img = fsPathFromWeb(n.bildPath);
  if (img) E.image(img, 120);
  E.itemSeparator();
}

function renderNewsGrouped(E, doc, newsArray) {
  const groups = groupNewsByRubrik(newsArray);
  groups.forEach(g => {
    E.subHeading(g.rubrik);
    g.items.forEach(n => renderNews(E, doc, n));
  });
}

function renderAnzeige(E, doc, a) {
  const font = 'Times-Roman';
  doc.font('Times-Bold').fontSize(9.5);
  const titleH = doc.heightOfString(a.titel || '', { width: E.col === 0 ? COL_W - 16 : COL_W - 16 });
  const textH = a.text ? doc.font(font).fontSize(8.8).heightOfString(a.text, { width: COL_W - 16, lineGap: 1 }) : 0;
  const kontaktH = a.kontakt ? 11 : 0;
  const img = fsPathFromWeb(a.bildPath);
  let imgH = 0, imgDims = null;
  if (img) {
    try {
      imgDims = doc.openImage(img);
      const scale = Math.min((COL_W - 16) / imgDims.width, 140 / imgDims.height, 1);
      imgH = imgDims.height * scale + 6;
    } catch (e) { /* ignore */ }
  }
  const total = 10 + titleH + 4 + textH + (textH ? 4 : 0) + imgH + kontaktH + 10;
  E.box((x, yy, w) => {
    doc.font('Times-Bold').fontSize(9.5).fillColor(C_ACCENT).text(a.titel || '', x, yy, { width: w });
    let cy = yy + titleH + 4;
    if (img && imgDims) {
      const scale = Math.min(w / imgDims.width, 140 / imgDims.height, 1);
      const iw = imgDims.width * scale, ih = imgDims.height * scale;
      doc.image(img, x, cy, { width: iw, height: ih });
      cy += ih + 6;
    }
    if (a.text) {
      doc.font(font).fontSize(8.8).fillColor(C_INK).text(a.text, x, cy, { width: w, lineGap: 1 });
      cy += textH + 4;
    }
    if (a.kontakt) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(C_MUTED).text(a.kontakt, x, cy, { width: w });
    }
  }, total, C_ACCENT);
}

// ============================================================
// Titelseite
// ============================================================
function renderCover(doc, ausgabe, settings) {
  // Dekorativer Schwung im Mastkopf (angelehnt an klassische Amtsblatt-Titel)
  doc.save();
  doc.path(`M0,150 C 150,120 450,180 ${PAGE_W},130 L ${PAGE_W},0 L 0,0 Z`).fill('#efeadd');
  doc.path(`M0,158 C 150,130 450,188 ${PAGE_W},140`).lineWidth(3).strokeColor(C_ACCENT).stroke();
  doc.restore();

  let y = 40;
  const logo = fsPathFromWeb(settings.logoPath);
  if (logo) {
    try {
      const dims = doc.openImage(logo);
      const h = 46, w = dims.width * (h / dims.height);
      doc.image(logo, MARGIN, y, { height: h, width: w });
    } catch (e) { /* ignore */ }
  }

  doc.font('Times-Bold').fontSize(30).fillColor(C_INK)
    .text(ausgabe.gemeindeName || 'Mitteilungsblatt', 0, y + 6, { align: 'center', width: PAGE_W });
  y += 46;
  if (ausgabe.untertitel) {
    doc.font('Helvetica').fontSize(11).fillColor(C_MUTED)
      .text(ausgabe.untertitel.toUpperCase(), 0, y, { align: 'center', width: PAGE_W, characterSpacing: 1 });
    y += 16;
  }
  doc.font('Courier-Bold').fontSize(10).fillColor(C_ACCENT)
    .text(`\u2014  Ausgabe Nr. ${ausgabe.nummer} / ${ausgabe.jahr}  \u00b7  ${formatDatum(ausgabe.datum)}  \u2014`, 0, y, { align: 'center', width: PAGE_W });
  y += 30;

  const titelbild = fsPathFromWeb(ausgabe.titelbildPath);
  if (titelbild) {
    try {
      const dims = doc.openImage(titelbild);
      const w = CONTENT_W;
      const h = Math.min(w * (dims.height / dims.width), 230);
      doc.image(titelbild, MARGIN, y, { width: w, height: h });
      doc.rect(MARGIN, y, w, h).lineWidth(1).strokeColor(C_RULE).stroke();
      y += h + 18;
    } catch (e) { /* ignore */ }
  }

  const featured = ausgabe.featuredVeranstaltungen || [];
  if (featured.length) {
    doc.rect(MARGIN, y, CONTENT_W, 20).fill(C_INK);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#ffffff')
      .text('WICHTIGSTE VERANSTALTUNGEN', MARGIN + 10, y + 5, { characterSpacing: 0.5 });
    y += 20;
    const boxTop = y;
    featured.forEach(v => {
      doc.font('Times-Bold').fontSize(11).fillColor(C_ACCENT).text(v.titel || '', MARGIN + 14, y + 8, { width: CONTENT_W - 28 });
      y += doc.heightOfString(v.titel || '', { width: CONTENT_W - 28 }) + 10;
      const meta = [v.organisation, formatDatum(v.datum), v.uhrzeit, v.ort].filter(Boolean).join('  \u00b7  ');
      if (meta) {
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(C_MUTED).text(meta, MARGIN + 14, y, { width: CONTENT_W - 28 });
        y += doc.heightOfString(meta, { width: CONTENT_W - 28 }) + 4;
      }
      if (v.beschreibung) {
        doc.font('Times-Roman').fontSize(9.3).fillColor(C_INK).text(v.beschreibung, MARGIN + 14, y, { width: CONTENT_W - 28, lineGap: 1.2 });
        y += doc.heightOfString(v.beschreibung, { width: CONTENT_W - 28, lineGap: 1.2 }) + 10;
      } else {
        y += 6;
      }
    });
    doc.rect(MARGIN, boxTop, CONTENT_W, y - boxTop).lineWidth(1).strokeColor(C_INK).stroke();
    y += 12;
  }
}

// ============================================================
// Hauptfunktion
// ============================================================
async function generateAusgabePdf(ausgabe, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: MARGIN, autoFirstPage: true, bufferPages: true });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const settings = { logoPath: null }; // Logo kommt bereits ueber ausgabe, Platzhalter fuer Erweiterung
      renderCover(doc, ausgabe, { logoPath: ausgabe.logoPath || null });

      const E = createEngine(doc, ausgabe);

      // ---------- Service & Notfallnummern ----------
      const servicerubriken = ausgabe.servicerubriken || [];
      if (servicerubriken.length) {
        E.sectionBar('Service & Notfallnummern');
        servicerubriken.forEach(r => {
          E.heading(r.titel, { font: 'Helvetica-Bold', size: 9.5 });
          E.paragraph(r.inhalt || '', { font: 'Helvetica', size: 8.8, align: 'left', gapAfter: 3 });
          E.itemSeparator();
        });
      }

      // ---------- Allgemeines aus der Gemeinde ----------
      const gemNews = ausgabe.gemeindeweitNews || [];
      const gemVer = (ausgabe.gemeindeweitVeranstaltungen || []).filter(v => !v.featured);
      if (gemNews.length || gemVer.length) {
        E.sectionBar('Allgemeines aus der Gemeinde');
        if (gemVer.length) {
          E.subHeading('Veranstaltungen');
          gemVer.forEach(v => renderVeranstaltung(E, doc, v));
        }
        if (gemNews.length) renderNewsGrouped(E, doc, gemNews);
      }

      // ---------- Ortsteile ----------
      (ausgabe.ortsteile || []).forEach(ot => {
        const ver = (ot.veranstaltungen || []).filter(v => !v.featured);
        const news = ot.news || [];
        if (!ver.length && !news.length) return;
        E.sectionBar(`Aus ${ot.name}`);
        if (ver.length) {
          E.subHeading('Veranstaltungen');
          ver.forEach(v => renderVeranstaltung(E, doc, v));
        }
        if (news.length) renderNewsGrouped(E, doc, news);
      });

      // ---------- Anzeigen & Werbung ----------
      const anzeigen = ausgabe.anzeigen || [];
      if (anzeigen.length) {
        E.sectionBar('Anzeigen & Werbung');
        anzeigen.forEach(a => renderAnzeige(E, doc, a));
      }

      // ---------- Seitenzahlen (auf allen Seiten inkl. Titelseite) ----------
      const range = doc.bufferedPageRange();
      const savedBottom = doc.page.margins.bottom;
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(7.5).fillColor(C_MUTED).text(
          `${ausgabe.gemeindeName || ''}  \u00b7  Ausgabe ${ausgabe.nummer}/${ausgabe.jahr}   \u2014   Seite ${i + 1} von ${range.count}`,
          MARGIN, PAGE_H - 26, { width: CONTENT_W, align: 'center' }
        );
        doc.page.margins.bottom = savedBottom;
      }

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateAusgabePdf };
