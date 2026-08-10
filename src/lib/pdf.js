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
const MIN_FILLER_SPACE = 70; // unter dieser Resthoehe lohnt sich kein Lueckenfueller mehr

const C_INK = '#1f2a24';
const C_ACCENT = '#7a2e2e';
const C_SLATE = '#2f4858';
const C_MUTED = '#6b6459';
const C_RULE = '#c9bfa8';
const C_BAR_BG = '#e7e2d4';

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

  function metaLine(parts) {
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

  // Zeichnet eine umrandete Box mit automatischem Spalten-/Seitenumbruch.
  function box(drawInner, totalHeight, borderColor) {
    ensureSpace(totalHeight);
    boxRaw(drawInner, totalHeight, borderColor);
  }

  // Wie box(), aber OHNE ensureSpace-Aufruf: der Aufrufer hat den Platz
  // bereits selbst geprueft (wird fuer Anzeigen-Luckenfueller gebraucht,
  // damit kein ungewollter Spalten-/Seitenumbruch ausgeloest wird).
  function boxRaw(drawInner, totalHeight, borderColor) {
    doc.rect(colX(), y, COL_W, totalHeight).lineWidth(0.75).strokeColor(borderColor || C_RULE).stroke();
    drawInner(colX() + 8, y + 8, COL_W - 16);
    y += totalHeight + 8;
  }

  // Springt — falls noch nicht geschehen — in die zweite Spalte, OHNE eine
  // neue Seite zu beginnen. Fuer das Auffuellen einer leeren rechten Spalte.
  function forceColumn2() {
    if (col === 0) {
      col = 1;
      y = contentStartY;
    }
  }

  function remainingSpace() {
    return CONTENT_BOTTOM - y;
  }

  return {
    newContentPage, sectionBar, subHeading, orgLabel, paragraph, heading,
    metaLine, image, itemSeparator, box, boxRaw, forceColumn2, remainingSpace,
    get y() { return y; }, set y(v) { y = v; },
    get col() { return col; }
  };
}

// ============================================================
// Inhaltsbausteine: Veranstaltungen & Meldungen
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

// ============================================================
// Anzeigen: Höhen-Berechnung getrennt vom Zeichnen, damit sich vor dem
// Platzieren prüfen lässt, ob eine Anzeige als Lückenfüller passt.
// ============================================================
function anzeigeMetrics(doc, a, width) {
  const innerW = width - 16;
  doc.font('Times-Bold').fontSize(9.5);
  const titleH = doc.heightOfString(a.titel || '', { width: innerW });
  doc.font('Times-Roman').fontSize(8.8);
  const textH = a.text ? doc.heightOfString(a.text, { width: innerW, lineGap: 1 }) : 0;
  const kontaktH = a.kontakt ? 11 : 0;
  const img = fsPathFromWeb(a.bildPath);
  let imgH = 0, imgDims = null;
  if (img) {
    try {
      imgDims = doc.openImage(img);
      const scale = Math.min(innerW / imgDims.width, 130 / imgDims.height, 1);
      imgH = imgDims.height * scale + 6;
    } catch (e) { /* ignore */ }
  }
  const total = 10 + titleH + 4 + (imgH || 0) + (textH ? textH + 4 : 0) + kontaktH + 10;
  return { total, titleH, textH, kontaktH, imgH, img, imgDims, innerW };
}

function drawAnzeigeInner(doc, a, x, yy, w, m) {
  doc.font('Times-Bold').fontSize(9.5).fillColor(C_ACCENT).text(a.titel || '', x, yy, { width: w });
  let cy = yy + m.titleH + 4;
  if (m.img && m.imgDims) {
    const scale = Math.min(w / m.imgDims.width, 130 / m.imgDims.height, 1);
    const iw = m.imgDims.width * scale, ih = m.imgDims.height * scale;
    doc.image(m.img, x, cy, { width: iw, height: ih });
    cy += ih + 6;
  }
  if (a.text) {
    doc.font('Times-Roman').fontSize(8.8).fillColor(C_INK).text(a.text, x, cy, { width: w, lineGap: 1 });
    cy += m.textH + 4;
  }
  if (a.kontakt) {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(C_MUTED).text(a.kontakt, x, cy, { width: w });
  }
}

function renderAnzeige(E, doc, a) {
  const m = anzeigeMetrics(doc, a, COL_W);
  E.box((x, yy, w) => drawAnzeigeInner(doc, a, x, yy, w, m), m.total, C_ACCENT);
}

// Fuellt eine leere oder halbleere Spalte mit passenden Anzeigen aus der
// Warteschlange (kleinste zuerst passende). Pro Luecke maximal MAX_PER_GAP
// Anzeigen, damit sich die Anzeigen ueber mehrere Seiten verteilen statt
// sich alle in einer einzigen grossen Luecke zu haeufen ("zwischen die
// Seiten eingefuegt" statt an einer Stelle konzentriert).
// Konsumierte Anzeigen werden aus adQueue entfernt.
const MAX_PER_GAP = 3;

