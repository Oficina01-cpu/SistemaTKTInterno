# ============================================================================
# backup.ps1 — Respaldo de la BD SQLite ULTRA (Windows / produccion)
# - Usa "VACUUM INTO" para un respaldo consistente aunque el servidor este vivo (WAL).
# - Rota y retiene solo los ultimos 30 respaldos en /Backup.
# - Programar cada 2 horas con la Tarea Programada (ver install-task.ps1).
# ============================================================================

$ErrorActionPreference = "Stop"

# Raiz del backend = carpeta padre de /scripts
$Root      = Split-Path -Parent $PSScriptRoot
$DbPath    = Join-Path $Root "data\tickets.db"
$BackupDir = Join-Path $Root "Backup"
$Retention = 30

if (-not (Test-Path $DbPath)) { Write-Error "No existe la BD en $DbPath"; exit 1 }
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }

$stamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$dest   = Join-Path $BackupDir "tickets_$stamp.db"

# Respaldo consistente con VACUUM INTO usando el mismo node:sqlite (sin sqlite3.exe externo)
$vacuum = Join-Path $PSScriptRoot "vacuum-backup.cjs"
& node $vacuum $DbPath $dest | Out-Null

if (-not (Test-Path $dest)) { Write-Error "Fallo la creacion del respaldo"; exit 1 }
Write-Host "[backup] Creado: $dest"

# --- Rotacion: conservar solo los ultimos $Retention respaldos ---
$backups = Get-ChildItem -Path $BackupDir -Filter "tickets_*.db" | Sort-Object LastWriteTime -Descending
if ($backups.Count -gt $Retention) {
    $backups | Select-Object -Skip $Retention | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Host "[backup] Eliminado antiguo: $($_.Name)"
    }
}

# --- (Opcional) Redundancia off-site: copiar a F:/TicketInterno/BASES DE DATOS ---
$offsite = "F:\TicketInterno\BASES DE DATOS"
if (Test-Path $offsite) {
    Copy-Item $dest (Join-Path $offsite ("tickets_$stamp.db")) -Force
    # Rotacion tambien en offsite
    $ob = Get-ChildItem -Path $offsite -Filter "tickets_*.db" | Sort-Object LastWriteTime -Descending
    if ($ob.Count -gt $Retention) {
        $ob | Select-Object -Skip $Retention | ForEach-Object { Remove-Item $_.FullName -Force }
    }
    Write-Host "[backup] Copia off-site en: $offsite"
}

Write-Host "[backup] Retencion aplicada: maximo $Retention respaldos."
