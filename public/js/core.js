/* Core helpers: safe templating, API, icons, router, modals. */
"use strict";
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const raw = s => new Safe(s);
const rend = v => v instanceof Safe ? v.s : Array.isArray(v) ? v.map(rend).join("") : (v == null || v === false) ? "" : esc(v);
const html = (st, ...vals) => new Safe(st.reduce((o, s, i) => o + s + (i < vals.length ? rend(vals[i]) : ""), ""));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- icons (24px stroke set) ---------- */
const ICONS = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  book: '<path d="M2 5.5c3.2-1.6 6.3-1.4 10 1 3.7-2.4 6.8-2.6 10-1v14c-3.2-1.6-6.3-1.4-10 1-3.7-2.4-6.8-2.6-10-1z"/><path d="M12 6.5v14"/>',
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5z"/>',
  scale: '<path d="M12 3v18M8 21h8M4 7h16"/><path d="M4 7l-2.6 7.2a3.6 3.6 0 0 0 5.2 0z"/><path d="M20 7l-2.6 7.2a3.6 3.6 0 0 0 5.2 0z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5"/>',
  users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M21 20v-1.5a4 4 0 0 0-3-3.9M15.5 4.2a3.5 3.5 0 0 1 0 6.6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21"/>',
  cross: '<path d="M12 2.5v19M6.5 8h11"/>',
  psi: '<path d="M12 3v18M4.5 4c0 7 2.4 10.5 7.5 10.5S19.5 11 19.5 4"/>',
  rings: '<circle cx="8.8" cy="12" r="5.2"/><circle cx="15.2" cy="12" r="5.2"/>',
  leaf: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15"/><path d="M5 19c3-5 6-8 11-10"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/><path d="M9 9h1.5M13.5 9H15M9 14h1.5M13.5 14H15"/>',
  infinity: '<path d="M12 12c-2-3-4-5-6.2-5a5 5 0 0 0 0 10c2.2 0 4.2-2 6.2-5zm0 0c2 3 4 5 6.2 5a5 5 0 0 0 0-10c-2.2 0-4.2 2-6.2 5z"/>',
  columns: '<path d="M3 9l9-5.5L21 9z"/><path d="M5.5 11.5v7M10 11.5v7M14 11.5v7M18.5 11.5v7M3 21h18"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z"/>',
  scroll: '<path d="M6 3h12v15a3 3 0 0 0 3 3H8a3 3 0 0 1-3-3v-2h3"/><path d="M6 3a2 2 0 0 0-2 2v3h4M10 8h6M10 12h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  bookmark: '<path d="M6 3h12v18l-6-4.2L6 21z"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  bulb: '<path d="M9.5 17.5h5M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.8.7 1.3 1.6 1.3 2.9h5c0-1.3.5-2.2 1.3-2.9A6 6 0 0 0 12 3z"/>',
  sparkle: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
  right: '<path d="M9 5.5l6.5 6.5L9 18.5"/>', left: '<path d="M15 5.5L8.5 12l6.5 6.5"/>', down: '<path d="M5.5 9l6.5 6.5L18.5 9"/>', up: '<path d="M5.5 15L12 8.5 18.5 15"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12.5l4.5 4.5L19.5 7"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  quote: '<path d="M4 17V11a5 5 0 0 1 5-5M13 17V11a5 5 0 0 1 5-5M4 12h5v5H4zM13 12h5v5h-5z"/>',
  pencil: '<path d="M4 20l4-1 11-11a2.8 2.8 0 0 0-4-4L4 15z"/>',
  marker: '<path d="M9 11l6 6M4 20l5-1 8.5-8.5-4-4L5 15z"/><path d="M14 5.5l4.5 4.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  reply: '<path d="M9.5 8L4 12.5 9.5 17M4 12.5h9a7 7 0 0 1 7 7"/>',
  logout: '<path d="M9 4H5v16h4M15.5 8L20 12l-4.5 4M20 12H9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  type: '<path d="M4 19l5-14 5 14M6 14h6M16 19l3-8 3 8M17 17h4"/>',
  focus: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
};
const icon = (n, cls = "") => raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`);
const hydrateIcons = (root = document) => $$("[data-icon]", root).forEach(e => { e.innerHTML = icon(e.dataset.icon).s; e.removeAttribute("data-icon"); });

/* ---------- state & API ---------- */
const S = { user: null, config: { labels: {} }, unread: 0, books: [], translations: [], cats: [] };
class ApiError extends Error { constructor(m, status) { super(m); this.status = status; } }
async function api(path, { method = "GET", body } = {}) {
  let res;
  try { res = await fetch("/api" + path, { method, headers: { "X-Requested-With": "psyche", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" }); }
  catch { throw new ApiError("You appear to be offline. Check your connection and try again.", 0); }
  let data = {}; try { data = await res.json(); } catch { }
  if (!res.ok) throw new ApiError(data.error || "Something went wrong.", res.status);
  return data;
}
const qs = o => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => { if (v !== "" && v != null && v !== false) p.set(k, v); }); const s = p.toString(); return s ? "?" + s : ""; };

/* ---------- formatting ---------- */
function ago(ts) {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m ago"; if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 86400 * 30) return Math.floor(s / 86400) + "d ago";
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
const dateStr = ts => new Date(ts * 1000).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
const num = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n);
const bookBySlug = s => S.books.find(b => b.slug === s);
const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

function avatar(u, size = 36) {
  if (u && u.avatar) return html`<img class="avatar" src="${u.avatar}" width="${size}" height="${size}" alt="">`;
  const name = (u && (u.name || u.username)) || "?"; const ini = name.replace(/^(Dr\.|Mr\.|Mrs\.)\s*/, "").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const h = hue((u && u.username) || name);
  return html`<span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .38)}px;background:linear-gradient(135deg,hsl(${h} 38% 38%),hsl(${(h + 40) % 360} 34% 24%))" aria-hidden="true">${ini}</span>`;
}

