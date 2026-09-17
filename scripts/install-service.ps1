# ============================================================================
# install-service.ps1 — Registra el backend como servicio de Windows con NSSM
# para que arranque solo y se reinicie ante caidas / cortes de luz.
#
# Requiere NSSM (https://nssm.cc/download). Coloca nssm.exe en el PATH o junto
# a este script. Ejecutar como Administrador:
#   powershell -ExecutionPolicy Bypass -File scripts\install-service.ps1
# ============================================================================
$ErrorActionPreference = "Stop"

$Root       = Split-Path -Parent $PSScriptRoot
$ServiceName = "ULTRA_Tickets"
$NodeExe    = (Get-Command node).Source
$Entry      = Join-Path $Root "server\index.js"

# Ubicar nssm
$nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $nssm) { $nssm = Join-Path $PSScriptRoot "nssm.exe" }
if (-not (Test-Path $nssm)) {
    Write-Error "No se encontro nssm.exe. Descargalo de https://nssm.cc y colocalo en el PATH o en /scripts."
    exit 1
}

& $nssm install $ServiceName $NodeExe $Entry
& $nssm set $ServiceName AppDirectory $Root
& $nssm set $ServiceName AppStdout (Join-Path $Root "Backup\service-out.log")
& $nssm set $ServiceName AppStderr (Join-Path $Root "Backup\service-err.log")
& $nssm set $ServiceName Start SERVICE_AUTO_START
& $nssm set $ServiceName AppExit Default Restart
& $nssm set $ServiceName AppRestartDelay 3000

Start-Service $ServiceName
Write-Host "Servicio '$ServiceName' instalado y arrancado."
Write-Host "El backend queda escuchando en el puerto configurado (.env PORT, por defecto 3080)."
Write-Host "Detener:   nssm stop $ServiceName"
Write-Host "Quitar:    nssm remove $ServiceName confirm"
