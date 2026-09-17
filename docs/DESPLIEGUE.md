# Guía de Despliegue — Publicar ULTRA en Internet

Cómo publicar el **Sistema de Tickets Interno ULTRA** para que los usuarios accedan desde `myspectra.com.mx/TicketInterno`, considerando que el backend es una app **Node.js (Fastify) con WebSockets, SQLite y Web Push** que corre en el servidor **Windows local**.

---

## 1. El problema de fondo

El sistema **no** es un sitio estático ni una app PHP. Requiere:

- Un **proceso Node.js siempre vivo** (Fastify) escuchando en `localhost:3080`.
- **WebSockets** (Socket.IO) para las notificaciones en tiempo real.
- Una **base de datos SQLite local** (`./data/tickets.db`) que vive en el disco del servidor Windows.
- Envío de **Web Push** desde el proceso Node.

Un **cPanel de hosting compartido** ejecuta PHP de forma efímera (una petición → un proceso que muere) y normalmente no permite procesos Node persistentes ni proxys de WebSocket fiables. Por eso **el backend debe seguir corriendo en el servidor Windows**, y el dominio `myspectra.com.mx` solo actúa como **puerta de entrada**.

---

## 2. Opción A — Cloudflare Tunnel + Cloudflare Access (RECOMENDADA)

Expone el backend local a Internet con HTTPS, **sin abrir puertos** ni IP pública, y protege el acceso.

### 2.1 Arquitectura

```
Usuario ─▶ https://tickets.myspectra.com.mx  ─▶ Cloudflare ─▶ (túnel cloudflared) ─▶ localhost:3080 (Windows)
                     ▲
        myspectra.com.mx/TicketInterno  ── redirección 302 ──┘
```

### 2.2 Por qué un subdominio y no un subpath

La app usa **rutas absolutas** (`/js/app.js`, `/api/*`, `/socket.io`, `/sw.js`). Servirla bajo `myspectra.com.mx/TicketInterno` con un reverse proxy en subpath rompería esas rutas y el **scope del Service Worker** (Web Push exige que el SW controle su propio path). La solución robusta es publicar en un **subdominio dedicado** `tickets.myspectra.com.mx` y hacer que `/TicketInterno` **redirija** a él.

### 2.3 Pasos (una sola vez)

1. **Cuenta Cloudflare** con `myspectra.com.mx` gestionado por Cloudflare (nameservers apuntando a Cloudflare).
2. **Instala cloudflared** en el servidor Windows: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
3. Autentícate y crea el túnel:
   ```powershell
   cloudflared tunnel login
   cloudflared tunnel create ultra-tickets
   ```
   Anota el `TUNNEL_ID` y la ruta del `.json` de credenciales.
4. Edita `scripts/cloudflared-config.yml` con tu `TUNNEL_ID` y la ruta de credenciales (ya viene plantillado).
5. Enruta el DNS:
   ```powershell
   cloudflared tunnel route dns ultra-tickets tickets.myspectra.com.mx
   ```
6. Instala cloudflared como **servicio de Windows** (arranca solo):
   ```powershell
   cloudflared --config scripts\cloudflared-config.yml service install
   ```

Con esto, `https://tickets.myspectra.com.mx` sirve el sistema con HTTPS válido (necesario para Service Worker y Web Push).

### 2.4 Lograr la ruta /TicketInterno (redirección 302 en cPanel)

En el hosting de `myspectra.com.mx`, coloca en el `.htaccess` de la raíz pública:

```apache
# Redirige /TicketInterno al subdominio del túnel (recomendado)
RewriteEngine On
RewriteRule ^TicketInterno/?$ https://tickets.myspectra.com.mx/ [R=302,L]
```

Así, quien entre a `myspectra.com.mx/TicketInterno` llega al sistema. Es la opción más estable.

### 2.5 Alternativa: conservar la URL con reverse proxy (solo si el hosting lo soporta)

Si necesitas que la barra muestre siempre `myspectra.com.mx/TicketInterno`, requieres un hosting con `mod_proxy` + `mod_proxy_wstunnel` (para WebSocket). Ejemplo conceptual:

```apache
RewriteEngine On
# WebSocket de Socket.IO
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule ^TicketInterno/(.*)$ wss://tickets.myspectra.com.mx/$1 [P,L]
# HTTP normal
RewriteRule ^TicketInterno/(.*)$ https://tickets.myspectra.com.mx/$1 [P,L]
```