/* ---------- rich text: paragraphs, ## headings, **bold**, auto-linked Bible references ---------- */
let REF_RX = null;
function refRx() {
  if (!REF_RX && S.books.length) {
    const names = S.books.map(b => b.name).sort((a, b) => b.length - a.length).map(n => n.replace(/ /g, "\\s"));
    REF_RX = new RegExp("\\b(" + names.join("|") + ")\\s(\\d{1,3})(?::(\\d{1,3})(?:[-–](\\d{1,3}))?)?\\b", "g");
  }
  return REF_RX;
}
function linkRefs(s) {
  const rx = refRx(); if (!rx) return s;
  return s.replace(rx, (m, name, ch, v) => {
    const b = S.books.find(x => x.name === name.replace(/\s/g, " ")); if (!b || +ch > b.chapters) return m;
    return `<a class="ref" href="#/bible/${b.slug}/${ch}${v ? "?v=" + v : ""}">${m}</a>`;
  });
}
function inline(t) { return linkRefs(esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s).,;:]|$)/g, "$1<em>$2</em>")); }
function rich(text) {
  return raw(String(text || "").split(/\n\n+/).map(p => {
    p = p.trim(); if (!p) return "";
    if (p.startsWith("## ")) { const [h, ...rest] = p.slice(3).split("\n"); return `<h3>${inline(h)}</h3>` + (rest.length ? `<p>${inline(rest.join("\n")).replace(/\n/g, "<br>")}</p>` : ""); }
    return `<p>${inline(p).replace(/\n/g, "<br>")}</p>`;
  }).join(""));
}

