// Kleiner Fetch-Wrapper für die JSON-API.
// - wirft bei Fehlern einen ApiError mit Status + Server-Meldung
// - leitet bei 401 (Sitzung abgelaufen) automatisch zur Login-Seite weiter

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined
  });

  if (res.status === 401 && !path.startsWith('/auth') && !path.startsWith('/session')) {
    // Sitzung abgelaufen — zur Login-Seite, danach landet man wieder zurück.
    const hier = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign('/admin/login?abgelaufen=1&zurueck=' + hier);
    throw new ApiError(401, 'Sitzung abgelaufen.');
  }

  let data = {};
  try { data = await res.json(); } catch { /* leere/keine JSON-Antwort */ }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Es ist ein Fehler aufgetreten.');
  return data;
}

// Objekt → FormData (spricht multer auf der Serverseite an)
export function toForm(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (v instanceof File) { if (v) fd.append(k, v); return; }
    fd.append(k, String(v));
  });
  return fd;
}
