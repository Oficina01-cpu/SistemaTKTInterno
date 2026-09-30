# Memoria de Sesión — Construcción con Kiro

Registro de cómo se construyó el **Sistema de Tickets Interno ULTRA**, las decisiones de diseño tomadas y las verificaciones realizadas. Documento vivo para futura referencia y mantenimiento.

- **Fecha de construcción:** 17 de septiembre de 2026
- **Constructor:** Kiro (agente) + 3 sub-agentes especializados, supervisado por Kiro
- **Ubicación:** `F:/TicketInterno/TKT` (servidor Windows, producción real)
- **Runtime verificado:** Node.js v24.18.0

---

## 1. Estrategia y sub-agentes

La construcción se organizó en 7 fases con lista de tareas y **4 usos de sub-agentes**:

1. **Sub-agente 1 (arquitectura/UX):** revisó el plan y produjo la estrategia de despliegue, cache-busting, modelo de datos, autenticación, tiempo real y backups.
2. **Sub-agente 2 (despliegue):** analizó la propuesta de publicar en `myspectra.com.mx/TicketInterno` y entregó la guía de Cloudflare Tunnel + Access (base de `DESPLIEGUE.md`).
3. **Sub-agente 3 (documentación):** redactó los manuales de usuario, lógica, instalación y sistema.
4. **Sub-agente 4 (QA final):** revisión integral y verificación de arranque (ver §5).

Kiro supervisó, corrigió las salidas de los sub-agentes y realizó todas las verificaciones ejecutables.

---

## 2. Decisiones técnicas clave

| Decisión | Motivo |
|----------|--------|
| **`node:crypto` (scrypt)** en lugar de `bcrypt` | Evita compilación nativa en Windows; nativo, sin dependencias, seguro |
| **Tailwind + DaisyUI por CDN** en lugar de build local | DaisyUI 4 no es compatible con el CLI de Tailwind v4; el CDN es robusto para producción |
| **BuzzBox propia** (`public/js/buzzbox.js`) | No existe una librería "BuzzBox" estable en CDN; se implementó con la misma API (toasts, modales, confirms, prompts, loaders, progress). Cumple "ningún modal del navegador" |
| **Backend en la raíz `/`**, no bajo `/TicketInterno` | Servir bajo sub-path rompe rutas absolutas y el scope del Service Worker; se documenta subdominio + redirección 302 |
| **Splash = landing HTML del propio servidor** | Redirección con `meta refresh` de 2s a `/index.html`; nunca a `file://` |
| **VAPID guardado en tabla `config`** | Se genera una sola vez en el primer arranque y persiste; no se hardcodea ni va en `.env` |
| **Inactividad de doble capa** | El servidor es autoritativo (compara `sesiones.ultima_actividad`); el cliente da UX inmediata |
| **`@fastify/helmet` + `@fastify/rate-limit`** | Endurecer la exposición a Internet (CSP para los CDN + límite de peticiones) |

---

## 3. Componentes construidos

**Backend (`server/`):** `index.js` (Fastify :3080 + Socket.IO + helmet + rate-limit + estáticos + carga de `.env`), `db.js` (schema WAL + seeds + scrypt), `auth.js` (login, JWT con `jti`, primer ingreso, inactividad, roles, PIN), `tickets.js` (CRUD, folios, multi-destino, adjuntos, buscador master), `config.js` (usuarios y departamentos), `bitacora.js` (auditoría), `notificaciones.js` (Socket.IO + Web Push VAPID).

**Frontend (`public/`):** `splash.html`, `index.html` (login), `dashboard.html` (panel), `sw.js` (Service Worker), `js/buzzbox.js`, `js/auth-client.js`, `js/app.js`, `css/input.css`, `assets/logo.png` + `logo.ico`.

**Scripts (`scripts/`):** `backup.ps1` + `vacuum-backup.cjs` (respaldo consistente + retención 30 + copia off-site), `backup.sh` (cron cPanel), `install-task.ps1` (Tarea Programada cada 2h), `install-service.ps1` (servicio Windows con NSSM), `cloudflared-config.yml`, `gen-vapid.js`.

