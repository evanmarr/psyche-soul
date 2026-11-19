/* Bible reader, plans, search and personal study. */
"use strict";
const B = (() => { try { return { size: 21, font: "serif", focus: false, tr: "kjv", ...JSON.parse(localStorage.getItem("psBible") || "{}") }; } catch { return { size: 21, font: "serif", focus: false, tr: "kjv" }; } })();
const saveB = () => { try { localStorage.setItem("psBible", JSON.stringify(B)); } catch { } };
const COLORS = ["gold", "purple", "green", "blue", "rose"];
let CUR = null; const SEL = new Set();

const bibleTabs = on => html`<div class="tabs" role="tablist">${[["read", "Read", "#/bible"], ["plans", "Plans", "#/bible/plans"], ["search", "Search", "#/bible/search"], ["mine", "My study", "#/bible/mine"]]
  .map(([k, l, h]) => html`<a class="tab ${on === k ? "on" : ""}" href="${h}">${l}</a>`)}</div>`;

function rangeLabel(vs) {
  const a = [...vs].sort((x, y) => x - y), out = []; let s = a[0], p = a[0];
  for (let i = 1; i <= a.length; i++) { if (a[i] === p + 1) { p = a[i]; continue; } out.push(s === p ? `${s}` : `${s}-${p}`); s = p = a[i]; }
  return out.join(", ");
}
const trName = () => (S.translations.find(t => t.id === B.tr) || { name: "KJV" }).name;
const selText = () => [...SEL].sort((a, b) => a - b).map(n => (CUR.verses.find(v => v.n === n) || {}).t).join(" ");
const selRef = () => `${CUR.book.name} ${CUR.chapter}:${rangeLabel(SEL)}`;
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement("textarea"); a.value = t; document.body.append(a); a.select(); document.execCommand("copy"); a.remove(); }
}

page("/bible", async () => {
  let to = "#/bible/john/1";
  if (S.user) { try { const p = await api("/progress"); if (p.current) to = `#/bible/${p.current.book}/${p.current.last_chapter}`; } catch { } }
  location.replace(to); return { html: "" };
});