/* ---------- toasts & modals ---------- */
function toast(msg, kind = "") {
  const t = document.createElement("div"); t.className = "toast " + kind; t.textContent = msg; $("#toasts").append(t);
  setTimeout(() => t.classList.add("out"), 3200); setTimeout(() => t.remove(), 3700);
}
let lastFocus = null;
function openModal(content, { wide = false, onclose } = {}) {
  closeModal(); lastFocus = document.activeElement;
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-back" data-act="close-modal"><div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${rend(content)}</div></div>`;
  root._onclose = onclose; hydrateIcons(root);
  const first = $("input,textarea,select,button.primary", root); if (first) setTimeout(() => first.focus(), 30);
}
function closeModal() { const r = $("#modal-root"); if (r.innerHTML) { r.innerHTML = ""; if (r._onclose) r._onclose(); r._onclose = null; if (lastFocus) lastFocus.focus?.(); } }
function confirmBox(title, text, okLabel = "Delete") {
  return new Promise(res => {
    openModal(html`<h2>${title}</h2><p class="muted">${text}</p><div class="row end gap"><button class="btn" data-act="close-modal">Cancel</button><button class="btn danger" id="conf-ok">${okLabel}</button></div>`, { onclose: () => res(false) });
    $("#conf-ok").onclick = () => { $("#modal-root")._onclose = null; closeModal(); res(true); };
  });
}

/* ---------- actions (delegated events) ---------- */
const ACT = {}, FORM = {};
async function run(fn) {
  try { return await fn(); }
  catch (e) { if (e.status === 401) openAuth(); else toast(e.message || "Something went wrong.", "err"); }
}
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const name = el.dataset.act;
  if (name === "close-modal") { if (e.target === el || el.tagName === "BUTTON") { e.preventDefault(); closeModal(); } return; }
  if (ACT[name]) { if (el.tagName !== "A") e.preventDefault(); run(() => ACT[name](el, e)); }
});
document.addEventListener("submit", e => {
  const f = e.target.closest("[data-form]"); if (!f || !FORM[f.dataset.form]) return;
  e.preventDefault(); run(() => FORM[f.dataset.form](f, Object.fromEntries(new FormData(f))));
});
const CHG = {};
document.addEventListener("change", e => { const el = e.target.closest("[data-chg]"); if (el && CHG[el.dataset.chg]) run(() => CHG[el.dataset.chg](el, e)); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { if ($("#modal-root").innerHTML) closeModal(); else document.body.classList.remove("menu-open"); } });

