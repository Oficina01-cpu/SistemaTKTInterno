// ============================================================================
// config.js — Rutas de Configuracion (solo Master): usuarios y departamentos
// Alta/baja de usuarios protegida con PIN 1033.
// ============================================================================
import { db, hashPassword } from "./db.js";
import { registrar } from "./bitacora.js";
import { clientIp } from "./auth.js";

const CORP_DOMAIN = process.env.CORP_DOMAIN || "corporativoultra.com";
const ADMIN_PIN = process.env.ADMIN_PIN || "1033";

export default async function configRoutes(fastify) {
  // ---------------- DEPARTAMENTOS (publico para llenar acordeon) -------------
  fastify.get("/api/departamentos", { preHandler: fastify.authRequired }, async () => {
    const rows = db.prepare("SELECT id, nombre, activo FROM departamentos WHERE activo = 1 ORDER BY nombre").all();
    return { ok: true, departamentos: rows };
  });

  // ---- ALTA departamento (master) ----
  fastify.post("/api/departamentos", { preHandler: fastify.authMaster }, async (req, reply) => {
    const nombre = (req.body?.nombre || "").trim();
    if (!nombre) return reply.code(400).send({ ok: false, error: "Nombre requerido" });
    try {
      const info = db.prepare("INSERT INTO departamentos (nombre) VALUES (?)").run(nombre);
      registrar({ usuario_id: req.currentUser.id, correo: req.currentUser.correo, accion: "DEPTO_ALTA", detalle: nombre, ip: clientIp(req) });
      return { ok: true, id: info.lastInsertRowid };
    } catch {
      return reply.code(409).send({ ok: false, error: "El departamento ya existe" });
    }
  });

  // ---- BAJA departamento (soft delete) (master) ----
  fastify.delete("/api/departamentos/:id", { preHandler: fastify.authMaster }, async (req) => {
    const id = Number(req.params.id);
    db.prepare("UPDATE departamentos SET activo = 0 WHERE id = ?").run(id);
    registrar({ usuario_id: req.currentUser.id, correo: req.currentUser.correo, accion: "DEPTO_BAJA", detalle: `id ${id}`, ip: clientIp(req) });
    return { ok: true };
  });

  // ---------------- USUARIOS (master) ----------------------------------------
  fastify.get("/api/usuarios", { preHandler: fastify.authMaster }, async () => {
    const rows = db
      .prepare(
        `SELECT u.id, u.correo, u.telefono, u.nombre, u.rol, u.activo, u.primer_ingreso,
                d.nombre AS departamento
           FROM usuarios u
           LEFT JOIN departamentos d ON d.id = u.departamento_id
          ORDER BY u.id DESC`
      )
      .all();
    return { ok: true, usuarios: rows };
  });

  // ---- ALTA usuario (master + PIN) ----
  fastify.post("/api/usuarios", { preHandler: fastify.authMaster }, async (req, reply) => {
    const { correo, telefono, departamento_id, rol, pin } = req.body || {};
    if (String(pin) !== String(ADMIN_PIN)) {
      return reply.code(403).send({ ok: false, error: "PIN incorrecto" });
    }
    const email = String(correo || "").trim().toLowerCase();
    if (!email.endsWith("@" + CORP_DOMAIN)) {
      return reply.code(400).send({ ok: false, error: `El correo debe ser @${CORP_DOMAIN}` });
    }
    if (!telefono || String(telefono).length < 7) {
      return reply.code(400).send({ ok: false, error: "Teléfono válido requerido (será la clave inicial)" });
    }
    const rolFinal = rol === "master" ? "master" : "usuario";
    try {
      // Contraseña inicial = telefono; primer_ingreso obliga cambio.
      const info = db
        .prepare(
          `INSERT INTO usuarios (correo, telefono, password_hash, rol, departamento_id, primer_ingreso, activo)
           VALUES (?, ?, ?, ?, ?, 1, 1)`
        )
        .run(email, String(telefono), hashPassword(String(telefono)), rolFinal, departamento_id || null);
      registrar({ usuario_id: req.currentUser.id, correo: req.currentUser.correo, accion: "USUARIO_ALTA", detalle: email, ip: clientIp(req) });
      return { ok: true, id: info.lastInsertRowid };
    } catch {
      return reply.code(409).send({ ok: false, error: "El correo ya está registrado" });
    }
  });

  // ---- BAJA usuario (master + PIN) ----
  fastify.delete("/api/usuarios/:id", { preHandler: fastify.authMaster }, async (req, reply) => {
    const pin = req.query.pin || req.body?.pin;
    if (String(pin) !== String(ADMIN_PIN)) {
      return reply.code(403).send({ ok: false, error: "PIN incorrecto" });
    }
    const id = Number(req.params.id);
    if (id === req.currentUser.id) {
      return reply.code(400).send({ ok: false, error: "No puedes darte de baja a ti mismo" });
    }
    db.prepare("UPDATE usuarios SET activo = 0 WHERE id = ?").run(id);
    // Revocar sesiones activas del usuario
    db.prepare("UPDATE sesiones SET revocada = 1 WHERE usuario_id = ?").run(id);
    registrar({ usuario_id: req.currentUser.id, correo: req.currentUser.correo, accion: "USUARIO_BAJA", detalle: `id ${id}`, ip: clientIp(req) });
    return { ok: true };
  });

  // ---- Reactivar usuario (master + PIN) ----
  fastify.post("/api/usuarios/:id/reactivar", { preHandler: fastify.authMaster }, async (req, reply) => {
    const pin = req.body?.pin;
    if (String(pin) !== String(ADMIN_PIN)) {
      return reply.code(403).send({ ok: false, error: "PIN incorrecto" });
    }
    const id = Number(req.params.id);
    db.prepare("UPDATE usuarios SET activo = 1 WHERE id = ?").run(id);
    registrar({ usuario_id: req.currentUser.id, correo: req.currentUser.correo, accion: "USUARIO_REACTIVAR", detalle: `id ${id}`, ip: clientIp(req) });
    return { ok: true };
  });
}
