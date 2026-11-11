import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, FileDown, Send } from 'lucide-react';
import { api } from '../api.js';
import { formatDatum } from '../format.js';
import { ConfirmDialog, FehlerBox, FormRow, PageHeader, Spinner, useToast } from '../components.jsx';

// Ausgaben-Verwaltung: Entwurf der nächsten Ausgabe, Vorschau (Web + PDF)
// und das eigentliche Veröffentlichen.
export default function Ausgaben() {
  const [data, setData] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [titelbild, setTitelbild] = useState(null);
  const [confirmOffen, setConfirmOffen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const laden = useCallback(() => {
    api('/admin/ausgaben').then(setData).catch(e => setFehler(e.message));
  }, []);

  useEffect(() => { laden(); }, [laden]);

  if (fehler) return <FehlerBox>{fehler}</FehlerBox>;
  if (!data) return <Spinner />;

  const { ausgaben, entwurf, settings } = data;
  const nummer = settings.naechsteAusgabenNummer;
  const jahr = settings.erscheinungsjahr;
  const gesamt = entwurf.veranstaltungen.length + entwurf.news.length;
  const featured = entwurf.veranstaltungen.filter(v => v.featured).length;
  const gemVer = entwurf.veranstaltungen.filter(v => !v.ortsteilId).length;
  const gemNews = entwurf.news.filter(n => !n.ortsteilId).length;

  const veroeffentlichen = async () => {
    setConfirmOffen(false);
    setBusy(true);
    try {
      const fd = new FormData();
      if (titelbild) fd.append('titelbild', titelbild);
      const res = await api('/admin/ausgaben', { method: 'POST', body: fd });
      if (res.pdfError) {
        toast.err('Ausgabe veröffentlicht, aber die PDF-Erstellung ist fehlgeschlagen — bitte Server-Log prüfen.');
      } else {
        toast.ok(`Ausgabe Nr. ${res.ausgabe.nummer}/${res.ausgabe.jahr} wurde veröffentlicht.`);
      }
      setTitelbild(null);
      laden();
    } catch (e) {
      toast.err(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader titel="Ausgaben" untertitel="Nächste Ausgabe zusammenstellen und veröffentlichen" />

      <div className="card">
        <h2>Entwurf der nächsten Ausgabe — Nr. {nummer}/{jahr}</h2>
        <p className="form-hint">Enthält alle aktuell vorgemerkten Veranstaltungen und Meldungen, sortiert nach Ortsteil.</p>

        <div className="entwurf-zaehler">
          <div>
            <div className="zahl">{featured}</div>
            <div className="bez">hervorgehoben für die <Link to="/admin/veranstaltungen">Titelseite</Link></div>
          </div>
          <div>
            <div className="zahl">{gemVer} / {gemNews}</div>
            <div className="bez">gemeindeweite Veranstaltungen / Meldungen</div>
          </div>
          {entwurf.ortsteile.map(o => {
            const ver = entwurf.veranstaltungen.filter(v => v.ortsteilId === o.id).length;
            const nw = entwurf.news.filter(n => n.ortsteilId === o.id).length;
            if (!ver && !nw) return null;
            return (
              <div key={o.id}>
                <div className="zahl">{ver} / {nw}</div>
                <div className="bez">{o.name}: Veranstaltungen / Meldungen</div>
              </div>
            );
          })}
          <div>
            <div className="zahl">{entwurf.anzeigen.length}</div>
            <div className="bez"><Link to="/admin/anzeigen">Anzeige(n)</Link> vorgemerkt</div>
          </div>
          <div>
            <div className="zahl">{entwurf.servicerubriken.length}</div>
            <div className="bez"><Link to="/admin/standardrubriken">Standard-Infos</Link> (automatisch übernommen)</div>
          </div>
          <div>
            <div className="zahl">{entwurf.sponsoren.length}</div>
            <div className="bez"><Link to="/admin/sponsoren">Sponsoren</Link> (Dankeschön-Seite)</div>
          </div>
        </div>

        {gesamt > 0 && (
          <>
            <div className="actions-row" style={{ marginTop: '1rem' }}>
              <Link to="/admin/ausgaben/vorschau" target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                <Eye size={15} /> Vorschau (Web)
              </Link>
              <a href="/api/admin/vorschau/pdf" target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                <Eye size={15} /> Vorschau (PDF)
              </a>
            </div>
            <p className="form-hint">Zeigt die Ausgabe genau so, wie sie beim Veröffentlichen aussehen würde — ohne etwas zu speichern oder zu archivieren.</p>
          </>
        )}

        <form onSubmit={e => { e.preventDefault(); setConfirmOffen(true); }} style={{ marginTop: '1.2rem' }}>
          <FormRow
            label="Titelbild dieser Ausgabe (optional)"
            hint={<>Ohne Auswahl wird das Standard-Titelbild aus <Link to="/admin/einstellungen">Einstellungen</Link> verwendet{settings.titelbildPath ? ' (aktuell hinterlegt)' : ' (aktuell keins hinterlegt)'}.</>}
          >
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => setTitelbild(e.target.files[0] || null)} />
          </FormRow>
          <button type="submit" className="btn btn-accent" disabled={gesamt === 0 || busy}>
            <Send size={15} /> Ausgabe Nr. {nummer} jetzt erstellen &amp; veröffentlichen
          </button>
          {gesamt === 0 && <p className="form-hint">Noch keine Inhalte vorgemerkt — zuerst Veranstaltungen oder Meldungen anlegen.</p>}
        </form>
      </div>

      <div className="card">
        <h2>Bisherige Ausgaben ({ausgaben.length})</h2>
        {!ausgaben.length ? (
          <p className="form-hint">Noch keine Ausgabe veröffentlicht.</p>
        ) : (
          <div className="scroll-tabelle">
            <table className="admin-table">
              <thead><tr><th>Nr.</th><th>Datum</th><th></th></tr></thead>
              <tbody>
                {ausgaben.map(a => (
                  <tr key={a.id}>
                    <td className="ausgaben-nr">Nr. {a.nummer}/{a.jahr}</td>
                    <td>{formatDatum(a.datum)}</td>
                    <td>
                      <div className="actions-row" style={{ marginTop: 0 }}>
                        <a href={`/ausgabe/${a.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                          <ExternalLink size={13} /> Ansehen
                        </a>
                        {a.pdfPath && (
                          <a href={a.pdfPath} className="btn btn-outline btn-sm"><FileDown size={13} /> PDF</a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        offen={confirmOffen}
        titel={`Ausgabe Nr. ${nummer} veröffentlichen?`}
        text="Alle vorgemerkten Inhalte werden danach archiviert und die nächste Ausgabe startet wieder leer. Dieser Schritt lässt sich nicht rückgängig machen."
        bestaetigenText={`Ja, Ausgabe Nr. ${nummer} veröffentlichen`}
        onJa={veroeffentlichen}
        onNein={() => setConfirmOffen(false)}
      />
    </>
  );
}
