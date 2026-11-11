import { formatDatum, formatTag, sichereUrl } from '../format.js';

// ------------------------------------------------------------
// Einzelbausteine der Ausgabe
// ------------------------------------------------------------

function TerminKarte({ v }) {
  const t = formatTag(v.datum);
  const meta = [v.organisation, v.uhrzeit, v.ort].filter(Boolean).join(' · ');
  return (
    <div className="event-card">
      {t.tag && (
        <div className="event-date-badge">
          <span className="day">{t.tag}</span>
          <span className="rest">{t.rest}</span>
        </div>
      )}
      <div>
        <h4>{v.titel}</h4>
        {meta && <div className="event-meta">{meta}</div>}
        {v.beschreibung && <p>{v.beschreibung}</p>}
        {v.bildPath && <img src={v.bildPath} alt="" loading="lazy" />}
      </div>
    </div>
  );
}

function Meldung({ n }) {
  return (
    <div className="news-item">
      {n.organisation && <div className="news-org-label">{n.organisation}</div>}
      <h4>{n.titel}</h4>
      {n.inhalt && <p>{n.inhalt}</p>}
      {n.bildPath && <img src={n.bildPath} alt="" loading="lazy" />}
    </div>
  );
}

function NewsGruppen({ gruppen }) {
  return (gruppen || []).map(gruppe => (
    <div key={gruppe.rubrik}>
      <div className="subsection-heading">{gruppe.rubrik}</div>
      {gruppe.items.map(n => <Meldung key={n.id} n={n} />)}
    </div>
  ));
}

// ------------------------------------------------------------
// Die komplette Ausgabe (aktuelle Ausgabe, Archiv-Ausgabe oder Vorschau)
// ------------------------------------------------------------
export default function AusgabeView({ ausgabe, isPreview = false, pdfPfad }) {
  if (!ausgabe) return null;

  const gemVer = (ausgabe.gemeindeweitVeranstaltungen || []).filter(v => !v.featured);
  const gemNewsGruppen = ausgabe.gemeindeweitNewsGruppiert || [];
  const sponsoren = ausgabe.sponsoren || [];
  const anzeigen = ausgabe.anzeigen || [];

  return (
    <article>
      {/* Ausgabe-Kopfzeile */}
      <div className="masthead__dateline" style={{ justifyContent: 'center', margin: '1rem 0 0' }}>
        Ausgabe Nr. {ausgabe.nummer} / {ausgabe.jahr} &nbsp;·&nbsp; {formatDatum(ausgabe.datum)}
        {pdfPfad && <> &nbsp;·&nbsp; <a className="no-print" href={pdfPfad}>PDF herunterladen</a></>}
      </div>

      {ausgabe.titelbildPath && (
        <div className="titelbild"><img src={ausgabe.titelbildPath} alt="Titelbild" /></div>
      )}

      {!!(ausgabe.featuredVeranstaltungen || []).length && (
        <section>
          <h2 className="section-heading">Wichtigste Veranstaltungen</h2>
          {ausgabe.featuredVeranstaltungen.map(v => <TerminKarte key={v.id} v={v} />)}
        </section>
      )}

      {!!(ausgabe.servicerubriken || []).length && (
        <section>
          <h2 className="section-heading">Service &amp; Notfallnummern</h2>
          <div className="service-grid">
            {ausgabe.servicerubriken.map(r => (
              <div className="service-box" key={r.id}>
                <h4>{r.titel}</h4>
                <p>{r.inhalt}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(gemVer.length > 0 || gemNewsGruppen.length > 0) && (
        <section>
          <h2 className="section-heading">Allgemeines aus der Gemeinde</h2>
          {gemVer.length > 0 && (
            <>
              <div className="subsection-heading">Veranstaltungen</div>
              {gemVer.map(v => <TerminKarte key={v.id} v={v} />)}
            </>
          )}
          <NewsGruppen gruppen={gemNewsGruppen} />
        </section>
      )}

      {(ausgabe.ortsteile || []).map(ot => {
        const ver = (ot.veranstaltungen || []).filter(v => !v.featured);
        if (!ver.length && !(ot.newsGruppiert || []).length) return null;
        return (
          <section key={ot.id || ot.name}>
            <h2 className="section-heading">Aus {ot.name}</h2>
            <div className="ortsteil-block">
              <span className="ortsteil-label">{ot.name}</span>
              {ver.length > 0 && (
                <>
                  <div className="subsection-heading">Veranstaltungen</div>
                  {ver.map(v => <TerminKarte key={v.id} v={v} />)}
                </>
              )}
              <NewsGruppen gruppen={ot.newsGruppiert} />
            </div>
          </section>
        );
      })}

      {anzeigen.length > 0 && (
        <section>
          <h2 className="section-heading">Anzeigen &amp; Werbung</h2>
          <div className="anzeigen-grid">
            {anzeigen.map(a => (
              <div className={`anzeige-box anzeige-${a.typ}`} key={a.id}>
                {a.bildPath && <img src={a.bildPath} alt="" loading="lazy" />}
                <h4>{a.titel}</h4>
                {a.text && <p>{a.text}</p>}
                {a.kontakt && <p className="anzeige-kontakt">{a.kontakt}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {sponsoren.length > 0 && (
        <section>
          <h2 className="section-heading">Diese Ausgabe wird unterstützt von</h2>
          <div className="sponsoren-grid">
            {sponsoren.map(s => (
              <div className="sponsor-card" key={s.id}>
                {s.logoPath && <img src={s.logoPath} alt={`Logo ${s.name}`} loading="lazy" />}
                <div className="sponsor-name">{s.name}</div>
                {s.beschreibung && <div className="sponsor-beschreibung">{s.beschreibung}</div>}
                {s.website && (
                  <a className="sponsor-website" href={sichereUrl(s.website)} target="_blank" rel="noopener noreferrer">
                    {s.website}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="site-footer">
        {ausgabe.gemeindeName} · Mitteilungsblatt Nr. {ausgabe.nummer}/{ausgabe.jahr}
        {isPreview && <span> · Vorschau</span>}
      </footer>
    </article>
  );
}
