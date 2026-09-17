// ============================================================================
// bitacora.js — Auditoria de accesos y acciones
// ============================================================================
import { db } from "./db.js";

/**
 * Registra una entrada en la bitacora.
 * Toda entrada al sistema y acciones relevantes se registran aqui.
 */
export function registrar({ usuario_id = null, correo = null, accion, detalle = null, ip = null }) {
  try {
    db.prepare(
      `INSERT INTO bitacora (usuario_id, correo, accion, detalle, ip)
       VALUES (?, ?, ?, ?, ?)`
    ).run(usuario_id, correo, accion, detalle, ip);
  } catch (err) {
    console.error("[bitacora] error al registrar:", err.message);
  }
}

/**
 * Lista la bitacora (mas reciente primero). Solo para masters.
 */
export function listar({ limite = 500, offset = 0 } = {}) {
  return db
    .prepare(
      `SELECT b.id, b.usuario_id, b.correo, b.accion, b.detalle, b.ip, b.creado_en
         FROM bitacora b
        ORDER BY b.id DESC
        LIMIT ? OFFSET ?`
    )
    .all(limite, offset);
}

// Rutas de bitacora (protegidas: solo master)
export default async function bitacoraRoutes(fastify) {
  fastify.get("/api/bitacora", { preHandler: fastify.authMaster }, async (req) => {
    const limite = Math.min(Number(req.query.limite) || 500, 2000);
    const offset = Number(req.query.offset) || 0;
    return { ok: true, bitacora: listar({ limite, offset }) };
  });
}