**Docs (`docs/`):** `MANUAL_USUARIO.md`, `LOGICA_SISTEMA.md`, `INSTALACION.md`, `MANUAL_SISTEMA.md`, `DESPLIEGUE.md`, `MEMORIA_KIRO.md`. Más `README.md` en la raíz.

---

## 4. Branding ULTRA aplicado

- Logo redondo de 80px arriba-izquierda + palabra **ULTRA** en **Arial Black** a 5px del logo.
- Palabra ULTRA en blanco o negro según el fondo (tema).
- Favicon `.ico` en todas las páginas.
- Paleta: gris `#9A9A9A`, rojo vivo `#E30613`, negro `#1A1A1A`, blanco `#FFF`.
- Botón de tema **light/dark** (`ultralight`/`ultradark`).
- Splash de 2s con logo. Login con nombre del sistema, logo y palabra del mismo estilo.
- Pie: **Derechos reservados ULTRA 2026** · soporte.spectra@corporativoultra.com — en todas las páginas.

---

## 5. Verificaciones realizadas (ejecutadas por Kiro)

- `npm install` — 180 paquetes, sin errores.
- `node server/db.js --seed` — crea `data/tickets.db` con 7 departamentos y 2 masters.
- Arranque del servidor — `/health` responde `{ ok: true, build_id }`; VAPID generado.
- **Prueba E2E real** contra `:3080`: login master (rol master), `/me`, listado de 7 departamentos, creación de ticket multi-destino con folio `TKT-YYYYMMDD-XXXX`, "Mis Tickets", buscador por folio (master), alta de departamento, alta de usuario con PIN 1033, login de usuario nuevo con teléfono → exige primer ingreso, y bitácora registrando accesos.
- Páginas servidas con status 200: splash, `index.html`, `dashboard.html`, `js/app.js`, `sw.js` (con `Cache-Control: no-store`), `assets/logo.png` (8057 bytes, el real).
- Verificación de seguridad: `Content-Security-Policy` presente; login funciona con helmet + rate-limit activos.
- `scripts/backup.ps1` — crea respaldo real, copia off-site y aplica retención de 30.
- Tras las pruebas, la BD se reinicializó **limpia** con solo los seeds base.

---

## 6. Pendientes de configuración del operador

Estas acciones dependen de credenciales/entorno del cliente y se documentan para ejecutarlas manualmente:

- Ejecutar `scripts/install-service.ps1` (requiere **NSSM** descargado) para el servicio Windows.
- Ejecutar `scripts/install-task.ps1` como Administrador para los respaldos cada 2h.
- Configurar Cloudflare Tunnel (`cloudflared`) y Cloudflare Access según `DESPLIEGUE.md`.
- Al exponer a Internet, considerar `HOST=127.0.0.1` en `.env` para que solo el túnel acceda.

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*

---

## 7. Segunda sesión de ajustes (17/09/2026)

Cambios solicitados por el operador tras la entrega inicial:

1. **Login sin header superior-izquierdo:** se eliminó el bloque `<header class="ultra-brand">` de `public/index.html` que mostraba el logo + palabra ULTRA en la esquina superior izquierda. El login conserva el logo centrado dentro de la tarjeta de acceso. El toggle de tema permanece arriba a la derecha. `auth-client.js` ya tenía guarda `if (bw)` para el `brandWord` retirado, por lo que no se rompió nada.

2. **Auditoría de logos:** se verificó que todas las referencias apuntan correctamente:
   - `index.html`, `dashboard.html`, `splash.html`: favicon `/assets/logo.ico` + `<img src="/assets/logo.png">`.
   - `js/buzzbox.js`: logo en la cabecera de los modales.
   - `sw.js`: `/assets/logo.png` como icon y badge de las notificaciones push.
   - Archivos físicos presentes en `public/assets/`: `logo.png` (8057 bytes) y `logo.ico` (209762 bytes).
   - Verificado en vivo: el servidor entrega ambos con status 200 y el tamaño correcto.

