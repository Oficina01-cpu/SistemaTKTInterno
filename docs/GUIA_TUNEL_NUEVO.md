# Guía paso a paso — Cuenta Cloudflare nueva + dominio gratuito + túnel desde cero

Objetivo: publicar el **Sistema de Tickets Interno ULTRA** (que corre en `localhost:3080` en el servidor Windows) en Internet con HTTPS, usando una **cuenta nueva de Cloudflare** y un **dominio gratuito**, con un **conector cloudflared independiente** que NO interfiere con los otros 2 sistemas que ya usan el servicio existente.

> Puerto local del sistema: **3080 (HTTP)** → URL del servicio en el túnel: `http://localhost:3080`

---

## Parte A — Crear la cuenta de Cloudflare (desde cero)

1. Ve a **https://dash.cloudflare.com/sign-up**
2. Registra tu correo y una contraseña. Verifica el correo (llega un enlace de confirmación).
3. Inicia sesión. Ya tienes la cuenta lista (plan Free).

---

## Parte B — Conseguir un dominio gratuito y agregarlo a Cloudflare

Cloudflare necesita gestionar el DNS del dominio. Elige UNA de estas fuentes de dominio gratuito:

### Opción B1 — dpdns.org (DigitalPlat FreeDomain) — recomendada
Permite delegar el dominio a Cloudflare (usar los nameservers de Cloudflare).

1. Ve a **https://dash.domain.digitalplat.org** y crea/inicia cuenta (requiere cuenta de GitHub).
2. Registra un dominio gratuito, por ejemplo `ultratkt.dpdns.org` (elige el nombre que prefieras).
3. Durante el registro, elige la opción **"Custom nameservers"** / **"Usar mis propios nameservers"** (para poder apuntar a Cloudflare).
4. Deja esta pestaña abierta; en la Parte C Cloudflare te dará los nameservers a poner aquí.

### Opción B2 — Dominio que ya tengas
Si dispones de cualquier dominio, sirve igual. Solo necesitas poder cambiar sus nameservers.

---

## Parte C — Agregar el dominio a Cloudflare y delegar DNS

1. En el dashboard de Cloudflare: botón **"Add a domain"** / **"Agregar sitio"**.
2. Escribe tu dominio (ej. `ultratkt.dpdns.org`) y continúa.
3. Elige el plan **Free** y confirma.
4. Cloudflare escanea DNS y te muestra **2 nameservers** asignados, por ejemplo:
   ```
   xxxx.ns.cloudflare.com
   yyyy.ns.cloudflare.com
   ```
5. Copia esos 2 nameservers y **pégalos en el panel del dominio** (dpdns.org, Parte B) como nameservers personalizados. Guarda.
6. Vuelve a Cloudflare y pulsa **"Check nameservers"**. La activación puede tardar de minutos a unas horas. Cuando el dominio quede **"Active"**, sigue.

> Verificación: el dominio debe aparecer como **Active** en Cloudflare antes de crear el túnel.

---

## Parte D — Crear el túnel en Cloudflare (Zero Trust)

1. En el menú lateral de Cloudflare: **Zero Trust** (si te pide crear organización/equipo, elige un nombre y el plan **Free**).
2. Ve a **Networks → Tunnels** → **Create a tunnel**.
3. Tipo de conector: **Cloudflared**. Continúa.
4. Nombre del túnel: por ejemplo `ultra-tickets`. Guarda.
5. En **"Install and run a connector"**, elige **Windows** y **64-bit**.
6. Cloudflare muestra un comando con un **token**. **Copia ese token** (lo usaremos en la Parte E). No lo compartas públicamente.

---

## Parte E — Instalar el conector en el servidor (SIN afectar los otros 2 sistemas)

Como el servicio `cloudflared` actual ya sirve 2 sistemas, instalaremos **un segundo conector independiente** con nombre de servicio distinto.

**Opción E1 — Prueba rápida (no persistente):** en una terminal, ejecutar:
```
"F:\ServerManager\cloudflared\cloudflared.exe" tunnel run --token <TOKEN_DEL_PASO_D>
```
Sirve para validar de inmediato. Se detiene al cerrar la terminal.

