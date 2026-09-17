# Manual de Usuario — Sistema de Tickets Interno ULTRA

Bienvenido al **Sistema de Tickets Interno ULTRA**. Esta guía te lleva paso a paso por todo lo que necesitas para trabajar con el sistema: desde tu primer ingreso hasta la creación y seguimiento de tickets.

> El sistema funciona en el navegador. No necesitas instalar nada en tu equipo.

---

## Índice

1. [Primer ingreso](#1-primer-ingreso)
2. [Iniciar sesión](#2-iniciar-sesión)
3. [Cambiar el tema (claro / oscuro)](#3-cambiar-el-tema-claro--oscuro)
4. [Crear un ticket](#4-crear-un-ticket)
5. [Ver Mis Tickets y Tickets de mi Departamento](#5-ver-mis-tickets-y-tickets-de-mi-departamento)
6. [Folios y estados](#6-folios-y-estados)
7. [Activar notificaciones](#7-activar-notificaciones)
8. [Inactividad de 20 minutos](#8-inactividad-de-20-minutos)
9. [Cerrar sesión](#9-cerrar-sesión)
10. [Preguntas frecuentes](#10-preguntas-frecuentes)

---

## 1. Primer ingreso

La primera vez que entras, el sistema te pide completar tus datos y establecer tu contraseña definitiva.

1. Abre el sistema en tu navegador. Verás un **splash de bienvenida de 2 segundos** con el logo ULTRA.
2. En la pantalla de acceso, escribe tu **correo** (formato `nombre@corporativoultra.com`).
3. Tu **contraseña inicial es tu número de teléfono**. Escríbelo tal como fue registrado.
4. Al validar, aparece un **modal propio del sistema (BuzzBox)** — no es un cuadro del navegador — que te obliga a:
   - Capturar tu **nombre completo**.
   - **Cambiar tu contraseña** por una nueva y personal.
5. Confirma. A partir de este momento entrarás con tu correo y tu nueva contraseña.

> Este paso solo ocurre una vez. Tu nombre completo se usará en el mensaje de bienvenida y en tus tickets.

---

## 2. Iniciar sesión

1. Ingresa tu **correo @corporativoultra.com**.
2. Ingresa tu **contraseña** (la que definiste en el primer ingreso).
3. Presiona **Entrar**.
4. Verás un mensaje de **bienvenida con tu nombre completo, la fecha y la hora** de acceso.

Cada ingreso queda registrado en la **bitácora** del sistema.

---

## 3. Cambiar el tema (claro / oscuro)

El sistema incluye un **botón de tema** que alterna entre modo claro y modo oscuro (temas `ultralight` y `ultradark`).

- Pulsa el botón de tema (arriba en la interfaz) para cambiar entre **light** y **dark**.
- El resto de colores de marca ULTRA (gris, rojo vivo, negro y blanco) se mantienen en ambos temas.

---

## 4. Crear un ticket

1. Entra al **generador de tickets**.
2. Selecciona el o los **departamentos destino** en el **acordeón de departamentos**. Puedes elegir **varios destinos** a la vez.
3. Completa los campos:

   | Campo | Descripción | Obligatorio |
   |-------|-------------|-------------|
   | Asunto | Título breve del ticket | Sí |
   | Descripción | Texto libre con el detalle | Sí |
   | Prioridad | baja / media / alta | Sí |
   | Adjunto | Archivo de apoyo | Opcional |

4. Presiona **Crear ticket**.
5. El sistema genera un **folio automático** con formato `TKT-YYYYMMDD-XXXX` y registra la **fecha y hora**.
6. Al crearse, el sistema notifica automáticamente al o los departamentos destino (ver [Notificaciones](#7-activar-notificaciones)).

---

## 5. Ver Mis Tickets y Tickets de mi Departamento

El sistema ofrece dos vistas principales:

- **Mis Tickets:** los tickets que tú creaste.
- **Tickets de mi Departamento:** los tickets dirigidos al departamento al que perteneces.

Ambas vistas muestran, para cada ticket: **folio, fecha y hora**.

> El **buscador por folio o por departamento** está disponible **solo para usuarios master**.

---

## 6. Folios y estados

**Folio:** identificador único del ticket con formato `TKT-YYYYMMDD-XXXX`, donde `YYYYMMDD` es la fecha de creación y `XXXX` es un consecutivo.

**Estados de un ticket:**

| Estado | Significado |
|--------|-------------|
| abierto | Ticket recién creado, aún sin atender |
| en_proceso | El departamento destino está trabajando en él |
| cerrado | El ticket fue resuelto |

---

## 7. Activar notificaciones

El sistema te avisa de nuevos tickets por tres vías:

1. **Socket.IO:** aviso en tiempo real al departamento destino cuando estás dentro del sistema.
2. **Toast BuzzBox:** notificación visual para los involucrados que están conectados.
3. **Web Push (VAPID):** aviso en el navegador aunque lo tengas cerrado.

Para recibir avisos con el navegador cerrado:

1. Pulsa el botón **🔔** de notificaciones.
2. Acepta el permiso que solicita el navegador.
3. Tu navegador queda suscrito para recibir Web Push.

> Si más adelante deseas dejar de recibirlas, vuelve a usar el botón 🔔 para desuscribirte.

---

## 8. Inactividad de 20 minutos

Por seguridad, el sistema aplica un **cierre automático por 20 minutos de inactividad**, con **doble capa (cliente y servidor)**:

- Si no realizas actividad durante 20 minutos, tu sesión se cierra automáticamente.
- El cierre aplica tanto dentro del sistema como en la pantalla de login.
- Deberás **iniciar sesión de nuevo** para continuar.

---

## 9. Cerrar sesión

- Usa la opción **Cerrar sesión** para salir de forma segura.
- El cierre de sesión también queda registrado en la bitácora.

---

## 10. Preguntas frecuentes

**¿Cuál es mi contraseña la primera vez?**
Tu **número de teléfono** registrado. En el primer ingreso el sistema te obliga a cambiarla.

**Olvidé mi contraseña, ¿qué hago?**
Contacta a un usuario master o a soporte para que gestione tu cuenta.

**¿Puedo enviar un ticket a más de un departamento?**
Sí. En el acordeón de departamentos puedes seleccionar **varios destinos**.

**¿Por qué no encuentro el buscador por folio o departamento?**
Esa función está reservada **solo para usuarios master**.

**¿Los cuadros de confirmación son del navegador?**
No. Todos los avisos, confirmaciones y formularios emergentes usan **BuzzBox**, la librería propia del sistema.

**Me cerró la sesión sin avisar, ¿es un error?**
No. Es el **cierre automático por 20 minutos de inactividad**. Vuelve a iniciar sesión.

**¿Puedo adjuntar un archivo al ticket?**
Sí, el **adjunto es opcional** al crear el ticket.

**¿Qué significa el folio `TKT-YYYYMMDD-XXXX`?**
Es el identificador único: la fecha de creación seguida de un consecutivo.

---

*Derechos reservados ULTRA 2026 · Soporte: soporte.spectra@corporativoultra.com*