3. **Control de versiones:** se inicializó el repositorio y se publicó en GitHub (`Oficina01-cpu/SistemaTKTInterno`).

4. **Respaldos del sistema completo:** se generó `Backup/TKTInterno_<fecha>_<hora>.zip` (sistema completo, sin `node_modules`/`.git`) y `Backup/TKTInterno_Cpanel_<fecha>_<hora>.zip` (paquete mínimo para cPanel: `backup.sh`, `cloudflared-config.yml`, `.htaccess` de redirección y guía de despliegue).

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*

---

## 8. Preparación del despliegue (Opción A) — continuación

- **GitHub CLI instalado:** `gh` 2.101.0 vía winget en `C:\Program Files\GitHub CLI\gh.exe`. Queda **pendiente `gh auth login`** (interactivo, lo hace el operador). El `git push` funciona igual porque las credenciales de Git ya están configuradas.
- **cloudflared-config.yml endurecido:** se añadió `logfile`, `loglevel` y bloque `originRequest` con soporte de WebSocket para Socket.IO (`connectTimeout`, `keepAliveTimeout`, `keepAliveConnections`, `httpHostHeader`).
- **Script asistido `scripts/setup-cloudflared.ps1`:** automatiza instalar cloudflared, login, crear el túnel `ultra-tickets`, rellenar el config con el `TUNNEL_ID` y credenciales reales, enrutar el DNS de `tickets.myspectra.com.mx` e instalar el servicio de Windows. Parámetros `-Hostname` y `-TunnelName`. Sintaxis verificada.
- **`docs/DESPLIEGUE.md`** actualizado con la opción rápida (script asistido) además de la manual.

**Pendientes del operador para publicar:** 1) `gh auth login` (opcional). 2) Ejecutar `setup-cloudflared.ps1` como Administrador. 3) Subir `scripts/cpanel/.htaccess` a `public_html`. 4) Configurar Cloudflare Access para `@corporativoultra.com`. 5) Fijar `HOST=127.0.0.1` en `.env` con el túnel activo.

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*

---

## 9. Despliegue real con Cloudflare Tunnel (17/09/2026)

Sesión de puesta en producción del acceso por Internet. Hallazgos y configuración **real** (sustituye a la teoría de secciones anteriores donde difiera):

### Infraestructura descubierta
- **Dominio principal `myspectra.com.mx`:** nameservers de **HostGator** (`ns00018/19.hostgator.mx`), IP `69.6.201.195`. **NO está en Cloudflare.** Por eso no puede usarse directamente como hostname del túnel.
- **Dominio `ultra.dpdns.org`:** **SÍ gestionado por Cloudflare** (NS `magali.ns.cloudflare.com`, `fred.ns.cloudflare.com`), en la cuenta `Carlos.urdaneta@...`. Este es el que sirve para publicar.
- **`labultra.dpdns.org`:** administrado en un hosting gratuito byet.org (`ns1..ns5.byet.org`). No se usa para tickets.
- **Túnel cloudflared preexistente:** el servicio de Windows `cloudflared` corre desde `F:\ServerManager\cloudflared\cloudflared.exe` con `--token-file C:\ProgramData\cloudflared\token`, y **da servicio a DOS sistemas en producción**. NO debe tocarse ni reinstalarse su token.

### Decisión de despliegue (revisada)
- **URL final elegida:** `https://ticketInterno.ultra.dpdns.org` (subdominio de marca en la zona Cloudflare disponible), en lugar de `tickets.myspectra.com.mx`, porque `myspectra.com.mx` no está en Cloudflare.
- Redirección opcional desde `myspectra.com.mx/ticketInterno` (HostGator/cPanel `.htaccess`) hacia ese subdominio.

### Túnel `ticketInterno`
- Creado en el panel de Cloudflare. **ID:** `09614fe3-f08e-47fb-addb-1bf814831e9c`.
- Public Hostname configurado: `ticketInterno.ultra.dpdns.org` → `http://localhost:3080`.
- El servicio de Windows existente NO sirve este túnel (está ocupado con los otros 2 sistemas). Solución aplicada: **levantar un SEGUNDO conector** con el token de `ticketInterno`:
  ```
  cloudflared.exe tunnel run --token <TOKEN_DE_ticketInterno>
  ```
  Verificado: el conector registró 4 conexiones y cargó el ingress `ticketInterno.ultra.dpdns.org → http://localhost:3080`.