> Esto es **frágil** en shared hosting y, además, la app tendría que servirse bajo el prefijo `/TicketInterno` (ver §5). Por eso se recomienda la **redirección 302** de §2.4.

### 2.6 Proteger el acceso (Cloudflare Access / Zero Trust)

Como es un sistema **interno**, restringe el acceso a los correos corporativos con **Cloudflare Access** (plan gratuito hasta 50 usuarios):

1. En Cloudflare Zero Trust → Access → Applications → Add self-hosted app.
2. Dominio: `tickets.myspectra.com.mx`.
3. Política: **Allow** solo emails que terminen en `@corporativoultra.com` (o lista específica).

Esto añade una capa de autenticación **antes** de llegar al login del sistema.

---

## 3. Opción B — Reverse proxy directo cPanel → IP:3080

El Apache de cPanel proxya hacia la IP pública del servidor Windows en el puerto 3080.

**Requisitos:** IP pública fija o DDNS, **port-forwarding** del 3080 en el router/firewall, y TLS. **Desventajas:** expone el puerto, depende de IP estable, más superficie de ataque, WebSocket a veces bloqueado. **Menos recomendable** que la Opción A.

---

## 4. Opción C — Mover el backend a un VPS con Node real

Si el negocio exige **alta disponibilidad** (que no dependa de que el Windows esté encendido) o conservar la URL exacta, migra el backend a un **VPS** con Node real:

- Proceso gestionado con **PM2** o `systemd`.
- **Nginx/Caddy** como reverse proxy con TLS (Caddy da HTTPS automático).
- El dominio `myspectra.com.mx/TicketInterno` puede apuntarse ahí con proxy de subpath + `BASE_PATH` (ver §5).

Vale la pena cuando el sistema se vuelve crítico.

---

## 5. Servir bajo un sub-path /TicketInterno (si fuera indispensable)

Para funcionar realmente bajo `/TicketInterno` (sin redirección), el backend necesitaría un **prefijo base** configurable:

- Prefijar todas las rutas y `@fastify/static` con `/TicketInterno`.
- Configurar Socket.IO con `path: "/TicketInterno/socket.io"` (cliente y servidor).
- Registrar el Service Worker con scope `/TicketInterno/`.
- Ajustar las rutas absolutas del frontend a relativas o al prefijo.

Es **más complejo y frágil** que usar un subdominio. **Recomendación: subdominio dedicado + redirección 302.**

---

## 6. Checklist de la opción recomendada (A)

- [ ] `myspectra.com.mx` gestionado por Cloudflare (nameservers).
- [ ] Backend ULTRA corriendo como servicio Windows (`scripts/install-service.ps1`).
- [ ] `cloudflared` instalado, túnel `ultra-tickets` creado y config editada.
- [ ] DNS `tickets.myspectra.com.mx` enrutado al túnel (registro proxied/naranja).
- [ ] `cloudflared` instalado como servicio de Windows.
- [ ] `.htaccess` con redirección 302 de `/TicketInterno` al subdominio.
- [ ] Cloudflare Access restringiendo a `@corporativoultra.com`.
- [ ] Verificado: `https://tickets.myspectra.com.mx/health` responde.
- [ ] Verificado: WebSocket conecta (en DevTools, request `/socket.io` con **101 Switching Protocols**).
- [ ] Verificado: Web Push funciona (HTTPS obligatorio para Service Worker y push).

---

## 7. Seguridad al exponer a Internet

| Riesgo | Mitigación (ya incluida o recomendada) |
|--------|----------------------------------------|
| Acceso no autorizado | **Cloudflare Access** limitado a `@corporativoultra.com` (recomendado) |
| Fuerza bruta al login | `@fastify/rate-limit` (300 req/min) — ya incluido |
| Cabeceras / XSS | `@fastify/helmet` con CSP — ya incluido |
| Exposición del puerto | Cloudflare Tunnel (sin abrir puertos) — Opción A |
| Escucha en todas las interfaces | Con túnel, puedes fijar `HOST=127.0.0.1` en `.env` para que solo cloudflared acceda |
| Robo de tokens | JWT con `jti` revocable + inactividad server-side 20 min — ya incluido |

> Recomendación: con Cloudflare Tunnel activo, cambia `HOST` a `127.0.0.1` en `.env` para que el backend **solo** sea accesible por el túnel local.

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*
