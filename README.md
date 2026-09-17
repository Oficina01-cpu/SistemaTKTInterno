# Sistema de Tickets Interno ULTRA

Aplicación web corporativa para gestión de tickets internos entre departamentos, con notificaciones en tiempo real y push al navegador cerrado. Marca **ULTRA**.

> Derechos reservados ULTRA 2026 · Soporte: **soporte.spectra@corporativoultra.com**

---

## Stack técnico

**Backend**
- Node.js v22+ (usa el módulo nativo `node:sqlite`)
- [Fastify](https://fastify.dev/) como framework HTTP (async-first)
- `node:sqlite` como base de datos nativa (archivo `./data/tickets.db`, persistente, sin dependencias externas)
- `@fastify/jwt` para autenticación JWT
- [Socket.IO](https://socket.io/) para notificaciones en tiempo real
- [`web-push`](https://github.com/web-push-libs/web-push) para Web Push con claves VAPID (sin Firebase ni OneSignal)
- `node:crypto` (scrypt) para el hash de contraseñas
- `@fastify/helmet` + `@fastify/rate-limit` para endurecer la exposición a Internet

**Frontend**
- HTML5 + Tailwind CSS + DaisyUI (vía CDN)
- **BuzzBox** (librería propia): toasts, modales, confirms, prompts, loaders y progress bars — *ningún modal del navegador*
- Socket.IO Client para notificaciones en vivo
- Service Worker (`sw.js`) para Web Push con el navegador cerrado

---

## Arranque rápido

```powershell
# 1. Instalar dependencias
npm install

# 2. Configurar entorno (copia y ajusta)
copy .env.example .env
# Genera un JWT_SECRET propio:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Inicializar la base de datos con datos base
npm run seed

# 4. Arrancar el servidor
npm start
```

El servidor queda en `http://localhost:3080`:
- `/` → splash con branding ULTRA (redirige al login en 2s)
- `/index.html` → login
- `/dashboard.html` → panel principal

---

## Credenciales Master iniciales

Para acceder a **Configuración** (⚙️):

| Usuario  | Correo                          | Contraseña |
|----------|---------------------------------|------------|
| Master   | `master2@corporativoultra.com`  | `Master2`  |
| Master   | `master3@corporativoultra.com`  | `Master3`  |

Desde Configuración se dan de alta el resto de usuarios. La **contraseña inicial de cada usuario es su teléfono**, y en el primer ingreso el sistema obliga a capturar nombre completo y cambiar la clave.

**PIN de administración** para alta/baja de usuarios: `1033`.

---

## Scripts de npm

| Script            | Descripción                                             |
|-------------------|---------------------------------------------------------|
| `npm start`       | Arranca el servidor de producción                       |
| `npm run dev`     | Arranca con recarga (`node --watch`)                    |
| `npm run seed`    | Inicializa el schema y aplica seeds                     |
| `npm run backup`  | Ejecuta un respaldo manual (PowerShell)                 |
| `npm run genvapid`| Genera manualmente claves VAPID                         |

---

## Respaldos

- **Windows (producción):** `scripts/backup.ps1` crea un respaldo consistente (`VACUUM INTO`), copia off-site a `F:\TicketInterno\BASES DE DATOS` y **retiene los últimos 30**. Programar cada 2 horas con `scripts/install-task.ps1`.
- **Linux / cPanel:** `scripts/backup.sh` para cron (`0 */2 * * *`).

Los respaldos se guardan en `./Backup`.

---

## Servicio permanente y publicación

- **Servicio de Windows** (arranque automático, reinicio ante caídas): `scripts/install-service.ps1` (requiere NSSM).
- **Publicación en Internet:** ver [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) para exponer el sistema en `myspectra.com.mx/TicketInterno` mediante Cloudflare Tunnel + Cloudflare Access.

---

## Documentación

En la carpeta [`docs/`](docs/):
- `MANUAL_USUARIO.md` — manual de uso paso a paso
- `LOGICA_SISTEMA.md` — lógica completa del sistema
- `INSTALACION.md` — guía de instalación
- `MANUAL_SISTEMA.md` — manual completo con procesos y entregables
- `DESPLIEGUE.md` — publicación en Internet (Cloudflare / cPanel / VPS)
- `MEMORIA_KIRO.md` — memoria de la sesión de construcción con Kiro

---

## Estructura del proyecto

```
F:/TicketInterno/TKT/
├─ server/            # Backend Fastify
│  ├─ index.js        # Servidor: splash + estáticos + API + Socket.IO
│  ├─ db.js           # Schema SQLite + seeds + hashing
│  ├─ auth.js         # Login, JWT, primer ingreso, inactividad, roles
│  ├─ tickets.js      # CRUD de tickets, folios, multi-destino, adjuntos
│  ├─ config.js       # Alta/baja de usuarios y departamentos (Master + PIN)
│  ├─ bitacora.js     # Auditoría de accesos y acciones
│  └─ notificaciones.js # Socket.IO + Web Push (VAPID)
├─ public/            # Frontend
│  ├─ splash.html     # Splash con branding ULTRA
│  ├─ index.html      # Login
│  ├─ dashboard.html  # Panel principal
│  ├─ sw.js           # Service Worker (Web Push)
│  ├─ css/            # input.css (branding) + app.css
│  ├─ js/             # buzzbox.js, auth-client.js, app.js
│  └─ assets/         # logo.png, logo.ico
├─ data/              # tickets.db (SQLite, persistente)
├─ Backup/            # Respaldos (retención 30)
├─ uploads/           # Adjuntos de tickets
├─ scripts/           # backup.ps1, backup.sh, install-*.ps1, cloudflared
├─ docs/              # Documentación
├─ .env               # Configuración (no versionar)
└─ package.json
```