- **Puerto local del sistema de tickets: 3080 (HTTP).** URL del servicio en el túnel: `http://localhost:3080`.

### Pendiente para que quede público (operador)
1. **Crear registro DNS en Cloudflare** (zona `ultra.dpdns.org` → DNS → Records → Add record):
   - Type `CNAME`, Name `ticketInterno`, Target `09614fe3-f08e-47fb-addb-1bf814831e9c.cfargotunnel.com`, Proxied (nube naranja) ON.
   - Sin este registro, el hostname no resuelve (Cloudflare avisó: *"this domain isn't a zone on your account"* al agregarlo desde la vista del túnel, pero la zona sí existe: crear el CNAME manualmente en DNS → Records lo resuelve).
2. **Persistir el segundo conector** como servicio propio (el actual se levantó en background para pruebas; para producción, instalarlo como servicio de Windows independiente con su token, o migrar a config unificada sin tocar los otros 2 sistemas).
3. (Opcional) `.htaccess` en HostGator para redirigir `myspectra.com.mx/ticketInterno`.

### Aclaración importante sobre cPanel
- El sistema de tickets **NO se sube a cPanel ni a hosting compartido**: corre como proceso Node en el servidor Windows. cPanel solo serviría (opcionalmente) para la redirección `.htaccess`. No hay que crear carpetas ni subir el sistema al hosting.

### Seguridad
- **Rotar el token del túnel** en el panel de Cloudflare: quedó expuesto durante la sesión de soporte.

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*

---

## 10. Sesión de operación y correcciones (30/09/2026)

### Despliegue público FINAL que quedó funcionando
- **URL pública del sistema:** `https://tickets.5962503.dpdns.org` (responde HTTP 200 con HTTPS).
- **Túnel Cloudflare usado:** `ticketINT`, ID `f46c1a2f-523e-4860-a902-859de4218eed`, en una **cuenta nueva de Cloudflare** (la cuenta anterior `Carlos.urdaneta@` no era viable).
- **Dominio:** `5962503.dpdns.org`, **movido a Cloudflare** (nameservers `salvador.ns.cloudflare.com` / `selah.ns.cloudflare.com`). Esto fue CLAVE: con el dominio fuera de Cloudflare el CNAME a `cfargotunnel.com` NO resuelve (da 1016). Solo funciona con el dominio gestionado por Cloudflare (proxied).
- **Registro DNS:** CNAME `tickets` → `f46c1a2f-...cfargotunnel.com` (proxied). OJO: DigitalPlat concatenaba el dominio al valor; se corrigió poniendo el valor con **punto final** o dejando que Cloudflare lo gestione.
- **Conector cloudflared del túnel `ticketINT`:** se levantó como proceso aparte (segundo conector) para NO tocar el servicio cloudflared que sirve los otros sistemas. PENDIENTE dejarlo como servicio propio permanente (hoy corre en background).
- **Redirección desde myspectra:** `myspectra.com.mx` está en HostGator (NS hostgator.mx, IP 69.6.201.195), NO en Cloudflare. La entrada de marca se hace con un splash en `public_html/ticketInterno/` (ver §Splash cPanel).

### ARQUITECTURA DE PROCESOS EN EL SERVIDOR (MUY IMPORTANTE)
El servidor Windows corre **varios sistemas** (4-6). Mapa de puertos node confirmado:
| Puerto | Sistema |
|--------|---------|
| **3080** | **Sistema de Tickets Interno ULTRA (ESTE)** — servicio `ULTRA_Tickets` |
| 8081, 8082, 8083, 8090 | Otros sistemas (uno puede ser "tickets de clientes", NO tocar) |

