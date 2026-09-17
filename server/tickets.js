// ============================================================================
// tickets.js — CRUD de tickets, folios, multi-destino, adjuntos, buscador
// ============================================================================
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import crypto from "node:crypto";
import { db } from "./db.js";
import { registrar } from "./bitacora.js";
import { clientIp } from "./auth.js";
import { notificarDepartamentos } from "./notificaciones.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS = join(__dirname, "..", "uploads");
if (!existsSync(UPLOADS)) mkdirSync(UPLOADS, { recursive: true });

// Genera folio unico legible: TKT-YYYYMMDD-XXXX
function generarFolio() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `TKT-${ymd}-${rand}`;
}

// Arma un ticket con sus departamentos destino y nombre de autor
function armarTicket(row) {
  const destinos = db
    .prepare(
      `SELECT d.id, d.nombre
         FROM ticket_destinos td
         JOIN departamentos d ON d.id = td.departamento_id
        WHERE td.ticket_id = ?`
    )
    .all(row.id);
  const autor = db.prepare("SELECT nombre, correo FROM usuarios WHERE id = ?").get(row.autor_id);
  return { ...row, destinos, autor_nombre: autor?.nombre || autor?.correo || "—" };
}

// Autoriza el acceso a un ticket: master, autor, o miembro de un depto destino.
function puedeAcceder(user, ticket) {
  if (user.rol === "master") return true;
  if (ticket.autor_id === user.id) return true;
  if (user.departamento_id) {
    const enDestino = db
      .prepare("SELECT 1 FROM ticket_destinos WHERE ticket_id = ? AND departamento_id = ?")
      .get(ticket.id, user.departamento_id);
    if (enDestino) return true;
  }
  return false;
}

