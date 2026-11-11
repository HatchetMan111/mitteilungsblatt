import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen, CalendarDays, ExternalLink, LayoutDashboard, ListChecks, LogOut,
  MapPinned, Megaphone, Menu, Newspaper, Settings, Handshake, X
} from 'lucide-react';
import { api } from '../api.js';
import { Spinner, useToast } from '../components.jsx';

const NAV = [
  { zu: '/admin', label: 'Übersicht', icon: LayoutDashboard, ende: true },
  { zu: '/admin/ausgaben', label: 'Ausgaben', icon: BookOpen },
  { zu: '/admin/veranstaltungen', label: 'Veranstaltungen', icon: CalendarDays },
  { zu: '/admin/news', label: 'Meldungen', icon: Newspaper },
  { zu: '/admin/anzeigen', label: 'Anzeigen & Werbung', icon: Megaphone },
  { zu: '/admin/sponsoren', label: 'Sponsoren', icon: Handshake },
  { zu: '/admin/ortsteile', label: 'Ortsteile', icon: MapPinned },
  { zu: '/admin/standardrubriken', label: 'Standard-Infos', icon: ListChecks },
  { zu: '/admin/einstellungen', label: 'Einstellungen', icon: Settings }
];

// Redaktions-Bereich: prüft die Anmeldung, zeichnet Sidebar + mobilen Topbar
// und rendert die jeweilige Unterseite.
export default function AdminLayout() {
  const [auth, setAuth] = useState(null); // null = wird geprüft
  const [menuOffen, setMenuOffen] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api('/admin/overview')
      .then(() => setAuth(true))
      .catch(() => {}); // 401 leitet api() bereits zur Login-Seite weiter
  }, []);

  useEffect(() => { setMenuOffen(false); }, [navigate]);

  const abmelden = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* egal */ }
    toast.info('Abgemeldet.');
    navigate('/admin/login');
  };

  if (auth === null) return <Spinner text="Redaktion wird geladen …" />;

  return (
    <>
      {/* Mobiler Topbar mit Menü-Knopf */}
      <div className="admin-topbar no-print">
        <button onClick={() => setMenuOffen(o => !o)} aria-label={menuOffen ? 'Menü schließen' : 'Menü öffnen'}>
          {menuOffen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <span className="admin-topbar__brand">Mitteilungsblatt — Redaktion</span>
      </div>

      {menuOffen && <div className="sidebar-hintergrund no-print" onClick={() => setMenuOffen(false)} />}

      <div className="admin-shell">
        <aside className={`admin-sidebar no-print${menuOffen ? ' offen' : ''}`}>
          <div className="admin-sidebar__brand">
            Mitteilungsblatt
            <span>Redaktion</span>
          </div>
          <ul className="admin-nav">
            {NAV.map(item => (
              <li key={item.zu}>
                <NavLink
                  to={item.zu}
                  end={item.ende}
                  className={({ isActive }) => isActive ? 'aktiv' : ''}
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li className="admin-nav__trenner" aria-hidden="true" />
            <li>
              <a href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} />
                Öffentliche Seite
              </a>
            </li>
          </ul>
          <div className="admin-sidebar__fuss">
            <button type="button" className="btn btn-outline btn-sm" onClick={abmelden}>
              <LogOut size={14} /> Abmelden
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </>
  );
}
