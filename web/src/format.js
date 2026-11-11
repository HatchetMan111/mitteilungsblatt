// Datums-Helfer (ISO "YYYY-MM-DD" → deutsche Anzeige), identisches Format
// wie zuvor in den EJS-Templates bzw. im PDF.

export function formatDatum(iso) {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function formatTag(iso) {
  if (!iso) return { tag: '', rest: '' };
  const parts = String(iso).split('-');
  if (parts.length !== 3) return { tag: '', rest: '' };
  const [y, m, d] = parts;
  return { tag: d, rest: MONATE[parseInt(m, 10) - 1] || '' };
}

// Sponsor-Website ohne Protokoll ergänzen, damit href gültig ist
export function sichereUrl(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : 'https://' + url;
}

export function heuteIso() {
  return new Date().toISOString().slice(0, 10);
}
