import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { api } from '../api.js';
import { EmptyState, Spinner } from '../components.jsx';
import AusgabeView from './AusgabeView.jsx';

// Startseite: die aktuelle (zuletzt veröffentlichte) Ausgabe
export default function Aktuell() {
  const { settings } = useOutletContext();
  const [data, setData] = useState(null);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    api('/public/aktuell')
      .then(setData)
      .catch(e => setFehler(e.message));
  }, []);

  if (fehler) return <EmptyState titel="Fehler" text={fehler} />;
  if (!data) return <Spinner />;

  if (!data.ausgabe) {
    return (
      <EmptyState
        icon={Newspaper}
        titel="Die erste Ausgabe ist noch in Vorbereitung"
        text="Schau bald wieder vorbei — hier erscheint das nächste Mitteilungsblatt, sobald die Redaktion es veröffentlicht hat."
      />
    );
  }

  return <AusgabeView ausgabe={data.ausgabe} settings={settings} pdfPfad={data.ausgabe.pdfPath} />;
}
