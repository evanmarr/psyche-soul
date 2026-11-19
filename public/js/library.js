/* Library: searchable resources and reading pages. */
"use strict";
function resCard(a) {
  return html`<a class="card res" href="#/library/${a.id}"><div class="row between"><span class="type t-${a.type}">${typeNames[a.type] || a.type}</span>${labelBadge(a.label)}</div>
    <h3>${a.title}</h3><p class="muted by">${a.author}</p><p>${a.summary}</p>
    <div class="row between meta"><span class="muted small">${a.type === "book" ? "Book recommendation" : html`${icon("clock")} ${a.read_minutes} min read`}</span>
      <span class="small">${catName(a.category)}</span></div></a>`;
}
page("/library", async (_, q) => {
  const f = { type: q.type || "all", cat: q.cat || "all", q: q.q || "", saved: q.saved || "", tag: q.tag || "" };
  const d = await api("/library" + qs(f)); const link = o => "#/library" + qs({ ...f, ...o });
  return { title: "Library", html: html`
  <div class="page-head"><div><h1>Library</h1><p class="lede">Theological and philosophical articles, essays, study guides, biblical studies, apologetics and recommended books.</p></div></div>
  <div class="toolbar"><form data-form="libsearch" class="inline-search" data-keep='${JSON.stringify({ type: f.type, cat: f.cat })}'>${icon("search")}<input name="q" value="${f.q}" placeholder="Search the library..." aria-label="Search the library"></form>
    <label class="sel">Topic <select data-chg="lib-cat" data-type="${f.type}" data-q="${f.q}"><option value="all">All topics</option>${S.cats.map(c => html`<option value="${c.slug}" ${f.cat === c.slug ? "selected" : ""}>${c.name}</option>`)}</select></label>
    ${S.user ? html`<a class="chip ${f.saved ? "on" : ""}" href="${link({ saved: f.saved ? "" : "1" })}">${icon("bookmark")} Saved</a>` : ""}</div>
  <div class="chips"><a class="chip ${f.type === "all" ? "on" : ""}" href="${link({ type: "all" })}">All</a>${Object.entries(typeNames).map(([k, v]) => html`<a class="chip ${f.type === k ? "on" : ""}" href="${link({ type: k })}">${v}s</a>`)}</div>
  ${f.tag ? html`<p class="muted">Tagged <b>#${f.tag}</b>. <a href="${link({ tag: "" })}">Clear</a></p>` : ""}
  ${d.items.length ? html`<div class="cards">${d.items.map(resCard)}</div>` : emptyState("Nothing matches", "Try a different type, topic or search term.")}${legend()}` };
});
FORM.libsearch = (f, d) => { const k = JSON.parse(f.dataset.keep || "{}"); go("#/library" + qs({ ...k, q: d.q })); };
CHG["lib-cat"] = el => go("#/library" + qs({ type: el.dataset.type, q: el.dataset.q, cat: el.value }));

page("/library/:id", async ({ id }) => {
  const a = await api("/library/" + id);
  return { title: a.title, html: html`<article class="narrow article">
    <p class="crumbs"><a href="#/library">Library</a> / <a href="#/library?type=${a.type}">${a.type_name}</a></p>
    <div class="row gap wrap"><span class="type t-${a.type}">${a.type_name}</span>${labelBadge(a.label)}<span class="muted small">${catName(a.category)}</span></div>
    <h1 class="dh">${a.title}</h1><p class="byline">By <b>${a.author}</b>${a.read_minutes ? html` &middot; ${a.read_minutes} min read` : ""}</p>
    ${a.label === "research" ? html`<div class="note-box">${icon("info")}<p>This resource is a <b>study guide to classical sources</b>. Read the primary texts alongside it.</p></div>` : a.label === "theory" ? html`<div class="note-box">${icon("info")}<p>This resource presents a <b>philosophical theory</b>. Thoughtful people disagree about it.</p></div>` : ""}
    <div class="rich body-text article-body">${rich(a.body)}</div>
    ${a.tags.length ? html`<div class="tags">${a.tags.map(t => html`<a class="tag" href="#/library?tag=${t}">#${t}</a>`)}</div>` : ""}
    <div class="actions">${bmBtn("article", a.id, a.bookmarked)}<button class="btn" data-act="discuss-article" data-title="${a.title}" data-cat="${a.category}">${icon("chat")} Discuss this</button></div>
    ${a.related.length ? html`<section><h2 class="sec">Related reading</h2><div class="panel list">${a.related.map(r => html`<a class="hrow" href="#/library/${r.id}"><b>${r.title}</b><span class="muted">${r.author}</span></a>`)}</div></section>` : ""}</article>` };
});
ACT["discuss-article"] = el => {
  if (!S.user) return openAuth();
  try { sessionStorage.setItem("psDraft", JSON.stringify({ title: `Discussing: ${el.dataset.title}`, body: `I just read "${el.dataset.title}" in the library and wanted to talk about it.\n\n`, category: el.dataset.cat })); } catch { }
  go("#/forums/new");
};