export default async function ticketsRoutes(fastify) {
  // ---- CREAR TICKET (multipart: campos + adjunto opcional) ----
  fastify.post("/api/tickets", { preHandler: fastify.authRequired }, async (req, reply) => {
    const parts = req.parts();
    const campos = {};
    let adjuntoNombre = null;

    for await (const part of parts) {
      if (part.type === "file") {
        if (part.filename) {
          const safe = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}${extname(part.filename)}`;
          const dest = join(UPLOADS, safe);
          await pipeline(part.file, createWriteStream(dest));
          adjuntoNombre = safe;
        } else {
          part.file.resume();
        }
      } else {
        campos[part.fieldname] = part.value;
      }
    }

    const asunto = (campos.asunto || "").trim();
    const descripcion = (campos.descripcion || "").trim();
    const prioridad = ["baja", "media", "alta"].includes(campos.prioridad) ? campos.prioridad : "media";
    let destinos = [];
    try {
      destinos = JSON.parse(campos.destinos || "[]").map(Number).filter(Boolean);
    } catch {
      destinos = [];
    }

    if (!asunto || !descripcion) {
      return reply.code(400).send({ ok: false, error: "Asunto y descripción son obligatorios" });
    }
    if (destinos.length === 0) {
      return reply.code(400).send({ ok: false, error: "Selecciona al menos un departamento destino" });
    }

    const folio = generarFolio();
    const info = db
      .prepare(
        `INSERT INTO tickets (folio, autor_id, asunto, descripcion, prioridad, adjunto)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(folio, req.currentUser.id, asunto, descripcion, prioridad, adjuntoNombre);

    const ticketId = info.lastInsertRowid;
    const insDest = db.prepare("INSERT OR IGNORE INTO ticket_destinos (ticket_id, departamento_id) VALUES (?, ?)");
    for (const depId of destinos) insDest.run(ticketId, depId);

    const row = db.prepare("SELECT * FROM tickets WHERE id = ?").get(ticketId);
    const ticket = armarTicket(row);

    registrar({
      usuario_id: req.currentUser.id,
      correo: req.currentUser.correo,
      accion: "TICKET_CREADO",
      detalle: `Folio ${folio} -> deptos [${ticket.destinos.map((d) => d.nombre).join(", ")}]`,
      ip: clientIp(req),
    });

    // Notificar a los departamentos destino (Socket.IO + Web Push)
    await notificarDepartamentos(destinos, "ticket:nuevo", {
      title: "Nuevo ticket ULTRA",
      body: `${folio}: ${asunto} (${prioridad})`,
      folio,
      ticketId,
      prioridad,
      url: "/dashboard.html",
    });

    return { ok: true, ticket };
  });

  // ---- MIS TICKETS ----
  fastify.get("/api/tickets/mios", { preHandler: fastify.authRequired }, async (req) => {
    const rows = db
      .prepare("SELECT * FROM tickets WHERE autor_id = ? ORDER BY id DESC")
      .all(req.currentUser.id);
    return { ok: true, tickets: rows.map(armarTicket) };
  });

  // ---- TICKETS DE MI DEPARTAMENTO ----
  fastify.get("/api/tickets/departamento", { preHandler: fastify.authRequired }, async (req, reply) => {
    const depId = req.currentUser.departamento_id;
    if (!depId) return { ok: true, tickets: [] };
    const rows = db
      .prepare(
        `SELECT t.* FROM tickets t
           JOIN ticket_destinos td ON td.ticket_id = t.id
          WHERE td.departamento_id = ?
          ORDER BY t.id DESC`
      )
      .all(depId);
    return { ok: true, tickets: rows.map(armarTicket) };
  });

  // ---- BUSCADOR (solo masters): por folio o por departamento ----
  fastify.get("/api/tickets/buscar", { preHandler: fastify.authMaster }, async (req) => {
    const { folio, departamento_id } = req.query;
    let rows = [];
    if (folio) {
      rows = db
        .prepare("SELECT * FROM tickets WHERE folio LIKE ? ORDER BY id DESC")
        .all(`%${folio}%`);
    } else if (departamento_id) {
      rows = db
        .prepare(
          `SELECT t.* FROM tickets t
             JOIN ticket_destinos td ON td.ticket_id = t.id
            WHERE td.departamento_id = ?
            ORDER BY t.id DESC`
        )
        .all(Number(departamento_id));
    } else {
      rows = db.prepare("SELECT * FROM tickets ORDER BY id DESC LIMIT 200").all();
    }
    return { ok: true, tickets: rows.map(armarTicket) };
  });

  // ---- DETALLE ----
  fastify.get("/api/tickets/:id", { preHandler: fastify.authRequired }, async (req, reply) => {
    const row = db.prepare("SELECT * FROM tickets WHERE id = ?").get(Number(req.params.id));
    if (!row) return reply.code(404).send({ ok: false, error: "Ticket no encontrado" });
    if (!puedeAcceder(req.currentUser, row)) {
      return reply.code(403).send({ ok: false, error: "No tienes acceso a este ticket" });
    }
    return { ok: true, ticket: armarTicket(row) };
  });

  // ---- CAMBIAR ESTADO ----
  fastify.patch("/api/tickets/:id/estado", { preHandler: fastify.authRequired }, async (req, reply) => {
    const { estado } = req.body || {};
    if (!["abierto", "en_proceso", "cerrado"].includes(estado)) {
      return reply.code(400).send({ ok: false, error: "Estado inválido" });
    }
    const id = Number(req.params.id);
    const row = db.prepare("SELECT * FROM tickets WHERE id = ?").get(id);
    if (!row) return reply.code(404).send({ ok: false, error: "Ticket no encontrado" });
    if (!puedeAcceder(req.currentUser, row)) {
      return reply.code(403).send({ ok: false, error: "No tienes acceso a este ticket" });
    }

    db.prepare("UPDATE tickets SET estado = ?, actualizado_en = datetime('now','localtime') WHERE id = ?").run(estado, id);
    registrar({
      usuario_id: req.currentUser.id,
      correo: req.currentUser.correo,
      accion: "TICKET_ESTADO",
      detalle: `Folio ${row.folio} -> ${estado}`,
      ip: clientIp(req),
    });
    return { ok: true };
  });
}
