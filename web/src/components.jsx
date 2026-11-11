import { createContext, useCallback, useContext, useEffect, useRef, useState, Component } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, UploadCloud, X } from 'lucide-react';

// ============================================================
// ErrorBoundary — fängt Render-Fehler ab und zeigt eine lesbare
// Meldung statt einer leeren Seite.
// ============================================================
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { fehler: null };
  }
  static getDerivedStateFromError(fehler) {
    return { fehler };
  }
  componentDidCatch(fehler, info) {
    console.error('Render-Fehler:', fehler, info);
  }
  render() {
    if (this.state.fehler) {
      return (
        <div className="site">
          <div className="alert alert-err" role="alert">
            <strong>Es ist ein Anzeigefehler aufgetreten.</strong>{' '}
            {String(this.state.fehler?.message || this.state.fehler)}
            <br />
            <a href="/" onClick={e => { e.preventDefault(); window.location.assign('/'); }}>Seite neu laden</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// Toasts — kurze Erfolgs-/Fehlermeldungen unten rechts
// ============================================================
const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((text, typ = 'ok') => {
    const id = ++idRef.current;
    setToasts(t => [...t, { id, text, typ }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  const toast = {
    ok: (text) => push(text, 'ok'),
    err: (text) => push(text, 'err'),
    info: (text) => push(text, 'info')
  };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.typ}`}>
            {t.typ === 'ok' ? <CheckCircle2 size={17} /> : t.typ === 'err' ? <AlertTriangle size={17} /> : <Info size={17} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

// ============================================================
// ConfirmDialog — ersetzt window.confirm durch ein passendes Modal
// ============================================================
export function ConfirmDialog({ offen, titel, text, gefahr = false, bestaetigenText = 'Ja, fortfahren', abbrechenText = 'Abbrechen', onJa, onNein }) {
  useEffect(() => {
    if (!offen) return;
    const onKey = e => { if (e.key === 'Escape') onNein(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offen, onNein]);

  if (!offen) return null;
  return (
    <div className="modal-hintergrund" onMouseDown={e => { if (e.target === e.currentTarget) onNein(); }}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={titel}>
        <h3>{titel}</h3>
        <p>{text}</p>
        <div className="modal-aktionen">
          <button className="btn btn-outline" onClick={onNein}>{abbrechenText}</button>
          <button className={gefahr ? 'btn btn-danger' : 'btn btn-accent'} onClick={onJa}>{bestaetigenText}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Kleine Bausteine
// ============================================================
export function Spinner({ text = 'Lädt …' }) {
  return (
    <div className="spinner-zeile">
      <Loader2 className="spin" size={18} />
      <span>{text}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, titel, text, children }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={30} strokeWidth={1.5} />}
      <h2>{titel}</h2>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

export function FehlerBox({ children }) {
  if (!children) return null;
  return <div className="alert alert-err">{children}</div>;
}

export function PageHeader({ titel, untertitel, aktion }) {
  return (
    <div className="admin-header">
      <div>
        <h1>{titel}</h1>
        {untertitel && <p>{untertitel}</p>}
      </div>
      {aktion}
    </div>
  );
}

export function FormRow({ label, hint, children, inline = false }) {
  return (
    <div className={`form-group${inline ? ' checkbox-row' : ''}`}>
      {label && <label>{label}</label>}
      {children}
      {hint && <p className="form-hint">{hint}</p>}
    </div>
  );
}

// Datei-Eingabe mit Sofort-Vorschau und Entfernen-Option
export function BildInput({ label, hint, file, onFile, vorhandenerPfad, onVorhandeneEntfernen }) {
  const inputRef = useRef(null);
  const [vorschau, setVorschau] = useState(null);

  useEffect(() => {
    if (!file) { setVorschau(null); return; }
    const url = URL.createObjectURL(file);
    setVorschau(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <FormRow label={label} hint={hint}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={e => onFile(e.target.files[0] || null)}
      />
      <div
        className="bild-dropzone"
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        role="button"
        tabIndex={0}
      >
        <UploadCloud size={20} />
        <span>{file ? file.name : 'Bild auswählen oder hierher ziehen'}</span>
        <em>JPG, PNG, WebP oder GIF · max. 8 MB</em>
      </div>
      {(vorschau || (!file && vorhandenerPfad)) && (
        <div className="bild-vorschau">
          <img src={vorschau || vorhandenerPfad} alt="Vorschau" />
          {vorschau
            ? <button type="button" className="btn btn-outline btn-sm" onClick={() => { onFile(null); if (inputRef.current) inputRef.current.value = ''; }}>
                <X size={14} /> Auswahl entfernen
              </button>
            : onVorhandeneEntfernen && (
              <button type="button" className="btn btn-outline btn-sm" onClick={onVorhandeneEntfernen}>
                <X size={14} /> Vorhandenes Bild entfernen
              </button>
            )}
        </div>
      )}
    </FormRow>
  );
}

// Speichern-Button mit Ladezustand
export function SpeichernButton({ busy, children = 'Speichern', ...rest }) {
  return (
    <button type="submit" className="btn btn-accent" disabled={busy} {...rest}>
      {busy ? <Loader2 size={15} className="spin" /> : null}
      {busy ? 'Speichert …' : children}
    </button>
  );
}

// Lösch-Button mit eingebautem Bestätigungsdialog
export function LoeschButton({ frage, titel = 'Wirklich löschen?', onJa, busy = false, text = 'Löschen' }) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => setOffen(true)}>
        {text}
      </button>
      <ConfirmDialog
        offen={offen}
        titel={titel}
        text={frage}
        gefahr
        bestaetigenText="Ja, löschen"
        onJa={() => { setOffen(false); onJa(); }}
        onNein={() => setOffen(false)}
      />
    </>
  );
}

// Auf/Ab-Sortierknöpfe für Listen mit fester Reihenfolge
export function SortierButtons({ position, gesamt, onMove, busy = false, beschriftet = false }) {
  return (
    <span className="sortier-gruppe">
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={busy || position === 0}
        title="Nach oben"
        onClick={() => onMove('up')}
      >↑{beschriftet ? ' Höher' : ''}</button>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={busy || position === gesamt - 1}
        title="Nach unten"
        onClick={() => onMove('down')}
      >↓{beschriftet ? ' Tiefer' : ''}</button>
    </span>
  );
}
