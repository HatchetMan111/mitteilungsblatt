# Mitteilungsblatt

Eine kleine Web-App, die das Amtsblatt/Mitteilungsblatt einer Gemeinde mit
mehreren Ortsteilen abbildet: Titelbild, wichtigste Veranstaltungen
auf der Titelseite, danach die einzelnen Ortsteile mit ihren eigenen
Meldungen und Terminen — als Web-Ansicht und als druckfertiges PDF.

## Funktionen

- Admin-Bereich (Login-geschützt): Ortsteile, Veranstaltungen und Meldungen
  pflegen, Titelbild/Logo hochladen.
- Veranstaltungen können als "wichtigste Veranstaltung" markiert werden und
  erscheinen dann prominent auf der Titelseite.
- Jeder Ortsteil bekommt automatisch eine eigene Rubrik mit seinen Terminen
  und Meldungen.
- **Rubriken für Meldungen**: Amtliche Bekanntmachung, Standesamtliche
  Nachricht, Vereinsnachricht, Kirchengemeinde, Schule & Kindergarten,
  Pressemitteilung oder Allgemein — jede Rubrik erscheint als eigene
  Überschrift in der Ausgabe.
- **Verein/Organisation**: Veranstaltungen und Meldungen können einem Verein,
  einer Kirchengemeinde o. ä. zugeordnet werden; der Name erscheint als
  Absender-Label über der Meldung bzw. in den Veranstaltungsdetails.
- **Anzeigen & Werbung**: eigener Bereich für Kleinanzeigen (nur Text) und
  größere Bild-Anzeigen/Flyer, inkl. Kontaktangabe und manueller Reihenfolge
  (für Platzierungswünsche). Im PDF werden Anzeigen automatisch als
  Lückenfüller zwischen die redaktionellen Seiten verteilt (wie in einer
  echten Zeitung) — nur was nicht dazwischen passt, bekommt am Ende eine
  eigene Seite „Weitere Anzeigen". Auf der Web-Seite erscheinen alle
  Anzeigen gesammelt in einem eigenen Abschnitt. Werden wie
  Veranstaltungen/Meldungen pro Ausgabe archiviert.
- **Sponsoren**: ständige Liste (kein Pool wie Anzeigen), erscheint
  automatisch am Ende jeder Ausgabe als Dankeschön-Seite „Diese Ausgabe
  wird unterstützt von" — mit Logo, Name, optionaler Website und
  Kurzbeschreibung, sowohl im PDF (eigene Abschlussseite) als auch auf der
  Web-Seite.
- **Standard-Infos**: feste Rubriken, die sich selten ändern (Notfallnummern,
  Störungsnummern Strom/Gas/Wasser, Öffnungszeiten Rathaus, Impressum —
  weitere frei anlegbar). Werden einmal gepflegt und automatisch in jede
  neue Ausgabe übernommen, ohne erneute Eingabe.
- Eine Ausgabe wird per Knopfdruck erstellt: alle aktuell vorgemerkten
  Inhalte werden zu einer Ausgabe zusammengefasst, veröffentlicht, archiviert
  und als PDF exportiert. Die nächste Ausgabe startet danach wieder leer.
  Optional kann beim Veröffentlichen ein eigenes Titelbild für genau diese
  Ausgabe hochgeladen werden — ohne Auswahl wird automatisch das
  Standard-Titelbild aus den Einstellungen verwendet.
- **Vorschau vor der Veröffentlichung**: Web-Ansicht und PDF lassen sich
  jederzeit als Vorschau ansehen, wie sie mit dem aktuellen Stand aussehen
  würden — ganz ohne etwas zu veröffentlichen, zu archivieren oder eine
  Ausgabennummer zu verbrauchen. Deutlich als „Vorschau" gekennzeichnet.
- Öffentliche Seite ohne Login: aktuelle Ausgabe + durchsuchbares Archiv
  aller früheren Ausgaben (Volltextsuche + Jahresfilter) inkl. PDF-Download.

## Technik

- **Backend**: Node.js/Express mit JSON-API unter `/api/*`, dateibasierte
  Datenhaltung (`data/db.json`, keine Datenbank nötig), PDF-Export über
  pdfkit, Session-Auth mit Brute-Force-Schutz.
- **Frontend**: React + Vite (Ordner `web/`), wird beim Bauen nach
  `src/public/app/` geschrieben und vom Express-Server mit ausgeliefert.
  Entwicklung mit Live-Reload:

  ```bash
  # Terminal 1: Backend
  cd src && npm install && npm start          # http://localhost:3000
  # Terminal 2: Frontend (Dev-Server mit Proxy auf :3000)
  cd web && npm install && npm run dev        # http://localhost:5173
  ```

  Beim allerersten Start wird automatisch ein Admin-Zugang mit dem
  Standard-Login `admin` / `admin` angelegt (überschreibbar über
  `ADMIN_USER` / `ADMIN_PASSWORD` in der `.env`). Die Zugangsdaten stehen
  zusätzlich in `data/admin-zugangsdaten.txt`. Bitte das Passwort nach dem
  ersten Login unter „Einstellungen" ändern.

