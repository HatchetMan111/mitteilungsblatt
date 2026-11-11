import { useEffect, useState } from 'react';
import { Link, useParams, useOutletContext } from 'react-router-dom';
import { api } from '../api.js';
import { EmptyState, Spinner } from '../components.jsx';
import AusgabeView from './AusgabeView.jsx';

// Eine einzelne (frühere) Ausgabe aus dem Archiv
export default function AusgabeSeite() {
  const { id } = useParams();
  const { settings } = useOutletContext();
  const [data, setData] = useState(null);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    setData(null);
    setFehler(null);
    api(`/public/ausgabe/${id}`)
      .then(setData)
      .catch(e => setFehler(e));
  }, [id]);

  if (fehler) {
    return (
      <EmptyState
        titel={fehler.status === 404 ? 'Ausgabe nicht gefunden' : 'Fehler'}
        text={fehler.status === 404 ? 'Diese Ausgabe existiert nicht (mehr).' : fehler.message}
      >
        <p><Link to="/archiv">← Zurück zum Archiv</Link></p>
      </EmptyState>
    );
  }
  if (!data) return <Spinner />;

  return <AusgabeView ausgabe={data.ausgabe} settings={settings} pdfPfad={data.ausgabe.pdfPath} />;
}