page("/bible/:book/:ch", async ({ book, ch }, q) => {
  const b = bookBySlug(book); if (!b) throw new ApiError("That book does not exist.", 404);
  if (S.translations.find(t => t.id === B.tr && !t.available)) B.tr = "kjv";
  let d;
  try { d = await api(`/bible/passage${qs({ book, chapter: ch, tr: B.tr })}`); }
  catch (e) { if (e.status === 409 || e.status === 502) { toast(e.message, "err"); B.tr = "kjv"; saveB(); d = await api(`/bible/passage${qs({ book, chapter: ch, tr: "kjv" })}`); } else throw e; }
  CUR = d; SEL.clear();
  const notesBy = {}; d.notes.forEach(n => (notesBy[n.verse] = notesBy[n.verse] || []).push(n));
  const bm = new Set(d.bookmarks);
  const verses = d.verses.map(v => html`<span class="v ${d.highlights[v.n] ? "hl-" + d.highlights[v.n] : ""}" data-act="verse" data-v="${v.n}" id="v${v.n}"><sup class="vn">${v.n}</sup><span class="vt">${v.t}</span>${notesBy[v.n] ? html`<span class="vmark note" title="Has a note">${icon("pencil")}</span>` : ""}${bm.has(v.n) ? html`<span class="vmark bm" title="Bookmarked">${icon("bookmark")}</span>` : ""}</span> `);
  return {
    title: `${b.name} ${ch}`, html: html`
  <div class="reader-wrap">
    <div class="reader-tabs">${bibleTabs("read")}</div>
    <div class="reader-bar">
      <button class="picker" data-act="pick" aria-haspopup="dialog"><span>${b.name} ${ch}</span>${icon("down")}</button>
      <div class="seg" role="group" aria-label="Translation">${S.translations.map(t => html`<button class="${B.tr === t.id ? "on" : ""} ${t.available ? "" : "off"}" data-act="tr" data-tr="${t.id}" title="${t.full}${t.available ? "" : " (not configured)"}">${t.name}</button>`)}</div>
      <div class="rtools"><button class="icon-btn" data-act="fs" data-d="-1" aria-label="Smaller text" title="Smaller text"><span class="fs-s">A</span></button><button class="icon-btn" data-act="fs" data-d="1" aria-label="Larger text" title="Larger text"><span class="fs-l">A</span></button>
        <button class="icon-btn" data-act="font" aria-label="Toggle serif or sans-serif" title="Serif / Sans">${icon("type")}</button>
        <button class="icon-btn ${B.focus ? "on" : ""}" data-act="focus" aria-label="Reading mode" title="Comfortable reading mode">${icon("focus")}</button></div>
    </div>
    <article class="reader ${B.font}" style="--fs:${B.size}px">
      <header class="rhead"><span class="rbook">${b.name}</span><h1>Chapter ${ch}</h1><span class="rtr">${S.translations.find(t => t.id === B.tr)?.full || ""}</span></header>
      <div class="bible-text" id="btext">${verses}</div>
      ${B.tr === "kjv" ? html`<p class="copyright">King James Version, public domain. ESV text is available when an ESV API key is configured on the server.</p>` : html`<p class="copyright">Scripture quotations are from the ESV&reg; Bible, &copy; 2001 by Crossway, a publishing ministry of Good News Publishers. Used via the ESV API.</p>`}
      <nav class="chnav">${d.prev ? html`<a class="btn" href="#/bible/${d.prev.book}/${d.prev.chapter}">${icon("left")} ${d.prev.name} ${d.prev.chapter}</a>` : html`<span></span>`}
        ${d.next ? html`<a class="btn" href="#/bible/${d.next.book}/${d.next.chapter}">${d.next.name} ${d.next.chapter} ${icon("right")}</a>` : ""}</nav>
      ${S.user ? "" : html`<div class="signin-note">${icon("user")}<span><button class="link" data-act="auth">Sign in</button> to highlight, take notes, bookmark verses and track your reading.</span></div>`}
      ${d.notes.length ? html`<section class="chnotes"><h2 class="sec">Your notes on this chapter</h2>${d.notes.map(n => html`<div class="note-card"><div class="row between"><a class="ref" href="#/bible/${book}/${ch}?v=${n.verse}">${b.name} ${ch}:${n.verse}${n.verse_end !== n.verse ? "-" + n.verse_end : ""}</a>
        <span class="row gap"><button class="link" data-act="edit-note" data-id="${n.id}" data-body="${n.body}">${icon("pencil")} Edit</button><button class="link dangerlink" data-act="del-note" data-id="${n.id}">${icon("trash")} Delete</button></span></div><p>${n.body}</p></div>`)}</section>` : ""}
    </article>
  </div>`,
    mount() {
      document.body.classList.toggle("reading", B.focus);
      if (q.v) { const vs = q.v.split(/[-,]/).map(Number); const lo = vs[0], hi = vs[1] || lo; for (let i = lo; i <= hi; i++) SEL.add(i); paintSel(); const el = $("#v" + lo); if (el) el.scrollIntoView({ block: "center" }); }
    }
  };
});

