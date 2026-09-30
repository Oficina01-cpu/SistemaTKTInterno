# OPERACIÓN — Sistema de Tickets Interno ULTRA

> **LÉEME PRIMERO en cada sesión.** Resumen operativo crítico del sistema en producción.
> Detalle histórico completo en `docs/MEMORIA_KIRO.md`.

---

## URLs

| Qué | Dónde |
|-----|-------|
| Sistema público (Internet) | `https://tickets.5962503.dpdns.org` |
| Login directo | `https://tickets.5962503.dpdns.org/index.html` |
| Healthcheck | `https://tickets.5962503.dpdns.org/health` |
| Local (servidor Windows) | `http://localhost:3080` |
| Entrada de marca | `myspectra.com.mx/ticketInterno` (splash → redirige al login) |

---

## Cómo corre el sistema (arquitectura de procesos)

- El backend es un **servicio de Windows: `ULTRA_Tickets`** (NSSM, cuenta LocalSystem, arranque automático).
- Escucha en el **puerto 3080**.
- **El servidor tiene VARIOS sistemas** (4-6). Mapa de puertos node:

| Puerto | Sistema |
|--------|---------|
| **3080** | **Tickets Interno ULTRA (ESTE)** — servicio `ULTRA_Tickets` |
| 8081 / 8082 / 8083 / 8090 | OTROS sistemas en producción — **NO TOCAR** |

> ⚠️ **NUNCA** matar procesos node por PID a ciegas. Identificar SIEMPRE por el puerto 3080 o el servicio `ULTRA_Tickets`. Los demás puertos son de otros sistemas en producción (uno puede ser "tickets de clientes").

---

## Aplicar cambios

### Cambios de FRONTEND (`public/*.html`, `public/js/*.js`, `public/css/*`)
No requieren reinicio. Se sirven con `no-cache`. Basta **recargar el navegador con Ctrl+Shift+R**.

### Cambios de BACKEND (`server/*.js`)
Requieren reiniciar el servicio, en **PowerShell como Administrador**:
```powershell
Restart-Service ULTRA_Tickets
Start-Sleep 3
Invoke-RestMethod http://localhost:3080/health   # debe devolver ok=True
```

---

## Acceso al sistema

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Master | `master2@corporativoultra.com` | `Master2` |
| Master | `master3@corporativoultra.com` | `Master3` |

- **PIN de administración** (alta/eliminación de usuarios): `1033`
- Contraseña inicial de un usuario nuevo = **su teléfono** (primer ingreso obliga a cambiarla).

---

## Reglas del proyecto (obligatorias)

1. **TODOS los modales son propios del sistema (BuzzBox).** NUNCA usar `confirm()`, `prompt()` ni `alert()` del navegador.
2. **Branding ULTRA** en todas las páginas (logo redondo, Arial Black, colores gris/rojo `#E30613`/negro/blanco, pie "Derechos reservados ULTRA 2026 · soporte.spectra@corporativoultra.com").
3. **Tema:** usar temas estándar de DaisyUI `dark`/`light` (los custom `ultradark/ultralight` NO existen en el CDN).
4. La **eliminación de usuarios es borrado completo** (no baja lógica): desaparece de la BD, preserva tickets reasignándolos al master, y registra `USUARIO_ELIMINADO` en bitácora.

---

## Túnel Cloudflare (acceso a Internet)

- Túnel: **`ticketINT`**, ID `f46c1a2f-523e-4860-a902-859de4218eed` (cuenta Cloudflare nueva).
- Dominio `5962503.dpdns.org` gestionado por **Cloudflare** (NS `salvador`/`selah.ns.cloudflare.com`).
- DNS: CNAME `tickets` → `f46c1a2f-...cfargotunnel.com` (proxied 🟠).
- **Requisito:** el dominio DEBE estar en Cloudflare para que el CNAME al túnel resuelva (si está fuera, da error 1016).
- **PENDIENTE:** el conector cloudflared del túnel `ticketINT` hoy corre como proceso en background. Dejarlo como **servicio propio** para que sobreviva reinicios.

---

## Backups

- Automáticos: servicio/tarea con retención de **30** en `./Backup`.
- Manual: `powershell -ExecutionPolicy Bypass -File scripts\backup.ps1`
- Restaurar: detener `ULTRA_Tickets`, copiar un `.db` de `./Backup` a `./data/tickets.db`, reiniciar el servicio.

---

## Repositorio

- GitHub: `Oficina01-cpu/SistemaTKTInterno` (rama `main`).
- `git push` funciona con las credenciales ya configuradas. `gh` CLI instalado (falta `gh auth login`).

---

## Pendientes conocidos

- [ ] Dejar el conector cloudflared de `ticketINT` como servicio permanente.
- [ ] Subir a HostGator el ZIP del splash corregido (`Backup/ticketInterno_splash_*.zip`) en `public_html/`.
- [ ] Rotar tokens del túnel expuestos durante soporte.
- [ ] Activar Cloudflare Access limitado a `@corporativoultra.com`.
- [ ] Cambiar contraseñas de los master ahora que está en Internet.

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*
