// ============================================================================
// notificaciones.js — Socket.IO (tiempo real) + Web Push (VAPID)
// ============================================================================
import { Server as SocketIOServer } from "socket.io";
import webpush from "web-push";
import { db, getConfig, setConfig } from "./db.js";

let io = null;

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:soporte.spectra@corporativoultra.com";

// ---------------------------------------------------------------------------
// VAPID: generar una sola vez y persistir en tabla config
// ---------------------------------------------------------------------------
export function initVapid() {
  let pub = getConfig("vapid_public");
  let priv = getConfig("vapid_private");
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    pub = keys.publicKey;
    priv = keys.privateKey;
    setConfig("vapid_public", pub);
    setConfig("vapid_private", priv);
    console.log("[push] Claves VAPID generadas y guardadas en BD.");
  }
  webpush.setVapidDetails(VAPID_SUBJECT, pub, priv);
  return { publicKey: pub };
}

export function getVapidPublicKey() {
  return getConfig("vapid_public");
}

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------
export function initSocket(httpServer, fastify) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
    path: "/socket.io",
  });

  // Autenticacion del socket via JWT (token en handshake.auth.token)
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Sin token"));
      const payload = fastify.jwt.verify(token);
      const ses = db.prepare("SELECT * FROM sesiones WHERE jti = ?").get(payload.jti);
      if (!ses || ses.revocada) return next(new Error("Sesión inválida"));
      const u = db.prepare("SELECT id, departamento_id, rol FROM usuarios WHERE id = ?").get(payload.sub);
      if (!u) return next(new Error("Usuario inválido"));
      socket.data.user = u;
      next();
    } catch {
      next(new Error("No autorizado"));
    }
  });

  io.on("connection", (socket) => {
    const u = socket.data.user;
    socket.join(`user:${u.id}`);
    if (u.departamento_id) socket.join(`dept:${u.departamento_id}`);
    if (u.rol === "master") socket.join("masters");

    socket.on("disconnect", () => {});
  });

  return io;
}

export function getIO() {
  return io;
}

// ---------------------------------------------------------------------------
// Envio de notificaciones combinadas: Socket.IO (toast si conectado) + Web Push
// ---------------------------------------------------------------------------

// Emite evento en tiempo real a un room
export function emitToRoom(room, evento, payload) {
  if (io) io.to(room).emit(evento, payload);
}

// Verifica si un usuario tiene sockets conectados
export function usuarioConectado(usuarioId) {
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(`user:${usuarioId}`);
  return !!(room && room.size > 0);
}

// Enviar Web Push a un usuario (para navegador cerrado / sin socket)
export async function pushAUsuario(usuarioId, data) {
  const subs = db.prepare("SELECT * FROM push_subscriptions WHERE usuario_id = ?").all(usuarioId);
  const payload = JSON.stringify(data);
  for (const s of subs) {
    const subscription = {
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth },
    };
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (err) {
      // 404/410 => suscripcion expirada: limpiar
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(s.id);
      } else {
        console.error("[push] error:", err.statusCode, err.body || err.message);
      }
    }
  }
}

/**
 * Notifica a todos los usuarios de una lista de departamentos:
 * - toast en vivo por Socket.IO (room dept:{id})
 * - Web Push a cada usuario del depto (por si el navegador esta cerrado)
 */
export async function notificarDepartamentos(departamentoIds, evento, data) {
  for (const depId of departamentoIds) {
    emitToRoom(`dept:${depId}`, evento, data);
    const usuarios = db
      .prepare("SELECT id FROM usuarios WHERE departamento_id = ? AND activo = 1")
      .all(depId);
    for (const u of usuarios) {
      // Web push como respaldo (el SW deduplica visualmente; el cliente ignora si ya tiene toast)
      await pushAUsuario(u.id, data);
    }
  }
}

// ---------------------------------------------------------------------------
// Rutas de suscripcion push
// ---------------------------------------------------------------------------
export function notificacionesRoutes(fastify) {
  fastify.get("/api/push/vapid", async () => {
    return { ok: true, publicKey: getVapidPublicKey() };
  });

  fastify.post("/api/push/subscribe", { preHandler: fastify.authRequired }, async (req, reply) => {
    const sub = req.body || {};
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return reply.code(400).send({ ok: false, error: "Suscripción inválida" });
    }
    db.prepare(
      `INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET usuario_id = excluded.usuario_id,
         p256dh = excluded.p256dh, auth = excluded.auth`
    ).run(req.currentUser.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
    return { ok: true };
  });

  fastify.post("/api/push/unsubscribe", { preHandler: fastify.authRequired }, async (req) => {
    const { endpoint } = req.body || {};
    if (endpoint) db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
    return { ok: true };
  });
}
