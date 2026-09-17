// ============================================================================
// auth-client.js — Cliente del login: cache-busting, tema, login, primer ingreso
// ============================================================================
(function () {
  "use strict";

  // ---- Limpieza de caché al iniciar (evita tomar info vieja/no válida) ----
  (async function limpiarCache() {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        // Solo desregistramos SW obsoletos si cambió el build_id
        const r = await fetch("/api/version", { cache: "no-store" });
        const { build_id } = await r.json();
        const prev = localStorage.getItem("ultra_build");
        if (prev && prev !== build_id) {
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          for (const reg of regs) await reg.update();
        }
        localStorage.setItem("ultra_build", build_id);
      }
    } catch (e) {
      /* silencioso */
    }
  })();

  // ---- Tema ----
  const THEME_KEY = "ultra_theme";
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    document.getElementById("themeIcon").textContent = t === "ultradark" ? "🌙" : "☀️";
    // Palabra ULTRA blanca en dark, negra en light
    const bw = document.getElementById("brandWord");
    if (bw) bw.style.color = t === "ultradark" ? "#FFFFFF" : "#1A1A1A";
    if (window.BuzzBox) BuzzBox.syncTheme();
    localStorage.setItem(THEME_KEY, t);
  }
  applyTheme(localStorage.getItem(THEME_KEY) || "ultradark");
  document.getElementById("themeToggle").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "ultradark" ? "ultralight" : "ultradark");
  });

  // Si ya hay token válido, ir directo al dashboard
  if (localStorage.getItem("ultra_token")) {
    location.replace("/dashboard.html");
    return;
  }

  // ---- Login ----
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = document.getElementById("correo").value.trim();
    const password = document.getElementById("password").value;
    BuzzBox.loader("Verificando credenciales...");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, password }),
      });
      const data = await res.json();
      BuzzBox.hideLoader();
      if (!data.ok) return BuzzBox.error(data.error || "No se pudo iniciar sesión");

      localStorage.setItem("ultra_token", data.token);
      localStorage.setItem("ultra_user", JSON.stringify(data.usuario));

      if (data.primer_ingreso) {
        await modalPrimerIngreso(data.token);
      }
      BuzzBox.success("Bienvenido a ULTRA");
      setTimeout(() => location.replace("/dashboard.html"), 500);
    } catch (err) {
      BuzzBox.hideLoader();
      BuzzBox.error("Error de conexión con el servidor");
    }
  });

  // ---- Modal obligatorio de primer ingreso (propio del sistema) ----
  async function modalPrimerIngreso(token) {
    return new Promise((resolve) => {
      BuzzBox.modal({
        title: "Primer ingreso",
        closable: false,
        bodyHTML: `
          <p class="mb-2">Por seguridad, completa tu perfil y define una nueva contraseña.</p>
          <label class="text-sm font-bold">Nombre completo</label>
          <input class="bb-input" id="pi-nombre" placeholder="Nombre y apellidos" />
          <label class="text-sm font-bold mt-3 block">Nueva contraseña</label>
          <input class="bb-input" id="pi-pass" type="password" placeholder="Mínimo 6 caracteres" />
          <label class="text-sm font-bold mt-3 block">Confirmar contraseña</label>
          <input class="bb-input" id="pi-pass2" type="password" placeholder="Repite la contraseña" />
        `,
        buttons: [
          {
            text: "Guardar y continuar",
            primary: true,
            value: true,
            onClick: async (m) => {
              const nombre = m.querySelector("#pi-nombre").value.trim();
              const p1 = m.querySelector("#pi-pass").value;
              const p2 = m.querySelector("#pi-pass2").value;
              if (nombre.length < 3) { BuzzBox.warning("Ingresa tu nombre completo"); return false; }
              if (p1.length < 6) { BuzzBox.warning("La contraseña debe tener al menos 6 caracteres"); return false; }
              if (p1 !== p2) { BuzzBox.warning("Las contraseñas no coinciden"); return false; }
              const res = await fetch("/api/auth/primer-ingreso", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
                body: JSON.stringify({ nombre, nueva_password: p1 }),
              });
              const data = await res.json();
              if (!data.ok) { BuzzBox.error(data.error || "No se pudo guardar"); return false; }
              const u = JSON.parse(localStorage.getItem("ultra_user") || "{}");
              u.nombre = data.nombre;
              localStorage.setItem("ultra_user", JSON.stringify(u));
            },
          },
        ],
      }).then(() => resolve());
    });
  }
})();
