/* Study paths (curated, with progress) and reading lists (made by members). */
"use strict";
const levelPill = l => html`<span class="pill lvl-${l.toLowerCase()}">${l}</span>`;
const stepIcon = { library: "layers", bible: "book", reflect: "pencil" };
const progressBar = (done, total) => html`<div class="prog"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div>`;

page("/study", async (_, q) => {
  const tab = q.tab === "lists" ? "lists" : "paths";
  const tabs = html`<div class="tabs"><a class="tab ${tab === "paths" ? "on" : ""}" href="#/study">Study paths</a><a class="tab ${tab === "lists" ? "on" : ""}" href="#/study?tab=lists">Reading lists</a></div>`;
  if (tab === "paths") {
    const d = await api("/study");
    return { title: "Study", html: html`<div class="page-head"><div><h1>Study</h1><p class="lede">Guided paths through the library and the Bible, one step at a time. Check off what you finish and pick up where you left off.</p></div></div>${tabs}
    <div class="cards">${d.paths.map(p => html`<a class="card path" href="#/study/${p.slug}"><div class="row between">${levelPill(p.level)}<span class="muted small">${p.steps} steps</span></div>
      <h3>${p.title}</h3><p class="muted">${p.description}</p>${progressBar(p.done, p.steps)}<span class="muted small">${p.done ? `${p.done} of ${p.steps} done` : "Not started"}</span></a>`)}</div>` };
  }
  const [pub, mine] = await Promise.all([api("/lists"), S.user ? api("/lists?mine=1") : { items: [] }]);
  const card = l => html`<a class="card rlist" href="#/lists/${l.id}"><h3>${l.title}</h3>${l.description ? html`<p class="muted">${l.description}</p>` : ""}<div class="row between meta"><span class="muted small">${icon("layers")} ${l.n} ${l.n === 1 ? "item" : "items"}</span>${l.owner ? html`<span class="muted small">by ${l.owner.name}</span>` : ""}</div></a>`;
  return { title: "Reading lists", html: html`<div class="page-head"><div><h1>Study</h1><p class="lede">Reading lists are collections of library items that members put together. Make your own, or borrow someone else's.</p></div>
    <button class="btn primary" data-act="new-list">${icon("plus")} New reading list</button></div>${tabs}
    ${S.user ? html`<h2 class="sec first">Your lists</h2>${mine.items.length ? html`<div class="cards">${mine.items.map(l => card({ ...l, owner: null }))}</div>` : emptyState("You have no reading lists yet", "Create one here, or use \"Add to reading list\" on any library item.")}` : ""}
    <h2 class="sec">Community lists</h2>${pub.items.length ? html`<div class="cards">${pub.items.map(card)}</div>` : emptyState("No reading lists yet", "Be the first to make one.")}` };
});

page("/study/:slug", async ({ slug }) => {
  const p = await api("/study/" + slug); const done = p.steps.filter(s => s.done).length; const next = p.steps.find(s => !s.done);
  return { title: p.title, html: html`<div class="narrow"><p class="crumbs"><a href="#/study">Study</a> / ${p.title}</p>
  <div class="row gap wrap">${levelPill(p.level)}<span class="muted small">${p.steps.length} steps</span></div><h1 class="dh">${p.title}</h1><p class="lede">${p.description}</p>
  ${S.user ? html`<div class="row between"><span class="muted">${done} of ${p.steps.length} steps complete</span>${next && next.link ? html`<a class="btn primary" href="${next.link}">Continue: ${next.title}</a>` : ""}</div><div class="prog big">${progressBar(done, p.steps.length)}</div>`
    : html`<div class="signin-note">${icon("user")}<span><button class="link" data-act="auth">Sign in</button> to check off steps and keep your place.</span></div>`}
  <ol class="steps-list">${p.steps.map((s, i) => html`<li class="${s.done ? "done" : ""} k-${s.kind}">
    <button class="check" data-act="step" data-id="${s.id}" aria-pressed="${s.done}" aria-label="Mark step ${i + 1} complete">${icon("check")}</button>
    <div class="sbody"><span class="skind">${icon(stepIcon[s.kind] || "book")} ${s.kind === "library" ? "Read" : s.kind === "bible" ? "Scripture" : "Reflect"}</span>
      ${s.link ? html`<a class="stitle" href="${s.link}">${s.title}</a>` : html`<span class="stitle">${s.title}</span>`}
      ${s.meta ? html`<span class="muted small">${s.meta}</span>` : ""}${s.note ? html`<p class="snote">${s.note}</p>` : ""}</div></li>`)}</ol></div>` };
});
ACT.step = async el => { await api("/study/steps/" + el.dataset.id, { method: "POST", body: {} }); rerender(); };

