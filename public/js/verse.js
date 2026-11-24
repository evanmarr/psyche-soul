/* Verse of the Month (poster + memorize), the poster maker for any verse, and the app / offline page. */
"use strict";

/* ---------- memorized verses (kept in this browser) ---------- */
const memStore = {
  get() { try { return JSON.parse(localStorage.getItem("psMemorized") || "{}"); } catch { return {}; } },
  set(o) { try { localStorage.setItem("psMemorized", JSON.stringify(o)); } catch { } },
};
const posterName = v => "psyche-and-soul-" + v.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const verseHref = v => `#/bible/${v.book}/${v.chapter}?v=${v.verse}${v.verse_end && v.verse_end !== v.verse ? "-" + v.verse_end : ""}`;
const styleChips = (active, act = "poster-style") => html`<div class="chips tight" role="group" aria-label="Poster style">${Poster.styles.map(s => html`<button class="chip ${s.id === active ? "on" : ""}" data-act="${act}" data-style="${s.id}">${s.label}</button>`)}</div>`;

/* ---------- the memorize tool ---------- */
const MEM = { words: [], order: [], level: 0, shown: new Set(), ref: "", text: "" };
const LEVELS = [["Read", 0], ["25%", .25], ["50%", .5], ["75%", .75], ["All", 1]];
function memInit(v) {
  const seed = [...v.label].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  let s = seed; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  MEM.words = v.text.split(/\s+/); MEM.ref = v.label; MEM.text = v.text; MEM.level = 0; MEM.shown = new Set();
  MEM.order = MEM.words.map((_, i) => i).sort(() => rnd() - .5);          // fixed shuffle: each level hides a superset of the one before
}
function memRender() {
  const n = MEM.words.length, hide = new Set(MEM.order.slice(0, Math.round(n * LEVELS[MEM.level][1])));
  $("#mem-text").innerHTML = MEM.words.map((w, i) => hide.has(i) && !MEM.shown.has(i)
    ? `<button class="blank" data-act="mem-peek" data-i="${i}" style="width:${Math.max(2, w.length * .62)}em" aria-label="Hidden word, tap to reveal"></button>` : `<span>${esc(w)}</span>`).join(" ");
  $$("#mem .levels button").forEach((b, i) => b.classList.toggle("on", i === MEM.level));
}
ACT["mem-level"] = el => { MEM.level = +el.dataset.v; MEM.shown = new Set(); memRender(); };
ACT["mem-peek"] = el => { MEM.shown.add(+el.dataset.i); memRender(); };
const norm = w => w.toLowerCase().replace(/[^a-z0-9'’]/g, "");
ACT["mem-check"] = () => {
  const typed = ($("#mem-input").value || "").split(/\s+/).map(norm).filter(Boolean), target = MEM.words.map(norm);
  if (!typed.length) return toast("Type the verse from memory first.");
  const dp = Array.from({ length: target.length + 1 }, () => new Array(typed.length + 1).fill(0));
  for (let i = 1; i <= target.length; i++) for (let j = 1; j <= typed.length; j++) dp[i][j] = target[i - 1] === typed[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const got = new Set(); for (let i = target.length, j = typed.length; i > 0 && j > 0;) { if (target[i - 1] === typed[j - 1]) { got.add(i - 1); i--; j--; } else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--; }
  const pct = Math.round(got.size / target.length * 100), msg = pct >= 98 ? "Word perfect!" : pct >= 85 ? "Almost there." : pct >= 60 ? "Good progress: keep going." : "Keep practising: try a lower level first.";
  $("#mem-result").innerHTML = `<p class="mem-score"><b>${pct}%</b> ${msg} <span class="muted">(${got.size} of ${target.length} words in order)</span></p><p class="mem-text">${MEM.words.map((w, i) => got.has(i) ? `<span>${esc(w)}</span>` : `<mark>${esc(w)}</mark>`).join(" ")}</p>`;
  if (pct >= 98) toast("Word perfect. Mark it as memorized below.", "ok");
};
ACT["mem-done"] = el => {
  const m = memStore.get(); if (m[MEM.ref]) delete m[MEM.ref]; else m[MEM.ref] = Date.now(); memStore.set(m);
  const on = !!m[MEM.ref]; el.classList.toggle("on", on); el.querySelector("span").textContent = on ? "Memorized. Well done!" : "I have memorized this";
  toast(on ? "Saved: " + MEM.ref + " is memorized" : "Unmarked", on ? "ok" : "");
};

/* ---------- Verse of the Month ---------- */
let VOM = null;
async function paintMain(v, style) { VOM = { v, style }; await Poster.draw($("#poster"), { text: v.text, ref: v.label, style, seed: v.label }, 1080); }
page("/verse", async (_, q) => {
  const [v, all] = await Promise.all([api("/verse-of-month" + qs({ m: q.m })), api("/verses/months")]);
  const done = memStore.get();
  return {
    title: "Verse of the Month", html: html`
  <div class="page-head"><div><span class="eyebrow">Verse of the month &middot; ${v.month_name}${v.current ? " (this month)" : ""}</span><h1>${v.theme}</h1><p class="lede">A passage to memorize, and a poster to keep.</p></div>
    <a class="btn" href="#/bible">${icon("book")} Open the Bible</a></div>
  <div class="vom-grid">
    <div class="vom-poster"><canvas id="poster" class="poster-canvas" width="540" height="675"></canvas>${styleChips(v.style)}
      <div class="row gap wrap"><button class="btn primary" data-act="poster-dl">${icon("copy")} Download poster</button><a class="btn" href="${verseHref(v)}">${icon("book")} Read in context</a></div>
      <p class="muted small">The poster is a plain image. Print it, set it as a wallpaper, or share it.</p></div>
    <div class="vom-side">
      <section class="panel pad vom-note"><span class="eyebrow">${v.label} &middot; ${v.translation}</span><blockquote class="vtext solo">&ldquo;${v.text}&rdquo;</blockquote><p class="muted">${v.note}</p></section>
      <section class="panel pad memo" id="mem"><h2>Memorize it</h2><p class="muted">Read it aloud, then hide more of the words each time. Tap a blank to peek.</p>
        <div class="seg full levels" role="group" aria-label="How much to hide">${LEVELS.map(([l], i) => html`<button data-act="mem-level" data-v="${i}" class="${i === 0 ? "on" : ""}">${l}</button>`)}</div>
        <p class="mem-text" id="mem-text"></p>
        <h3>Check yourself</h3><textarea id="mem-input" rows="3" placeholder="Type the verse from memory..." aria-label="Type the verse from memory"></textarea>
        <div class="row gap wrap"><button class="btn primary" data-act="mem-check">Check</button><button class="btn mem-done ${done[v.label] ? "on" : ""}" data-act="mem-done">${icon("check")}<span>${done[v.label] ? "Memorized. Well done!" : "I have memorized this"}</span></button></div>
        <div id="mem-result" aria-live="polite"></div></section>
    </div></div>
  <h2 class="sec">All twelve months</h2>
  <div class="months-grid">${all.items.map(m => html`<a class="month-card ${m.month === v.month ? "now" : ""}" href="#/verse?m=${m.month}"><canvas data-m="${m.month}" class="poster-thumb" width="270" height="338"></canvas>
    <span class="mc-month">${m.month_name}${m.month === all.current ? " · now" : ""}${done[m.label] ? " ✓" : ""}</span><span class="mc-ref">${m.label}</span></a>`)}</div>`,
    mount() {
      window._pv = null; memInit(v); memRender(); paintMain(v, v.style);
      all.items.forEach(m => Poster.draw($(`canvas[data-m="${m.month}"]`), { text: m.text, ref: m.label, style: m.style, seed: m.label }, 270));
    },
  };
});
ACT["poster-style"] = async el => {
  $$('[data-act="poster-style"]').forEach(b => b.classList.toggle("on", b === el));
  const spec = window._pv || VOM; const v = spec.v; spec.style = el.dataset.style;
  await Poster.draw($("#poster"), { text: v.text, ref: v.label, style: spec.style, seed: v.label }, 1080);
};
ACT["poster-dl"] = () => { const spec = window._pv || VOM; Poster.download($("#poster"), posterName(spec.v)); };

/* ---------- a poster for any verse ---------- */
const defaultStyle = ref => Poster.styles[[...ref].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % Poster.styles.length].id;
page("/poster/:book/:ch", async ({ book, ch }, q) => {
  const b = bookBySlug(book); if (!b) throw new ApiError("That book does not exist.", 404);
  const v = await api("/verse" + qs({ ref: `${b.name} ${ch}:${q.v || 1}`, tr: q.tr })), style = q.style || defaultStyle(v.label);
  const here = o => "#/poster/" + book + "/" + ch + qs({ v: q.v || 1, tr: q.tr, ...o });
  return {
    title: "Poster · " + v.label, html: html`
  <p class="crumbs"><a href="${verseHref(v)}">${v.label}</a> / Poster</p>
  <div class="vom-grid"><div class="vom-poster"><canvas id="poster" class="poster-canvas" width="540" height="675"></canvas></div>
    <div class="vom-side"><section class="panel pad"><span class="eyebrow">${v.label} &middot; ${v.translation}</span><h1 class="dh small">Make a poster</h1><p class="muted">Choose a design, then download the image to print or share.</p>
      ${styleChips(style)}<div class="seg" role="group" aria-label="Translation">${S.translations.map(t => html`<a class="${v.translation.toLowerCase() === t.id ? "on" : ""}" href="${here({ tr: t.id })}">${t.name}</a>`)}</div>
      <div class="row gap wrap vspace"><button class="btn primary" data-act="poster-dl">${icon("copy")} Download poster</button><a class="btn" href="${verseHref(v)}">${icon("book")} Read in context</a></div></section>
      <section class="panel pad"><blockquote class="vtext solo">&ldquo;${v.text}&rdquo;</blockquote></section></div></div>`,
    mount() { window._pv = { v, style }; Poster.draw($("#poster"), { text: v.text, ref: v.label, style, seed: v.label }, 1080); },
  };
});

/* ---------- offline Bible (stored on this device) ---------- */
const OFFLINE = {
  cache: () => caches.open("ps-offline"),
  async status() { if (!("caches" in window)) return {}; const c = await this.cache(), out = {}; for (const t of S.translations) { const m = await c.match(`/offline/${t.id}/meta`); out[t.id] = m ? (await m.json()).date : 0; } return out; },
  async download(tr, onProgress) {
    const c = await this.cache(); let parts = 6, ranges = [];
    for (let n = 0; n < parts; n++) {
      const d = await api(`/bible/pack?tr=${tr}&part=${n}`); parts = d.parts; ranges = d.ranges;
      await c.put(`/offline/${tr}/${n}`, new Response(JSON.stringify(d.books), { headers: { "Content-Type": "application/json" } })); onProgress((n + 1) / parts);
    }
    await c.put(`/offline/${tr}/meta`, new Response(JSON.stringify({ ranges, date: Date.now() }), { headers: { "Content-Type": "application/json" } }));
  },
  async remove() { await caches.delete("ps-offline"); },
  /* a chapter built from the downloaded copy, in the same shape the server sends */
  async passage(book, ch, preferred) {
    if (!("caches" in window)) return null;
    const c = await this.cache();
    for (const tr of [preferred, ...S.translations.map(t => t.id)].filter((t, i, a) => a.indexOf(t) === i)) {
      const mr = await c.match(`/offline/${tr}/meta`); if (!mr) continue;
      const meta = await mr.json(), part = meta.ranges.findIndex(([a, z]) => book.id >= a && book.id <= z); if (part < 0) continue;
      const pr = await c.match(`/offline/${tr}/${part}`); if (!pr) continue;
      const raw = (await pr.json())[String(book.id)]; if (!raw || !raw[ch - 1]) continue;
      const verses = raw[ch - 1].map((t, i) => ({ n: i + 1, t })).filter(v => v.t), i = book.id, B_ = S.books;
      const prev = ch > 1 ? { book: book.slug, name: book.name, chapter: ch - 1 } : i > 0 ? { book: B_[i - 1].slug, name: B_[i - 1].name, chapter: B_[i - 1].chapters } : null;
      const next = ch < book.chapters ? { book: book.slug, name: book.name, chapter: ch + 1 } : i < B_.length - 1 ? { book: B_[i + 1].slug, name: B_[i + 1].name, chapter: 1 } : null;
      return { book, chapter: ch, translation: tr, verses, highlights: {}, notes: [], bookmarks: [], read: false, prev, next, offline: true };
    }
    return null;
  },
};

/* ---------- Get the app ---------- */
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $$('[data-act="install-app"]').forEach(b => b.hidden = false); });
window.addEventListener("appinstalled", () => { installEvt = null; toast("Installed. Look for Psyche & Soul on your home screen or dock.", "ok"); });
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const sizeNote = "about 4 MB each";

page("/app", async () => ({
  title: "Get the app", html: html`
  <div class="narrow"><span class="eyebrow">Psyche &amp; Soul on your device</span><h1>Get the app</h1>
  <p class="lede">Install Psyche &amp; Soul like an app. It opens in its own window, works on slow connections, and lets you read the Bible with no connection at all.</p>
  <section class="panel pad appcard"><h2>1. Install</h2><div id="install-box"></div></section>
  <section class="panel pad appcard"><h2>2. Download the Bible for offline reading</h2>
    <p class="muted">Both translations are free and public domain. Download the ones you want (${sizeNote}); they stay on this device.</p>
    <div id="offline-box" class="stack tight"></div></section>
  <section class="panel pad appcard"><h2>What works offline</h2>
    <ul class="ticks"><li>Reading any chapter of a downloaded Bible, and moving between chapters</li><li>Pages you have already opened, such as library articles, study paths and your verse posters</li>
    <li>Memorizing the Verse of the Month</li></ul><p class="muted">Signing in, posting, voting, searching the Bible and saving notes need a connection. Notes and highlights you made earlier appear again when you reconnect.</p></section></div>`,
  mount() { appStatus(); },
}));
async function appStatus() {
  const box = $("#install-box"); if (!box) return;
  if (isStandalone()) box.innerHTML = `<p class="pill ok">Installed: you are using the app</p>`;
  else if (installEvt) box.innerHTML = `<p class="muted">One click adds it to your device.</p><button class="btn primary" data-act="install-app">${icon("plus").s} Install Psyche &amp; Soul</button>`;
  else if (isIOS()) box.innerHTML = `<ol class="steps"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (the square with an arrow).</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>`;
  else box.innerHTML = `<p class="muted">In <b>Chrome, Edge or Brave</b>, open the browser menu and choose <b>Install Psyche &amp; Soul</b> (or click the install icon in the address bar). In <b>Safari</b> on a Mac, use File &rarr; <b>Add to Dock</b>. If you don't see the option yet, browse the site for a minute and look again.</p>`;
  hydrateIcons(box);
  const ob = $("#offline-box"); if (!("caches" in window)) { ob.innerHTML = `<p class="muted">This browser cannot store offline copies.</p>`; return; }
  const st = await OFFLINE.status();
  ob.innerHTML = S.translations.map(t => `<div class="offrow"><div><b>${esc(t.name)}</b> <span class="muted small">${esc(t.full)}</span></div><div class="row gap" data-tr="${t.id}">${st[t.id]
    ? `<span class="pill ok">Downloaded ${new Date(st[t.id]).toLocaleDateString()}</span>` : `<button class="btn sm primary" data-act="off-dl" data-tr="${t.id}">Download</button>`}</div></div>`).join("")
    + (Object.values(st).some(Boolean) ? `<button class="link dangerlink" data-act="off-rm">Remove downloaded Bibles</button>` : "");
}
ACT["install-app"] = async () => { if (!installEvt) return; installEvt.prompt(); const r = await installEvt.userChoice; installEvt = null; if (r.outcome === "accepted") toast("Installing...", "ok"); appStatus(); };
ACT["off-dl"] = async el => {
  const slot = el.parentElement, tr = el.dataset.tr; slot.innerHTML = `<div class="prog dlbar"><i style="width:2%"></i></div>`;
  try { await OFFLINE.download(tr, f => { const i = slot.querySelector("i"); if (i) i.style.width = Math.round(f * 100) + "%"; }); toast("Downloaded for offline reading", "ok"); }
  catch (e) { toast(e.status === 0 ? "You need a connection to download." : "The download did not finish. Please try again.", "err"); }
  appStatus();
};
ACT["off-rm"] = async () => { if (await confirmBox("Remove offline Bibles?", "You can download them again at any time.", "Remove")) { await OFFLINE.remove(); toast("Removed"); appStatus(); } };
