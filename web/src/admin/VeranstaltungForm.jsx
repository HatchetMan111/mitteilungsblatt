import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, toForm } from '../api.js';
import { FehlerBox, FormRow, PageHeader, BildInput, SpeichernButton, Spinner, useToast } from '../components.jsx';

// Neu anlegen + Bearbeiten in einer Komponente (unterschieden per URL-Param)
export default function VeranstaltungForm() {
  const { id } = useParams();
  const bearbeite = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const [ortsteile, setOrtsteile] = useState(null);
  const [v, setV] = useState(bearbeite ? null : { titel: '', datum: '', uhrzeit: '', ort: '', beschreibung: '', organisation: '', ortsteilId: '', featured: false, bildPath: null });
  const [bild, setBild] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/admin/ortsteile').then(d => setOrtsteile(d.ortsteile)).catch(e => setFehler(e.message));
  }, []);

  useEffect(() => {
    if (!bearbeite) return;
    api('/admin/veranstaltungen')
      .then(d => {
        const item = d.veranstaltungen.find(x => x.id === id);
        if (!item) { toast.err('Veranstaltung nicht gefunden.'); navigate('/admin/veranstaltungen', { replace: true }); return; }
        setV({ ...item, ortsteilId: item.ortsteilId || '' });
      })
      .catch(e => setFehler(e.message));
  }, [bearbeite, id]);

  if (!ortsteile || (bearbeite && !v)) return <Spinner />;
  if (!v) return <Spinner />;

  const senden = async e => {
    e.preventDefault();
    setFehler(null);
    if (!v.titel.trim()) { setFehler('Bitte einen Titel angeben.'); return; }
    setBusy(true);
    try {
      const fd = toForm({
        titel: v.titel, datum: v.datum, uhrzeit: v.uhrzeit, ort: v.ort,
        beschreibung: v.beschreibung, organisation: v.organisation,
        ortsteilId: v.ortsteilId, featured: v.featured ? 'true' : 'false'
      });
      if (bild) fd.append('bild', bild);
      if (bearbeite) await api(`/admin/veranstaltungen/${id}`, { method: 'PUT', body: fd });
      else await api('/admin/veranstaltungen', { method: 'POST', body: fd });
      toast.ok(bearbeite ? 'Veranstaltung aktualisiert.' : 'Veranstaltung angelegt.');
      navigate('/admin/veranstaltungen');
    } catch (err) {
      setFehler(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader titel={bearbeite ? 'Veranstaltung bearbeiten' : 'Neue Veranstaltung'} />
      <div className="card">
        <FehlerBox>{fehler}</FehlerBox>
        <form onSubmit={senden}>
          <FormRow label="Titel">
            <input type="text" value={v.titel} onChange={e => setV({ ...v, titel: e.target.value })} required />
          </FormRow>
          <div className="form-reihe">
            <FormRow label="Datum">
              <input type="date" value={v.datum} onChange={e => setV({ ...v, datum: e.target.value })} />
            </FormRow>
            <FormRow label="Uhrzeit">
              <input type="time" value={v.uhrzeit} onChange={e => setV({ ...v, uhrzeit: e.target.value })} />
            </FormRow>
          </div>
          <FormRow label="Ort">
            <input type="text" value={v.ort} onChange={e => setV({ ...v, ort: e.target.value })} placeholder="z. B. Dorfgemeinschaftshaus" />
          </FormRow>
          <FormRow label="Ausrichtender Verein / Organisation (optional)">
            <input type="text" value={v.organisation} onChange={e => setV({ ...v, organisation: e.target.value })} placeholder="z. B. TV Creglingen, Freiwillige Feuerwehr" />
          </FormRow>
          <FormRow label="Ortsteil">
            <select value={v.ortsteilId || ''} onChange={e => setV({ ...v, ortsteilId: e.target.value })}>
              <option value="">Gemeindeweit (kein bestimmter Ortsteil)</option>
              {ortsteile.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </FormRow>
          <FormRow label="Beschreibung">
            <textarea value={v.beschreibung} onChange={e => setV({ ...v, beschreibung: e.target.value })} />
          </FormRow>
          <BildInput
            label="Bild (optional)"
            hint="Ein neu hochgeladenes Bild ersetzt das bisherige."
            file={bild}
            onFile={setBild}
            vorhandenerPfad={bearbeite && !bild ? v.bildPath : null}
          />
          <FormRow inline>
            <input
              id="featured"
              type="checkbox"
              checked={!!v.featured}
              onChange={e => setV({ ...v, featured: e.target.checked })}
            />
            <label htmlFor="featured">Auf der Titelseite als „wichtigste Veranstaltung“ hervorheben</label>
          </FormRow>
          <div className="actions-row" style={{ marginTop: '1.2rem' }}>
            <SpeichernButton busy={busy} />
            <Link to="/admin/veranstaltungen" className="btn btn-outline">Abbrechen</Link>
          </div>
        </form>
      </div>
    </>
  );
}
