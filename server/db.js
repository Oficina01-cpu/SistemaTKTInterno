// ============================================================================
// db.js — Base de datos SQLite nativa (node:sqlite) + schema + seeds
// Sistema de Tickets Interno ULTRA
// ----------------------------------------------------------------------------
// Usa el modulo nativo node:sqlite (Node >= 22.5). Sin dependencias externas.
// La BD vive en ./data/tickets.db y sobrevive reinicios y cortes de luz (WAL).
// ============================================================================

import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const DB_PATH = join(DATA_DIR, "tickets.db");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

// PRAGMAs de robustez para produccion.
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");

// ---------------------------------------------------------------------------
// Password hashing con node:crypto (scrypt). Formato: scrypt$salt$hash
// ---------------------------------------------------------------------------
export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(plain), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(plain, stored) {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const [, salt, hash] = stored.split("$");
  const derived = crypto.scryptSync(String(plain), salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(derived, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      clave TEXT PRIMARY KEY,
      valor TEXT
    );

    CREATE TABLE IF NOT EXISTS departamentos (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre       TEXT NOT NULL UNIQUE,
      activo       INTEGER NOT NULL DEFAULT 1,
      creado_en    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      correo         TEXT NOT NULL UNIQUE,
      telefono       TEXT NOT NULL,
      nombre         TEXT,
      password_hash  TEXT NOT NULL,
      rol            TEXT NOT NULL DEFAULT 'usuario',   -- 'usuario' | 'master'
      departamento_id INTEGER,
      primer_ingreso INTEGER NOT NULL DEFAULT 1,
      activo         INTEGER NOT NULL DEFAULT 1,
      creado_en      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      folio          TEXT NOT NULL UNIQUE,
      autor_id       INTEGER NOT NULL,
      asunto         TEXT NOT NULL,
      descripcion    TEXT NOT NULL,
      prioridad      TEXT NOT NULL DEFAULT 'media',    -- baja | media | alta
      estado         TEXT NOT NULL DEFAULT 'abierto',  -- abierto | en_proceso | cerrado
      adjunto        TEXT,                              -- nombre de archivo en /uploads
      creado_en      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    -- Relacion N:M ticket <-> departamentos destino (varios involucrados)
    CREATE TABLE IF NOT EXISTS ticket_destinos (
      ticket_id      INTEGER NOT NULL,
      departamento_id INTEGER NOT NULL,
      PRIMARY KEY (ticket_id, departamento_id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bitacora (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id  INTEGER,
      correo      TEXT,
      accion      TEXT NOT NULL,
      detalle     TEXT,
      ip          TEXT,
      creado_en   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id  INTEGER NOT NULL,
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      creado_en   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    -- Sesiones activas (jti para poder revocar y aplicar inactividad server-side)
    CREATE TABLE IF NOT EXISTS sesiones (
      jti          TEXT PRIMARY KEY,
      usuario_id   INTEGER NOT NULL,
      creado_en    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      ultima_actividad TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      revocada     INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_autor ON tickets(autor_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_folio ON tickets(folio);
    CREATE INDEX IF NOT EXISTS idx_destinos_dep ON ticket_destinos(departamento_id);
    CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON bitacora(creado_en);
    CREATE INDEX IF NOT EXISTS idx_sesiones_user ON sesiones(usuario_id);
  `);
}

// ---------------------------------------------------------------------------
// Helpers de config (clave/valor)
// ---------------------------------------------------------------------------
export function getConfig(clave, fallback = null) {
  const row = db.prepare("SELECT valor FROM config WHERE clave = ?").get(clave);
  return row ? row.valor : fallback;
}

export function setConfig(clave, valor) {
  db.prepare(
    `INSERT INTO config (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`
  ).run(clave, String(valor));
}

// ---------------------------------------------------------------------------
// Seeds: departamentos base + usuarios Master
// ---------------------------------------------------------------------------
const DEPARTAMENTOS_BASE = [
  "Operaciones",
  "Calidad",
  "Recursos Humanos",
  "Administración",
  "Cuentas Por Pagar",
  "Alta Dirección",
  "Legal",
];

export function seed() {
  const insDep = db.prepare("INSERT OR IGNORE INTO departamentos (nombre) VALUES (?)");
  for (const d of DEPARTAMENTOS_BASE) insDep.run(d);

  // Usuarios Master solicitados:
  //   Usuario "Master" / Password "Master2"
  //   Usuario "Master" / Password "Master3"
  // Se modelan como correos internos para poder autenticarse por el mismo flujo.
  const altaDir = db.prepare("SELECT id FROM departamentos WHERE nombre = 'Alta Dirección'").get();
  const depId = altaDir ? altaDir.id : null;

  const masters = [
    { correo: "master2@corporativoultra.com", pass: "Master2", tel: "0000000002" },
    { correo: "master3@corporativoultra.com", pass: "Master3", tel: "0000000003" },
  ];

  const insUser = db.prepare(`
    INSERT OR IGNORE INTO usuarios
      (correo, telefono, nombre, password_hash, rol, departamento_id, primer_ingreso, activo)
    VALUES (?, ?, ?, ?, 'master', ?, 0, 1)
  `);
  for (const m of masters) {
    insUser.run(m.correo, m.tel, "Master ULTRA", hashPassword(m.pass), depId);
  }

  // Guarda la version de build para cache-busting
  if (!getConfig("build_id")) setConfig("build_id", Date.now().toString());
}

// ---------------------------------------------------------------------------
// Ejecutar directamente para inicializar/seed: node server/db.js --seed
// ---------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith("db.js")) {
  initSchema();
  if (process.argv.includes("--seed")) {
    seed();
    console.log("BD inicializada y seed aplicado en", DB_PATH);
  } else {
    console.log("Schema inicializado en", DB_PATH);
  }
}
