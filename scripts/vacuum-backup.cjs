// vacuum-backup.cjs — Respaldo consistente de la BD con node:sqlite (VACUUM INTO).
// Uso: node scripts/vacuum-backup.cjs <ruta_db> <ruta_destino>
const { DatabaseSync } = require("node:sqlite");

const dbPath = process.argv[2];
const dest = process.argv[3];
if (!dbPath || !dest) {
  console.error("Uso: node vacuum-backup.cjs <db> <destino>");
  process.exit(1);
}
const destSql = dest.replace(/\\/g, "/").replace(/'/g, "''");
const db = new DatabaseSync(dbPath);
db.exec(`VACUUM INTO '${destSql}'`);
db.close();
console.log("OK");