- **Produktbuild** (`npm run build` im Ordner `web/`, oder einfach
  `bash tools/build.sh` im Repo-Root) erzeugt die statischen Dateien in
  `src/public/app/` — der Installer bettet sie zusammen mit dem Backend ein.

## Daten & Uploads

Alle Inhalte liegen in `data/db.json` (kein separates Datenbanksystem nötig),
hochgeladene Bilder in `public/uploads/`, erzeugte PDFs in `public/pdf/`.
Ein Backup der App besteht also einfach aus einer Kopie des `data`-Ordners
und `public/uploads` bzw. `public/pdf`.

## Installation auf Proxmox

`install-mitteilungsblatt.sh` ist ein einzelnes, in sich abgeschlossenes
Skript (der komplette App-Code inkl. gebautem React-Frontend ist darin
eingebettet — es wird also keine Internetverbindung zu einem Repo benötigt,
nur für Debian-Pakete/Node.js).

**Auf dem Proxmox-VE-Host** (nicht in einem Container, als root):

```bash
bash install-mitteilungsblatt.sh
```

Das Skript fragt interaktiv Container-ID, Hostname, Ressourcen (CPU/RAM/
Platte), Netzwerk-Bridge und Storage ab (Enter übernimmt jeweils den
vorgeschlagenen Standardwert). Es legt einen unprivilegierten Debian-12-LXC
an, installiert Node.js 20, kopiert die App hinein, richtet einen
systemd-Dienst ein und zeigt am Ende die URL sowie das Admin-Passwort an.

Für vollautomatische Installation ohne Rückfragen (Standardwerte):

```bash
AUTO=1 bash install-mitteilungsblatt.sh
```

**Update:** Skript mit derselben Container-ID erneut ausführen — der
App-Code wird aktualisiert, `data/`, hochgeladene Bilder und PDFs bleiben
erhalten.

**Danach im Browser:**

1. `http://<Container-IP>:3000/admin` öffnen und anmelden:
   - **Benutzername:** `admin`
   - **Passwort:** `admin`

   Das ist ein fester Standard-Login (wird auch am Ende der
   Installer-Ausgabe angezeigt) — bitte **gleich nach dem ersten Login**
   unter „Einstellungen" ein eigenes, sicheres Passwort vergeben, vor allem
   wenn die Seite nicht nur im Heimnetz erreichbar ist.

   Zugangsdaten nochmal nachlesen (z. B. nach einem Neustart):
   ```bash
   pct exec <CTID> -- cat /opt/mitteilungsblatt/data/admin-zugangsdaten.txt
   ```
   (`<CTID>` ist die Container-ID, die der Installer vergeben hat.)
2. Unter „Einstellungen" Gemeindename, Untertitel und Titelbild setzen.
3. Unter „Ortsteile" die Dörfer/Stadtteile anlegen, die eigene Rubriken
   bekommen sollen.
4. Laufend unter „Veranstaltungen" und „Meldungen" Inhalte eintragen und
   optional einem Ortsteil zuordnen; wichtige Termine als „Titelseite"
   markieren.
5. Unter „Ausgaben" die nächste Ausgabe per Knopfdruck veröffentlichen —
   Web-Ansicht und PDF entstehen automatisch, die Inhalte werden archiviert
   und die nächste Ausgabe startet wieder leer.

Die Zählung beginnt normalerweise bei Ausgabe Nr. 1. Wer stattdessen mit
einer „Nullnummer" (Probe-/Pilotausgabe Nr. 0) starten möchte, kann direkt
nach der Installation einmalig `data/db.json` öffnen und
`settings.naechsteAusgabenNummer` auf `0` setzen, bevor die erste Ausgabe
veröffentlicht wird.

Die Container-IP findest du im Proxmox-Webinterface oder mit
`pct exec <CTID> -- hostname -I`. Für eine feste, „schöne" Adresse aus dem
Heimnetz empfiehlt sich zusätzlich ein Reverse-Proxy (z. B. nginx) oder ein
lokaler DNS-Eintrag — das übernimmt dieses Skript bewusst nicht, damit es zu
jeder vorhandenen Netzwerkstruktur passt.

## Sicherheit

- **HTTPS**: Die App selbst spricht nur HTTP. Sobald sie aus dem Internet
  (nicht nur dem Heimnetz) erreichbar sein soll, unbedingt einen
  Reverse-Proxy mit TLS davorschalten. Fertige Beispiel-Konfigurationen für
  Caddy (automatisches Let's-Encrypt-Zertifikat, empfohlen für den einfachen
  Einstieg) und nginx liegen im Ordner `deploy/` des Repos.
