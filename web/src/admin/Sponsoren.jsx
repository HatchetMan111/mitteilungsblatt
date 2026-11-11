import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Handshake, Pencil, Plus } from 'lucide-react';
import { api } from '../api.js';
import { FehlerBox, LoeschButton, PageHeader, SortierButtons, Spinner, useToast } from '../components.jsx';

export default function Sponsoren() {
  const [data, setData] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const laden = () => api('/admin/sponsoren').then(setData).catch(e => setFehler(e.message));
  useEffect(() => { laden(); }, []);

  if (fehler) return <FehlerBox>{fehler}</FehlerBox>;
  if (!data) return <Spinner />;

  const { sponsoren } = data;

  const verschieben = async (s, direction) => {
    setBusy(true);
    try {
      const d = await api(`/admin/sponsoren/${s.id}/move`, { method: 'POST', body: { direction } });
      setData({ sponsoren: d.sponsoren });
    } catch (e) {
      toast.err(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loeschen = async s => {
    setBusy(true);
    try {
      await api(`/admin/sponsoren/${s.id}`, { method: 'DELETE' });
      toast.ok('Sponsor gelöscht.');
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
        titel="Sponsoren"
        untertitel="Ständige Liste — erscheint automatisch am Ende jeder Ausgabe als Dankeschön-Seite, im PDF und auf der Web-Seite."
        aktion={<Link to="/admin/sponsoren/neu" className="btn btn-accent"><Plus size={15} /> Neuer Sponsor</Link>}
      />
      <div className="card">
        {!sponsoren.length ? (
          <p className="form-hint">Noch keine Sponsoren eingetragen.</p>
        ) : (
          <div className="scroll-tabelle">
            <table className="admin-table">
              <thead><tr><th></th><th>Name</th><th>Website</th><th>Reihenfolge</th><th></th></tr></thead>
              <tbody>
                {sponsoren.map((s, idx) => (
                  <tr key={s.id}>
                    <td>{s.logoPath && <img className="thumb-klein" src={s.logoPath} alt="" />}</td>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.website || '—'}</td>
                    <td>
                      <SortierButtons position={idx} gesamt={sponsoren.length} busy={busy} onMove={dir => verschieben(s, dir)} />
                    </td>
                    <td>
                      <div className="actions-row" style={{ marginTop: 0 }}>
                        <Link to={`/admin/sponsoren/${s.id}/bearbeiten`} className="btn btn-outline btn-sm">
                          <Pencil size={13} /> Bearbeiten
                        </Link>
                        <LoeschButton frage={`Sponsor „${s.name}“ wirklich löschen?`} busy={busy} onJa={() => loeschen(s)} />
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
