import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { FehlerBox, FormRow, LoeschButton, PageHeader, SortierButtons, SpeichernButton, Spinner, useToast } from '../components.jsx';

// Standard-Infos: feste Rubriken (Notfallnummern, Öffnungszeiten, Impressum),
// die automatisch in jede Ausgabe übernommen werden.
export default function Standardrubriken() {
  const [rubriken, setRubriken] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [neu, setNeu] = useState({ titel: '', inhalt: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const laden = () => api('/admin/servicerubriken').then(d => setRubriken(d.rubriken)).catch(e => setFehler(e.message));
  useEffect(() => { laden(); }, []);

  if (fehler) return <FehlerBox>{fehler}</FehlerBox>;
  if (!rubriken) return <Spinner />;

  const hinzufuegen = async e => {
    e.preventDefault();
    if (!neu.titel.trim()) return;
    setBusy(true);
    try {
      await api('/admin/servicerubriken', { method: 'POST', body: neu });
      toast.ok(`Rubrik „${neu.titel.trim()}“ angelegt.`);
      setNeu({ titel: '', inhalt: '' });
      await laden();
    } catch (err) {
      toast.err(err.message);
    } finally {
      setBusy(false);
    }
  };

  const speichern = async (r, titel, inhalt) => {
    if (!titel.trim()) { toast.err('Bitte einen Titel angeben.'); return; }
    setBusy(true);
    try {
      await api(`/admin/servicerubriken/${r.id}`, { method: 'PUT', body: { titel, inhalt } });
      toast.ok('Rubrik gespeichert.');
      await laden();
    } catch (err) {
      toast.err(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verschieben = async (r, direction) => {
    setBusy(true);
    try {
      const d = await api(`/admin/servicerubriken/${r.id}/move`, { method: 'POST', body: { direction } });
      setRubriken(d.rubriken);
    } catch (err) {
      toast.err(err.message);
    } finally {
      setBusy(false);
    }
  };

  const loeschen = async r => {
    setBusy(true);
    try {
      await api(`/admin/servicerubriken/${r.id}`, { method: 'DELETE' });
      toast.ok(`Rubrik „${r.titel}“ gelöscht.`);
      await laden();
    } catch (err) {
      toast.err(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader titel="Standard-Infos" untertitel="Feste Angaben, die sich selten ändern (Notfallnummern, Öffnungszeiten, Impressum …) — erscheinen automatisch in jeder Ausgabe." />

      {rubriken.map((r, idx) => (
        <RubrikKarte key={r.id} r={r} idx={idx} gesamt={rubriken.length} busy={busy}
          onSpeichern={speichern} onMove={verschieben} onLoeschen={loeschen} />
      ))}

      <div className="card">
        <h2>Neue Rubrik</h2>
        <form onSubmit={hinzufuegen}>
          <FormRow label="Titel">
            <input type="text" value={neu.titel} onChange={e => setNeu({ ...neu, titel: e.target.value })} placeholder="z. B. Bereitschaftsdienst der Apotheken" required />
          </FormRow>
          <FormRow label="Inhalt" hint="Zeilenumbrüche werden übernommen.">
            <textarea rows={5} value={neu.inhalt} onChange={e => setNeu({ ...neu, inhalt: e.target.value })} />
          </FormRow>
          <SpeichernButton busy={busy}>Hinzufügen</SpeichernButton>
        </form>
      </div>
    </>
  );
}

function RubrikKarte({ r, idx, gesamt, busy, onSpeichern, onMove, onLoeschen }) {
  const [titel, setTitel] = useState(r.titel);
  const [inhalt, setInhalt] = useState(r.inhalt || '');

  return (
    <div className="card">
      <form onSubmit={e => { e.preventDefault(); onSpeichern(r, titel, inhalt); }}>
        <FormRow label="Titel">
          <input type="text" value={titel} onChange={e => setTitel(e.target.value)} />
        </FormRow>
        <FormRow label="Inhalt" hint="Zeilenumbrüche werden übernommen.">
          <textarea rows={5} value={inhalt} onChange={e => setInhalt(e.target.value)} />
        </FormRow>
        <div className="actions-row" style={{ marginTop: '.6rem' }}>
          <SpeichernButton busy={busy} />
          <SortierButtons position={idx} gesamt={gesamt} busy={busy} onMove={dir => onMove(r, dir)} beschriftet />
          <LoeschButton frage={`Rubrik „${r.titel}“ wirklich löschen?`} busy={busy} onJa={() => onLoeschen(r)} />
        </div>
      </form>
    </div>
  );
}
