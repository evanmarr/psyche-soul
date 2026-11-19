/* Forums: list, new discussion, discussion page with threaded comments. */
"use strict";
const RX = { like: ["heart", "Like"], insightful: ["bulb", "Insightful"], gracious: ["sparkle", "Gracious"] };

function discRow(d) {
  return html`<a class="drow" href="#/d/${d.id}">
    <span class="dico">${icon(catIcon(d.category))}</span>
    <span class="dmain"><span class="dtitle">${d.title}</span>
      <span class="dtags"><span class="pill">${d.category_name}</span>${d.label !== "discussion" ? labelBadge(d.label) : ""}${d.group ? html`<span class="pill grp">${d.group.name}</span>` : ""}
        <span class="dby">by ${d.author.name}</span></span></span>
    <span class="dstat">${icon("chat")}<b>${d.replies}</b></span><span class="dtime">${ago(d.last_activity)}</span></a>`;
}
function debateRow(d) {
  return html`<a class="drow" href="#/debates/${d.id}"><span class="dico">${icon("scale")}</span>
    <span class="dmain"><span class="dtitle">Debate: ${d.title}</span><span class="dtags"><span class="pill">${d.cname}</span><span class="pill">${d.aff_label}</span><span class="vs">vs</span><span class="pill alt">${d.opp_label}</span></span></span>
    <span class="dstat">${icon("chat")}<b>${d.entries + d.comments}</b></span><span class="dtime">${ago(d.last_activity)}</span></a>`;
}

function rxBar(type, id, reactions = {}, mine = null, small = false) {
  return html`<span class="rx ${small ? "sm" : ""}" data-type="${type}" data-id="${id}">${Object.entries(RX).map(([k, [ic, lab]]) =>
    html`<button class="rxb ${mine === k ? "on" : ""}" data-act="react" data-kind="${k}" title="${lab}" aria-pressed="${mine === k}" aria-label="${lab}">${icon(ic)}${reactions[k] ? html`<b>${reactions[k]}</b>` : ""}</button>`)}</span>`;
}
ACT.react = async el => {
  const bar = el.closest(".rx"); const d = await api("/react", { method: "POST", body: { type: bar.dataset.type, id: +bar.dataset.id, kind: el.dataset.kind } });
  const small = bar.classList.contains("sm"); bar.outerHTML = rxBar(bar.dataset.type, +bar.dataset.id, d.reactions, d.mine, small).s; hydrateIcons();
};
ACT.bookmark = async el => {
  const d = await api("/bookmarks", { method: "POST", body: { kind: el.dataset.kind, ref: el.dataset.ref } });
  el.classList.toggle("on", d.bookmarked); el.setAttribute("aria-pressed", d.bookmarked);
  const t = el.querySelector(".bm-label"); if (t) t.textContent = d.bookmarked ? "Saved" : "Save";
  toast(d.bookmarked ? "Saved to your bookmarks" : "Removed from bookmarks", d.bookmarked ? "ok" : "");
};
const bmBtn = (kind, ref, on, label = true) => html`<button class="btn ghost bm ${on ? "on" : ""}" data-act="bookmark" data-kind="${kind}" data-ref="${ref}" aria-pressed="${!!on}" title="Bookmark">${icon("bookmark")}${label ? html`<span class="bm-label">${on ? "Saved" : "Save"}</span>` : ""}</button>`;

/* ----- comments ----- */
function buildTree(flat) {
  const by = new Map(flat.map(c => [c.id, { ...c, kids: [] }])); const roots = [];
  by.forEach(c => (c.parent_id && by.get(c.parent_id) ? by.get(c.parent_id).kids : roots).push(c)); return roots;
}
function commentHtml(c, type, id, depth) {
  const mine = S.user && S.user.username === c.author.username;
  return html`<article class="comment d${Math.min(depth, 4)}" id="c${c.id}">
    <div class="chead">${authorLink(c.author)}<span class="muted">${ago(c.created_at)}</span></div>
    <div class="cbody rich">${rich(c.body)}</div>
    <div class="cacts">${rxBar("comment", c.id, c.reactions, c.mine, true)}<button class="link" data-act="reply" data-id="${c.id}">${icon("reply")} Reply</button>
      ${mine ? html`<button class="link dangerlink" data-act="del-comment" data-id="${c.id}">${icon("trash")} Delete</button>` : ""}</div>
    <div class="reply-slot" id="reply-${c.id}"></div>
    ${c.kids.length ? html`<div class="kids">${c.kids.map(k => commentHtml(k, type, id, depth + 1))}</div>` : ""}</article>`;
}
function composer(type, id, parent = null, label = "Add to the conversation") {
  return html`<form class="composer" data-form="comment" data-type="${type}" data-id="${id}" data-parent="${parent || ""}">
    <textarea name="body" rows="${parent ? 3 : 4}" required minlength="2" maxlength="5000" placeholder="${label}. Be charitable, cite sources where you can, and engage the strongest version of other views." aria-label="Comment"></textarea>
    <div class="row between"><span class="muted small">Bible references like John 3:16 become links automatically.</span><span class="row gap">${parent ? html`<button type="button" class="btn" data-act="cancel-reply" data-id="${parent}">Cancel</button>` : ""}<button class="btn primary" type="submit">${parent ? "Reply" : "Post comment"}</button></span></div></form>`;
}
const commentsSection = (type, id, comments) => html`<section class="comments"><h2 class="sec">${comments.length} ${comments.length === 1 ? "comment" : "comments"}</h2>
  ${S.user ? composer(type, id) : html`<div class="signin-note">${icon("user")}<span><button class="link" data-act="auth">Sign in</button> to join the conversation.</span></div>`}
  <div class="thread">${comments.length ? buildTree(comments).map(c => commentHtml(c, type, id, 0)) : emptyState("No comments yet", "Be the first to respond.")}</div></section>`;
