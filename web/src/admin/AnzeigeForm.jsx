import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, toForm } from '../api.js';
import { FehlerBox, FormRow, PageHeader, BildInput, SpeichernButton, Spinner, useToast } from '../components.jsx';

export default function AnzeigeForm() {
  const { id } = useParams();
  const bearbeite = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const [ortsteile, setOrtsteile] = useState(null);
  const [a, setA] = useState(bearbeite ? null : { titel: '', typ: 'klein', text: '', kontakt: '', ortsteilId: '', bildPath: null });
  const [bild, setBild] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/admin/anzeigen')
      .then(d => {
        setOrtsteile(d.ortsteile);
        if (!bearbeite) return;
        const item = d.anzeigen.find(x => x.id === id);
        if (!item) { toast.err('Anzeige nicht gefunden.'); navigate('/admin/anzeigen', { replace: true }); return; }
        setA({ ...item, ortsteilId: item.ortsteilId || '' });
      })
      .catch(e => setFehler(e.message));
  }, [bearbeite, id]);

  if (!ortsteile || !a) return <Spinner />;

  const senden = async e => {
    e.preventDefault();
    setFehler(null);
    if (!a.titel.trim()) { setFehler('Bitte einen Titel angeben.'); return; }
    setBusy(true);
    try {
      const fd = toForm({
        titel: a.titel, typ: a.typ, text: a.text, kontakt: a.kontakt, ortsteilId: a.ortsteilId
      });
      if (bild) fd.append('bild', bild);
      if (bearbeite) await api(`/admin/anzeigen/${id}`, { method: 'PUT', body: fd });
      else await api('/admin/anzeigen', { method: 'POST', body: fd });
      toast.ok(bearbeite ? 'Anzeige aktualisiert.' : 'Anzeige angelegt.');
      navigate('/admin/anzeigen');
    } catch (err) {
      setFehler(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader titel={bearbeite ? 'Anzeige bearbeiten' : 'Neue Anzeige'} />
      <div className="card">
        <FehlerBox>{fehler}</FehlerBox>
        <form onSubmit={senden}>
          <FormRow label="Titel">
            <input type="text" value={a.titel} onChange={e => setA({ ...a, titel: e.target.value })} placeholder="z. B. Ackerfläche zu verkaufen" required />
          </FormRow>
          <FormRow label="Anzeigentyp">
            <select value={a.typ} onChange={e => setA({ ...a, typ: e.target.value })}>
              <option value="klein">Kleinanzeige (nur Text, schmaler Kasten)</option>
              <option value="bild">Bild-Anzeige (großer Kasten mit Bild/Flyer)</option>
            </select>
          </FormRow>
          <FormRow label="Anzeigentext">
            <textarea rows={5} value={a.text} onChange={e => setA({ ...a, text: e.target.value })} />
          </FormRow>
          <FormRow label="Kontakt (Telefon/E-Mail, optional)">
            <input type="text" value={a.kontakt || ''} onChange={e => setA({ ...a, kontakt: e.target.value })} />
          </FormRow>
          <FormRow label="Ortsteil (optional, sonst gemeindeweit)">
            <select value={a.ortsteilId || ''} onChange={e => setA({ ...a, ortsteilId: e.target.value })}>
              <option value="">Gemeindeweit</option>
              {ortsteile.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </FormRow>
          <BildInput
            label="Bild / Flyer (optional, v. a. bei Bild-Anzeigen)"
            hint="Ein neu hochgeladenes Bild ersetzt das bisherige."
            file={bild}
            onFile={setBild}
            vorhandenerPfad={bearbeite && !bild ? a.bildPath : null}
          />
          <div className="actions-row" style={{ marginTop: '1.2rem' }}>
            <SpeichernButton busy={busy} />
            <Link to="/admin/anzeigen" className="btn btn-outline">Abbrechen</Link>
          </div>
        </form>
      </div>
    </>
  );
}
