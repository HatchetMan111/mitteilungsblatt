import { useEffect, useState } from 'react';
import { api, toForm } from '../api.js';
import { FehlerBox, FormRow, BildInput, PageHeader, SpeichernButton, Spinner, useToast } from '../components.jsx';

export default function Einstellungen() {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [logo, setLogo] = useState(null);
  const [titelbild, setTitelbild] = useState(null);
  const [busy, setBusy] = useState(false);

  const [pw, setPw] = useState({ aktuellesPasswort: '', neuesPasswort: '', neuesPasswortWiederholen: '' });
  const [pwFehler, setPwFehler] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    api('/admin/settings').then(d => setS(d.settings)).catch(e => setFehler(e.message));
  }, []);

  if (fehler) return <FehlerBox>{fehler}</FehlerBox>;
  if (!s) return <Spinner />;

  const speichern = async e => {
    e.preventDefault();
    setFehler(null);
    if (!s.gemeindeName.trim()) { setFehler('Bitte einen Gemeinde-Namen angeben.'); return; }
    setBusy(true);
    try {
      const fd = toForm({
        gemeindeName: s.gemeindeName,
        untertitel: s.untertitel || '',
        erscheinungsjahr: s.erscheinungsjahr
      });
      if (logo) fd.append('logo', logo);
      if (titelbild) fd.append('titelbild', titelbild);
      const d = await api('/admin/settings', { method: 'PUT', body: fd });
      setS(d.settings);
      setLogo(null);
      setTitelbild(null);
      toast.ok('Einstellungen gespeichert.');
    } catch (err) {
      setFehler(err.message);
    } finally {
      setBusy(false);
    }
  };

  const passwortAendern = async e => {
    e.preventDefault();
    setPwFehler(null);
    setPwBusy(true);
    try {
      await api('/admin/settings/password', { method: 'POST', body: pw });
      setPw({ aktuellesPasswort: '', neuesPasswort: '', neuesPasswortWiederholen: '' });
      toast.ok('Passwort geändert.');
    } catch (err) {
      setPwFehler(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <>
      <PageHeader titel="Einstellungen" untertitel="Grunddaten der Gemeinde und des Mitteilungsblatts" />

      <div className="card">
        <h2>Gemeinde</h2>
        <FehlerBox>{fehler}</FehlerBox>
        <form onSubmit={speichern}>
          <FormRow label="Name der Gemeinde">
            <input type="text" value={s.gemeindeName} onChange={e => setS({ ...s, gemeindeName: e.target.value })} required />
          </FormRow>
          <FormRow label="Untertitel">
            <input type="text" value={s.untertitel || ''} onChange={e => setS({ ...s, untertitel: e.target.value })} placeholder="z. B. Amtliches Mitteilungsblatt" />
          </FormRow>
          <FormRow label="Erscheinungsjahr (für die Ausgaben-Zählung)" hint="Bei Jahreswechsel startet die Ausgaben-Nummer automatisch wieder bei 1.">
            <input type="number" value={s.erscheinungsjahr} onChange={e => setS({ ...s, erscheinungsjahr: e.target.value })} />
          </FormRow>
          <BildInput
            label="Logo / Wappen (optional, klein)"
            hint="Erscheint im PDF-Namenszug und auf der Web-Seite. Neues Bild ersetzt das bisherige."
            file={logo}
            onFile={setLogo}
            vorhandenerPfad={!logo ? s.logoPath : null}
          />
          <BildInput
            label="Standard-Titelbild (wird verwendet, falls für eine Ausgabe kein eigenes hochgeladen wird)"
            file={titelbild}
            onFile={setTitelbild}
            vorhandenerPfad={!titelbild ? s.titelbildPath : null}
          />
          <SpeichernButton busy={busy} />
        </form>
      </div>

      <div className="card">
        <h2>Passwort ändern</h2>
        <FehlerBox>{pwFehler}</FehlerBox>
        <form onSubmit={passwortAendern}>
          <FormRow label="Aktuelles Passwort">
            <input type="password" autoComplete="current-password" value={pw.aktuellesPasswort} onChange={e => setPw({ ...pw, aktuellesPasswort: e.target.value })} required />
          </FormRow>
          <FormRow label="Neues Passwort" hint="Mindestens 6 Zeichen.">
            <input type="password" autoComplete="new-password" minLength={6} value={pw.neuesPasswort} onChange={e => setPw({ ...pw, neuesPasswort: e.target.value })} required />
          </FormRow>
          <FormRow label="Wiederholen">
            <input type="password" autoComplete="new-password" minLength={6} value={pw.neuesPasswortWiederholen} onChange={e => setPw({ ...pw, neuesPasswortWiederholen: e.target.value })} required />
          </FormRow>
          <button type="submit" className="btn btn-outline" disabled={pwBusy}>
            {pwBusy ? 'Ändere …' : 'Passwort ändern'}
          </button>
        </form>
      </div>
    </>
  );
}