ACT.reply = el => {
  if (!S.user) return openAuth();
  const slot = $("#reply-" + el.dataset.id); if (slot.innerHTML) { slot.innerHTML = ""; return; }
  const f = $("#view .comments > .composer"); const t = f.dataset.type, i = f.dataset.id;
  slot.innerHTML = composer(t, i, el.dataset.id, "Write a reply").s; slot.querySelector("textarea").focus();
};
ACT["cancel-reply"] = el => { $("#reply-" + el.dataset.id).innerHTML = ""; };
ACT["del-comment"] = async el => { if (await confirmBox("Delete comment?", "This removes your comment and any replies to it.")) { await api("/comments/" + el.dataset.id, { method: "DELETE" }); toast("Comment deleted"); rerender(); } };
FORM.comment = async (f, d) => {
  await api("/comments", { method: "POST", body: { type: f.dataset.type, id: +f.dataset.id, parent_id: f.dataset.parent ? +f.dataset.parent : null, body: d.body } });
  toast("Posted", "ok"); rerender();
};

/* ----- list ----- */
const SORTS = { new: "Newest", popular: "Most popular", active: "Most active" };
page("/forums", async (_, q) => {
  const f = { cat: q.cat || "all", sort: q.sort || "new", q: q.q || "", tag: q.tag || "", saved: q.saved || "" };
  const data = await api("/discussions" + qs({ ...f, limit: 20 }));
  const link = o => "#/forums" + qs({ ...f, ...o });
  const cur = S.cats.find(c => c.slug === f.cat);
  return { title: "Forums", html: html`
  <div class="page-head"><div><h1>Forums</h1><p class="lede">Thoughtful conversation about theology, psychology and the questions between them.</p></div>
    <a class="btn primary" href="#/forums/new${cur ? "?cat=" + cur.slug : ""}" data-need-login>${icon("plus")} New discussion</a></div>
  <div class="chips" role="tablist"><a class="chip ${f.cat === "all" ? "on" : ""}" href="${link({ cat: "all" })}">All</a>
    ${S.cats.map(c => html`<a class="chip ${f.cat === c.slug ? "on" : ""}" href="${link({ cat: c.slug })}">${c.name}<small>${c.discussions}</small></a>`)}</div>
  ${cur ? html`<p class="cat-desc">${cur.description} <a href="#/topic/${cur.slug}">Visit the ${cur.name} hub</a></p>` : ""}
  <div class="toolbar"><form data-form="forumsearch" class="inline-search" data-keep='${JSON.stringify({ cat: f.cat, sort: f.sort })}'>${icon("search")}<input name="q" value="${f.q}" placeholder="Search discussions..." aria-label="Search discussions"></form>
    <label class="sel">Sort <select data-chg="forum-sort" data-cat="${f.cat}" data-q="${f.q}">${Object.entries(SORTS).map(([k, v]) => html`<option value="${k}" ${f.sort === k ? "selected" : ""}>${v}</option>`)}</select></label>
    ${S.user ? html`<a class="chip ${f.saved ? "on" : ""}" href="${link({ saved: f.saved ? "" : "1" })}">${icon("bookmark")} Saved</a>` : ""}</div>
  ${f.tag ? html`<p class="muted">Filtered by topic <b>#${f.tag}</b>. <a href="${link({ tag: "" })}">Clear</a></p>` : ""}
  <div class="panel list" id="dlist">${data.items.length ? data.items.map(discRow) : emptyState("No discussions match", "Try a different category or search term, or start the conversation yourself.")}
    ${data.items.length < data.total ? html`<button class="btn wide-more" data-act="more-disc" data-offset="${data.items.length}" data-qs='${JSON.stringify({ ...f, limit: 20 })}'>Load more</button>` : ""}</div>
  ${legend()}` };
});
ACT["more-disc"] = async el => {
  const off = +el.dataset.offset; const d = await api("/discussions" + qs({ ...JSON.parse(el.dataset.qs), offset: off }));
  el.insertAdjacentHTML("beforebegin", d.items.map(x => discRow(x).s).join("")); hydrateIcons($("#dlist"));
  if (off + d.items.length >= d.total) el.remove(); else el.dataset.offset = off + d.items.length;
};
FORM.forumsearch = (f, d) => { const keep = JSON.parse(f.dataset.keep || "{}"); go("#/forums" + qs({ ...keep, q: d.q })); };
CHG["forum-sort"] = el => go("#/forums" + qs({ cat: el.dataset.cat, q: el.dataset.q, sort: el.value }));
document.addEventListener("click", e => { const a = e.target.closest("[data-need-login]"); if (a && !S.user) { e.preventDefault(); openAuth(); } });

/* ----- new ----- */
page("/forums/new", async (_, q) => {
  if (!S.user) return { html: requireLogin("Sign in to start a discussion") };
  let pre = {}; try { pre = JSON.parse(sessionStorage.getItem("psDraft") || "{}"); sessionStorage.removeItem("psDraft"); } catch { }
  const groups = (await api("/groups")).items.filter(g => g.is_member);
  const cat = q.cat || pre.category || "theology";
  return { title: "New discussion", html: html`
  <div class="narrow"><p class="crumbs"><a href="#/forums">Forums</a> / New discussion</p><h1>Start a discussion</h1>
  <form class="form card" data-form="newdisc">
    <label>Title<input name="title" required minlength="5" maxlength="200" value="${pre.title || ""}" placeholder="Ask a clear, specific question"></label>
    <div class="grid2"><label>Category<select name="category">${S.cats.map(c => html`<option value="${c.slug}" ${c.slug === cat ? "selected" : ""}>${c.name}</option>`)}</select></label>
      <label>What kind of contribution is this?<select name="label">${Object.entries(S.config.labels).map(([k, v]) => html`<option value="${k}" ${k === (pre.label || "discussion") ? "selected" : ""}>${v}</option>`)}</select></label></div>
    <label>Group (optional)<select name="group"><option value="">Public forum</option>${groups.map(g => html`<option value="${g.slug}" ${q.group === g.slug ? "selected" : ""}>${g.name}</option>`)}</select></label>
    <label>Tags<input name="tags" maxlength="80" placeholder="e.g. memory, free-will, romans (up to 5)"><small>Psychology subtopics: cognitive, behavioral, developmental, personality, consciousness, emotions, memory, motivation, relationships, mental-health, philosophy-of-mind.</small></label>
    <label>Your post<textarea name="body" rows="10" required minlength="10" maxlength="10000" placeholder="Share your question or argument. Say what you are drawing on: research, Scripture, a theological tradition, or personal experience.">${pre.body || ""}</textarea></label>
    <p id="form-err" class="form-err"></p>
    <div class="row between"><span class="muted small">Please be charitable and cite sources. This is not a place for medical or crisis advice.</span><button class="btn primary" type="submit">Post discussion</button></div>
  </form>${legend()}</div>` };
});
FORM.newdisc = async (f, d) => { const r = await api("/discussions", { method: "POST", body: d }); toast("Discussion posted", "ok"); go("#/d/" + r.id); };

/* ----- discussion ----- */
page("/d/:id", async ({ id }) => {
  const d = await api("/discussions/" + id);
  const mine = S.user && S.user.username === d.author.username;
  return { title: d.title, html: html`
  <article class="narrow disc">
    <p class="crumbs"><a href="#/forums">Forums</a> / <a href="#/forums?cat=${d.category}">${d.category_name}</a>${d.group ? html` / <a href="#/groups/${d.group.slug}">${d.group.name}</a>` : ""}</p>
    <h1 class="dh">${d.title}</h1>
    <div class="dmeta">${authorLink(d.author)}<span class="muted">${ago(d.created_at)}</span>${labelBadge(d.label)}<span class="muted">${icon("eye")} ${num(d.views)}</span></div>
    <div class="rich body-text">${rich(d.body)}</div>
    ${d.tags.length ? html`<div class="tags">${d.tags.map(t => html`<a class="tag" href="#/forums?tag=${t}">#${t}</a>`)}</div>` : ""}
    <div class="actions">${rxBar("discussion", d.id, d.reactions, d.mine)}${bmBtn("discussion", d.id, d.bookmarked)}
      ${mine ? html`<button class="btn ghost dangerlink" data-act="del-disc" data-id="${d.id}">${icon("trash")} Delete</button>` : ""}</div>
    ${commentsSection("discussion", d.id, d.comments)}
  </article>` };
});
ACT["del-disc"] = async el => { if (await confirmBox("Delete discussion?", "This permanently removes the discussion and all of its comments.")) { await api("/discussions/" + el.dataset.id, { method: "DELETE" }); toast("Discussion deleted"); go("#/forums"); } };
