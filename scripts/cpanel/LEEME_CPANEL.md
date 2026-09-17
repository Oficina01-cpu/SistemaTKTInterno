# Paquete cPanel — Sistema de Tickets Interno ULTRA

Este paquete contiene **solo lo necesario para la comunicación desde cPanel** con el Sistema de Tickets ULTRA, que corre en el servidor Windows y se expone por Cloudflare Tunnel.

> El backend Node/SQLite **no** se instala en cPanel. cPanel solo dirige el tráfico y (opcionalmente) guarda respaldos off-site.

## Contenido

| Archivo | Qué hacer con él |
|---------|------------------|
| `.htaccess` | Colócalo en `public_html/` del dominio. Redirige `myspectra.com.mx/TicketInterno` → `https://tickets.myspectra.com.mx/` (túnel Cloudflare). |
| `cloudflared-config.yml` | Referencia de la configuración del túnel (se ejecuta en el servidor Windows, no en cPanel). Edita `TUNNEL_ID` y credenciales. |
| `backup.sh` | Súbelo al hosting y prográmalo en **cPanel → Cron Jobs** cada 2 horas para respaldo off-site de la BD: `0 */2 * * * /home/USUARIO/ruta/backup.sh` |
| `DESPLIEGUE.md` | Guía completa de publicación (Cloudflare Tunnel + Access, alternativas y seguridad). |

## Pasos rápidos (opción recomendada)

1. En el servidor Windows: instala y arranca el sistema como servicio + `cloudflared` (ver `DESPLIEGUE.md`).
2. Enruta el DNS del subdominio `tickets.myspectra.com.mx` al túnel.
3. Sube `.htaccess` a `public_html/` en cPanel.
4. (Opcional) Programa `backup.sh` como Cron Job para redundancia off-site.
5. Protege el acceso con **Cloudflare Access** limitado a `@corporativoultra.com`.

## Verificación

- `https://tickets.myspectra.com.mx/health` responde.
- `https://myspectra.com.mx/TicketInterno` redirige al sistema.
- El login carga con HTTPS (necesario para Service Worker y Web Push).

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*
