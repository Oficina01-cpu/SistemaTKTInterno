// ============================================================================
// buzzbox.js — Librería propia de UI para ULTRA (toasts, modales, confirms,
// prompts, loaders, progress bars). NINGÚN modal del navegador: todo propio.
// Sin dependencias externas. Compatible con temas DaisyUI ultralight/ultradark.
// ============================================================================
(function (global) {
  "use strict";

  const COLORS = {
    success: "#22C55E",
    error: "#E30613",
    warning: "#F59E0B",
    info: "#3ABFF8",
    ultra: "#E30613",
  };

  // Inyecta estilos una sola vez
  function ensureStyles() {
    if (document.getElementById("buzzbox-styles")) return;
    const css = `
    .bb-toast-wrap{position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:10px;max-width:360px}
    .bb-toast{display:flex;align-items:flex-start;gap:10px;background:var(--bb-bg,#1A1A1A);color:#fff;
      border-left:5px solid #E30613;border-radius:12px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.35);
      font-family:Arial,Helvetica,sans-serif;animation:bbIn .25s ease;opacity:.98}
    .bb-toast .bb-ic{font-size:18px;line-height:1.2}
    .bb-toast .bb-tx{flex:1;font-size:14px}
    .bb-toast .bb-tt{font-weight:800;font-family:"Arial Black",Arial,sans-serif;margin-bottom:2px}
    .bb-toast .bb-cl{cursor:pointer;opacity:.6;font-weight:700}
    .bb-toast .bb-cl:hover{opacity:1}
    @keyframes bbIn{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:.98}}

    .bb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998;display:flex;align-items:center;
      justify-content:center;backdrop-filter:blur(2px);animation:bbFade .2s ease}
    @keyframes bbFade{from{opacity:0}to{opacity:1}}
    .bb-modal{background:var(--bb-mbg,#fff);color:var(--bb-mfg,#1A1A1A);border-radius:16px;min-width:320px;max-width:92vw;
      width:440px;box-shadow:0 20px 60px rgba(0,0,0,.4);overflow:hidden;font-family:Arial,Helvetica,sans-serif;
      animation:bbPop .2s ease}
    @keyframes bbPop{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
    .bb-modal .bb-hd{display:flex;align-items:center;gap:8px;padding:16px 18px;border-bottom:1px solid rgba(154,154,154,.25)}
    .bb-modal .bb-hd img{width:34px;height:34px;border-radius:9999px}
    .bb-modal .bb-hd .bb-ti{font-family:"Arial Black",Arial,sans-serif;font-weight:900;font-size:16px}
    .bb-modal .bb-bd{padding:18px;font-size:14px;line-height:1.5}
    .bb-modal .bb-ft{padding:14px 18px;display:flex;justify-content:flex-end;gap:10px;background:rgba(154,154,154,.08)}
    .bb-btn{border:none;border-radius:10px;padding:9px 16px;font-weight:700;cursor:pointer;font-size:14px}
    .bb-btn-primary{background:#E30613;color:#fff}
    .bb-btn-primary:hover{background:#c00510}
    .bb-btn-ghost{background:transparent;color:inherit;border:1px solid rgba(154,154,154,.5)}
    .bb-input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid rgba(154,154,154,.5);
      background:transparent;color:inherit;font-size:14px;margin-top:8px}
    .bb-loader{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;
      justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(2px)}
    .bb-spinner{width:64px;height:64px;border-radius:9999px;border:6px solid rgba(255,255,255,.2);border-top-color:#E30613;
      animation:bbSpin .8s linear infinite}
    @keyframes bbSpin{to{transform:rotate(360deg)}}
    .bb-loader .bb-lt{color:#fff;margin-top:14px;font-family:"Arial Black",Arial,sans-serif;letter-spacing:1px}
    .bb-progress{width:280px;height:8px;border-radius:9999px;background:rgba(255,255,255,.2);margin-top:14px;overflow:hidden}
    .bb-progress>span{display:block;height:100%;width:0;background:#E30613;transition:width .2s ease}
    `;
    const s = document.createElement("style");
    s.id = "buzzbox-styles";
    s.textContent = css;
    document.head.appendChild(s);

    // Ajusta colores segun tema
    syncTheme();
  }

  function syncTheme() {
    const dark = document.documentElement.getAttribute("data-theme") === "ultradark";
    document.documentElement.style.setProperty("--bb-bg", dark ? "#1A1A1A" : "#1A1A1A");
    document.documentElement.style.setProperty("--bb-mbg", dark ? "#1A1A1A" : "#FFFFFF");
    document.documentElement.style.setProperty("--bb-mfg", dark ? "#F3F3F3" : "#1A1A1A");
  }

  function wrap() {
    ensureStyles();
    let w = document.querySelector(".bb-toast-wrap");
    if (!w) {
      w = document.createElement("div");
      w.className = "bb-toast-wrap";
      document.body.appendChild(w);
    }
    return w;
  }

  const ICONS = { success: "✅", error: "⛔", warning: "⚠️", info: "ℹ️", ultra: "🎫" };

  const BuzzBox = {
    // -------- TOAST --------
    toast(msg, opts = {}) {
      ensureStyles();
      const type = opts.type || "info";
      const t = document.createElement("div");
      t.className = "bb-toast";
      t.style.borderLeftColor = COLORS[type] || COLORS.info;
      t.innerHTML = `
        <div class="bb-ic">${opts.icon || ICONS[type] || "ℹ️"}</div>
        <div class="bb-tx">
          ${opts.title ? `<div class="bb-tt">${opts.title}</div>` : ""}
          <div>${msg}</div>
        </div>
        <div class="bb-cl">✕</div>`;
      const close = () => { t.style.opacity = "0"; setTimeout(() => t.remove(), 200); };
      t.querySelector(".bb-cl").onclick = close;
      wrap().appendChild(t);
      if (opts.duration !== 0) setTimeout(close, opts.duration || 4500);
      return t;
    },
    success(m, o = {}) { return this.toast(m, { ...o, type: "success", title: o.title || "Listo" }); },
    error(m, o = {}) { return this.toast(m, { ...o, type: "error", title: o.title || "Error" }); },
    warning(m, o = {}) { return this.toast(m, { ...o, type: "warning", title: o.title || "Atención" }); },
    info(m, o = {}) { return this.toast(m, { ...o, type: "info", title: o.title || "Aviso" }); },

    // -------- MODAL genérico (propio, no del navegador) --------
    modal({ title = "ULTRA", bodyHTML = "", buttons = [], closable = true, logo = true } = {}) {
      ensureStyles();
      return new Promise((resolve) => {
        const ov = document.createElement("div");
        ov.className = "bb-overlay";
        const m = document.createElement("div");
        m.className = "bb-modal";
        m.innerHTML = `
          <div class="bb-hd">${logo ? `<img src="/assets/logo.png" alt="ULTRA"/>` : ""}<div class="bb-ti">${title}</div></div>
          <div class="bb-bd">${bodyHTML}</div>
          <div class="bb-ft"></div>`;
        const ft = m.querySelector(".bb-ft");
        const done = (val) => { ov.remove(); resolve(val); };
        buttons.forEach((b) => {
          const btn = document.createElement("button");
          btn.className = "bb-btn " + (b.primary ? "bb-btn-primary" : "bb-btn-ghost");
          btn.textContent = b.text;
          btn.onclick = () => {
            if (b.onClick) {
              const r = b.onClick(m);
              if (r === false) return; // validacion fallida: no cerrar
            }
            done(b.value);
          };
          ft.appendChild(btn);
        });
        if (closable) ov.addEventListener("click", (e) => { if (e.target === ov) done(null); });
        ov.appendChild(m);
        document.body.appendChild(ov);
        const first = m.querySelector("input,select,textarea,button");
        if (first) setTimeout(() => first.focus(), 50);
      });
    },

    // -------- CONFIRM --------
    confirm(mensaje, { title = "Confirmar", okText = "Aceptar", cancelText = "Cancelar" } = {}) {
      return this.modal({
        title,
        bodyHTML: `<div>${mensaje}</div>`,
        buttons: [
          { text: cancelText, value: false },
          { text: okText, value: true, primary: true },
        ],
      });
    },

    // -------- ALERT --------
    alert(mensaje, { title = "ULTRA", okText = "Entendido" } = {}) {
      return this.modal({
        title,
        bodyHTML: `<div>${mensaje}</div>`,
        buttons: [{ text: okText, value: true, primary: true }],
      });
    },

    // -------- PROMPT --------
    prompt(mensaje, { title = "ULTRA", placeholder = "", type = "text", okText = "Aceptar", cancelText = "Cancelar" } = {}) {
      return this.modal({
        title,
        bodyHTML: `<div>${mensaje}</div><input class="bb-input" id="bb-prompt-input" type="${type}" placeholder="${placeholder}"/>`,
        buttons: [
          { text: cancelText, value: null },
          { text: okText, primary: true, value: undefined,
            onClick: (m) => { m.dataset.val = m.querySelector("#bb-prompt-input").value; } },
        ],
      }).then((v) => {
        if (v === null) return null;
        return document.querySelector("#bb-prompt-input")?.value ?? null;
      });
    },

    // -------- LOADER --------
    _loader: null,
    loader(text = "Procesando...") {
      ensureStyles();
      if (this._loader) return this._loader;
      const l = document.createElement("div");
      l.className = "bb-loader";
      l.innerHTML = `<div class="bb-spinner"></div><div class="bb-lt">${text}</div>`;
      document.body.appendChild(l);
      this._loader = l;
      return l;
    },
    hideLoader() { if (this._loader) { this._loader.remove(); this._loader = null; } },

    // -------- PROGRESS --------
    progress(text = "Cargando...") {
      ensureStyles();
      const l = document.createElement("div");
      l.className = "bb-loader";
      l.innerHTML = `<div class="bb-lt">${text}</div><div class="bb-progress"><span></span></div>`;
      document.body.appendChild(l);
      const bar = l.querySelector(".bb-progress > span");
      return {
        set(pct) { bar.style.width = Math.max(0, Math.min(100, pct)) + "%"; },
        close() { l.remove(); },
      };
    },

    syncTheme,
  };

  global.BuzzBox = BuzzBox;
})(window);