/* ---------- router ---------- */
const ROUTES = [];
const page = (pattern, fn) => ROUTES.push([new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "/?$"), fn, (pattern.match(/:/g) || []).length]);
let navToken = 0;
async function route() {
  const token = ++navToken;
  const hash = location.hash.replace(/^#/, "") || "/"; const [path, query = ""] = hash.split("?");
  const q = Object.fromEntries(new URLSearchParams(query));
  document.body.classList.remove("menu-open"); document.body.classList.toggle("on-home", path === "/");
  let out = null;
  let best = 99;                                                     // the most specific route (fewest :params) wins
  for (const [rx, fn, n] of ROUTES) { const m = path.match(rx); if (m && n < best) { best = n; out = { fn, params: { ...m.groups } }; } }
  closeModal(); document.body.classList.remove("reading");
  const view = $("#view");
  if (!out) { view.innerHTML = '<div class="empty big"><h1>Page not found</h1><p>That page does not exist. <a href="#/">Return home</a>.</p></div>'; return; }
  view.classList.add("loading");
  let res;
  try { res = await out.fn(out.params, q); }
  catch (e) { if (token !== navToken) return; view.classList.remove("loading"); view.innerHTML = `<div class="empty big"><h1>${esc(e.status === 404 ? "Not found" : "Something went wrong")}</h1><p>${esc(e.message)}</p><p><a class="btn" href="#/">Return home</a></p></div>`; setNav(path); return; }
  if (token !== navToken) return;
  view.classList.remove("loading");
  view.innerHTML = rend(res.html); hydrateIcons(view);
  setNav(path); updateSelBar && updateSelBar(true);
  if (keepOnce) { window.scrollTo(0, savedY); keepOnce = false; } else if (!res.keepScroll) window.scrollTo(0, 0);
  if (res.mount) res.mount(view);
  document.title = (res.title ? res.title + " · " : "") + "Psyche & Soul";
}
let keepOnce = false, savedY = 0;
const rerender = () => { keepOnce = true; savedY = window.scrollY; return route(); };
window.addEventListener("hashchange", route);
const go = h => { if (location.hash === h) route(); else location.hash = h; };
let updateSelBar = null;

/* ---------- shared UI pieces ---------- */
const labelBadge = l => html`<span class="label l-${l}" title="${S.config.labels[l] || l}">${S.config.labels[l] || l}</span>`;
const typeNames = { article: "Article", essay: "Essay", research: "Study guide", biblical: "Biblical studies", apologetics: "Apologetics", book: "Recommended book" };
const catIcon = slug => (S.cats.find(c => c.slug === slug) || {}).icon || "chat";
const catName = slug => (S.cats.find(c => c.slug === slug) || {}).name || slug;
function authorLink(a) { return html`<a class="who" href="#/u/${a.username}">${avatar(a, 22)}<span>${a.name}</span></a>`; }
function legend() {
  return html`<details class="legend"><summary>${icon("info")} How we label contributions</summary>
    <p>Psyche &amp; Soul keeps different kinds of claims distinct. A post can be labelled as <b>Classical source</b> (what a text or thinker actually says), <b>Philosophical theory</b> (a framework that goes beyond the texts), a <b>Theological position</b>, a <b>Philosophical argument</b>, or <b>Open discussion</b>. What a philosopher argued is not the same as what the church teaches, and a theological claim is not a philosophical proof.</p></details>`;
}
const emptyState = (t, s = "") => html`<div class="empty"><p><b>${t}</b></p>${s ? html`<p class="muted">${s}</p>` : ""}</div>`;
function requireLogin(title = "Sign in to continue") {
  return html`<div class="empty big"><h1>${title}</h1><p class="muted">Your reading, notes, highlights and discussions are saved to your account.</p><p><button class="btn primary" data-act="auth">Sign in or create an account</button></p></div>`;
}

/* ---------- auth ---------- */
function openAuth(mode = "login") {
  openModal(html`<div class="auth-head"><img class="auth-logo" src="/img/logo.png" height="56" alt=""><h2>${mode === "login" ? "Welcome back" : "Join Psyche & Soul"}</h2></div>
    <div class="tabs small" role="tablist"><button class="tab ${mode === "login" ? "on" : ""}" data-act="auth" data-mode="login">Sign in</button><button class="tab ${mode === "register" ? "on" : ""}" data-act="auth" data-mode="register">Create account</button></div>
    ${mode === "login" ? html`
    <form data-form="login" class="form"><label>Username or email<input name="username" autocomplete="username" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      <p class="form-err" id="auth-err" role="alert"></p><button class="btn primary wide" type="submit">Sign in</button></form>
    ${S.config.demo ? html`<div class="demo-box"><span>Just exploring?</span> <button class="link" data-act="demo-login">Use the demo account</button></div>` : ""}` : html`
    <form data-form="register" class="form"><label>Display name<input name="name" autocomplete="name" maxlength="60"></label>
      <label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+"><small>Letters, numbers, underscores.</small></label>
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8"><small>At least 8 characters.</small></label>
      <p class="form-err" id="auth-err" role="alert"></p><button class="btn primary wide" type="submit">Create account</button></form>`}`);
}
async function afterAuth() { closeModal(); await loadMe(); toast("Signed in", "ok"); route(); }
ACT.auth = el => openAuth(el.dataset.mode || "login");
ACT["demo-login"] = async () => { await api("/login", { method: "POST", body: { username: "demo", password: "PsycheDemo1!" } }); await afterAuth(); };
FORM.login = async (f, d) => { try { await api("/login", { method: "POST", body: d }); await afterAuth(); } catch (e) { $("#auth-err").textContent = e.message; } };
FORM.register = async (f, d) => { try { await api("/register", { method: "POST", body: d }); await afterAuth(); } catch (e) { $("#auth-err").textContent = e.message; } };
ACT.logout = async () => { await api("/logout", { method: "POST" }); try { await caches.delete("ps-api"); } catch { } await loadMe(); toast("Signed out"); go("#/"); };

async function loadMe() {
  const d = await api("/me"); S.user = d.user; S.config = d.config; S.unread = d.unread || 0; renderChrome();
}
