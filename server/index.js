// ============================================================================
// index.js — Servidor Fastify: splash + app estatica + API + Socket.IO
// Sistema de Tickets Interno ULTRA
// ============================================================================
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

import { initSchema, seed, getConfig } from "./db.js";
import { registerAuthDecorators } from "./auth.js";
import authRoutes from "./auth.js";
import ticketsRoutes from "./tickets.js";
import configRoutes from "./config.js";
import bitacoraRoutes from "./bitacora.js";
import { initVapid, initSocket, notificacionesRoutes } from "./notificaciones.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");
const UPLOADS = join(ROOT, "uploads");

// Cargar .env manualmente (sin dependencia dotenv)
(function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
})();

const PORT = Number(process.env.PORT || 3080);
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET || "ULTRA_DEV_SECRET_CAMBIAR_EN_PRODUCCION";

// ---- Inicializar BD (schema + seeds) ----
initSchema();
seed();
initVapid();
const BUILD_ID = getConfig("build_id") || Date.now().toString();

const fastify = Fastify({
  logger: { level: process.env.NODE_ENV === "production" ? "warn" : "info" },
  bodyLimit: 15 * 1024 * 1024,
});

await fastify.register(fastifyCookie);
await fastify.register(fastifyJwt, { secret: JWT_SECRET });
await fastify.register(fastifyMultipart, {
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB adjuntos
});

// Seguridad de cabeceras (CSP permite CDN de Tailwind/DaisyUI/Socket.IO)
await fastify.register(fastifyHelmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.socket.io", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Rate limiting global (protege el login y la API expuesta a Internet)
await fastify.register(fastifyRateLimit, {
  max: 300,
  timeWindow: "1 minute",
  allowList: (req) => (req.raw.url || "").startsWith("/socket.io"),
});

// Decorators de auth (authRequired / authMaster)
registerAuthDecorators(fastify);

// ---- Cache-busting global: no-cache para html/sw/api ----
fastify.addHook("onSend", async (req, reply, payload) => {
  const url = req.raw.url || "";
  if (url === "/" || url.endsWith(".html") || url.endsWith("sw.js") || url.startsWith("/api")) {
    reply.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
  }
  return payload;
});

// Exponer BUILD_ID a la app
fastify.get("/api/version", async () => ({ ok: true, build_id: BUILD_ID }));

// ---- Estaticos ----
await fastify.register(fastifyStatic, {
  root: PUBLIC,
  prefix: "/",
  index: false,
  setHeaders(res, path) {
    if (path.endsWith(".html") || path.endsWith("sw.js")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    }
  },
});

// Adjuntos servidos con auth (fuera de /public)
await fastify.register(fastifyStatic, {
  root: UPLOADS,
  prefix: "/uploads/",
  decorateReply: false,
});
fastify.addHook("onRequest", async (req, reply) => {
  if ((req.raw.url || "").startsWith("/uploads/")) {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ ok: false, error: "No autenticado" });
    }
  }
});

// ---- Rutas ----
await fastify.register(authRoutes);
await fastify.register(ticketsRoutes);
await fastify.register(configRoutes);
await fastify.register(bitacoraRoutes);
fastify.register(async (f) => notificacionesRoutes(f));

// ---- Paginas ----
// Splash en la raiz (redirige a login tras 2s)
fastify.get("/", async (req, reply) => {
  reply.type("text/html");
  return readFileSync(join(PUBLIC, "splash.html"), "utf8");
});

// Healthcheck
fastify.get("/health", async () => ({ ok: true, ts: Date.now(), build_id: BUILD_ID }));

// ---- Arranque + Socket.IO sobre el mismo server HTTP ----
try {
  await fastify.listen({ port: PORT, host: HOST });
  initSocket(fastify.server, fastify);
  console.log("========================================================");
  console.log("  Sistema de Tickets Interno ULTRA");
  console.log(`  Escuchando en http://${HOST}:${PORT}`);
  console.log(`  Splash:    http://localhost:${PORT}/`);
  console.log(`  Login:     http://localhost:${PORT}/index.html`);
  console.log(`  Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`  Build ID:  ${BUILD_ID}`);
  console.log("========================================================");
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
