# ============================================================================
# setup-cloudflared.ps1 — Asistente para publicar ULTRA con Cloudflare Tunnel
# Automatiza: verificar/instalar cloudflared, login, crear tunel, rellenar el
# config con el TUNNEL_ID real, enrutar DNS e instalar el servicio de Windows.
#
# Ejecutar como Administrador:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-cloudflared.ps1
#
# Parametros opcionales:
#   -Hostname  Subdominio publico (por defecto tickets.myspectra.com.mx)
#   -TunnelName Nombre del tunel  (por defecto ultra-tickets)
# ============================================================================
param(
  [string]$Hostname   = "tickets.myspectra.com.mx",
  [string]$TunnelName = "ultra-tickets"
)
$ErrorActionPreference = "Stop"

$Root       = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $PSScriptRoot "cloudflared-config.yml"

function Find-Cloudflared {
  $c = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
  if ($c) { return $c }
  foreach ($p in @("C:\Program Files (x86)\cloudflared\cloudflared.exe",
                   "C:\Program Files\cloudflared\cloudflared.exe")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

# 1) Instalar cloudflared si falta
$cf = Find-Cloudflared
if (-not $cf) {
  Write-Host "cloudflared no encontrado. Instalando con winget..."
  winget install --id Cloudflare.cloudflared --source winget --accept-source-agreements --accept-package-agreements
  $cf = Find-Cloudflared
  if (-not $cf) { Write-Error "No se pudo instalar cloudflared. Instalalo manualmente: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"; exit 1 }
}
Write-Host "cloudflared: $cf"

# 2) Login (abre el navegador para autorizar el dominio)
Write-Host "`n== Paso 1/4: Autenticacion en Cloudflare (se abrira el navegador) =="
& $cf tunnel login

# 3) Crear el tunel (si ya existe, reutiliza)
Write-Host "`n== Paso 2/4: Creando tunel '$TunnelName' =="
& $cf tunnel create $TunnelName 2>&1 | Write-Host

# Obtener el TUNNEL_ID
$info = & $cf tunnel list 2>&1 | Out-String
$tunnelId = ($info -split "`n" | Where-Object { $_ -match [regex]::Escape($TunnelName) } |
             ForEach-Object { ($_ -split "\s+")[0] } | Select-Object -First 1)
if (-not $tunnelId) { Write-Error "No se pudo determinar el TUNNEL_ID. Revisa 'cloudflared tunnel list'."; exit 1 }
Write-Host "TUNNEL_ID = $tunnelId"

# Ubicar el archivo de credenciales
$credDir  = Join-Path $env:USERPROFILE ".cloudflared"
$credFile = Join-Path $credDir "$tunnelId.json"
if (-not (Test-Path $credFile)) {
  $found = Get-ChildItem $credDir -Filter "*.json" -ErrorAction SilentlyContinue |
           Where-Object { $_.Name -like "*$tunnelId*" } | Select-Object -First 1
  if ($found) { $credFile = $found.FullName }
}

# 4) Rellenar el config con TUNNEL_ID y credenciales reales
Write-Host "`n== Paso 3/4: Actualizando $ConfigPath =="
$cfg = Get-Content $ConfigPath -Raw
$cfg = $cfg -replace "tunnel: .*",           "tunnel: $tunnelId"
$cfg = $cfg -replace "credentials-file: .*", "credentials-file: $credFile"
$cfg = $cfg -replace "hostname: .*",         "hostname: $Hostname"
$cfg = $cfg -replace "httpHostHeader: .*",   "httpHostHeader: $Hostname"
Set-Content -Path $ConfigPath -Value $cfg -Encoding UTF8
Write-Host "Config actualizado (tunnel, credenciales y hostname=$Hostname)."

# 5) Enrutar DNS e instalar el servicio
Write-Host "`n== Paso 4/4: Enrutando DNS e instalando servicio =="
& $cf tunnel route dns $TunnelName $Hostname 2>&1 | Write-Host
& $cf --config $ConfigPath service install 2>&1 | Write-Host

Write-Host "`n=================================================================="
Write-Host " Tunel Cloudflare configurado para $Hostname"
Write-Host " Verifica:  https://$Hostname/health"
Write-Host " Recuerda: en .env puedes fijar HOST=127.0.0.1 para que el backend"
Write-Host " solo sea accesible por el tunel local."
Write-Host " Siguiente: sube scripts\cpanel\.htaccess a public_html en cPanel"
Write-Host " y configura Cloudflare Access para @corporativoultra.com."
Write-Host "=================================================================="
