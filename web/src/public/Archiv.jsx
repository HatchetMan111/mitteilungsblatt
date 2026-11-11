import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { FileDown, Search, SearchX, X } from 'lucide-react';
import { api } from '../api.js';
import { formatDatum } from '../format.js';
import { EmptyState, Spinner } from '../components.jsx';

// Archiv: Volltextsuche über alle Ausgaben + Jahresfilter.
// Die Suche greift debounced live, ohne Absenden eines Formulars.
export default function Archiv() {
  const { settings } = useOutletContext();
  const [data, setData] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [q, setQ] = useState('');
  const [jahr, setJahr] = useState('');
  const [suche, setSuche] = useState(false); // wurde schon gesucht/gefiltert?

  useEffect(() => {
    // Debounce: 250ms nach der letzten Eingabe suchen
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (jahr) params.set('jahr', jahr);
      api('/public/archiv?' + params.toString())
        .then(d => { setData(d); setSuche(!!(q.trim() || jahr)); })
        .catch(e => setFehler(e.message));
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, jahr]);

  if (fehler) return <EmptyState titel="Fehler" text={fehler} />;
  if (!data) return <Spinner />;

  const reset = () => { setQ(''); setJahr(''); };

  return (
    <section>
      {data.gesamtAnzahl > 0 && (
        <div className="archiv-suche">
          <div className="suche-feld">
            <Search size={15} className="suche-icon" aria-hidden="true" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Suche nach Titel, Verein, Ortsteil …"
              aria-label="Archiv durchsuchen"
            />
          </div>
          <select value={jahr} onChange={e => setJahr(e.target.value)} aria-label="Jahr filtern">
            <option value="">Alle Jahre</option>
            {data.jahre.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          {suche && (
            <button type="button" className="archiv-suche__reset btn-download" onClick={reset}>
              <X size={13} /> Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {suche && (
        <p className="form-hint" style={{ margin: '-.4rem 0 1.2rem' }}>
          {data.ausgaben.length} von {data.gesamtAnzahl} Ausgabe{data.gesamtAnzahl === 1 ? '' : 'n'} gefunden.
        </p>
      )}

      {!data.gesamtAnzahl ? (
        <EmptyState titel="Noch keine Ausgaben im Archiv" />
      ) : data.ausgaben.length === 0 ? (
        <EmptyState
          icon={SearchX}
          titel="Keine Treffer"
          text={<>Für diese Suche/diesen Filter gibt es keine passende Ausgabe. <a href="#" onClick={e => { e.preventDefault(); reset(); }}>Alle Ausgaben anzeigen</a></>}
        />
      ) : (
        <ul className="archiv-list">
          {data.ausgaben.map(a => (
            <li key={a.id}>
              <span className="nr">Nr. {a.nummer}/{a.jahr}</span>
              <Link className="titel" to={`/ausgabe/${a.id}`}>{a.gemeindeName || settings?.gemeindeName}</Link>
              <span className="datum">{formatDatum(a.datum)}</span>
              {a.pdfPath && (
                <a href={a.pdfPath} className="btn-download"><FileDown size={13} /> PDF</a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