/* ---------- reading lists ---------- */
page("/lists/:id", async ({ id }) => {
  const l = await api("/lists/" + id); window._list = l;
  return { title: l.title, html: html`<div class="narrow"><p class="crumbs"><a href="#/study?tab=lists">Reading lists</a> / ${l.title}</p>
  <h1 class="dh">${l.title}</h1><div class="dmeta">${authorLink(l.owner)}<span class="muted">${l.items.length} ${l.items.length === 1 ? "item" : "items"}</span></div>
  ${l.description ? html`<p class="lede">${l.description}</p>` : ""}
  ${l.can_edit ? html`<div class="actions"><button class="btn" data-act="edit-list">${icon("pencil")} Edit list</button><button class="btn ghost dangerlink" data-act="delete-list">${icon("trash")} Delete list</button><a class="btn" href="#/library">${icon("plus")} Browse the library</a></div>` : ""}
  ${l.items.length ? html`<div class="stack">${l.items.map(a => html`<div class="card res listitem"><div class="row between"><span class="type t-${a.type}">${a.type_name}</span>${l.can_edit ? html`<button class="link dangerlink" data-act="list-remove" data-id="${a.id}">${icon("x")} Remove</button>` : ""}</div>
    <a href="#/library/${a.id}"><h3>${a.title}</h3></a><p class="muted by">${a.author}</p><p>${a.summary}</p></div>`)}</div>`
    : emptyState("This list is empty", l.can_edit ? "Open any library item and choose \"Add to reading list\"." : "")}</div>` };
});
const listForm = (title, d, action) => html`<div class="row between"><h2>${title}</h2><button class="icon-btn" data-act="close-modal" aria-label="Close">${icon("x")}</button></div>
  <form class="form" data-form="${action}"><label>Name<input name="title" required minlength="3" maxlength="80" value="${d.title || ""}" placeholder="e.g. Faith and reason, in order"></label>
  <label>Description (optional)<textarea name="description" rows="3" maxlength="400" placeholder="Who is this list for, and what will they get from it?">${d.description || ""}</textarea></label>
  <p class="form-err" id="list-err"></p><div class="row end gap"><button type="button" class="btn" data-act="close-modal">Cancel</button><button class="btn primary">Save</button></div></form>`;
ACT["new-list"] = () => { if (!S.user) return openAuth(); openModal(listForm("New reading list", {}, "newlist")); };
FORM.newlist = async (f, d) => { try { const r = await api("/lists", { method: "POST", body: d }); closeModal(); toast("List created", "ok"); go("#/lists/" + r.id); } catch (e) { $("#list-err").textContent = e.message; } };
ACT["edit-list"] = () => openModal(listForm("Edit reading list", window._list, "editlist"));
FORM.editlist = async (f, d) => { try { await api("/lists/" + window._list.id, { method: "PUT", body: d }); closeModal(); toast("List updated", "ok"); rerender(); } catch (e) { $("#list-err").textContent = e.message; } };
ACT["delete-list"] = async () => { if (await confirmBox("Delete this list?", "The library items stay where they are; only the list is removed.")) { await api("/lists/" + window._list.id, { method: "DELETE" }); toast("List deleted"); go("#/study?tab=lists"); } };
ACT["list-remove"] = async el => { await api(`/lists/${window._list.id}/items/${el.dataset.id}`, { method: "DELETE" }); toast("Removed from list"); rerender(); };

/* "Add to reading list" on a library item */
async function listPicker(aid) {
  const d = await api(`/lists?mine=1&article=${aid}`);
  $("#pick-lists").innerHTML = (d.items.length ? d.items.map(l => html`<button class="listpick ${l.has ? "on" : ""}" data-act="toggle-in-list" data-list="${l.id}" data-article="${aid}" aria-pressed="${l.has}"><span class="check mini">${icon("check")}</span><span>${l.title}<small class="muted"> · ${l.n} ${l.n === 1 ? "item" : "items"}</small></span></button>`)
    : html`<p class="muted">You have no lists yet. Make one below.</p>`).s; hydrateIcons($("#pick-lists"));
}
ACT["add-to-list"] = async el => {
  if (!S.user) return openAuth(); const aid = +el.dataset.id;
  openModal(html`<div class="row between"><h2>Add to reading list</h2><button class="icon-btn" data-act="close-modal" aria-label="Close">${icon("x")}</button></div>
    <div id="pick-lists" class="stack tight"></div>
    <form class="form newinline" data-form="newlist-inline" data-article="${aid}"><label>Or start a new list<input name="title" required minlength="3" maxlength="80" placeholder="List name"></label><p class="form-err" id="list-err"></p><button class="btn primary">Create list and add this</button></form>`);
  await listPicker(aid);
};
ACT["toggle-in-list"] = async el => { await api(`/lists/${el.dataset.list}/items`, { method: "POST", body: { article_id: +el.dataset.article } }); await listPicker(+el.dataset.article); };
FORM["newlist-inline"] = async (f, d) => {
  try { await api("/lists", { method: "POST", body: { title: d.title, article_id: +f.dataset.article } }); f.reset(); toast("List created", "ok"); await listPicker(+f.dataset.article); }
  catch (e) { $("#list-err").textContent = e.message; }
};
