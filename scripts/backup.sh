#!/usr/bin/env bash
# -------------------------------------------------------------------
# Cartelera Planta — nightly backup
#
# - Dumps SQLite database to .sql.gz
# - Archives uploads directory
# - Rotates backups older than KEEP_DAYS (default: 30)
# -------------------------------------------------------------------
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/cartelera}"
CONTAINER="${CONTAINER:-cartelera-backend}"
KEEP_DAYS="${KEEP_DAYS:-30}"

TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Backup start ($TS)"

# 1. DB snapshot (using .backup to ensure consistency during writes)
docker exec "$CONTAINER" sqlite3 /data/cartelera.db ".backup /tmp/cartelera.db.bak"
docker cp "$CONTAINER:/tmp/cartelera.db.bak" "$BACKUP_DIR/db-$TS.sqlite"
docker exec "$CONTAINER" rm -f /tmp/cartelera.db.bak
gzip "$BACKUP_DIR/db-$TS.sqlite"

# 2. Uploads snapshot (tar, gzipped)
docker run --rm \
  --volumes-from "$CONTAINER" \
  -v "$BACKUP_DIR:/backup" \
  alpine:3 \
  tar czf "/backup/uploads-$TS.tar.gz" -C /data uploads

# 3. Rotation
find "$BACKUP_DIR" -maxdepth 1 -type f -name "db-*.sqlite.gz" -mtime +$KEEP_DAYS -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name "uploads-*.tar.gz" -mtime +$KEEP_DAYS -delete

echo "[$(date -Iseconds)] Backup OK: $(ls -lh "$BACKUP_DIR" | tail -2)"
