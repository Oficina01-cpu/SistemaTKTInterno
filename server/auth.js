// ============================================================================
// auth.js — Login, JWT, cambio de clave, primer ingreso, roles, inactividad
// ============================================================================
import crypto from "node:crypto";
import { db, verifyPassword, hashPassword, getConfig } from "./db.js";
import { registrar } from "./bitacora.js";

const CORP_DOMAIN = process.env.CORP_DOMAIN || "corporativoultra.com";
const IDLE_MIN = Number(process.env.SESSION_IDLE_MINUTES || 20);
const ADMIN_PIN = process.env.ADMIN_PIN || "1033";

function clientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || null;
}

// ---------------------------------------------------------------------------
// Decorators de autenticacion registrados en Fastify
// ---------------------------------------------------------------------------
export function registerAuthDecorators(fastify) {
  // Verifica JWT + sesion activa + inactividad server-side (autoritativo)
  fastify.decorate("authRequired", async function (req, reply) {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ ok: false, error: "No autenticado" });
    }
    const { sub, jti } = req.user || {};
    const ses = db.prepare("SELECT * FROM sesiones WHERE jti = ?").get(jti);
    if (!ses || ses.revocada) {
      return reply.code(401).send({ ok: false, error: "Sesión cerrada" });
    }
    // Inactividad autoritativa en servidor
    const inactivo = db
      .prepare(
        `SELECT (julianday('now','localtime') - julianday(ultima_actividad)) * 24 * 60 AS mins
           FROM sesiones WHERE jti = ?`
      )
      .get(jti);
    if (inactivo && inactivo.mins > IDLE_MIN) {
      db.prepare("UPDATE sesiones SET revocada = 1 WHERE jti = ?").run(jti);
      registrar({ usuario_id: sub, accion: "SESION_EXPIRADA", detalle: `Inactividad > ${IDLE_MIN}min` });
      return reply.code(401).send({ ok: false, error: "Sesión expirada por inactividad" });
    }
    // Refrescar ultima actividad
    db.prepare("UPDATE sesiones SET ultima_actividad = datetime('now','localtime') WHERE jti = ?").run(jti);

    const u = db.prepare("SELECT id, correo, nombre, rol, departamento_id, primer_ingreso, activo FROM usuarios WHERE id = ?").get(sub);
    if (!u) return reply.code(401).send({ ok: false, error: "Usuario no válido" });
    // Usuario dado de baja: rechazar y revocar la sesión que aún tuviera abierta.
    if (!u.activo) {
      db.prepare("UPDATE sesiones SET revocada = 1 WHERE jti = ?").run(jti);
      registrar({ usuario_id: sub, accion: "ACCESO_DENEGADO", detalle: "Usuario inactivo" });
      return reply.code(401).send({ ok: false, error: "Usuario inactivo" });
    }
    req.currentUser = u;
  });

  // Requiere rol master
  fastify.decorate("authMaster", async function (req, reply) {
    await fastify.authRequired.call(fastify, req, reply);
    if (reply.sent) return;
    if (req.currentUser?.rol !== "master") {
      return reply.code(403).send({ ok: false, error: "Requiere rol Master" });
    }
  });
}

