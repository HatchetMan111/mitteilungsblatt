import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, Pencil, Plus } from 'lucide-react';
import { api } from '../api.js';
import { FehlerBox, LoeschButton, PageHeader, Spinner, useToast } from '../components.jsx';

export default function News() {
  const [data, setData] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const laden = () => api('/admin/news').then(setData).catch(e => setFehler(e.message));
  useEffect(() => { laden(); }, []);

  if (fehler) return <FehlerBox>{fehler}</FehlerBox>;
  if (!data) return <Spinner />;

  const { news, ortsteile } = data;
  const ortName = id => ortsteile.find(o => o.id === id)?.name || 'Gemeindeweit';

  const loeschen = async n => {
    setBusy(true);
    try {
      await api(`/admin/news/${n.id}`, { method: 'DELETE' });
      toast.ok('Meldung gelöscht.');
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
        titel="Meldungen"
        untertitel={`Für die nächste Ausgabe vorgemerkt (${news.length})`}
        aktion={<Link to="/admin/news/neu" className="btn btn-accent"><Plus size={15} /> Neue Meldung</Link>}
      />
      <div className="card">
        {!news.length ? (
          <p className="form-hint">Noch keine Meldungen für die nächste Ausgabe eingetragen.</p>
        ) : (
          <div className="scroll-tabelle">
            <table className="admin-table">
              <thead><tr><th>Titel</th><th>Rubrik</th><th>Verein/Org.</th><th>Ortsteil</th><th></th></tr></thead>
              <tbody>
                {news.map(n => (
                  <tr key={n.id}>
                    <td><strong>{n.titel}</strong></td>
                    <td><span className="badge badge-slate">{n.rubrik}</span></td>
                    <td>{n.organisation || '—'}</td>
                    <td>{ortName(n.ortsteilId)}</td>
                    <td>
                      <div className="actions-row" style={{ marginTop: 0 }}>
                        <Link to={`/admin/news/${n.id}/bearbeiten`} className="btn btn-outline btn-sm">
                          <Pencil size={13} /> Bearbeiten
                        </Link>
                        <LoeschButton frage={`Meldung „${n.titel}“ wirklich löschen?`} busy={busy} onJa={() => loeschen(n)} />
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