function fillGapWithAds(E, doc, adQueue) {
  if (!adQueue.length) return;
  E.forceColumn2();
  let placed = 0;
  let changed = true;
  while (changed && placed < MAX_PER_GAP && adQueue.length && E.remainingSpace() > MIN_FILLER_SPACE) {
    changed = false;
    let bestIdx = -1, bestH = Infinity;
    for (let i = 0; i < adQueue.length; i++) {
      const m = anzeigeMetrics(doc, adQueue[i], COL_W);
      if (m.total <= E.remainingSpace() && m.total < bestH) { bestH = m.total; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    const [a] = adQueue.splice(bestIdx, 1);
    const m = anzeigeMetrics(doc, a, COL_W);
    E.boxRaw((x, yy, w) => drawAnzeigeInner(doc, a, x, yy, w, m), m.total, C_ACCENT);
    changed = true;
    placed++;
  }
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
// Sponsoren-Seite (Dankeschön-Seite, volle Breite, kein Spaltensatz)
// ============================================================
function drawSponsorPageHeader(doc, ausgabe) {
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_MUTED)
    .text((ausgabe.gemeindeName || '').toUpperCase(), MARGIN, MARGIN - 2, { width: CONTENT_W * 0.6, characterSpacing: 0.4, lineBreak: false });
  doc.font('Courier').fontSize(7.5).fillColor(C_MUTED)
    .text(`Nr. ${ausgabe.nummer}/${ausgabe.jahr} \u00b7 ${formatDatum(ausgabe.datum)}`, MARGIN, MARGIN - 2, { width: CONTENT_W, align: 'right', lineBreak: false });
  doc.moveTo(MARGIN, MARGIN + 12).lineTo(MARGIN + CONTENT_W, MARGIN + 12)
    .lineWidth(1).strokeColor(C_ACCENT).stroke();
}

function renderSponsorPage(doc, ausgabe, sponsoren) {
  doc.addPage();
  drawSponsorPageHeader(doc, ausgabe);

  let y = CONTENT_TOP + 26;
  doc.font('Times-Bold').fontSize(18).fillColor(C_INK)
    .text('Diese Ausgabe wird unterstützt von', MARGIN, y, { width: CONTENT_W, align: 'center' });
  y += 26;
  doc.moveTo(PAGE_W / 2 - 60, y).lineTo(PAGE_W / 2 + 60, y).lineWidth(1.5).strokeColor(C_ACCENT).stroke();
  y += 34;

  const cols = 3;
  const gap = 20;
  const cellW = (CONTENT_W - gap * (cols - 1)) / cols;
  const ROW_RESERVE = 115; // grobzuegige Reservehoehe pro Zeile fuer den Seitenumbruch-Check
  const LOGO_SLOT_H = 55; // feste Logo-Reservehoehe, damit Namen ohne Logo buendig mit denen mit Logo stehen

  let col = 0;
  let rowTop = y;
  let rowMaxH = 0;

  sponsoren.forEach(s => {
    if (col === 0 && rowTop + ROW_RESERVE > CONTENT_BOTTOM) {
      doc.addPage();
      drawSponsorPageHeader(doc, ausgabe);
      rowTop = CONTENT_TOP + 20;
    }
    const x = MARGIN + col * (cellW + gap);
    const logo = fsPathFromWeb(s.logoPath);
    if (logo) {
      try {
        const dims = doc.openImage(logo);
        const scale = Math.min(cellW / dims.width, (LOGO_SLOT_H - 8) / dims.height, 1);
        const w = dims.width * scale, h = dims.height * scale;
        doc.image(logo, x + (cellW - w) / 2, rowTop + (LOGO_SLOT_H - h) / 2, { width: w, height: h });
      } catch (e) { /* ignore */ }
    }
    let cy = rowTop + LOGO_SLOT_H;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C_INK).text(s.name || '', x, cy, { width: cellW, align: 'center' });
    cy += doc.heightOfString(s.name || '', { width: cellW, align: 'center' }) + 3;
    if (s.beschreibung) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(C_MUTED).text(s.beschreibung, x, cy, { width: cellW, align: 'center' });
      cy += doc.heightOfString(s.beschreibung, { width: cellW, align: 'center' }) + 3;
    }
    if (s.website) {
      doc.font('Helvetica').fontSize(8).fillColor(C_ACCENT).text(s.website, x, cy, { width: cellW, align: 'center' });
      cy += 12;
    }
    rowMaxH = Math.max(rowMaxH, cy - rowTop);

    col++;
    if (col >= cols) {
      col = 0;
      rowTop += rowMaxH + 26;
      rowMaxH = 0;
    }
  });
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

      renderCover(doc, ausgabe, { logoPath: ausgabe.logoPath || null });

      const E = createEngine(doc, ausgabe);
      // Warteschlange aller Anzeigen: wird als Luckenfueller nach und nach
      // geleert; was am Ende uebrig bleibt, bekommt eine eigene Seite.
      const adQueue = (ausgabe.anzeigen || []).slice();

      // ---------- Service & Notfallnummern ----------
      const servicerubriken = ausgabe.servicerubriken || [];
      if (servicerubriken.length) {
        E.sectionBar('Service & Notfallnummern');
        servicerubriken.forEach(r => {
          E.heading(r.titel, { font: 'Helvetica-Bold', size: 9.5 });
          E.paragraph(r.inhalt || '', { font: 'Helvetica', size: 8.8, align: 'left', gapAfter: 3 });
          E.itemSeparator();
        });
        fillGapWithAds(E, doc, adQueue);
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
        fillGapWithAds(E, doc, adQueue);
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
        fillGapWithAds(E, doc, adQueue);
      });

      // ---------- Verbleibende Anzeigen & Werbung ----------
      // (alles, was nicht bereits als Luckenfueller zwischen den Seiten
      // untergebracht werden konnte)
      if (adQueue.length) {
        E.sectionBar('Weitere Anzeigen');
        adQueue.forEach(a => renderAnzeige(E, doc, a));
      }

      // ---------- Sponsoren (eigene Dankeschoen-Seite am Schluss) ----------
      const sponsoren = ausgabe.sponsoren || [];
      if (sponsoren.length) {
        renderSponsorPage(doc, ausgabe, sponsoren);
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
