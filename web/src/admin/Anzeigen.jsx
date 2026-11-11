import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Pencil, Plus } from 'lucide-react';
import { api } from '../api.js';
import { FehlerBox, LoeschButton, PageHeader, SortierButtons, Spinner, useToast } from '../components.jsx';

export default function Anzeigen() {
  const [data, setData] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const laden = () => api('/admin/anzeigen').then(setData).catch(e => setFehler(e.message));
  useEffect(() => { laden(); }, []);

  if (fehler) return <FehlerBox>{fehler}</FehlerBox>;
  if (!data) return <Spinner />;

  const { anzeigen, ortsteile } = data;
  const ortName = id => ortsteile.find(o => o.id === id)?.name || 'Gemeindeweit';

  const verschieben = async (a, direction) => {
    setBusy(true);
    try {
      const d = await api(`/admin/anzeigen/${a.id}/move`, { method: 'POST', body: { direction } });
      setData(x => ({ ...x, anzeigen: d.anzeigen }));
    } catch (e) {
      toast.err(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loeschen = async a => {
    setBusy(true);
    try {
      await api(`/admin/anzeigen/${a.id}`, { method: 'DELETE' });
      toast.ok('Anzeige gelöscht.');
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
        titel="Anzeigen & Werbung"
        untertitel={`Kleinanzeigen und lokale Werbung, für die nächste Ausgabe vorgemerkt (${anzeigen.length})`}
        aktion={<Link to="/admin/anzeigen/neu" className="btn btn-accent"><Plus size={15} /> Neue Anzeige</Link>}
      />
      <div className="card">
        <p className="form-hint">
          Die Reihenfolge hier bestimmt die Reihenfolge im Anzeigenteil der Ausgabe
          (Platzierungswünsche lassen sich so nach Möglichkeit berücksichtigen).
        </p>
        {!anzeigen.length ? (
          <p className="form-hint">Noch keine Anzeigen für die nächste Ausgabe eingetragen.</p>
        ) : (
          <div className="scroll-tabelle">
            <table className="admin-table">
              <thead><tr><th>Titel</th><th>Typ</th><th>Ortsteil</th><th>Reihenfolge</th><th></th></tr></thead>
              <tbody>
                {anzeigen.map((a, idx) => (
                  <tr key={a.id}>
                    <td><strong>{a.titel}</strong></td>
                    <td><span className="badge badge-slate">{a.typ === 'bild' ? 'Bild-Anzeige' : 'Kleinanzeige'}</span></td>
                    <td>{ortName(a.ortsteilId)}</td>
                    <td>
                      <SortierButtons position={idx} gesamt={anzeigen.length} busy={busy} onMove={dir => verschieben(a, dir)} />
                    </td>
                    <td>
                      <div className="actions-row" style={{ marginTop: 0 }}>
                        <Link to={`/admin/anzeigen/${a.id}/bearbeiten`} className="btn btn-outline btn-sm">
                          <Pencil size={13} /> Bearbeiten
                        </Link>
                        <LoeschButton frage={`Anzeige „${a.titel}“ wirklich löschen?`} busy={busy} onJa={() => loeschen(a)} />
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
