#!/usr/bin/env bash
# Baut install-mitteilungsblatt.sh im Repo-Root aus dem Code in src/
# Aufruf: bash tools/build.sh   (aus dem Repo-Root heraus)
set -euo pipefail
cd "$(dirname "$0")"

APP_DIR="../src"
TEMPLATE="install-template.sh"
OUT="../install-mitteilungsblatt.sh"

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