/* selection & floating action bar */
function paintSel() {
  $$("#btext .v").forEach(e => e.classList.toggle("sel", SEL.has(+e.dataset.v))); updateSelBar();
}
updateSelBar = reset => {
  const bar = $("#selbar"); if (reset) { SEL.clear(); if (!CUR || !$("#btext")) CUR = null; }
  if (!SEL.size || !CUR || !$("#btext")) { bar.hidden = true; bar.innerHTML = ""; return; }
  const bmAll = false;
  bar.hidden = false;
  bar.innerHTML = html`<div class="selin"><span class="selref">${selRef()}</span>
    <button data-act="sel-copy" title="Copy">${icon("copy")}<span>Copy</span></button><button data-act="sel-quote" title="Copy as quote">${icon("quote")}<span>Quote</span></button>
    <span class="swatches" role="group" aria-label="Highlight">${COLORS.map(c => html`<button class="sw hl-${c}" data-act="sel-hl" data-color="${c}" aria-label="Highlight ${c}"></button>`)}<button class="sw none" data-act="sel-hl" data-color="" aria-label="Remove highlight" title="Remove highlight">${icon("x")}</button></span>
    <button data-act="sel-note" title="Add a note">${icon("pencil")}<span>Note</span></button><button data-act="sel-bm" title="Bookmark">${icon("bookmark")}<span>Save</span></button>
    <button data-act="sel-discuss" title="Start a discussion">${icon("chat")}<span>Discuss</span></button><button class="x" data-act="sel-clear" aria-label="Clear selection">${icon("x")}</button></div>`.s;
  hydrateIcons(bar);
};
ACT.verse = el => { const n = +el.dataset.v; SEL.has(n) ? SEL.delete(n) : SEL.add(n); paintSel(); };
ACT["sel-clear"] = () => { SEL.clear(); paintSel(); };
ACT["sel-copy"] = async () => { await copyText(`${selText()}\n\n${selRef()} (${trName()})`); toast("Copied to clipboard", "ok"); };
ACT["sel-quote"] = async () => { await copyText(`“${selText()}” — ${selRef()} (${trName()})`); toast("Quote copied", "ok"); };
ACT["sel-hl"] = async el => {
  const verses = [...SEL]; await api("/bible/highlight", { method: "POST", body: { book: CUR.book.slug, chapter: CUR.chapter, verses, color: el.dataset.color || null } });
  verses.forEach(n => { const e = $("#v" + n); e.className = "v" + (el.dataset.color ? " hl-" + el.dataset.color : ""); });
  SEL.clear(); updateSelBar(); toast(el.dataset.color ? "Highlighted" : "Highlight removed", "ok");
};
function noteModal(title, body, onSave) {
  openModal(html`<h2>${title}</h2><form class="form" id="note-form"><textarea name="body" rows="6" maxlength="4000" required placeholder="Write your thoughts, questions or prayers...">${body}</textarea><div class="row end gap"><button type="button" class="btn" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">Save note</button></div></form>`);
  $("#note-form").onsubmit = e => { e.preventDefault(); run(async () => { await onSave($("#note-form textarea").value); closeModal(); }); };
}
ACT["sel-note"] = () => {
  if (!S.user) return openAuth(); const vs = [...SEL].sort((a, b) => a - b), lo = vs[0], hi = vs[vs.length - 1];
  noteModal(`Note on ${selRef()}`, "", async body => { await api("/bible/notes", { method: "POST", body: { book: CUR.book.slug, chapter: CUR.chapter, verse: lo, verse_end: hi, body } }); toast("Note saved", "ok"); rerender(); });
};
ACT["edit-note"] = el => noteModal("Edit note", el.dataset.body, async body => { await api("/bible/notes/" + el.dataset.id, { method: "PUT", body: { body } }); toast("Note updated", "ok"); rerender(); });
ACT["del-note"] = async el => { if (await confirmBox("Delete note?", "This cannot be undone.")) { await api("/bible/notes/" + el.dataset.id, { method: "DELETE" }); toast("Note deleted"); rerender(); } };
ACT["sel-bm"] = async () => {
  if (!S.user) return openAuth(); const has = new Set(CUR.bookmarks); const vs = [...SEL]; const allOn = vs.every(v => has.has(v));
  for (const v of vs) if (allOn === has.has(v)) await api("/bookmarks", { method: "POST", body: { kind: "verse", ref: `${CUR.book.id}:${CUR.chapter}:${v}` } });
  toast(allOn ? "Bookmarks removed" : "Saved to your bookmarks", allOn ? "" : "ok"); rerender();
};
ACT["sel-discuss"] = () => {
  if (!S.user) return openAuth();
  const q = `> “${selText()}” — ${selRef()} (${trName()})\n\n`;
  try { sessionStorage.setItem("psDraft", JSON.stringify({ title: `Thoughts on ${selRef()}`, body: q, category: "biblical-interpretation" })); } catch { }
  go("#/forums/new");
};

