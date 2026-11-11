import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, toForm } from '../api.js';
import { FehlerBox, FormRow, PageHeader, BildInput, SpeichernButton, Spinner, useToast } from '../components.jsx';

export default function SponsorForm() {
  const { id } = useParams();
  const bearbeite = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const [s, setS] = useState(bearbeite ? null : { name: '', website: '', beschreibung: '', logoPath: null });
  const [logo, setLogo] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bearbeite) return;
    api('/admin/sponsoren')
      .then(d => {
        const item = d.sponsoren.find(x => x.id === id);
        if (!item) { toast.err('Sponsor nicht gefunden.'); navigate('/admin/sponsoren', { replace: true }); return; }
        setS(item);
      })
      .catch(e => setFehler(e.message));
  }, [bearbeite, id]);

  if (!s) return <Spinner />;

  const senden = async e => {
    e.preventDefault();
    setFehler(null);
    if (!s.name.trim()) { setFehler('Bitte einen Namen angeben.'); return; }
    setBusy(true);
    try {
      const fd = toForm({ name: s.name, website: s.website, beschreibung: s.beschreibung });
      if (logo) fd.append('logo', logo);
      if (bearbeite) await api(`/admin/sponsoren/${id}`, { method: 'PUT', body: fd });
      else await api('/admin/sponsoren', { method: 'POST', body: fd });
      toast.ok(bearbeite ? 'Sponsor aktualisiert.' : 'Sponsor angelegt.');
      navigate('/admin/sponsoren');
    } catch (err) {
      setFehler(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader titel={bearbeite ? 'Sponsor bearbeiten' : 'Neuer Sponsor'} />
      <div className="card">
        <FehlerBox>{fehler}</FehlerBox>
        <form onSubmit={senden}>
          <FormRow label="Name">
            <input type="text" value={s.name} onChange={e => setS({ ...s, name: e.target.value })} placeholder="z. B. Getränkemarkt Talblick" required />
          </FormRow>
          <FormRow label="Website (optional)">
            <input type="text" value={s.website || ''} onChange={e => setS({ ...s, website: e.target.value })} placeholder="z. B. www.beispiel.de" />
          </FormRow>
          <FormRow label="Kurzer Dank-/Beschreibungstext (optional)">
            <input type="text" value={s.beschreibung || ''} onChange={e => setS({ ...s, beschreibung: e.target.value })} placeholder="z. B. Hauptsponsor des Dorffests" />
          </FormRow>
          <BildInput
            label="Logo (optional)"
            hint="Ein neu hochgeladenes Logo ersetzt das bisherige."
            file={logo}
            onFile={setLogo}
            vorhandenerPfad={bearbeite && !logo ? s.logoPath : null}
          />
          <div className="actions-row" style={{ marginTop: '1.2rem' }}>
            <SpeichernButton busy={busy} />
            <Link to="/admin/sponsoren" className="btn btn-outline">Abbrechen</Link>
          </div>
        </form>
      </div>
    </>
  );
}