// ---------------------------------------------------------------------------
// Rutas de autenticacion
// ---------------------------------------------------------------------------
export default async function authRoutes(fastify) {
  // ---- LOGIN ----
  fastify.post("/api/auth/login", async (req, reply) => {
    const { correo, password } = req.body || {};
    const ip = clientIp(req);
    if (!correo || !password) {
      return reply.code(400).send({ ok: false, error: "Correo y contraseña requeridos" });
    }
    const email = String(correo).trim().toLowerCase();
    if (!email.endsWith("@" + CORP_DOMAIN)) {
      registrar({ correo: email, accion: "LOGIN_FALLIDO", detalle: "Dominio no permitido", ip });
      return reply.code(400).send({ ok: false, error: `El correo debe ser @${CORP_DOMAIN}` });
    }

    const u = db.prepare("SELECT * FROM usuarios WHERE correo = ?").get(email);
    if (!u || !u.activo) {
      registrar({ correo: email, accion: "LOGIN_FALLIDO", detalle: "Usuario inexistente o inactivo", ip });
      return reply.code(401).send({ ok: false, error: "Credenciales inválidas" });
    }
    if (!verifyPassword(password, u.password_hash)) {
      registrar({ usuario_id: u.id, correo: email, accion: "LOGIN_FALLIDO", detalle: "Password incorrecta", ip });
      return reply.code(401).send({ ok: false, error: "Credenciales inválidas" });
    }

    // Crear sesion con jti
    const jti = crypto.randomUUID();
    db.prepare("INSERT INTO sesiones (jti, usuario_id) VALUES (?, ?)").run(jti, u.id);

    // El JWT tiene vida amplia (12h); el criterio REAL de cierre es la
    // inactividad de IDLE_MIN validada server-side (tabla sesiones). Asi un
    // usuario activo no es expulsado a los 20 min exactos del login.
    const token = await reply.jwtSign(
      { sub: u.id, jti, rol: u.rol },
      { expiresIn: "12h" }
    );

    registrar({ usuario_id: u.id, correo: email, accion: "LOGIN", detalle: "Ingreso exitoso", ip });

    return {
      ok: true,
      token,
      primer_ingreso: !!u.primer_ingreso,
      usuario: {
        id: u.id,
        correo: u.correo,
        nombre: u.nombre,
        rol: u.rol,
        departamento_id: u.departamento_id,
      },
      idle_minutes: IDLE_MIN,
    };
  });

  // ---- PRIMER INGRESO: nombre completo + cambio de clave (obligatorio) ----
  fastify.post("/api/auth/primer-ingreso", { preHandler: fastify.authRequired }, async (req, reply) => {
    const { nombre, nueva_password } = req.body || {};
    const u = req.currentUser;
    if (!nombre || String(nombre).trim().length < 3) {
      return reply.code(400).send({ ok: false, error: "Nombre completo requerido" });
    }
    if (!nueva_password || String(nueva_password).length < 6) {
      return reply.code(400).send({ ok: false, error: "La nueva contraseña debe tener al menos 6 caracteres" });
    }
    db.prepare(
      "UPDATE usuarios SET nombre = ?, password_hash = ?, primer_ingreso = 0 WHERE id = ?"
    ).run(String(nombre).trim(), hashPassword(nueva_password), u.id);

    registrar({ usuario_id: u.id, correo: u.correo, accion: "PRIMER_INGRESO", detalle: "Nombre y clave actualizados", ip: clientIp(req) });
    return { ok: true, nombre: String(nombre).trim() };
  });

  // ---- CAMBIO DE CLAVE (usuario ya activo) ----
  fastify.post("/api/auth/cambiar-clave", { preHandler: fastify.authRequired }, async (req, reply) => {
    const { actual, nueva } = req.body || {};
    const u = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(req.currentUser.id);
    if (!verifyPassword(actual, u.password_hash)) {
      return reply.code(400).send({ ok: false, error: "Contraseña actual incorrecta" });
    }
    if (!nueva || String(nueva).length < 6) {
      return reply.code(400).send({ ok: false, error: "La nueva contraseña debe tener al menos 6 caracteres" });
    }
    db.prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?").run(hashPassword(nueva), u.id);
    registrar({ usuario_id: u.id, correo: u.correo, accion: "CAMBIO_CLAVE", ip: clientIp(req) });
    return { ok: true };
  });

  // ---- INFO SESION (bienvenida: nombre, fecha/hora) ----
  fastify.get("/api/auth/me", { preHandler: fastify.authRequired }, async (req) => {
    const u = req.currentUser;
    const dep = u.departamento_id
      ? db.prepare("SELECT nombre FROM departamentos WHERE id = ?").get(u.departamento_id)
      : null;
    return {
      ok: true,
      usuario: {
        id: u.id,
        correo: u.correo,
        nombre: u.nombre,
        rol: u.rol,
        departamento_id: u.departamento_id,
        departamento: dep?.nombre || null,
      },
      servidor_fecha: new Date().toISOString(),
      idle_minutes: IDLE_MIN,
    };
  });

  // ---- KEEPALIVE (refresca actividad; usado por el cliente) ----
  fastify.post("/api/auth/ping", { preHandler: fastify.authRequired }, async () => {
    return { ok: true, ts: Date.now() };
  });

  // ---- LOGOUT ----
  fastify.post("/api/auth/logout", { preHandler: fastify.authRequired }, async (req) => {
    const { jti } = req.user;
    db.prepare("UPDATE sesiones SET revocada = 1 WHERE jti = ?").run(jti);
    registrar({ usuario_id: req.currentUser.id, correo: req.currentUser.correo, accion: "LOGOUT", ip: clientIp(req) });
    return { ok: true };
  });

  // ---- VALIDAR PIN admin (para alta/baja usuarios) ----
  fastify.post("/api/auth/validar-pin", { preHandler: fastify.authMaster }, async (req, reply) => {
    const { pin } = req.body || {};
    if (String(pin) !== String(ADMIN_PIN)) {
      registrar({ usuario_id: req.currentUser.id, correo: req.currentUser.correo, accion: "PIN_FALLIDO", ip: clientIp(req) });
      return reply.code(403).send({ ok: false, error: "PIN incorrecto" });
    }
    return { ok: true };
  });
}

export { clientIp };
