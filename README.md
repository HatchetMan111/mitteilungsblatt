# Mitteilungsblatt

Gemeinde-Mitteilungsblatt für Proxmox: aggregiert Veranstaltungen und
Meldungen mehrerer Ortsteile zu einer gemeinsamen Ausgabe (Web + PDF).

## Installation (Proxmox VE)

Auf dem Proxmox-VE-Host als root:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/HatchetMan111/mitteilungsblatt/main/install-mitteilungsblatt.sh)"
```

Details, Optionen (`AUTO=1`) und die Bedienung der App nach der Installation:
siehe [`src/README.md`](src/README.md).

**Sicherheit vor dem produktiven Einsatz:** Standard-Login `admin`/`admin`
gleich ändern, und für eine aus dem Internet erreichbare Adresse unbedingt
HTTPS vorschalten — Beispiel-Konfigurationen dafür liegen in [`deploy/`](deploy/).
Details siehe Abschnitt „Sicherheit“ in [`src/README.md`](src/README.md).

## Repo-Struktur

```
install-mitteilungsblatt.sh   ← fertiges Installer-Skript (enthält App + gebautes Frontend)
src/                          ← Backend-Quellcode (Node.js/Express, JSON-API)
web/                          ← Frontend-Quellcode (React + Vite)
tools/build.sh                ← baut Frontend + install-mitteilungsblatt.sh neu aus src/ + web/
deploy/                       ← Beispiel-Konfigurationen für HTTPS-Reverse-Proxy (Caddy/nginx)
```

## Nach Änderungen am Code

```bash
# Code in src/ bzw. web/ bearbeiten, dann:
bash tools/build.sh
git add -A
git commit -m "Update"
git push
```

Damit steckt der neue Code (inkl. gebautem React-Frontend) automatisch im
Installer-Skript. Nur Backend-Änderungen ohne Frontend-Neubau:
`SKIP_WEB=1 bash tools/build.sh`.
