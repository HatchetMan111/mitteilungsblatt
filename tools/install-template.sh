#!/usr/bin/env bash
# ============================================================================
#  Mitteilungsblatt — Installer für Proxmox VE
#  Legt einen LXC-Container an, installiert Node.js und die App darin.
#
#  Ausführen AUF DEM PROXMOX-VE-HOST (nicht in einem Container!) als root:
#    bash install-mitteilungsblatt.sh
#
#  Nicht-interaktiv mit Standardwerten (z.B. für Automatisierung):
#    AUTO=1 bash install-mitteilungsblatt.sh
# ============================================================================
set -euo pipefail

# ---------- Darstellung ----------
if [ -t 1 ]; then
  C_RESET="\033[0m"; C_BOLD="\033[1m"; C_GREEN="\033[1;32m"; C_RED="\033[1;31m"
  C_YELLOW="\033[1;33m"; C_BLUE="\033[1;34m"; C_DIM="\033[2m"
else
  C_RESET=""; C_BOLD=""; C_GREEN=""; C_RED=""; C_YELLOW=""; C_BLUE=""; C_DIM=""
fi
msg_info()  { echo -e " ${C_BLUE}i${C_RESET}  $1"; }
msg_ok()    { echo -e " ${C_GREEN}✓${C_RESET}  $1"; }
msg_warn()  { echo -e " ${C_YELLOW}!${C_RESET}  $1"; }
msg_err()   { echo -e " ${C_RED}✗${C_RESET}  $1"; }
section()   { echo -e "\n${C_BOLD}$1${C_RESET}"; }

trap 'msg_err "Installation abgebrochen (Zeile $LINENO). Siehe Meldung oberhalb."' ERR

# ---------- Voraussetzungen ----------
if [ "$(id -u)" -ne 0 ]; then
  msg_err "Bitte als root auf dem Proxmox-VE-Host ausführen."
  exit 1
fi
if ! command -v pct >/dev/null 2>&1; then
  msg_err "Dieses Skript muss auf einem Proxmox-VE-Host laufen (Befehl 'pct' nicht gefunden)."
  exit 1
fi

APP_NAME="mitteilungsblatt"
APP_PORT=3000

