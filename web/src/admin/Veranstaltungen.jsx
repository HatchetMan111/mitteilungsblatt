import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Pencil, Plus } from 'lucide-react';
import { api } from '../api.js';
import { formatDatum } from '../format.js';
import { FehlerBox, LoeschButton, PageHeader, Spinner, useToast } from '../components.jsx';

export default function Veranstaltungen() {
  const [data, setData] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const laden = () => api('/admin/veranstaltungen').then(setData).catch(e => setFehler(e.message));
  useEffect(() => { laden(); }, []);

  if (fehler) return <FehlerBox>{fehler}</FehlerBox>;
  if (!data) return <Spinner />;

  const { veranstaltungen, ortsteile } = data;
  const ortName = id => ortsteile.find(o => o.id === id)?.name || 'Gemeindeweit';

  const loeschen = async v => {
    setBusy(true);
    try {
      await api(`/admin/veranstaltungen/${v.id}`, { method: 'DELETE' });
      toast.ok('Veranstaltung gelöscht.');
      await laden();
    } catch (e) {
      toast.err(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        titel="Veranstaltungen"
        untertitel={`Für die nächste Ausgabe vorgemerkt (${veranstaltungen.length})`}
        aktion={<Link to="/admin/veranstaltungen/neu" className="btn btn-accent"><Plus size={15} /> Neue Veranstaltung</Link>}
      />
      <div className="card">
        {!veranstaltungen.length ? (
          <p className="form-hint">Noch keine Veranstaltungen für die nächste Ausgabe eingetragen.</p>
        ) : (
          <div className="scroll-tabelle">
            <table className="admin-table">
              <thead><tr><th>Titel</th><th>Datum</th><th>Ort</th><th>Verein/Org.</th><th>Ortsteil</th><th>Titelseite</th><th></th></tr></thead>
              <tbody>
                {veranstaltungen.map(v => (
                  <tr key={v.id}>
                    <td><strong>{v.titel}</strong></td>
                    <td>{formatDatum(v.datum)}{v.uhrzeit ? ` ${v.uhrzeit}` : ''}</td>
                    <td>{v.ort || '—'}</td>
                    <td>{v.organisation || '—'}</td>
                    <td>{ortName(v.ortsteilId)}</td>
                    <td>{v.featured ? <span className="badge badge-accent">Ja</span> : '—'}</td>
                    <td>
                      <div className="actions-row" style={{ marginTop: 0 }}>
                        <Link to={`/admin/veranstaltungen/${v.id}/bearbeiten`} className="btn btn-outline btn-sm">
                          <Pencil size={13} /> Bearbeiten
                        </Link>
                        <LoeschButton
                          frage={`Veranstaltung „${v.titel}“ wirklich löschen?`}
                          busy={busy}
                          onJa={() => loeschen(v)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