**Opción E2 — Servicio permanente e independiente (producción):**
El comando estándar `service install <token>` chocaría con el servicio existente. Para tener un servicio separado usamos **NSSM** (ya descargado en `scripts\nssm.exe`). En PowerShell **como Administrador**:
```powershell
$nssm = "F:\TicketInterno\TKT\scripts\nssm.exe"
$cf   = "F:\ServerManager\cloudflared\cloudflared.exe"
$token = "<TOKEN_DEL_PASO_D>"
& $nssm install ULTRA_Cloudflared $cf "tunnel run --token $token"
& $nssm set ULTRA_Cloudflared Start SERVICE_AUTO_START
& $nssm set ULTRA_Cloudflared AppExit Default Restart
Start-Service ULTRA_Cloudflared
```
Esto crea un servicio `ULTRA_Cloudflared` propio, con arranque automático, sin tocar el servicio `cloudflared` que sirve tus otros 2 sistemas.

> Verifica en el panel del túnel que el estado pase a **HEALTHY / Connected** y muestre 1 réplica.

---

## Parte F — Publicar el hostname (Public Hostname)

1. En el panel del túnel `ultra-tickets` → pestaña **Public Hostname** → **Add a public hostname**.
2. Configura:
   - **Subdomain:** `tickets` (o el que prefieras)
   - **Domain:** tu dominio (ej. `ultratkt.dpdns.org`) — debe aparecer en el desplegable porque ya está Active en Cloudflare
   - **Path:** (vacío)
   - **Type:** `HTTP`
   - **URL:** `localhost:3080`
3. Guardar. Como el dominio SÍ está en Cloudflare, **el DNS se crea automáticamente** (a diferencia del intento anterior con `ultra.dpdns.org`).

Resultado: `https://tickets.ultratkt.dpdns.org` servirá el sistema con HTTPS válido.

---

## Parte G — Dejar el backend siempre encendido

Para que el túnel siempre tenga qué servir, el sistema de tickets debe correr permanentemente. En PowerShell **como Administrador**:
```powershell
cd F:\TicketInterno\TKT
.\scripts\install-service.ps1
Start-Service ULTRA_Tickets
```
Esto instala el backend como servicio de Windows `ULTRA_Tickets` (arranque automático + reinicio ante caídas), usando el `nssm.exe` de `scripts\`.

---

## Parte H — Verificación final

1. `https://tickets.<tu-dominio>/health` responde `{ "ok": true, ... }`.
2. Abre `https://tickets.<tu-dominio>/` → ves el splash ULTRA y el login.
3. Inicia sesión con un master (`master2@corporativoultra.com` / `Master2`).
4. (Opcional) Redirección de marca desde `myspectra.com.mx/ticketInterno`: sube `scripts/cpanel/.htaccess` (ajustando el destino al nuevo subdominio) a `public_html/` en HostGator.

---

## Seguridad (recomendado)

- **Cloudflare Access (Zero Trust):** restringe el acceso a correos `@corporativoultra.com` antes del login.
- En `.env`, con el túnel activo, puedes fijar `HOST=127.0.0.1` para que el backend solo sea accesible por el conector local.
- Rota cualquier token que se haya expuesto.

---

## Checklist rápido

- [ ] Cuenta Cloudflare creada y verificada
- [ ] Dominio gratuito registrado (dpdns.org u otro)
- [ ] Dominio agregado a Cloudflare y **Active** (nameservers delegados)
- [ ] Túnel `ultra-tickets` creado; token copiado
- [ ] Conector instalado (servicio `ULTRA_Cloudflared`) y **HEALTHY**
- [ ] Public Hostname `tickets.<dominio>` → `http://localhost:3080`
- [ ] Backend como servicio `ULTRA_Tickets` (arranque automático)
- [ ] `https://tickets.<dominio>/health` responde
- [ ] (Opcional) Cloudflare Access + redirección desde myspectra.com.mx

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*