- **NUESTRO backend YA es un servicio de Windows:** `ULTRA_Tickets` (NSSM, cuenta LocalSystem, arranque Automático, binario `F:\TicketInterno\TKT\scripts\nssm.exe`).
- El node del puerto 3080 es **hijo** del proceso del servicio `ULTRA_Tickets`.
- **PARA APLICAR CAMBIOS DE BACKEND** (server/*.js): reiniciar el servicio en PowerShell **como Administrador**:
  ```powershell
  Restart-Service ULTRA_Tickets
  Start-Sleep 3
  Invoke-RestMethod http://localhost:3080/health
  ```
- Los cambios de **frontend** (public/*.html, *.js) NO requieren reinicio: se sirven con no-cache; basta recargar el navegador con Ctrl+Shift+R.
- NUNCA matar procesos node por PID a ciegas: hay otros sistemas en producción. Identificar SIEMPRE por puerto 3080 / servicio ULTRA_Tickets.

### Correcciones aplicadas en esta sesión
1. **Alta de usuario no registraba:** bug en `BuzzBox.prompt()` que leía el input después de cerrar el modal → PIN llegaba null. Corregido en `public/js/buzzbox.js` (el botón OK captura el valor en su `.value` antes de cerrar).
2. **Toggle tema sol/luna no funcionaba:** usaba temas custom `ultradark/ultralight` que no existen en el DaisyUI del CDN. Cambiado a temas estándar **`dark`/`light`** en index.html, dashboard.html, app.js, auth-client.js, buzzbox.js (con migración de valores viejos guardados).
3. **Notificaciones/campanita:** `activarPush` mejorada (valida HTTPS, reusa suscripción, mensajes claros, indicador 🔔 verde activa / 🔕 inactiva) + `estadoPushInicial()`.
4. **"Choose file" en inglés:** input file nativo ocultado; reemplazado por botón propio **"📎 Seleccionar archivo"** + nombre en español + quitar (en dashboard.html y app.js).
5. **Doble splash:** el splash de cPanel iba a la raíz `/` que mostraba splash.html del servidor. Corregido: (a) splash de cPanel va directo a `/index.html`; (b) la raíz `/` del server ahora hace `redirect 302 a /index.html` (server/index.js) en vez de servir splash.html.
6. **Eliminación de usuarios (rediseño):** ahora es **BORRADO COMPLETO real** (DELETE FROM usuarios), preserva tickets reasignándolos al master, limpia sesiones y push, registra `USUARIO_ELIMINADO` en bitácora. Frontend: filas de usuario **seleccionables/iluminadas** al clic, botón "🗑 Eliminar" → **modal propio** de confirmación → **PIN en modal propio** → borra y refresca. Se eliminaron las funciones viejas `__bajaUsuario`/`__reactivarUsuario`. VERIFICADO en vivo: alta ok, borrado completo (desaparece de lista), bitácora ok, PIN incorrecto rechazado.

### Regla de oro del proyecto (recordatorio permanente)
- **TODOS los modales son propios del sistema (BuzzBox), NUNCA del navegador** (`confirm()`/`prompt()`/`alert()` nativos prohibidos).

### Splash cPanel (entrada de marca desde myspectra)
- Carpeta `cpanel-splash/ticketInterno/` (index.html + logo.png + logo.ico). Se sube a `public_html/` de HostGator (queda `public_html/ticketInterno/`).
- El splash muestra branding ULTRA con animación "Cargando..." (~2.6s) y redirige a `https://tickets.5962503.dpdns.org/index.html` (login directo, sin doble splash).
- ZIP más reciente generado en `Backup/ticketInterno_splash_*.zip`.

### Pendientes para próximas sesiones
- Dejar el **conector cloudflared de `ticketINT`** como servicio permanente propio (hoy en background, no sobrevive reinicio).
- Subir a HostGator el ZIP del splash corregido (evita doble splash) si aún no se hizo.
- **Rotar tokens** del túnel expuestos durante soporte.
- Considerar **Cloudflare Access** para limitar a `@corporativoultra.com`.
- Cambiar contraseñas de los master (`Master2`/`Master3`) ahora que está en Internet.

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*
