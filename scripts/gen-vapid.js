// Genera claves VAPID para Web Push y las imprime.
// El servidor las genera automaticamente la primera vez y las guarda en la BD (tabla config),
// pero este script permite generarlas manualmente si se desea.
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("VAPID_PUBLIC_KEY =", keys.publicKey);
console.log("VAPID_PRIVATE_KEY=", keys.privateKey);
console.log("\nEstas claves se guardan automaticamente en la tabla 'config' de la BD al primer arranque.");
