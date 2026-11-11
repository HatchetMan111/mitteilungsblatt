import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { EmptyState, Spinner } from '../components.jsx';
import AusgabeView from './AusgabeView.jsx';

// Vorschau der nächsten Ausgabe (aus der Redaktion geöffnet).
// Zeigt exakt das, was beim Veröffentlichen entstehen würde — ganz ohne
// etwas zu speichern oder zu archivieren. Deutlich als Vorschau gekennzeichnet.
export default function Vorschau() {
  const [data, setData] = useState(null);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    api('/admin/vorschau')
      .then(setData)
      .catch(e => setFehler(e));
  }, []);

  if (fehler) {
    return (
      <div className="site">
        <div className="preview-banner no-print">
          <strong>Vorschau nicht möglich</strong> — <Link to="/admin/ausgaben">← Zurück zur Redaktion</Link>
        </div>
        <EmptyState
          titel={fehler.status === 401 ? 'Nicht angemeldet' : 'Keine Inhalte vorgemerkt'}
          text={fehler.status === 401
            ? 'Für die Vorschau musst du in der Redaktion angemeldet sein.'
            : 'Es sind aktuell keine Veranstaltungen oder Meldungen für die nächste Ausgabe vorgemerkt.'}
        />
      </div>
    );
  }
  if (!data) return <Spinner />;

  return (
    <>
      <div className="preview-banner no-print">
        <strong>Vorschau</strong> — diese Ausgabe ist noch nicht veröffentlicht. So würde sie aussehen.
        <Link to="/admin/ausgaben">← Zurück zur Redaktion</Link>
      </div>
      <div className="site">
        <header className="masthead">
          {data.settings?.logoPath && <img className="masthead__logo" src={data.settings.logoPath} alt="" />}
          <div className="masthead__gemeinde">{data.ausgabe.gemeindeName}</div>
          {data.ausgabe.untertitel && <div className="masthead__untertitel">{data.ausgabe.untertitel}</div>}
        </header>
        <AusgabeView ausgabe={data.ausgabe} isPreview />
      </div>
    </>
  );
}