/* toolbar actions */
ACT.fs = el => { B.size = Math.max(15, Math.min(32, B.size + 2 * +el.dataset.d)); saveB(); const r = $(".reader"); if (r) r.style.setProperty("--fs", B.size + "px"); };
ACT.font = () => { B.font = B.font === "serif" ? "sans" : "serif"; saveB(); const r = $(".reader"); r.classList.toggle("serif", B.font === "serif"); r.classList.toggle("sans", B.font === "sans"); };
ACT.focus = () => { B.focus = !B.focus; saveB(); document.body.classList.toggle("reading", B.focus); const b = $('[data-act="focus"]'); if (b) b.classList.toggle("on", B.focus); };
ACT.unfocus = () => { B.focus = false; saveB(); document.body.classList.remove("reading"); const b = $('[data-act="focus"]'); if (b) b.classList.remove("on"); };
ACT.tr = el => {
  const t = S.translations.find(x => x.id === el.dataset.tr);
  if (!t.available) return openModal(html`<h2>ESV is not configured yet</h2><p>This site reads the English Standard Version through the official <b>ESV API</b>, so no copyrighted text is stored here. To switch it on:</p>
    <ol class="steps"><li>Create a free API key at <b>api.esv.org</b> (Crossway).</li><li>Start the server with <code>ESV_API_KEY=your-key python3 server.py</code>.</li><li>Follow Crossway's display and attribution terms (the reader already shows the required notice).</li></ol><p class="muted">Until then the reader uses the public-domain KJV.</p><div class="row end"><button class="btn primary" data-act="close-modal">Got it</button></div>`);
  B.tr = t.id; saveB(); rerender();
};
ACT.pick = () => {
  const list = (ot) => S.books.filter(b => (b.testament === "OT") === ot).map(b => html`<button class="bk ${CUR && CUR.book.slug === b.slug ? "on" : ""}" data-act="pick-book" data-slug="${b.slug}">${b.name}</button>`);
  openModal(html`<div class="row between"><h2>Choose a book</h2><button class="icon-btn" data-act="close-modal" aria-label="Close">${icon("x")}</button></div>
    <input class="bk-filter" id="bk-filter" placeholder="Filter books or type a reference like Romans 8:28" aria-label="Filter books">
    <div id="pick-body"><h4 class="eyebrow">Old Testament</h4><div class="bk-grid">${list(true)}</div><h4 class="eyebrow">New Testament</h4><div class="bk-grid">${list(false)}</div></div>`, { wide: true });
  $("#bk-filter").addEventListener("input", e => {
    const v = e.target.value.trim().toLowerCase();
    $$("#pick-body .bk").forEach(b => b.hidden = v && !b.textContent.toLowerCase().includes(v)); $$("#pick-body h4").forEach(h => h.hidden = !!v);
  });
  $("#bk-filter").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); const v = e.target.value.trim(); if (v) { closeModal(); go("#/bible/search?q=" + encodeURIComponent(v)); } }
  });
};
ACT["pick-book"] = el => {
  const b = bookBySlug(el.dataset.slug);
  $("#pick-body").innerHTML = html`<button class="link" data-act="pick">${icon("left")} All books</button><h3 class="pick-title">${b.name}</h3><div class="ch-grid">${Array.from({ length: b.chapters }, (_, i) => html`<a class="chb ${CUR && CUR.book.slug === b.slug && CUR.chapter === i + 1 ? "on" : ""}" href="#/bible/${b.slug}/${i + 1}">${i + 1}</a>`)}</div>`.s;
  $("#bk-filter").hidden = true;
};
document.addEventListener("keydown", e => {
  if (!CUR || !$("#btext") || e.target.closest("input,textarea,select") || $("#modal-root").innerHTML || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowRight" && CUR.next) go(`#/bible/${CUR.next.book}/${CUR.next.chapter}`);
  if (e.key === "ArrowLeft" && CUR.prev) go(`#/bible/${CUR.prev.book}/${CUR.prev.chapter}`);
  if (e.key === "Escape" && SEL.size) { SEL.clear(); paintSel(); }
});

/* ----- search ----- */
const hilite = (t, q) => { let s = esc(t); q.split(/\s+/).filter(w => w.length > 1).forEach(w => { s = s.replace(new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>"); }); return raw(s); };
page("/bible/search", async (_, q) => {
  const term = (q.q || "").trim(); let d = null;
  if (term.length >= 2) d = await api("/bible/search" + qs({ q: term }));
  return { title: "Search the Bible", html: html`
  <div class="reader-wrap wide-wrap"><div class="reader-tabs">${bibleTabs("search")}</div>
  <h1>Search the Bible</h1>
  <form class="bigsearch" data-form="biblesearch">${icon("search")}<input name="q" value="${term}" placeholder='Search words ("peace", "renewing of your mind") or go to a passage ("Romans 12:2")' aria-label="Search the Bible" autofocus><button class="btn primary">Search</button></form>
  ${d ? html`${d.reference ? html`<a class="jump" href="#/bible/${d.reference.book}/${d.reference.chapter}${d.reference.verse ? "?v=" + d.reference.verse : ""}">${icon("book")}<span>Go to <b>${d.reference.label}</b></span>${icon("right")}</a>` : ""}
    <p class="muted">${d.total} ${d.total === 1 ? "verse" : "verses"} in the KJV contain ${d.query ? html`<b>${d.query}</b>` : ""}${d.total > d.results.length ? ` (showing the first ${d.results.length})` : ""}.</p>
    <div class="panel list">${d.results.length ? d.results.map(r => html`<a class="vres" href="#/bible/${r.book}/${r.chapter}?v=${r.verse}"><b>${r.ref}</b><span>${hilite(r.text, d.query)}</span></a>`) : emptyState("No verses found", "Try fewer or different words. Searching uses the public-domain KJV wording.")}</div>` :
      html`<p class="muted">Search covers the whole Bible. Use the exact wording of the translation, or type a passage reference to jump straight to it.</p>`}
  </div>` };
});
FORM.biblesearch = (f, d) => go("#/bible/search" + qs({ q: d.q }));

/* ----- plans ----- */
page("/bible/plans", async () => {
  const d = await api("/plans");
  return { title: "Reading plans", html: html`<div class="reader-wrap wide-wrap"><div class="reader-tabs">${bibleTabs("plans")}</div>
  <h1>Reading plans</h1><p class="lede">Read Scripture a little each day. Join a plan and check off days as you go.</p>
  <div class="cards">${d.items.map(p => html`<a class="card plan" href="#/bible/plans/${p.slug}"><span class="card-ico">${icon("calendar")}</span><h3>${p.name}</h3><p class="muted">${p.description}</p>
    <div class="prog"><i style="width:${p.joined ? Math.round(p.completed / p.days * 100) : 0}%"></i></div><span class="muted small">${p.joined ? `${p.completed} of ${p.days} days done` : `${p.days} days`}</span></a>`)}</div></div>` };
});
page("/bible/plans/:slug", async ({ slug }) => {
  const p = await api("/plans/" + slug); const done = new Set(p.completed);
  const next = p.days.find(d => !done.has(d.day));
  return { title: p.name, html: html`<div class="reader-wrap wide-wrap"><div class="reader-tabs">${bibleTabs("plans")}</div>
  <p class="crumbs"><a href="#/bible/plans">Plans</a> / ${p.name}</p><h1>${p.name}</h1><p class="lede">${p.description}</p>
  <div class="row gap wrap">${p.joined ? html`<button class="btn" data-act="plan-leave" data-slug="${slug}">Leave plan</button>${next ? html`<a class="btn primary" href="#/bible/${next.items[0].book}/${next.items[0].chapter}">Continue: day ${next.day}</a>` : html`<span class="pill ok">Plan complete</span>`}` : html`<button class="btn primary" data-act="plan-join" data-slug="${slug}">Start this plan</button>`}
    ${p.joined ? html`<span class="muted">${p.completed.length} of ${p.days.length} days complete</span>` : ""}</div>
  ${p.joined ? html`<div class="prog big"><i style="width:${Math.round(p.completed.length / p.days.length * 100)}%"></i></div>` : ""}
  <ol class="days panel">${p.days.map(d => html`<li class="${done.has(d.day) ? "done" : ""}"><button class="check" data-act="plan-day" data-slug="${slug}" data-n="${d.day}" aria-pressed="${done.has(d.day)}" aria-label="Mark day ${d.day} complete">${icon("check")}</button>
    <span class="dn">Day ${d.day}</span><span class="dl">${d.items.map(i => html`<a class="ref" href="#/bible/${i.book}/${i.chapter}">${i.label}</a>`)}</span></li>`)}</ol></div>` };
});
ACT["plan-join"] = async el => { await api(`/plans/${el.dataset.slug}/join`, { method: "POST", body: {} }); toast("Plan started", "ok"); rerender(); };
ACT["plan-leave"] = async el => { if (await confirmBox("Leave this plan?", "Your progress in this plan will be removed.", "Leave plan")) { await api(`/plans/${el.dataset.slug}/join`, { method: "POST", body: { leave: true } }); rerender(); } };
ACT["plan-day"] = async el => {
  const d = await api(`/plans/${el.dataset.slug}/days/${el.dataset.n}`, { method: "POST", body: {} }); rerender();
};

/* ----- my study ----- */
page("/bible/mine", async (_, q) => {
  if (!S.user) return { html: requireLogin("Sign in to see your study") };
  const d = await api("/bible/mine"); const tab = q.tab || "highlights";
  const tabs = [["highlights", "Highlights", d.highlights.length], ["notes", "Notes", d.notes.length], ["bookmarks", "Bookmarks", d.bookmarks.length], ["history", "History", d.history.length]];
  const verseCard = (x, extra = "") => html`<div class="note-card"><div class="row between"><a class="ref" href="#/bible/${x.book}/${x.chapter}?v=${x.verse}">${x.label}</a>${extra}</div><p class="quote">${x.text}</p>${x.body ? html`<p class="mynote">${x.body}</p>` : ""}</div>`;
  const body = tab === "highlights" ? (d.highlights.length ? d.highlights.map(x => verseCard(x, html`<span class="swatch hl-${x.color}"></span>`)) : emptyState("No highlights yet", "Tap a verse in the reader and choose a colour."))
    : tab === "notes" ? (d.notes.length ? d.notes.map(x => verseCard(x, html`<span class="muted small">${ago(x.updated_at)}</span>`)) : emptyState("No notes yet", "Select verses in the reader and choose Note."))
    : tab === "bookmarks" ? (d.bookmarks.length ? d.bookmarks.map(x => verseCard(x)) : emptyState("No bookmarked verses", "Select a verse and choose Save."))
    : (d.history.length ? html`<div class="panel list">${d.history.map(x => html`<a class="hrow" href="#/bible/${x.book}/${x.chapter}"><b>${x.label}</b><span class="muted">${ago(x.read_at)}</span></a>`)}</div>` : emptyState("Nothing read yet", "Chapters you open are recorded here."));
  return { title: "My study", html: html`<div class="reader-wrap wide-wrap"><div class="reader-tabs">${bibleTabs("mine")}</div><h1>My study</h1>
    <div class="chips">${tabs.map(([k, l, n]) => html`<a class="chip ${tab === k ? "on" : ""}" href="#/bible/mine?tab=${k}">${l}<small>${n}</small></a>`)}</div><div class="stack">${body}</div></div>` };
});

page("/bible/:book", async ({ book }) => { location.replace(`#/bible/${book}/1`); return { html: "" }; });
