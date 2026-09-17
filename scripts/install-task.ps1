# ============================================================================
# install-task.ps1 — Registra la Tarea Programada de respaldo cada 2 horas.
# Ejecutar UNA VEZ como Administrador:
#   powershell -ExecutionPolicy Bypass -File scripts\install-task.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

$Root      = Split-Path -Parent $PSScriptRoot
$BackupPs1 = Join-Path $Root "scripts\backup.ps1"
$TaskName  = "ULTRA_Tickets_Backup"

if (-not (Test-Path $BackupPs1)) { Write-Error "No se encontro backup.ps1"; exit 1 }

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$BackupPs1`""

# Cada 2 horas, indefinidamente
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Hours 2) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd `
    -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force `
    -Description "Respaldo automatico de la BD del Sistema de Tickets ULTRA cada 2 horas (retencion 30)."

Write-Host "Tarea '$TaskName' registrada: respaldo cada 2 horas."
Write-Host "Verifica con:  Get-ScheduledTask -TaskName $TaskName"
