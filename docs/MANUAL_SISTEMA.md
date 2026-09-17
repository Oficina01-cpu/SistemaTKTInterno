# Manual del Sistema — Sistema de Tickets Interno ULTRA

Manual integral del **Sistema de Tickets Interno ULTRA**: entregables, procesos operativos, matriz de roles, endpoints de API, variables de entorno y procedimiento de restauración de respaldos.

- **Ubicación:** `F:/TicketInterno/TKT` (servidor Windows)
- **Backend:** Fastify en `http://localhost:3080`
- **Base de datos:** SQLite nativa (`node:sqlite`) en `./data/tickets.db` (WAL)

---

## Índice

1. [Entregables y archivos](#1-entregables-y-archivos)
2. [Procesos operativos](#2-procesos-operativos)
3. [Matriz de roles y permisos](#3-matriz-de-roles-y-permisos)
4. [Tabla de endpoints API](#4-tabla-de-endpoints-api)
5. [Variables de entorno (.env)](#5-variables-de-entorno-env)
6. [Procedimiento de restauración de un respaldo](#6-procedimiento-de-restauración-de-un-respaldo)

---

## 1. Entregables y archivos

| Elemento | Propósito |
|----------|-----------|
| Backend Fastify (`:3080`) | Sirve splash, estáticos, API REST, Socket.IO y Web Push |
| `./data/tickets.db` | Base de datos SQLite (WAL) con todas las tablas |
| Interfaz web (Tailwind + DaisyUI por CDN) | UI con marca ULTRA, temas `ultralight`/`ultradark` |
| **BuzzBox** (librería propia) | Toasts, modales, confirms, prompts, loaders y progress |
| Service Worker | Cache-busting; usa `skipWaiting`/`clients.claim`; no cachea HTML/API |
| `scripts/backup.ps1` | Genera respaldo en `./Backup` (Windows) |
| `scripts/install-task.ps1` | Programa Tarea Programada de respaldo cada 2h (Windows) |
| `scripts/backup.sh` | Genera respaldo (Linux/cPanel, vía cron) |
| `scripts/install-service.ps1` | Instala el sistema como servicio de Windows con NSSM |
| `./Backup` | Carpeta de respaldos con retención de los últimos 30 |
| `.env` | Configuración sensible (JWT_SECRET, puerto, VAPID) |
| `docs/` | MANUAL_USUARIO, LOGICA_SISTEMA, INSTALACION, MANUAL_SISTEMA |

---

## 2. Procesos operativos

### 2.1 Alta de usuario
1. Un **master** entra a Configuración (⚙️) → Usuarios.
2. Registra correo `@corporativoultra.com`, teléfono, rol y departamento.
3. La operación pide el **PIN 1033** para confirmar.
4. El usuario nuevo inicia con contraseña = **su teléfono** y, en el **primer ingreso**, captura nombre completo y cambia la clave.
5. El alta queda en **bitácora**.

### 2.2 Baja / reactivación de usuario
1. Master → Configuración → Usuarios.
2. `DELETE /api/usuarios/:id` da de baja (baja lógica, `activo = 0`), protegido con **PIN 1033**.
3. `POST /api/usuarios/:id/reactivar` reactiva la cuenta.

### 2.3 Alta / baja de departamento
1. Master → Configuración → Departamentos.
2. Alta con `POST /api/departamentos`; baja con `DELETE /api/departamentos/:id`.
3. Los departamentos base son: Operaciones, Calidad, Recursos Humanos, Administración, Cuentas Por Pagar, Alta Dirección y Legal (todos gestionables).

### 2.4 Ciclo de vida de un ticket
1. El usuario crea el ticket (`POST /api/tickets`, multipart) eligiendo uno o varios departamentos destino.
2. Se genera folio `TKT-YYYYMMDD-XXXX`; estado inicial **abierto**.
3. Notificación por **Socket.IO** (rooms `user:{id}`/`dept:{id}`), **toast BuzzBox** y **Web Push (VAPID)** como fallback.
4. El departamento avanza el estado con `PATCH /api/tickets/:id/estado`: **abierto → en_proceso → cerrado**.
5. Consultas vía **Mis Tickets** (`/api/tickets/mios`) y **Tickets de mi Departamento** (`/api/tickets/departamento`). El **buscador** (`/api/tickets/buscar`) es solo para masters.

### 2.5 Respaldo
- **Windows:** `scripts/backup.ps1`, disparado por Tarea Programada (`install-task.ps1`) cada 2h.
- **Linux/cPanel:** `scripts/backup.sh` en cron `0 */2 * * *`.
- Destino: `./Backup`.

### 2.6 Rotación de 30 respaldos
- El proceso de respaldo conserva **los últimos 30** archivos en `./Backup`.
- Al crear uno nuevo, si se supera el umbral, se **eliminan los más antiguos** automáticamente.

---

## 3. Matriz de roles y permisos

| Función | usuario | master |
|---------|:-------:|:------:|
| Iniciar sesión / primer ingreso / cambiar clave | ✅ | ✅ |
| Crear tickets (multi-destino, adjunto) | ✅ | ✅ |
| Ver Mis Tickets | ✅ | ✅ |
| Ver Tickets de mi Departamento | ✅ | ✅ |
| Cambiar estado de tickets | ✅ | ✅ |
| Activar/desactivar notificaciones (🔔) | ✅ | ✅ |
| Buscador por folio o departamento | ❌ | ✅ |
| Configuración (⚙️) | ❌ | ✅ |
| Ver bitácora completa de accesos | ❌ | ✅ |
| Alta/baja de usuarios (PIN 1033) | ❌ | ✅ |
| Alta/baja de departamentos | ❌ | ✅ |

Masters iniciales: `master2@corporativoultra.com` (Master2) y `master3@corporativoultra.com` (Master3).

---

## 4. Tabla de endpoints API

### Autenticación
| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/primer-ingreso` | Captura de nombre + cambio de clave inicial |
| POST | `/api/auth/cambiar-clave` | Cambiar contraseña |
| GET | `/api/auth/me` | Datos del usuario autenticado |
| POST | `/api/auth/logout` | Cerrar sesión |
| POST | `/api/auth/ping` | Actualizar actividad (inactividad server-side) |

### Departamentos
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | `/api/departamentos` | Listar departamentos |
| POST | `/api/departamentos` | Alta de departamento (master) |
| DELETE | `/api/departamentos/:id` | Baja de departamento (master) |

### Usuarios
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | `/api/usuarios` | Listar usuarios (master) |
| POST | `/api/usuarios` | Alta de usuario (master, PIN 1033) |
| DELETE | `/api/usuarios/:id` | Baja de usuario (master, PIN 1033) |
| POST | `/api/usuarios/:id/reactivar` | Reactivar usuario (master) |

### Tickets
| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | `/api/tickets` | Crear ticket (multipart, adjunto opcional) |
| GET | `/api/tickets/mios` | Mis Tickets |
| GET | `/api/tickets/departamento` | Tickets de mi Departamento |
| GET | `/api/tickets/buscar` | Buscar por folio o departamento (master) |
| GET | `/api/tickets/:id` | Detalle de un ticket |
| PATCH | `/api/tickets/:id/estado` | Cambiar estado (abierto/en_proceso/cerrado) |

### Bitácora
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | `/api/bitacora` | Bitácora completa de accesos (master) |

### Web Push
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | `/api/push/vapid` | Obtener clave pública VAPID |
| POST | `/api/push/subscribe` | Suscribir navegador |
| POST | `/api/push/unsubscribe` | Cancelar suscripción |

### Sistema
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | `/health` | Estado de salud del backend |
| GET | `/api/version` | `build_id` para cache-busting |

---

## 5. Variables de entorno (.env)

| Variable | Descripción |
|----------|-------------|
| `JWT_SECRET` | Secreto para firmar los JWT (obligatorio, largo y aleatorio) |
| `PORT` | Puerto del backend (por defecto 3080) |
| `HOST` | Interfaz de escucha (por defecto 0.0.0.0) |
| `SESSION_IDLE_MINUTES` | Minutos de inactividad antes del cierre (por defecto 20) |
| `CORP_DOMAIN` | Dominio corporativo permitido (por defecto corporativoultra.com) |
| `ADMIN_PIN` | PIN para alta/baja de usuarios (por defecto 1033) |
| `SUPPORT_EMAIL` | Correo de soporte del pie de página |
| `VAPID_SUBJECT` | Contacto `mailto:` para Web Push |
| `BACKUP_RETENTION` | Número de respaldos a conservar (por defecto 30) |
| `NODE_ENV` | Entorno de ejecución (`production`) |

> Las **claves VAPID** (pública/privada) NO van en `.env`: el servidor las **genera una sola vez y las guarda en la tabla `config`** de la base de datos en el primer arranque.

> Mantén `.env` fuera del control de versiones. No compartas `JWT_SECRET`.

---

## 6. Procedimiento de restauración de un respaldo

La restauración reemplaza la base de datos activa por un archivo de `./Backup`. **Debe hacerse con el servicio detenido** para evitar el bloqueo de la BD (WAL).

1. **Detén el servicio de Windows** (NSSM) para liberar `./data/tickets.db`:
   ```powershell
   nssm stop <NombreDelServicio>
   ```
2. **Identifica el respaldo** deseado en `./Backup` (ordenados por fecha; se conservan los últimos 30).
3. (Recomendado) **Conserva la BD actual** por seguridad antes de sobrescribir:
   ```powershell
   Rename-Item F:\TicketInterno\TKT\data\tickets.db tickets.db.old
   ```
4. **Copia el respaldo** a la ruta de la base de datos activa:
   ```powershell
   Copy-Item F:\TicketInterno\TKT\Backup\<archivo-de-respaldo> F:\TicketInterno\TKT\data\tickets.db
   ```
5. **Reinicia el servicio:**
   ```powershell
   nssm start <NombreDelServicio>
   ```
6. **Verifica** que el sistema responde:
   ```powershell
   curl http://localhost:3080/health
   ```
   Confirma en la interfaz que los datos corresponden al respaldo restaurado.

> Si aparece "database is locked", asegúrate de que el servicio esté **detenido** y de que no haya procesos de Node abiertos sobre `./data/tickets.db` antes de copiar.

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*
