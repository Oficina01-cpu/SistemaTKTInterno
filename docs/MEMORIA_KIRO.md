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