- **Brute-Force-Schutz**: Der Login ist auf 8 Versuche pro 15 Minuten und
  IP-Adresse begrenzt.
- **Sicherheits-Header**: Die App setzt Standard-Header über `helmet`, seit
  dem React-Umbau auch eine aktive Content-Security-Policy. Das
  Session-Cookie ist `HttpOnly` und `SameSite=Lax` gesetzt, was die meisten
  CSRF-Angriffe bereits browserseitig blockiert; zusätzlich lehnt die API
  schreibende Anfragen mit fremdem Origin-Header ab. Bei erfolgreichem
  Login wird die Session neu generiert (Schutz vor Session-Fixierung).
- **Automatisches Backup**: Der Installer richtet einen täglichen Backup-Job
  (3 Uhr nachts, 14 Tage Aufbewahrung) ein, der `data/`, `public/uploads/`
  und `public/pdf/` als `.tar.gz` unter `/opt/mitteilungsblatt/backups/`
  sichert. Zusätzlich empfiehlt sich ein reguläres Proxmox-Backup des
  gesamten Containers (Datacenter → Backup) für den Fall eines kompletten
  Datenverlusts.

**Backup wiederherstellen** (Beispiel):
```bash
pct exec <CTID> -- systemctl stop mitteilungsblatt
pct exec <CTID> -- bash -c "cd /opt/mitteilungsblatt && tar -xzf backups/backup-JJJJ-MM-TT_HHMMSS.tar.gz"
pct exec <CTID> -- systemctl start mitteilungsblatt
```

## Grenzen (Stand jetzt)

- Ein einzelner Admin-Zugang (keine separaten Konten je Ortsteil).
- Standard-Login `admin`/`admin` — bewusst einfach gehalten, aber unbedingt
  gleich nach der Installation unter „Einstellungen" ändern, besonders wenn
  die App aus dem Internet erreichbar ist (nicht nur im Heimnetz).
- Anzeigen/Werbung: reine Platzierung im Blatt, keine Buchung, Abrechnung
  oder Rechnungsstellung — das läuft weiterhin außerhalb der App.
- Kein automatischer News-Import (RSS o.ä.) — Inhalte werden manuell gepflegt.
- Kein E-Mail-Versand der Ausgaben, nur Web-Ansicht + PDF-Download.

## Änderungsprotokoll

### React/Vite-Neubau der Oberfläche + Bugfix-Runde (dieser Stand)

**Oberfläche:** Das komplette UI (öffentliche Seiten + Redaktion) wurde von
servergerenderten EJS-Templates auf eine React/Vite-Single-Page-Anwendung
umgestellt — gleiches Zeitungdesign, aber mit Live-Suche im Archiv,
Sofort-Vorschau bei Bild-Uploads, Toast-Meldungen, Bestätigungsdialogen,
Ladezuständen und mobiler Redaktions-Navigation.

**Behobene Bugs (Code-Review):**

- Das Gemeinde-Logo wurde im PDF-Namenszug nie gezeichnet: Die
  Ausgaben-Momentaufnahme enthielt `logoPath` nicht — behoben.
- Die Ausgaben-Liste und „zuletzt veröffentlicht" sortierten nur nach
  Ausgabennummer, nicht nach Jahr — nach einem Jahreswechsel (Zählung
  beginnt wieder bei 1) landeten alte Ausgaben fälschlich oben. Sortiert
  wird jetzt nach Jahr + Nummer.
- Reihenfolge-Änderungen (Anzeigen/Sponsoren/Standard-Infos) waren stumme
  No-Ops, sobald doppelte `order`-Werte in der Datenhaltung existierten —
  die Ordnung wird jetzt nach jedem Tausch neu durchnummeriert.
- `db.json` wird jetzt atomar geschrieben (Temp-Datei + umbenennen), damit
  ein Absturz mitten im Speichern die Daten nicht korrumpieren kann.
- Bei erfolgreichem Login wird die Session neu generiert (Schutz vor
  Session-Fixierung).
- Uploads werden zusätzlich zur Dateiendung auch per MIME-Typ geprüft.
- Die Content-Security-Policy ist aktiviert (vorher bewusst deaktiviert).
- Schreibende API-Anfragen mit fremdem Origin-Header werden abgelehnt
  (CSRF-Zusatzsicherung neben dem SameSite=Lax-Cookie).
- Text in `.env.example` korrigiert: Ohne `ADMIN_PASSWORD` gilt der feste
  Standard-Login `admin/admin` — die Datei behauptete ein automatisch
  erzeugtes Zufallspasswort, das die App so nie erzeugt hat.
