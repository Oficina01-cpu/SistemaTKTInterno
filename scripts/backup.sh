#!/usr/bin/env bash
# ============================================================================
# backup.sh — Respaldo de la BD SQLite ULTRA (Linux / cPanel cron)
# - Respaldo consistente con "VACUUM INTO" (sqlite3) o copia con .backup.
# - Retiene solo los ultimos 30 respaldos en ./Backup.
#
# Programar en cPanel > Cron Jobs cada 2 horas:
#   0 */2 * * *  /home/USUARIO/tkt/scripts/backup.sh >> /home/USUARIO/tkt/Backup/backup.log 2>&1
# ============================================================================
set -euo pipefail

# Raiz del backend = carpeta padre de /scripts
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="$ROOT/data/tickets.db"
BACKUP_DIR="$ROOT/Backup"
RETENTION=30

mkdir -p "$BACKUP_DIR"
[ -f "$DB" ] || { echo "[backup] No existe la BD: $DB"; exit 1; }

STAMP="$(date +%Y%m%d_%H%M%S)"
DEST="$BACKUP_DIR/tickets_${STAMP}.db"

if command -v sqlite3 >/dev/null 2>&1; then
  # Respaldo consistente aunque el servidor este activo (WAL)
  sqlite3 "$DB" "VACUUM INTO '${DEST}'"
else
  # Fallback: copia simple (detener el servidor recomendado si no hay sqlite3)
  cp "$DB" "$DEST"
fi

echo "[backup] Creado: $DEST"

# --- Rotacion: conservar solo los ultimos $RETENTION ---
COUNT=$(ls -1t "$BACKUP_DIR"/tickets_*.db 2>/dev/null | wc -l)
if [ "$COUNT" -gt "$RETENTION" ]; then
  ls -1t "$BACKUP_DIR"/tickets_*.db | tail -n +$((RETENTION + 1)) | while read -r old; do
    rm -f "$old"
    echo "[backup] Eliminado antiguo: $(basename "$old")"
  done
fi

echo "[backup] Retencion aplicada: maximo $RETENTION respaldos."
