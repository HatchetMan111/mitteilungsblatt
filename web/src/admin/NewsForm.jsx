import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, toForm } from '../api.js';
import { FehlerBox, FormRow, PageHeader, BildInput, SpeichernButton, Spinner, useToast } from '../components.jsx';

export default function NewsForm() {
  const { id } = useParams();
  const bearbeite = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const [stammdaten, setStammdaten] = useState(null); // { ortsteile, rubriken }
  const [n, setN] = useState(bearbeite ? null : { titel: '', rubrik: 'Allgemein', organisation: '', ortsteilId: '', inhalt: '', bildPath: null });
  const [bild, setBild] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/admin/news')
      .then(d => {
        setStammdaten({ ortsteile: d.ortsteile, rubriken: d.rubriken });
        if (!bearbeite) return;
        const item = d.news.find(x => x.id === id);
        if (!item) { toast.err('Meldung nicht gefunden.'); navigate('/admin/news', { replace: true }); return; }
        setN({ ...item, ortsteilId: item.ortsteilId || '' });
      })
      .catch(e => setFehler(e.message));
  }, [bearbeite, id]);

  if (!stammdaten || !n) return <Spinner />;

  const senden = async e => {
    e.preventDefault();
    setFehler(null);
    if (!n.titel.trim()) { setFehler('Bitte einen Titel angeben.'); return; }
    setBusy(true);
    try {
      const fd = toForm({
        titel: n.titel, inhalt: n.inhalt, organisation: n.organisation,
        ortsteilId: n.ortsteilId, rubrik: n.rubrik
      });
      if (bild) fd.append('bild', bild);
      if (bearbeite) await api(`/admin/news/${id}`, { method: 'PUT', body: fd });
      else await api('/admin/news', { method: 'POST', body: fd });
      toast.ok(bearbeite ? 'Meldung aktualisiert.' : 'Meldung angelegt.');
      navigate('/admin/news');
    } catch (err) {
      setFehler(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader titel={bearbeite ? 'Meldung bearbeiten' : 'Neue Meldung'} />
      <div className="card">
        <FehlerBox>{fehler}</FehlerBox>
        <form onSubmit={senden}>
          <FormRow label="Titel">
            <input type="text" value={n.titel} onChange={e => setN({ ...n, titel: e.target.value })} required />
          </FormRow>
          <FormRow label="Rubrik" hint="Bestimmt, unter welcher Überschrift die Meldung in der Ausgabe erscheint.">
            <select value={n.rubrik} onChange={e => setN({ ...n, rubrik: e.target.value })}>
              {stammdaten.rubriken.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormRow>
          <FormRow label="Verein / Kirchengemeinde / Einrichtung (optional)">
            <input type="text" value={n.organisation || ''} onChange={e => setN({ ...n, organisation: e.target.value })} placeholder="z. B. Freiwillige Feuerwehr" />
          </FormRow>
          <FormRow label="Ortsteil">
            <select value={n.ortsteilId || ''} onChange={e => setN({ ...n, ortsteilId: e.target.value })}>
              <option value="">Gemeindeweit (kein bestimmter Ortsteil)</option>
              {stammdaten.ortsteile.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </FormRow>
          <FormRow label="Text" hint="Zeilenumbrüche werden übernommen.">
            <textarea rows={8} value={n.inhalt} onChange={e => setN({ ...n, inhalt: e.target.value })} />
          </FormRow>
          <BildInput
            label="Bild (optional)"
            hint="Ein neu hochgeladenes Bild ersetzt das bisherige."
            file={bild}
            onFile={setBild}
            vorhandenerPfad={bearbeite && !bild ? n.bildPath : null}
          />
          <div className="actions-row" style={{ marginTop: '1.2rem' }}>
            <SpeichernButton busy={busy} />
            <Link to="/admin/news" className="btn btn-outline">Abbrechen</Link>
          </div>
        </form>
      </div>
    </>
  );
}
