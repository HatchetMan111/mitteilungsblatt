import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { FehlerBox, FormRow, LoeschButton, PageHeader, SortierButtons, SpeichernButton, Spinner, useToast } from '../components.jsx';

// Ortsteile: anlegen, inline bearbeiten, sortieren, löschen.
// Beim Löschen werden zugeordnete Inhalte auf "gemeindeweit" umgestellt.
export default function Ortsteile() {
  const [ortsteile, setOrtsteile] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [neu, setNeu] = useState({ name: '', beschreibung: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const laden = () => api('/admin/ortsteile').then(d => setOrtsteile(d.ortsteile)).catch(e => setFehler(e.message));
  useEffect(() => { laden(); }, []);

  if (fehler) return <FehlerBox>{fehler}</FehlerBox>;
  if (!ortsteile) return <Spinner />;

  const hinzufuegen = async e => {
    e.preventDefault();
    if (!neu.name.trim()) return;
    setBusy(true);
    try {
      await api('/admin/ortsteile', { method: 'POST', body: neu });
      toast.ok(`Ortsteil „${neu.name.trim()}“ angelegt.`);
      setNeu({ name: '', beschreibung: '' });
      await laden();
    } catch (err) {
      toast.err(err.message);
    } finally {
      setBusy(false);
    }
  };

  const speichern = async (o, name, beschreibung) => {
    if (!name.trim()) { toast.err('Bitte einen Namen angeben.'); return; }
    setBusy(true);
    try {
      await api(`/admin/ortsteile/${o.id}`, { method: 'PUT', body: { name, beschreibung } });
      toast.ok('Ortsteil gespeichert.');
      await laden();
    } catch (err) {
      toast.err(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verschieben = async (o, direction) => {
    setBusy(true);
    try {
      const d = await api(`/admin/ortsteile/${o.id}/move`, { method: 'POST', body: { direction } });
      setOrtsteile(d.ortsteile);
    } catch (err) {
      toast.err(err.message);
    } finally {
      setBusy(false);
    }
  };

  const loeschen = async o => {
    setBusy(true);
    try {
      await api(`/admin/ortsteile/${o.id}`, { method: 'DELETE' });
      toast.ok(`Ortsteil „${o.name}“ gelöscht — zugeordnete Inhalte sind jetzt gemeindeweit.`);
      await laden();
    } catch (err) {
      toast.err(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader titel="Ortsteile" untertitel="Dörfer / Stadtteile, die eigene Rubriken im Mitteilungsblatt bekommen" />

      <div className="card">
        <h2>Neuer Ortsteil</h2>
        <form onSubmit={hinzufuegen}>
          <div className="form-reihe">
            <FormRow label="Name">
              <input type="text" value={neu.name} onChange={e => setNeu({ ...neu, name: e.target.value })} placeholder="z. B. Unterdorf" required />
            </FormRow>
            <FormRow label="Kurzbeschreibung (optional)">
              <input type="text" value={neu.beschreibung} onChange={e => setNeu({ ...neu, beschreibung: e.target.value })} placeholder="z. B. Ortsvorsteher, Besonderheiten …" />
            </FormRow>
          </div>
          <SpeichernButton busy={busy}>Hinzufügen</SpeichernButton>
        </form>
      </div>

      <div className="card">
        <h2>Vorhandene Ortsteile ({ortsteile.length})</h2>
        {!ortsteile.length && <p className="form-hint">Noch keine Ortsteile angelegt.</p>}
        {ortsteile.map((o, idx) => (
          <OrtsteilZeile key={o.id} o={o} idx={idx} gesamt={ortsteile.length} busy={busy}
            onSpeichern={speichern} onMove={verschieben} onLoeschen={loeschen} />
        ))}
      </div>
    </>
  );
}

function OrtsteilZeile({ o, idx, gesamt, busy, onSpeichern, onMove, onLoeschen }) {
  const [name, setName] = useState(o.name);
  const [beschreibung, setBeschreibung] = useState(o.beschreibung || '');

  return (
    <div style={{ borderBottom: '1px solid var(--rule)', padding: '.9rem 0' }}>
      <div className="form-reihe" style={{ alignItems: 'flex-end' }}>
        <FormRow label="Name">
          <input type="text" value={name} onChange={e => setName(e.target.value)} />
        </FormRow>
        <FormRow label="Kurzbeschreibung">
          <input type="text" value={beschreibung} onChange={e => setBeschreibung(e.target.value)} placeholder="Kurzbeschreibung" />
        </FormRow>
      </div>
      <div className="actions-row">
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => onSpeichern(o, name, beschreibung)}>Speichern</button>
        <SortierButtons position={idx} gesamt={gesamt} busy={busy} onMove={dir => onMove(o, dir)} beschriftet />
        <LoeschButton
          frage={`Ortsteil „${o.name}“ wirklich löschen? Zugeordnete Veranstaltungen und Meldungen werden auf gemeindeweit umgestellt.`}
          busy={busy}
          onJa={() => onLoeschen(o)}
        />
      </div>
    </div>
  );
}
