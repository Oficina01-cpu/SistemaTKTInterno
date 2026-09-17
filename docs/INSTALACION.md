# Guía de Instalación — Sistema de Tickets Interno ULTRA

Instalación desde cero del **Sistema de Tickets Interno ULTRA** en el servidor **Windows**, ubicación `F:/TicketInterno/TKT`. El backend corre con **Fastify** en `http://localhost:3080`.

---

## Índice

1. [Requisitos](#1-requisitos)
2. [Instalación paso a paso](#2-instalación-paso-a-paso)
3. [Verificación](#3-verificación)
4. [Instalar como servicio de Windows (NSSM)](#4-instalar-como-servicio-de-windows-nssm)
5. [Programar respaldos automáticos](#5-programar-respaldos-automáticos)
6. [Puertos y firewall](#6-puertos-y-firewall)
7. [Solución de problemas comunes](#7-solución-de-problemas-comunes)

---

## 1. Requisitos

| Requisito | Valor |
|-----------|-------|
| Sistema operativo | Windows Server |
| Node.js | **v22 o superior** (probado en v24.18.0) |
| Ubicación del proyecto | `F:/TicketInterno/TKT` |
| Base de datos | SQLite nativa (`node:sqlite`), sin servidor externo |

`npm install` instala las dependencias: `fastify`, `@fastify/jwt`, `@fastify/cookie`, `@fastify/static`, `@fastify/multipart`, `@fastify/helmet`, `@fastify/rate-limit`, `socket.io`, `web-push`. Tailwind + DaisyUI y el cliente de Socket.IO se cargan por **CDN** (no requieren instalación local).

---

## 2. Instalación paso a paso

1. **Ubícate en la carpeta del proyecto:**
   ```powershell
   cd F:\TicketInterno\TKT
   ```

2. **Instala dependencias:**
   ```powershell
   npm install
   ```

3. **Crea el archivo `.env`** en la raíz del proyecto con al menos el secreto JWT:
   ```env
   JWT_SECRET=coloca-aqui-un-secreto-largo-y-aleatorio
   PORT=3080
   ```

4. **Inicializa la base de datos (seed):** crea tablas, departamentos base y masters iniciales.
   ```powershell
   npm run seed
   ```
   Esto genera `./data/tickets.db` (WAL), los departamentos base (Operaciones, Calidad, Recursos Humanos, Administración, Cuentas Por Pagar, Alta Dirección, Legal) y los masters iniciales:

   | Correo | Contraseña inicial |
   |--------|--------------------|
   | master2@corporativoultra.com | Master2 |
   | master3@corporativoultra.com | Master3 |

5. **Arranca el servidor:**
   ```powershell
   npm start
   ```
   El sistema quedará disponible en `http://localhost:3080`.

---

## 3. Verificación

1. Abre en el navegador: `http://localhost:3080` — deberías ver el **splash de 2s** y la pantalla de login.
2. Comprueba el estado del backend:
   ```powershell
   curl http://localhost:3080/health
   ```
   Debe responder correctamente (estado saludable).
3. Consulta la versión / `build_id`:
   ```powershell
   curl http://localhost:3080/api/version
   ```
4. Inicia sesión con un master inicial para confirmar el acceso a Configuración (⚙️).

---

## 4. Instalar como servicio de Windows (NSSM)

Para que el sistema arranque solo y se mantenga en ejecución, instálalo como servicio con **NSSM**:

```powershell
cd F:\TicketInterno\TKT
.\scripts\install-service.ps1
```

Esto registra el proceso de Node como servicio de Windows. A partir de aquí el servicio se administra desde `services.msc` o con los comandos de NSSM.

> **Importante:** para tareas de mantenimiento de base de datos o restauración de respaldos, **detén el servicio** antes de manipular `./data/tickets.db`.

---

## 5. Programar respaldos automáticos

El sistema conserva los **últimos 30 respaldos** en `./Backup`.

**Windows (Tarea Programada, cada 2 horas):**
```powershell
cd F:\TicketInterno\TKT
.\scripts\install-task.ps1
```
Esto registra la tarea que ejecuta `scripts\backup.ps1` cada 2 horas.

**Linux / cPanel (cron, cada 2 horas):**
```cron
0 */2 * * * /ruta/al/proyecto/scripts/backup.sh
```

En ambos casos se aplica la **retención de los últimos 30 respaldos**; los más antiguos se eliminan automáticamente.

---

## 6. Puertos y firewall

- El backend escucha en el puerto **3080**.
- Si el acceso será desde otros equipos de la red, permite el puerto **3080/TCP** en el Firewall de Windows:
  ```powershell
  New-NetFirewallRule -DisplayName "TicketInterno ULTRA 3080" -Direction Inbound -Protocol TCP -LocalPort 3080 -Action Allow
  ```
- Si publicas detrás de un proxy inverso, redirige el tráfico externo hacia `http://localhost:3080`.

---

## 7. Solución de problemas comunes

### Puerto 3080 ocupado
Otro proceso usa el puerto. Identifícalo y libéralo, o cambia `PORT` en `.env`.
```powershell
netstat -ano | findstr :3080
taskkill /PID <PID> /F
```

### Permisos de escritura
Si falla la creación de `./data/tickets.db`, `./Backup` o los adjuntos, verifica que la cuenta que ejecuta el servicio tenga **permisos de escritura** sobre `F:\TicketInterno\TKT`.

### Base de datos bloqueada (database is locked)
SQLite en modo WAL permite lectura concurrente, pero una restauración o copia mientras el servidor escribe puede bloquear la BD.
- **Detén el servicio** antes de copiar o restaurar `./data/tickets.db`.
- Asegúrate de que no queden procesos de Node abiertos sobre el archivo.
- Vuelve a arrancar el servicio tras la operación.

### El seed falla o no crea masters
Verifica que `./data` sea escribible y que `.env` exista con `JWT_SECRET`. Si necesitas reinicializar, detén el servicio antes de volver a ejecutar `npm run seed`.

### La interfaz muestra una versión vieja
El sistema limpia caché comparando `build_id` con `/api/version` y el Service Worker no cachea HTML/API. Fuerza una recarga; si persiste, confirma que `/api/version` responde el `build_id` esperado.

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*
