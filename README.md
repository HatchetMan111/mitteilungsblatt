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
install-mitteilungsblatt.sh   ← fertiges Installer-Skript (enthält den App-Code eingebettet)
src/                          ← App-Quellcode (Node.js/Express)
tools/build.sh                ← baut install-mitteilungsblatt.sh neu aus src/
deploy/                       ← Beispiel-Konfigurationen für HTTPS-Reverse-Proxy (Caddy/nginx)
```

## Nach Änderungen am Code

```bash
# Code in src/ bearbeiten, dann:
bash tools/build.sh
git add -A
git commit -m "Update"
git push
```

Damit steckt der neue Code automatisch im Installer-Skript.
