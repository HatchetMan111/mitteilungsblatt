import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, FileDown, ExternalLink, MapPinned, Megaphone, Newspaper, Handshake, Plus } from 'lucide-react';
import { api } from '../api.js';
import { formatDatum } from '../format.js';
import { PageHeader, Spinner, EmptyState, FehlerBox } from '../components.jsx';

const STATS = [
  { key: 'ortsteile', label: 'Ortsteile', icon: MapPinned, zu: '/admin/ortsteile' },
  { key: 'veranstaltungen', label: 'Offene Veranstaltungen', icon: CalendarDays, zu: '/admin/veranstaltungen' },
  { key: 'news', label: 'Offene Meldungen', icon: Newspaper, zu: '/admin/news' },
  { key: 'anzeigen', label: 'Offene Anzeigen', icon: Megaphone, zu: '/admin/anzeigen' },
  { key: 'sponsoren', label: 'Sponsoren', icon: Handshake, zu: '/admin/sponsoren' },
  { key: 'ausgaben', label: 'Veröffentlichte Ausgaben', icon: BookOpen, zu: '/admin/ausgaben' }
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    api('/admin/overview').then(setData).catch(e => setFehler(e.message));
  }, []);

  if (fehler) return <FehlerBox>{fehler}</FehlerBox>;
  if (!data) return <Spinner />;

  const letzte = data.letzteAusgabe;

  return (
    <>
      <PageHeader
        titel={data.settings.gemeindeName}
        untertitel="Redaktions-Übersicht"
        aktion={<Link to="/admin/ausgaben" className="btn btn-accent">Ausgabe erstellen</Link>}
      />

      <div className="stat-grid">
        {STATS.map(s => (
          <Link key={s.key} to={s.zu} className="stat-card">
            <div className="num">{data.counts[s.key]}</div>
            <div className="label">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="card">
        <h2>Nächste Ausgabe</h2>
        <p>
          Aktuell sind <strong>{data.counts.veranstaltungen} Veranstaltungen</strong> und{' '}
          <strong>{data.counts.news} Meldungen</strong> für die nächste Ausgabe vorgemerkt.
          Neue Inhalte fügst du bei „Veranstaltungen“ bzw. „Meldungen“ hinzu — sie erscheinen
          automatisch in der nächsten Ausgabe, sortiert nach Ortsteil.
        </p>
        <div className="actions-row">
          <Link to="/admin/veranstaltungen/neu" className="btn btn-outline"><Plus size={14} /> Veranstaltung</Link>
          <Link to="/admin/news/neu" className="btn btn-outline"><Plus size={14} /> Meldung</Link>
          <Link to="/admin/anzeigen/neu" className="btn btn-outline"><Plus size={14} /> Anzeige</Link>
          <Link to="/admin/ausgaben" className="btn btn-accent">Zur Ausgaben-Verwaltung</Link>
        </div>
      </div>

      {letzte ? (
        <div className="card">
          <h2>Zuletzt veröffentlicht</h2>
          <p>Ausgabe Nr. {letzte.nummer}/{letzte.jahr} vom {formatDatum(letzte.datum)}</p>
          <div className="actions-row">
            <a href={`/ausgabe/${letzte.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
              <ExternalLink size={14} /> Ansehen
            </a>
            {letzte.pdfPath && (
              <a href={letzte.pdfPath} className="btn btn-outline btn-sm"><FileDown size={14} /> PDF</a>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <h2>Noch keine Ausgabe veröffentlicht</h2>
          <p>Lege zunächst Ortsteile an, trage Veranstaltungen und Meldungen ein, und veröffentliche danach die erste Ausgabe.</p>
        </div>
      )}
    </>
  );
}
