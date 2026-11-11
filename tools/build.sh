#!/usr/bin/env bash
# Baut install-mitteilungsblatt.sh im Repo-Root aus dem Code in src/ und
# web/ — der fertige Installer ist komplett in sich abgeschlossen.
# Aufruf: bash tools/build.sh              (aus dem Repo-Root heraus)
#         SKIP_WEB=1 bash tools/build.sh   (nur Backend neu einpacken, Frontend unverändert)
set -euo pipefail
cd "$(dirname "$0")"

APP_DIR="../src"
WEB_DIR="../web"
TEMPLATE="install-template.sh"
OUT="../install-mitteilungsblatt.sh"

if [ "${SKIP_WEB:-0}" != "1" ]; then
  echo "Baue React-Frontend (web/) …"
  if ! command -v npm >/dev/null 2>&1; then
    echo "Fehler: npm nicht gefunden — Node.js wird zum Bauen des Frontends benötigt." >&2
    echo "Ohne Frontend-Build fortfahren: SKIP_WEB=1 bash tools/build.sh" >&2
    exit 1
  fi
  (cd "$WEB_DIR" && npm ci --no-audit --no-fund && npm run build)
  echo "Frontend liegt in src/public/app/"
fi

echo "Packe App-Verzeichnis (src/) …"
tar --exclude='node_modules' --exclude='data' --exclude='public/uploads' \
    --exclude='public/pdf' --exclude='.env' \
    -C "$APP_DIR" -czf app.tar.gz .

echo "Kodiere als base64 …"
base64 -w0 app.tar.gz > app.b64

echo "Baue finales Installer-Skript …"
python3 - <<'PYEOF'
with open('install-template.sh', 'r') as f:
    template = f.read()
with open('app.b64', 'r') as f:
    payload = f.read()
result = template.replace('__APP_PAYLOAD_BASE64__', payload)
with open('../install-mitteilungsblatt.sh', 'w') as f:
    f.write(result)
PYEOF

chmod +x "$OUT"
rm -f app.tar.gz app.b64
SIZE=$(du -h "$OUT" | cut -f1)
echo "Fertig: install-mitteilungsblatt.sh ($SIZE) im Repo-Root"
