import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api.js';

// Zeitungs-Kopfbereich für alle öffentlichen Seiten: Logo, Gemeinde-Name,
// Untertitel und die Navigation. Die Ausgaben-spezifische Datumszeile kommt
// aus den Unterseiten.
export default function PublicLayout() {
  const [settings, setSettings] = useState(null);
  const ort = useLocation();

  useEffect(() => {
    let ok = true;
    api('/session')
      .then(d => { if (ok) setSettings(d.settings); })
      .catch(() => { if (ok) setSettings({}); });
    return () => { ok = false; };
  }, []);

  // Bei Seitenwechsel an den Anfang scrollen (SPA-Verhalten wie ein Seitenwechsel)
  useEffect(() => { window.scrollTo(0, 0); }, [ort.pathname]);

  const gemeindeName = settings?.gemeindeName || 'Mitteilungsblatt';

  return (
    <div className="site">
      <header className="masthead">
        {settings?.logoPath && <img className="masthead__logo" src={settings.logoPath} alt="" />}
        <div className="masthead__gemeinde">{gemeindeName}</div>
        {settings?.untertitel && <div className="masthead__untertitel">{settings.untertitel}</div>}
        <nav className="site-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'aktiv' : ''}>Aktuelle Ausgabe</NavLink>
          <span aria-hidden="true">·</span>
          <NavLink to="/archiv" className={({ isActive }) => isActive ? 'aktiv' : ''}>Archiv</NavLink>
        </nav>
      </header>
      <Outlet context={{ settings }} />
      <footer className="site-footer">{gemeindeName} · Gemeinde-Mitteilungsblatt</footer>
    </div>
  );
}
