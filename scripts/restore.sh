#!/usr/bin/env bash
# -------------------------------------------------------------------
# Cartelera Planta — restore from backup
#
# Usage: bash restore.sh db-YYYYMMDD-HHMMSS.sqlite.gz [uploads-YYYYMMDD-HHMMSS.tar.gz]
# -------------------------------------------------------------------
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <db-YYYYMMDD-HHMMSS.sqlite.gz> [<uploads-YYYYMMDD-HHMMSS.tar.gz>]"
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/cartelera}"
CONTAINER="${CONTAINER:-cartelera-backend}"

DB_FILE="$BACKUP_DIR/$1"
UPLOADS_FILE="${2:+$BACKUP_DIR/$2}"

[[ -f "$DB_FILE" ]] || { echo "DB backup not found: $DB_FILE"; exit 1; }
[[ -z "$UPLOADS_FILE" ]] || [[ -f "$UPLOADS_FILE" ]] || { echo "Uploads backup not found: $UPLOADS_FILE"; exit 1; }

read -p "⚠  This will OVERWRITE the current database (and uploads if provided). Continue? (yes/no): " confirm
[[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 1; }

echo "Stopping backend..."
docker compose stop backend

echo "Restoring DB..."
TMP=$(mktemp -d)
gunzip -c "$DB_FILE" > "$TMP/restore.sqlite"
docker cp "$TMP/restore.sqlite" "$CONTAINER:/data/cartelera.db"
rm -rf "$TMP"

if [[ -n "$UPLOADS_FILE" ]]; then
  echo "Restoring uploads..."
  docker run --rm --volumes-from "$CONTAINER" -v "$BACKUP_DIR:/backup" alpine:3 \
    sh -c "rm -rf /data/uploads && tar xzf /backup/$(basename "$UPLOADS_FILE") -C /data"
fi

echo "Starting backend..."
docker compose start backend

echo "✅ Restore done."
