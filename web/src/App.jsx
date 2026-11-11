import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './public/PublicLayout.jsx';
import Aktuell from './public/Aktuell.jsx';
import Archiv from './public/Archiv.jsx';
import AusgabeSeite from './public/AusgabeSeite.jsx';
import Vorschau from './public/Vorschau.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import Login from './admin/Login.jsx';
import Dashboard from './admin/Dashboard.jsx';
import Ausgaben from './admin/Ausgaben.jsx';
import Veranstaltungen from './admin/Veranstaltungen.jsx';
import VeranstaltungForm from './admin/VeranstaltungForm.jsx';
import News from './admin/News.jsx';
import NewsForm from './admin/NewsForm.jsx';
import Anzeigen from './admin/Anzeigen.jsx';
import AnzeigeForm from './admin/AnzeigeForm.jsx';
import Sponsoren from './admin/Sponsoren.jsx';
import SponsorForm from './admin/SponsorForm.jsx';
import Ortsteile from './admin/Ortsteile.jsx';
import Standardrubriken from './admin/Standardrubriken.jsx';
import Einstellungen from './admin/Einstellungen.jsx';
import { EmptyState } from './components.jsx';

export default function App() {
  return (
    <Routes>
      {/* Wer direkt /app (die Asset-Basis) aufruft, landet auf der Startseite */}
      <Route path="/app/*" element={<Navigate to="/" replace />} />

      {/* Öffentliche Seiten */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Aktuell />} />
        <Route path="/archiv" element={<Archiv />} />
        <Route path="/ausgabe/:id" element={<AusgabeSeite />} />
        <Route path="*" element={
          <EmptyState titel="Seite nicht gefunden" text="Diese Adresse gibt es nicht." />
        } />
      </Route>

      {/* Vorschau (wird aus dem Admin heraus geöffnet, nutzt aber das Zeitungs-Layout) */}
      <Route path="/admin/ausgaben/vorschau" element={<Vorschau />} />

      {/* Redaktion */}
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="ausgaben" element={<Ausgaben />} />
        <Route path="veranstaltungen" element={<Veranstaltungen />} />
        <Route path="veranstaltungen/neu" element={<VeranstaltungForm />} />
        <Route path="veranstaltungen/:id/bearbeiten" element={<VeranstaltungForm />} />
        <Route path="news" element={<News />} />
        <Route path="news/neu" element={<NewsForm />} />
        <Route path="news/:id/bearbeiten" element={<NewsForm />} />
        <Route path="anzeigen" element={<Anzeigen />} />
        <Route path="anzeigen/neu" element={<AnzeigeForm />} />
        <Route path="anzeigen/:id/bearbeiten" element={<AnzeigeForm />} />
        <Route path="sponsoren" element={<Sponsoren />} />
        <Route path="sponsoren/neu" element={<SponsorForm />} />
        <Route path="sponsoren/:id/bearbeiten" element={<SponsorForm />} />
        <Route path="ortsteile" element={<Ortsteile />} />
        <Route path="standardrubriken" element={<Standardrubriken />} />
        <Route path="einstellungen" element={<Einstellungen />} />
      </Route>
    </Routes>
  );
}
