#!/usr/bin/env bash
# Sichert die Mitteilungsblatt-Daten (Inhalte, Bilder, PDFs) als komprimiertes
# Archiv. Wird taeglich per systemd-Timer ausgefuehrt (siehe Installer).
set -euo pipefail

APP_DIR="/opt/mitteilungsblatt"
BACKUP_DIR="$APP_DIR/backups"
KEEP=14  # Anzahl der aufzubewahrenden taeglichen Backups

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
ARCHIVE="$BACKUP_DIR/backup-$TIMESTAMP.tar.gz"

TARGETS=()
[ -d "$APP_DIR/data" ] && TARGETS+=("data")
[ -d "$APP_DIR/public/uploads" ] && TARGETS+=("public/uploads")
[ -d "$APP_DIR/public/pdf" ] && TARGETS+=("public/pdf")

if [ ${#TARGETS[@]} -eq 0 ]; then
  echo "Nichts zu sichern (keine Datenverzeichnisse gefunden)." >&2
  exit 1
fi

tar -czf "$ARCHIVE" -C "$APP_DIR" "${TARGETS[@]}"

# Alte Backups aufraeumen, nur die letzten $KEEP behalten
ls -1t "$BACKUP_DIR"/backup-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "Backup erstellt: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