echo -e "${C_BOLD}"
cat <<'BANNER'
  __  __ _  _   _     _ _                       _     _     _       _   _
 |  \/  (_)| |_| |___(_) |_ _  _ _ _  __ _ ___ | |__ | |___| |_ __| |_| |
 | |\/| | ||  _|  _/ -_) | | | || | ' \/ _` (_-<| '_ \| / _` \ V  _|  _|_|
 |_|  |_|_(_)__|\__\___|_|_|\_,_|_|_||_\__, /__/|_.__/|_\__,_|\_/\__|\__(_)
                                        |___/
BANNER
echo -e "${C_RESET}  Gemeinde-Mitteilungsblatt — Installer für Proxmox VE\n"

# ---------- Einstellungen (mit Defaults, interaktiv abfragbar) ----------
DEFAULT_CTID="$(pvesh get /cluster/nextid 2>/dev/null || echo 900)"
DEFAULT_HOSTNAME="mitteilungsblatt"
DEFAULT_DISK_GB=4
DEFAULT_CORES=2
DEFAULT_RAM_MB=1024
DEFAULT_BRIDGE="vmbr0"
DEFAULT_STORAGE="local-lvm"
DEFAULT_TEMPLATE_STORAGE="local"

if [ "${AUTO:-0}" = "1" ] || [ ! -t 0 ]; then
  CTID="$DEFAULT_CTID"; HOSTNAME_="$DEFAULT_HOSTNAME"; DISK_GB="$DEFAULT_DISK_GB"
  CORES="$DEFAULT_CORES"; RAM_MB="$DEFAULT_RAM_MB"; BRIDGE="$DEFAULT_BRIDGE"
  STORAGE="$DEFAULT_STORAGE"; TEMPLATE_STORAGE="$DEFAULT_TEMPLATE_STORAGE"
  msg_info "Automatischer Modus (AUTO=1) — Standardwerte werden verwendet."
else
  section "Container-Einstellungen (Enter = Standardwert übernehmen)"
  read -rp "  Container-ID [$DEFAULT_CTID]: " CTID; CTID="${CTID:-$DEFAULT_CTID}"
  read -rp "  Hostname [$DEFAULT_HOSTNAME]: " HOSTNAME_; HOSTNAME_="${HOSTNAME_:-$DEFAULT_HOSTNAME}"
  read -rp "  Festplatte in GB [$DEFAULT_DISK_GB]: " DISK_GB; DISK_GB="${DISK_GB:-$DEFAULT_DISK_GB}"
  read -rp "  CPU-Kerne [$DEFAULT_CORES]: " CORES; CORES="${CORES:-$DEFAULT_CORES}"
  read -rp "  RAM in MB [$DEFAULT_RAM_MB]: " RAM_MB; RAM_MB="${RAM_MB:-$DEFAULT_RAM_MB}"
  read -rp "  Netzwerk-Bridge [$DEFAULT_BRIDGE]: " BRIDGE; BRIDGE="${BRIDGE:-$DEFAULT_BRIDGE}"
  read -rp "  Storage für Container-Disk [$DEFAULT_STORAGE]: " STORAGE; STORAGE="${STORAGE:-$DEFAULT_STORAGE}"
  read -rp "  Storage für LXC-Template [$DEFAULT_TEMPLATE_STORAGE]: " TEMPLATE_STORAGE; TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-$DEFAULT_TEMPLATE_STORAGE}"
fi

if pct status "$CTID" >/dev/null 2>&1; then
  section "Container $CTID existiert bereits"
  msg_warn "Es wird angenommen, dass hier bereits eine Mitteilungsblatt-Installation läuft."
  read -rp "  App-Code im bestehenden Container aktualisieren? Daten (data/, uploads) bleiben erhalten. [j/N]: " UPDATE_CONFIRM
  if [[ "$UPDATE_CONFIRM" =~ ^[jJ]$ ]]; then
    UPDATE_MODE=1
  else
    msg_err "Abgebrochen. Bitte eine andere Container-ID wählen oder Container zuerst löschen."
    exit 1
  fi
else
  UPDATE_MODE=0
fi

# ---------- Template sicherstellen ----------
if [ "$UPDATE_MODE" = "0" ]; then
  section "LXC-Container anlegen"
  TEMPLATE="debian-12-standard_12.7-1_amd64.tar.zst"
  if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE"; then
    msg_info "Lade Debian-12-Template herunter …"
    pveam update >/dev/null 2>&1 || true
    LATEST_DEBIAN=$(pveam available --section system 2>/dev/null | grep 'debian-12-standard' | awk '{print $2}' | sort -V | tail -1)
    TEMPLATE="${LATEST_DEBIAN:-$TEMPLATE}"
    pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
  fi
  msg_ok "Template bereit: $TEMPLATE"

  pct create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
    --hostname "$HOSTNAME_" \
    --cores "$CORES" \
    --memory "$RAM_MB" \
    --swap 512 \
    --rootfs "${STORAGE}:${DISK_GB}" \
    --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp,firewall=1" \
    --unprivileged 1 \
    --features nesting=0 \
    --onboot 1 \
    --ostype debian >/dev/null
  msg_ok "Container $CTID erstellt (Hostname: $HOSTNAME_)"

  pct start "$CTID" >/dev/null
  msg_info "Container wird gestartet, warte auf Netzwerk …"
  for i in $(seq 1 30); do
    if pct exec "$CTID" -- ping -c1 -W1 deb.debian.org >/dev/null 2>&1; then break; fi
    sleep 2
    if [ "$i" = 30 ]; then msg_warn "Kein Internetzugang im Container erkannt — Installation versucht es trotzdem."; fi
  done
  msg_ok "Container läuft"
fi

# ---------- App-Code übertragen ----------
section "App-Code übertragen"
PAYLOAD_FILE="$(mktemp)"
trap 'rm -f "$PAYLOAD_FILE"' EXIT

# Der komplette Quellcode der App steckt als base64-kodiertes tar.gz direkt
# in diesem Skript — dadurch ist keine externe Download-Quelle nötig.
base64 -d <<'PAYLOAD_END' > "$PAYLOAD_FILE"
__APP_PAYLOAD_BASE64__
PAYLOAD_END

pct push "$CTID" "$PAYLOAD_FILE" /root/mitteilungsblatt.tar.gz
pct exec "$CTID" -- mkdir -p /opt/mitteilungsblatt
pct exec "$CTID" -- tar -xzf /root/mitteilungsblatt.tar.gz -C /opt/mitteilungsblatt
pct exec "$CTID" -- rm -f /root/mitteilungsblatt.tar.gz
msg_ok "App-Code liegt in /opt/mitteilungsblatt im Container"

# ---------- Node.js & Abhängigkeiten ----------
section "Node.js installieren"
pct exec "$CTID" -- bash -c "apt-get update -qq && apt-get install -y -qq curl ca-certificates gnupg openssl >/dev/null"
pct exec "$CTID" -- bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1"
pct exec "$CTID" -- bash -c "apt-get install -y -qq nodejs >/dev/null"
NODE_VERSION="$(pct exec "$CTID" -- node --version)"
msg_ok "Node.js installiert ($NODE_VERSION)"

msg_info "Installiere App-Abhängigkeiten (npm install) …"
pct exec "$CTID" -- bash -c "cd /opt/mitteilungsblatt && npm install --omit=dev --no-audit --no-fund >/tmp/npm-install.log 2>&1" \
  || { msg_err "npm install fehlgeschlagen, Log:"; pct exec "$CTID" -- tail -40 /tmp/npm-install.log; exit 1; }
msg_ok "Abhängigkeiten installiert"

# ---------- Systemd-Dienst & Konfiguration ----------
section "Dienst einrichten"
if [ "$UPDATE_MODE" = "0" ]; then
  pct exec "$CTID" -- bash -c "id -u mitteilungsblatt >/dev/null 2>&1 || useradd -r -m -d /opt/mitteilungsblatt -s /usr/sbin/nologin mitteilungsblatt"

  SESSION_SECRET="$(pct exec "$CTID" -- openssl rand -hex 32)"
  pct exec "$CTID" -- bash -c "cat > /opt/mitteilungsblatt/.env" <<EOF
PORT=${APP_PORT}
SESSION_SECRET=${SESSION_SECRET}
ADMIN_USER=admin
ADMIN_PASSWORD=admin
EOF

  pct exec "$CTID" -- bash -c "cat > /etc/systemd/system/${APP_NAME}.service" <<EOF
[Unit]
Description=Mitteilungsblatt
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/mitteilungsblatt
EnvironmentFile=/opt/mitteilungsblatt/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
User=mitteilungsblatt

[Install]
WantedBy=multi-user.target
EOF
fi

pct exec "$CTID" -- bash -c "chown -R mitteilungsblatt:mitteilungsblatt /opt/mitteilungsblatt"
pct exec "$CTID" -- bash -c "systemctl daemon-reload && systemctl enable --now ${APP_NAME}"
sleep 2
pct exec "$CTID" -- bash -c "systemctl restart ${APP_NAME}"
sleep 2

if pct exec "$CTID" -- systemctl is-active --quiet "${APP_NAME}"; then
  msg_ok "Dienst läuft"
else
  msg_err "Dienst konnte nicht gestartet werden. Logs:"
  pct exec "$CTID" -- journalctl -u "${APP_NAME}" --no-pager -n 40
  exit 1
fi

# ---------- Abschluss ----------
section "Fertig"
IP_ADDR="$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}')"

echo -e "${C_GREEN}${C_BOLD}Mitteilungsblatt ist installiert.${C_RESET}\n"
echo -e "  Öffentliche Seite : ${C_BOLD}http://${IP_ADDR}:${APP_PORT}/${C_RESET}"
echo -e "  Redaktions-Login  : ${C_BOLD}http://${IP_ADDR}:${APP_PORT}/admin${C_RESET}"
echo -e "\n${C_YELLOW}${C_BOLD}Admin-Zugangsdaten (Standard):${C_RESET}"
echo -e "  Benutzername      : admin"
echo -e "  Passwort          : admin"
echo -e "  ${C_RED}${C_BOLD}Wichtig:${C_RESET} fester Standard-Login, leicht zu erraten — bitte gleich nach"
echo -e "  dem ersten Login unter „Einstellungen“ ein eigenes Passwort vergeben,"
echo -e "  besonders falls die Seite außerhalb des Heimnetzes erreichbar ist."
echo -e "\n  Container-ID      : $CTID"
echo -e "  Dienst verwalten  : pct exec $CTID -- systemctl {status|restart} ${APP_NAME}"
echo -e "  Update einspielen : dieses Skript erneut mit derselben Container-ID ausführen"
echo ""
