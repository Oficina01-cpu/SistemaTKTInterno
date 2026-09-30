// ============================================================================
// app.js — Lógica del dashboard: tickets, tiempo real, config, tema, sesión
// ============================================================================
(function () {
  "use strict";

  const token = localStorage.getItem("ultra_token");
  if (!token) { location.replace("/index.html"); return; }

  let USER = JSON.parse(localStorage.getItem("ultra_user") || "{}");
  let IDLE_MIN = 20;
  let deptosCache = [];
  let socket = null;
  let idleTimer = null;

  const authHeaders = () => ({ Authorization: "Bearer " + token });
  const jsonHeaders = () => ({ ...authHeaders(), "Content-Type": "application/json" });

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { ...(opts.headers || {}), ...authHeaders() },
      cache: "no-store",
    });
    if (res.status === 401) { cerrarSesion(true); throw new Error("401"); }
    return res.json();
  }

  // ---- Tema (usa temas estandar de DaisyUI: dark / light) ----
  const THEME_KEY = "ultra_theme";
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    const icon = document.getElementById("themeIcon");
    if (icon) icon.textContent = t === "dark" ? "🌙" : "☀️";
    const bw = document.getElementById("brandWord");
    if (bw) bw.style.color = t === "dark" ? "#FFFFFF" : "#1A1A1A";
    if (window.BuzzBox) BuzzBox.syncTheme();
    localStorage.setItem(THEME_KEY, t);
  }
  // Migra valores viejos (ultradark/ultralight) a dark/light
  let _saved = localStorage.getItem(THEME_KEY);
  if (_saved === "ultradark") _saved = "dark";
  if (_saved === "ultralight") _saved = "light";
  applyTheme(_saved || "dark");
  document.getElementById("themeToggle").onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "dark" ? "light" : "dark");
  };

  // ---- Cierre de sesión ----
  async function cerrarSesion(expirado) {
    try { await fetch("/api/auth/logout", { method: "POST", headers: authHeaders() }); } catch {}
    localStorage.removeItem("ultra_token");
    localStorage.removeItem("ultra_user");
    if (socket) socket.disconnect();
    if (expirado) {
      await BuzzBox.alert("Tu sesión se cerró por inactividad. Vuelve a ingresar.", { title: "Sesión expirada" });
    }
    location.replace("/index.html");
  }
  document.getElementById("btnLogout").onclick = async () => {
    if (await BuzzBox.confirm("¿Deseas cerrar tu sesión?", { title: "Salir" })) cerrarSesion(false);
  };

  // ---- Inactividad (cliente): reinicia contador con actividad ----
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => cerrarSesion(true), IDLE_MIN * 60 * 1000);
  }
  ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, throttle(() => { resetIdle(); pingServidor(); }, 30000))
  );
  function throttle(fn, ms) { let last = 0; return (...a) => { const n = Date.now(); if (n - last > ms) { last = n; fn(...a); } }; }
  async function pingServidor() { try { await fetch("/api/auth/ping", { method: "POST", headers: authHeaders() }); } catch {} }

  // ---- Bienvenida ----
  async function cargarSesion() {
    const data = await api("/api/auth/me");
    if (!data.ok) return;
    USER = data.usuario;
    IDLE_MIN = data.idle_minutes || 20;
    localStorage.setItem("ultra_user", JSON.stringify(USER));
    const f = new Date(data.servidor_fecha);
    const fecha = f.toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" });
    document.getElementById("welcome").innerHTML =
      `<b>${USER.nombre || USER.correo}</b><br><span class="opacity-60">${fecha}</span>`;

    // Mostrar tabs de master
    if (USER.rol === "master") {
      document.getElementById("tabBuscar").classList.remove("hidden");
      document.getElementById("tabConfig").classList.remove("hidden");
    }
    resetIdle();
  }

  // ---- Tabs ----
  document.querySelectorAll("[data-tab]").forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll("[data-tab]").forEach((x) => x.classList.remove("tab-active"));
      t.classList.add("tab-active");
      const tab = t.dataset.tab;
      document.querySelectorAll("[data-panel]").forEach((p) =>
        p.classList.toggle("hidden", p.dataset.panel !== tab)
      );
      if (tab === "mios") cargarMios();
      if (tab === "depto") cargarDepto();
      if (tab === "config") { cargarUsuarios(); cargarDeptosConfig(); }
    };
  });

  // ---- Departamentos + acordeón ----
  async function cargarDepartamentos() {
    const data = await api("/api/departamentos");
    deptosCache = data.departamentos || [];
    const cont = document.getElementById("acordeonDeptos");
    cont.innerHTML = deptosCache.map((d) => `
      <div class="collapse collapse-arrow join-item border border-base-300">
        <input type="checkbox" name="acc" />
        <div class="collapse-title font-medium flex items-center gap-2">
          <input type="checkbox" class="checkbox checkbox-sm dest-chk" value="${d.id}" onclick="event.stopPropagation()" />
          ${d.nombre}
        </div>
        <div class="collapse-content text-sm opacity-70">
          Marca la casilla para incluir a <b>${d.nombre}</b> como destino del ticket.
        </div>
      </div>`).join("");

    // Selects que usan departamentos
    const selBuscar = document.getElementById("buscarDepto");
    const selNu = document.getElementById("nu_dep");
    if (selBuscar) selBuscar.innerHTML = `<option value="">Todos</option>` + deptosCache.map((d) => `<option value="${d.id}">${d.nombre}</option>`).join("");
    if (selNu) selNu.innerHTML = `<option value="">Sin departamento</option>` + deptosCache.map((d) => `<option value="${d.id}">${d.nombre}</option>`).join("");
  }

  // ---- Crear ticket ----
  document.getElementById("ticketForm").onsubmit = async (e) => {
    e.preventDefault();
    const destinos = [...document.querySelectorAll(".dest-chk:checked")].map((c) => Number(c.value));
    if (destinos.length === 0) return BuzzBox.warning("Selecciona al menos un departamento destino");

    const fd = new FormData();
    fd.append("asunto", document.getElementById("asunto").value.trim());
    fd.append("descripcion", document.getElementById("descripcion").value.trim());
    fd.append("prioridad", document.getElementById("prioridad").value);
    fd.append("destinos", JSON.stringify(destinos));
    const file = document.getElementById("adjunto").files[0];
    if (file) fd.append("adjunto", file);

    BuzzBox.loader("Creando ticket...");
    try {
      const res = await fetch("/api/tickets", { method: "POST", headers: authHeaders(), body: fd });
      const data = await res.json();
      BuzzBox.hideLoader();
      if (!data.ok) return BuzzBox.error(data.error || "No se pudo crear el ticket");
      BuzzBox.success(`Ticket ${data.ticket.folio} creado`);
      e.target.reset();
      document.querySelectorAll(".dest-chk").forEach((c) => (c.checked = false));
      limpiarAdjunto();
    } catch {
      BuzzBox.hideLoader();
      BuzzBox.error("Error al crear el ticket");
    }
  };

  // ---- Selector de adjunto en espanol (evita el "Choose file" del navegador) ----
  const inputAdjunto = document.getElementById("adjunto");
  const btnAdjunto = document.getElementById("btnAdjunto");
  const adjuntoNombre = document.getElementById("adjuntoNombre");
  const btnAdjuntoQuitar = document.getElementById("btnAdjuntoQuitar");
  function limpiarAdjunto() {
    if (inputAdjunto) inputAdjunto.value = "";
    if (adjuntoNombre) adjuntoNombre.textContent = "Ningún archivo seleccionado";
    if (btnAdjuntoQuitar) btnAdjuntoQuitar.classList.add("hidden");
  }
  if (btnAdjunto) btnAdjunto.onclick = () => inputAdjunto.click();
  if (inputAdjunto) inputAdjunto.onchange = () => {
    const f = inputAdjunto.files[0];
    if (f) {
      adjuntoNombre.textContent = f.name;
      btnAdjuntoQuitar.classList.remove("hidden");
    } else {
      limpiarAdjunto();
    }
  };
  if (btnAdjuntoQuitar) btnAdjuntoQuitar.onclick = limpiarAdjunto;

  // ---- Render de tarjeta de ticket ----
  function ticketCard(t) {
    const prio = { alta: "prio-alta", media: "prio-media", baja: "prio-baja" }[t.prioridad] || "";
    const estados = { abierto: "badge-error", en_proceso: "badge-warning", cerrado: "badge-success" };
    return `
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <div class="flex justify-between items-start gap-2">
            <div>
              <div class="font-mono text-xs opacity-60">${t.folio}</div>
              <h3 class="font-bold text-base">${escapeHtml(t.asunto)}</h3>
            </div>
            <span class="badge ${estados[t.estado] || "badge-ghost"}">${t.estado}</span>
          </div>
          <p class="text-sm opacity-80">${escapeHtml(t.descripcion)}</p>
          <div class="text-xs opacity-70 flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <span>🕒 ${t.creado_en}</span>
            <span class="${prio}">Prioridad: ${t.prioridad}</span>
            <span>👤 ${escapeHtml(t.autor_nombre)}</span>
            <span>🏢 ${t.destinos.map((d) => escapeHtml(d.nombre)).join(", ")}</span>
            ${t.adjunto ? `<a class="link" href="/uploads/${t.adjunto}" target="_blank">📎 Adjunto</a>` : ""}
          </div>
          <div class="flex gap-2 mt-2">
            ${["abierto", "en_proceso", "cerrado"].map((es) =>
              `<button class="btn btn-xs ${es === t.estado ? "btn-active" : "btn-ghost"}" onclick="window.__cambiarEstado(${t.id},'${es}')">${es}</button>`
            ).join("")}
          </div>
        </div>
      </div>`;
  }

  window.__cambiarEstado = async (id, estado) => {
    const data = await api(`/api/tickets/${id}/estado`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify({ estado }) });
    if (data.ok) { BuzzBox.success("Estado actualizado"); refrescarActivo(); }
    else BuzzBox.error(data.error || "No se pudo actualizar");
  };

  function refrescarActivo() {
    const activo = document.querySelector("[data-tab].tab-active")?.dataset.tab;
    if (activo === "mios") cargarMios();
    if (activo === "depto") cargarDepto();
  }

  async function cargarMios() {
    const data = await api("/api/tickets/mios");
    const cont = document.getElementById("listaMios");
    cont.innerHTML = (data.tickets || []).length
      ? data.tickets.map(ticketCard).join("")
      : `<div class="opacity-60 text-center py-8">No has creado tickets todavía.</div>`;
  }

  async function cargarDepto() {
    const data = await api("/api/tickets/departamento");
    const cont = document.getElementById("listaDepto");
    cont.innerHTML = (data.tickets || []).length
      ? data.tickets.map(ticketCard).join("")
      : `<div class="opacity-60 text-center py-8">No hay tickets dirigidos a tu departamento.</div>`;
  }

  // ---- Buscador (master) ----
  const btnBuscar = document.getElementById("btnBuscar");
  if (btnBuscar) btnBuscar.onclick = async () => {
    const folio = document.getElementById("buscarFolio").value.trim();
    const dep = document.getElementById("buscarDepto").value;
    const q = new URLSearchParams();
    if (folio) q.set("folio", folio);
    else if (dep) q.set("departamento_id", dep);
    const data = await api("/api/tickets/buscar?" + q.toString());
    const cont = document.getElementById("listaBuscar");
    cont.innerHTML = (data.tickets || []).length
      ? data.tickets.map(ticketCard).join("")
      : `<div class="opacity-60 text-center py-8">Sin resultados.</div>`;
  };

  // ---- Config: subtabs ----
  document.querySelectorAll("[data-ctab]").forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll("[data-ctab]").forEach((x) => x.classList.remove("tab-active"));
      t.classList.add("tab-active");
      document.querySelectorAll("[data-cpanel]").forEach((p) =>
        p.classList.toggle("hidden", p.dataset.cpanel !== t.dataset.ctab)
      );
      if (t.dataset.ctab === "bitacora") cargarBitacora();
      if (t.dataset.ctab === "deptos") cargarDeptosConfig();
      if (t.dataset.ctab === "usuarios") cargarUsuarios();
    };
  });

  // ---- Usuarios ----
  let _usuariosCache = [];
  async function cargarUsuarios() {
    const data = await api("/api/usuarios");
    _usuariosCache = data.usuarios || [];
    const cont = document.getElementById("listaUsuarios");
    cont.innerHTML = `<table class="table table-sm">
      <thead><tr><th>ID</th><th>Correo</th><th>Nombre</th><th>Depto</th><th>Rol</th><th>Estado</th><th class="text-right">Acciones</th></tr></thead>
      <tbody>${_usuariosCache.map((u) => `
        <tr class="fila-usuario cursor-pointer hover:bg-base-300" data-uid="${u.id}">
          <td>${u.id}</td><td>${escapeHtml(u.correo)}</td><td>${escapeHtml(u.nombre || "—")}</td>
          <td>${escapeHtml(u.departamento || "—")}</td><td>${u.rol}</td>
          <td>${u.activo ? '<span class="badge badge-success">activo</span>' : '<span class="badge badge-error">baja</span>'}</td>
          <td class="text-right">
            <button class="btn btn-xs btn-error" onclick="event.stopPropagation();window.__eliminarUsuario(${u.id})">🗑 Eliminar</button>
          </td>
        </tr>`).join("")}</tbody></table>`;

    // Seleccion visual de fila al hacer clic
    cont.querySelectorAll(".fila-usuario").forEach((tr) => {
      tr.addEventListener("click", () => {
        cont.querySelectorAll(".fila-usuario").forEach((x) => {
          x.classList.remove("fila-seleccionada");
          x.style.background = "";
        });
        tr.classList.add("fila-seleccionada");
        tr.style.background = "rgba(227,6,19,.18)";
        tr.style.outline = "2px solid #E30613";
      });
    });
  }

  // ---- Eliminar usuario: modal propio -> PIN propio -> borrado completo ----
  window.__eliminarUsuario = async (id) => {
    const u = _usuariosCache.find((x) => x.id === id) || { correo: "este usuario" };
    // 1) Modal de confirmacion (propio del sistema)
    const ok = await BuzzBox.confirm(
      `¿Eliminar por completo a <b>${escapeHtml(u.correo)}</b>?<br><span style="opacity:.7">Esta acción no se puede deshacer. El usuario desaparecerá de la lista.</span>`,
      { title: "Eliminar usuario", okText: "Sí, eliminar", cancelText: "Cancelar" }
    );
    if (!ok) return;
    // 2) Pedir PIN (modal propio del sistema)
    const pin = await BuzzBox.prompt("Ingresa el PIN de administración para confirmar la eliminación:", {
      title: "PIN requerido", type: "password", placeholder: "PIN",
    });
    if (pin === null || pin === "") return;
    // 3) Ejecutar borrado
    const data = await api(`/api/usuarios/${id}?pin=${encodeURIComponent(pin)}`, { method: "DELETE" });
    if (data.ok) {
      BuzzBox.success(`Usuario ${data.eliminado || ""} eliminado. Registrado en bitácora.`);
      cargarUsuarios();
    } else {
      BuzzBox.error(data.error || "No se pudo eliminar");
    }
  };

  document.getElementById("btnAltaUsuario").onclick = async () => {
    const pin = await BuzzBox.prompt("Ingresa el PIN de administración para dar de alta:", { title: "PIN requerido", type: "password" });
    if (pin === null) return;
    const body = {
      correo: document.getElementById("nu_correo").value.trim(),
      telefono: document.getElementById("nu_tel").value.trim(),
      departamento_id: document.getElementById("nu_dep").value || null,
      rol: document.getElementById("nu_rol").value,
      pin,
    };
    const data = await api("/api/usuarios", { method: "POST", headers: jsonHeaders(), body: JSON.stringify(body) });
    if (data.ok) { BuzzBox.success("Usuario dado de alta. Clave inicial = teléfono."); cargarUsuarios(); }
    else BuzzBox.error(data.error || "No se pudo dar de alta");
  };

  // ---- Departamentos (config) ----
  async function cargarDeptosConfig() {
    const data = await api("/api/departamentos");
    const cont = document.getElementById("listaDeptos");
    cont.innerHTML = (data.departamentos || []).map((d) => `
      <div class="flex justify-between items-center bg-base-100 rounded-lg px-4 py-2 shadow">
        <span>${escapeHtml(d.nombre)}</span>
        <button class="btn btn-xs btn-error" onclick="window.__bajaDepto(${d.id})">Dar de baja</button>
      </div>`).join("");
  }
  document.getElementById("btnAltaDepto").onclick = async () => {
    const nombre = document.getElementById("nd_nombre").value.trim();
    if (!nombre) return BuzzBox.warning("Escribe el nombre del departamento");
    const data = await api("/api/departamentos", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ nombre }) });
    if (data.ok) { BuzzBox.success("Departamento agregado"); document.getElementById("nd_nombre").value = ""; cargarDeptosConfig(); cargarDepartamentos(); }
    else BuzzBox.error(data.error || "No se pudo agregar");
  };
  window.__bajaDepto = async (id) => {
    if (!(await BuzzBox.confirm("¿Dar de baja este departamento?"))) return;
    const data = await api(`/api/departamentos/${id}`, { method: "DELETE" });
    if (data.ok) { BuzzBox.success("Departamento dado de baja"); cargarDeptosConfig(); cargarDepartamentos(); }
  };

  // ---- Bitácora ----
  async function cargarBitacora() {
    const data = await api("/api/bitacora");
    const cont = document.getElementById("listaBitacora");
    cont.innerHTML = `<table class="table table-xs">
      <thead><tr><th>Fecha</th><th>Correo</th><th>Acción</th><th>Detalle</th><th>IP</th></tr></thead>
      <tbody>${(data.bitacora || []).map((b) => `
        <tr><td>${b.creado_en}</td><td>${escapeHtml(b.correo || "—")}</td><td>${b.accion}</td>
        <td>${escapeHtml(b.detalle || "")}</td><td>${b.ip || ""}</td></tr>`).join("")}</tbody></table>`;
  }

  // ---- Socket.IO ----
  function initSocket() {
    socket = io({ auth: { token }, path: "/socket.io" });
    socket.on("connect_error", (e) => console.warn("socket:", e.message));
    socket.on("ticket:nuevo", (data) => {
      BuzzBox.toast(`${data.body}`, { type: "ultra", title: "🎫 Nuevo ticket" });
      refrescarActivo();
    });
  }

  // ---- Web Push ----
  const btnPush = document.getElementById("btnPush");
  btnPush.onclick = activarPush;

  // Refleja visualmente si las notificaciones ya estan activas
  function marcarCampanita(activa) {
    if (!btnPush) return;
    btnPush.textContent = activa ? "🔔" : "🔕";
    btnPush.title = activa ? "Notificaciones activadas" : "Activar notificaciones";
    btnPush.style.color = activa ? "#22C55E" : "";
  }

  async function estadoPushInicial() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { marcarCampanita(false); return; }
      if (Notification.permission !== "granted") { marcarCampanita(false); return; }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      marcarCampanita(!!sub);
    } catch { marcarCampanita(false); }
  }

  async function activarPush() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return BuzzBox.warning("Tu navegador no soporta notificaciones push");
      }
      if (!window.isSecureContext) {
        return BuzzBox.warning("Las notificaciones requieren HTTPS. Abre el sistema por su URL segura (https://).");
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        marcarCampanita(false);
        return BuzzBox.warning("Permiso de notificaciones denegado. Actívalo en el candado del navegador.");
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const resp = await fetch("/api/push/vapid");
      const { publicKey } = await resp.json();
      if (!publicKey) return BuzzBox.error("El servidor no entregó la clave de notificaciones (VAPID).");
      // Reusar suscripcion existente si ya hay
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      await api("/api/push/subscribe", { method: "POST", headers: jsonHeaders(), body: JSON.stringify(sub) });
      marcarCampanita(true);
      BuzzBox.success("Notificaciones activadas");
    } catch (e) {
      marcarCampanita(false);
      BuzzBox.error("No se pudieron activar las notificaciones: " + (e && e.message ? e.message : "error desconocido"));
    }
  }
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  // ---- Util ----
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---- Registrar SW (para push con navegador cerrado) en silencio ----
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  // ---- Init ----
  (async function init() {
    await cargarSesion();
    await cargarDepartamentos();
    initSocket();
    estadoPushInicial();
  })();
})();
