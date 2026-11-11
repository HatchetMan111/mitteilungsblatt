import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { api } from '../api.js';
import { FehlerBox, useToast } from '../components.jsx';

export default function Login() {
  const [params] = useSearchParams();
  const [zustand, setZustand] = useState('pruefe'); // pruefe | formular | senden
  const [fehler, setFehler] = useState(null);
  const [form, setForm] = useState({ username: '', password: '' });
  const [gemeindeName, setGemeindeName] = useState('');
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api('/session')
      .then(d => {
        setGemeindeName(d.settings?.gemeindeName || '');
        if (d.authenticated) setZustand('eingeloggt');
        else setZustand('formular');
      })
      .catch(() => setZustand('formular'));
  }, []);

  if (zustand === 'pruefe') return null;
  if (zustand === 'eingeloggt') return <Navigate to="/admin" replace />;

  const senden = async e => {
    e.preventDefault();
    setFehler(null);
    setZustand('senden');
    try {
      await api('/auth/login', { method: 'POST', body: form });
      toast.ok('Angemeldet.');
      navigate(params.get('zurueck') || '/admin', { replace: true });
    } catch (err) {
      setFehler(err.message);
      setZustand('formular');
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>Redaktion</h1>
        <p className="sub">{gemeindeName ? `${gemeindeName} · ` : ''}Mitteilungsblatt</p>
        {params.get('abgelaufen') && (
          <div className="alert alert-err">Deine Sitzung ist abgelaufen — bitte neu anmelden.</div>
        )}
        <FehlerBox>{fehler}</FehlerBox>
        <form onSubmit={senden}>
          <div className="form-group">
            <label htmlFor="username">Benutzername</label>
            <input
              id="username"
              type="text"
              autoFocus
              required
              autoComplete="username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
          <button className="btn btn-accent" disabled={zustand === 'senden'}>
            {zustand === 'senden' ? <Loader2 size={15} className="spin" /> : <LogIn size={15} />}
            {zustand === 'senden' ? 'Anmeldung …' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}
