/* App shell: navigation chrome, notifications, boot. */
"use strict";
const NAV = [["/", "Home", "home", "#/"], ["/bible", "Bible", "book", "#/bible"], ["/forums", "Forums", "chat", "#/forums"], ["/debates", "Debates", "scale", "#/debates"], ["/library", "Library", "layers", "#/library"], ["/study", "Study", "scroll", "#/study"], ["/groups", "Groups", "users", "#/groups"]];
function activePath() { return (location.hash.replace(/^#/, "") || "/").split("?")[0]; }
function setNav(path) {
  const key = path === "/" ? "/" : "/" + path.split("/")[1];
  const alias = { "/d": "/forums", "/topic": "/forums", "/topics": "/forums", "/u": "/profile", "/lists": "/study", "/search": "" };
  const k = alias[key] !== undefined ? alias[key] : key;
  $$("#topnav a, #sidebar a[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === k));
  $$("#sidebar a[data-topic]").forEach(a => a.classList.toggle("on", path === "/topic/" + a.dataset.topic));
}
const SIDE_TOPICS = ["theology", "philosophy", "philosophy-of-religion", "faith-reason", "human-nature", "mind-soul", "biblical-interpretation", "apologetics"];
function renderChrome() {
  $("#topnav").innerHTML = NAV.map(([p, l, , h]) => `<a href="${h}" data-nav="${p}">${l}</a>`).join("");
  const side = $("#sidebar");
  side.innerHTML = `<nav class="sidenav" aria-label="Sections">${NAV.map(([p, l, ic, h]) => `<a href="${h}" data-nav="${p}">${icon(ic).s}<span>${l === "Bible" ? "Bible" : l}</span></a>`).join("")}
    <a href="#/profile" data-nav="/profile">${icon("user").s}<span>Profile</span></a></nav>
    <div class="divider"></div><h3 class="eyebrow side-h">Topics</h3>
    <nav class="sidenav topics" aria-label="Topics">${SIDE_TOPICS.map(s => { const c = S.cats.find(x => x.slug === s); return c ? `<a href="#/topic/${s}" data-topic="${s}">${icon(c.icon).s}<span>${esc(c.name)}</span></a>` : ""; }).join("")}
    <a href="#/topics">${icon("infinity").s}<span>More Topics...</span></a></nav>
    <div class="side-foot"><a href="#/guidelines">Community guidelines</a></div>`;
  const acct = $("#account");
  acct.innerHTML = S.user ? `<div class="acct"><button class="avatar-btn" data-act="acct-menu" aria-label="Account menu" aria-haspopup="menu">${avatar(S.user, 38).s}</button></div>` : `<button class="btn primary sm" data-act="auth">Sign in</button>`;
  const dot = $("#bell-dot"); dot.hidden = !(S.user && S.unread > 0); $(".bell").hidden = !S.user;
  setNav(activePath());
}
function popover(anchor, content, cls = "") {
  closePop(); const p = document.createElement("div"); p.className = "popover " + cls; p.id = "pop"; p.innerHTML = rend(content); document.body.append(p); hydrateIcons(p);
  const r = anchor.getBoundingClientRect(); p.style.top = r.bottom + 8 + "px"; p.style.right = Math.max(10, innerWidth - r.right) + "px";
  setTimeout(() => document.addEventListener("click", outside), 0);
  function outside(e) { if (!p.contains(e.target)) { closePop(); } }
  p._off = () => document.removeEventListener("click", outside);
}
function closePop() { const p = $("#pop"); if (p) { p._off && p._off(); p.remove(); } }
ACT["acct-menu"] = el => popover(el, html`<div class="pop-head">${avatar(S.user, 40)}<div><b>${S.user.name}</b><br><span class="muted small">@${S.user.username}</span></div></div>
  <a href="#/profile" class="pop-item">${icon("user")} Profile</a><a href="#/profile?tab=saved" class="pop-item">${icon("bookmark")} Saved</a><a href="#/bible/mine" class="pop-item">${icon("pencil")} Highlights &amp; notes</a><a href="#/profile?tab=settings" class="pop-item">${icon("list")} Settings</a>
  <button class="pop-item" data-act="logout">${icon("logout")} Sign out</button>`, "menu");
ACT.bell = async el => {
  if (!S.user) return openAuth();
  const d = await api("/notifications");
  popover(el, html`<div class="pop-title">Notifications</div>${d.items.length ? d.items.map(n => html`<a class="pop-note ${n.read ? "" : "unread"}" href="${n.link}">${n.text}<span class="muted small">${ago(n.created_at)}</span></a>`) : html`<p class="muted pad">You're all caught up.</p>`}`, "notes");
  if (S.unread) { await api("/notifications/read", { method: "POST", body: {} }); S.unread = 0; $("#bell-dot").hidden = true; }
};
/* ----- display settings: theme and text size (saved in this browser) ----- */
const SIZE_LABELS = [["normal", "Normal"], ["large", "Large"], ["xl", "Extra large"]];
const store = (k, v) => { try { localStorage.setItem(k, v); } catch { } };
function displayPanel() {
  const t = document.documentElement.dataset.theme, s = document.documentElement.dataset.size;
  return html`<div class="pop-title">Display</div><div class="disp"><p class="eyebrow">Theme</p>
    <div class="seg full" role="group" aria-label="Theme"><button data-act="set-theme" data-v="dark" class="${t === "dark" ? "on" : ""}">Dark</button><button data-act="set-theme" data-v="light" class="${t === "light" ? "on" : ""}">Light</button></div>
    <p class="eyebrow">Text size</p><div class="seg full" role="group" aria-label="Text size">${SIZE_LABELS.map(([k, l]) => html`<button data-act="set-size" data-v="${k}" class="${s === k ? "on" : ""}">${l}</button>`)}</div></div>`;
}
ACT.display = el => popover(el, displayPanel(), "menu disp-pop");
function markActive(attr, value) { $$(`#pop [data-act="${attr}"]`).forEach(b => b.classList.toggle("on", b.dataset.v === value)); }
ACT["set-theme"] = el => {
  document.documentElement.dataset.theme = el.dataset.v; store("psTheme", el.dataset.v); markActive("set-theme", el.dataset.v);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = el.dataset.v === "light" ? "#f5efe6" : "#0c0a0b";
};
ACT["set-size"] = el => { document.documentElement.dataset.size = el.dataset.v; store("psSize", el.dataset.v); markActive("set-size", el.dataset.v); };
ACT.menu = () => document.body.classList.toggle("menu-open");
FORM.search = (f, d) => { const q = (d.q || "").trim(); if (q.length < 2) { toast("Type at least two characters to search."); return; } go("#/search?q=" + encodeURIComponent(q)); };
document.addEventListener("click", e => { if (e.target.closest("#sidebar a, .scrim")) document.body.classList.remove("menu-open"); });
document.addEventListener("keydown", e => { if (e.key === "/" && !e.target.closest("input,textarea,select") && !e.metaKey) { e.preventDefault(); $("#q").focus(); } });

(async function boot() {
  hydrateIcons();
  const exit = document.createElement("button"); exit.className = "exit-reading"; exit.dataset.act = "unfocus"; exit.innerHTML = icon("x").s + " Exit reading mode"; document.body.append(exit);
  try {
    const [b, c] = await Promise.all([api("/bible/books"), api("/categories")]);
    S.books = b.books; S.translations = b.translations; S.cats = c.items;
    await loadMe();
  } catch (e) { $("#view").innerHTML = `<div class="empty big"><h1>Cannot reach the server</h1><p>${esc(e.message)}</p></div>`; return; }
  route();
  setInterval(async () => { if (S.user && !document.hidden) { try { const d = await api("/me"); if (d.unread !== S.unread) { S.unread = d.unread; $("#bell-dot").hidden = !S.unread; } } catch { } } }, 60000);
})();
