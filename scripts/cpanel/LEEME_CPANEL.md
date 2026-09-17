# Paquete cPanel — Sistema de Tickets Interno ULTRA

Este paquete contiene **solo lo necesario para la comunicación desde cPanel** con el Sistema de Tickets ULTRA, que corre en el servidor Windows y se expone por Cloudflare Tunnel.

> El backend Node/SQLite **no** se instala en cPanel. cPanel solo dirige el tráfico y (opcionalmente) guarda respaldos off-site.

## Contenido

| Archivo | Qué hacer con él |
|---------|------------------|
| `.htaccess` | Colócalo en `public_html/` del dominio. Redirige `myspectra.com.mx/ticketInterno` → `https://ticketinterno.myspectra.com.mx/` (subdominio de marca servido por el túnel Cloudflare). |
| `cloudflared-config.yml` | Referencia de la configuración del túnel (se ejecuta en el servidor Windows, no en cPanel). Edita `TUNNEL_ID` y credenciales. |
| `backup.sh` | Súbelo al hosting y prográmalo en **cPanel → Cron Jobs** cada 2 horas para respaldo off-site de la BD: `0 */2 * * * /home/USUARIO/ruta/backup.sh` |
| `DESPLIEGUE.md` | Guía completa de publicación (Cloudflare Tunnel + Access, alternativas y seguridad). |

## Pasos rápidos (opción recomendada)

1. En el servidor Windows: el sistema corre como servicio + `cloudflared` ya conectado (ver `DESPLIEGUE.md`).
2. En el panel de Cloudflare (túnel `ticketInterno` → Public Hostname), publica el subdominio `ticketinterno.myspectra.com.mx` → `http://localhost:3080`. El DNS se crea solo.
3. Sube `.htaccess` a `public_html/` en cPanel.
4. (Opcional) Programa `backup.sh` como Cron Job para redundancia off-site.
5. Protege el acceso con **Cloudflare Access** limitado a `@corporativoultra.com`.

## Verificación

- `https://ticketinterno.myspectra.com.mx/health` responde.
- `https://myspectra.com.mx/ticketInterno` redirige al sistema (la barra muestra el subdominio de marca).
- El login carga con HTTPS (necesario para Service Worker y Web Push).

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*
