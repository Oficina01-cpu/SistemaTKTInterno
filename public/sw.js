// ============================================================================
// sw.js — Service Worker: Web Push (navegador cerrado) + cache-busting
// ============================================================================
const SW_VERSION = "ultra-tickets-v1";

self.addEventListener("install", (event) => {
  // Activar de inmediato (no esperar a que cierren pestañas)
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Purgar cachés viejos
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// No cacheamos HTML/API: siempre red (evita datos viejos). Passthrough.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api") || url.pathname.endsWith(".html") || url.pathname === "/") {
    event.respondWith(fetch(event.request).catch(() => new Response("", { status: 503 })));
  }
});

// ---- Recepción de Web Push ----
self.addEventListener("push", (event) => {
  let data = { title: "ULTRA", body: "Nueva notificación" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    if (event.data) data.body = event.data.text();
  }
  const options = {
    body: data.body,
    icon: "/assets/logo.png",
    badge: "/assets/logo.png",
    tag: data.folio || "ultra-ticket",
    data: { url: data.url || "/dashboard.html" },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(data.title || "ULTRA", options));
});

// ---- Click en la notificación → abrir/enfocar el dashboard ----
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard.html";
  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (c.url.includes(target) && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })()
  );
});
