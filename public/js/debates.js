/* Structured debates. */
"use strict";
const KIND = { opening: "Opening argument", rebuttal: "Rebuttal", counterargument: "Counterargument" };

page("/debates", async () => {
  const d = await api("/debates");
  return { title: "Debates", html: html`
  <div class="page-head"><div><h1>Debates</h1><p class="lede">Structured, charitable argument. Each debate lays out two positions with opening arguments, rebuttals, Scripture and scholarly references.</p></div>
    <a class="btn primary" href="#/debates/new" data-need-login>${icon("plus")} Propose a debate</a></div>
  ${d.items.length ? html`<div class="cards two">${d.items.map(x => html`<a class="card debate-card" href="#/debates/${x.id}">
      <span class="eyebrow">${x.cname}</span><h3>${x.title}</h3><p class="dq">${x.question}</p>
      <div class="sides"><span class="side aff">${x.aff_label}</span><span class="vs">vs</span><span class="side opp">${x.opp_label}</span></div>
      <div class="meta">${icon("chat")} ${x.entries} arguments &middot; ${x.comments} comments &middot; ${x.votes} votes &middot; ${ago(x.last_activity)}</div></a>`)}</div>` : html`<div class="panel"><div class="empty big"><h2>No debates yet</h2><p class="muted">Pose a question, set out two positions, and invite others to argue them well.</p><a class="btn primary" href="#/debates/new" data-need-login>Propose the first debate</a></div></div>`}
  <div class="note-box">${icon("info")}<p><b>How debates work here.</b> Positions are presented side by side. Votes ask which case was <i>argued more convincingly</i>, not which view is true, and results stay hidden until you have judged for yourself.</p></div>` };
});

page("/debates/new", async () => {
  if (!S.user) return { html: requireLogin("Sign in to propose a debate") };
  const fld = (n, l, ph, rows = 0, max = 400) => rows ? html`<label>${l}<textarea name="${n}" rows="${rows}" required maxlength="${max}" placeholder="${ph}"></textarea></label>` : html`<label>${l}<input name="${n}" required maxlength="${max}" placeholder="${ph}"></label>`;
  return { title: "Propose a debate", html: html`<div class="narrow"><p class="crumbs"><a href="#/debates">Debates</a> / Propose</p><h1>Propose a debate</h1>
  <form class="form card" data-form="newdebate">${fld("title", "Topic", "e.g. Does free will exist alongside divine sovereignty?", 0, 160)}
    ${fld("question", "Central question", "State the question as neutrally as you can.", 2)}
    <label>Category<select name="category">${S.cats.map(c => html`<option value="${c.slug}">${c.name}</option>`)}</select></label>
    ${fld("summary", "Why it matters", "Briefly frame the disagreement and who holds each view.", 3, 800)}
    <div class="grid2"><div>${fld("aff_label", "Affirmative position (short name)", "e.g. Compatible", 0, 60)}${fld("aff_summary", "Affirmative case in a sentence or two", "Describe it the way its defenders would.", 3, 600)}</div>
    <div>${fld("opp_label", "Opposing position (short name)", "e.g. Incompatible", 0, 60)}${fld("opp_summary", "Opposing case in a sentence or two", "Describe it the way its defenders would.", 3, 600)}</div></div>
    <p class="form-err" id="form-err"></p><div class="row end"><button class="btn primary">Create debate</button></div></form></div>` };
});
FORM.newdebate = async (f, d) => { const r = await api("/debates", { method: "POST", body: d }); toast("Debate created. Add the first opening argument!", "ok"); go("#/debates/" + r.id); };

const scriptureBlock = vs => vs.length ? html`<details class="scripture"><summary>${icon("book")} Supporting Scripture <span class="muted">(${vs.map(v => v.label).join("; ")})</span></summary>
  ${vs.map(v => html`<blockquote><a class="ref" href="#/bible/${v.book}/${v.chapter}?v=${v.verse}">${v.label}</a> <span>${v.text}</span><cite>WEB</cite></blockquote>`)}</details>` : "";
const refsBlock = rs => rs.length ? html`<details class="refsbox"><summary>${icon("scroll")} Sources &amp; references <span class="muted">(${rs.length})</span></summary><ul>${rs.map(r => html`<li>${r}</li>`)}</ul></details>` : "";
function entryCard(e, d) {
  const label = e.side === "aff" ? d.aff_label : d.opp_label;
  return html`<article class="entry ${e.side}"><header><span class="sidetag ${e.side}">${label}</span><span class="kind">${KIND[e.kind]}</span></header>
    <div class="rich">${rich(e.body)}</div>${scriptureBlock(e.verses)}${refsBlock(e.refs)}
    ${e.author.username === "editors" ? "" : html`<footer>${authorLink(e.author)}<span class="muted">${ago(e.created_at)}</span>
      ${S.user && S.user.username === e.author.username ? html`<span class="entry-acts"><button class="link" data-act="edit-entry" data-id="${e.id}">${icon("pencil")} Edit</button><button class="link dangerlink" data-act="del-entry" data-id="${e.id}">${icon("trash")} Delete</button></span>` : ""}</footer>`}</article>`;
}
const tallyBars = (t, d) => { const n = t.aff + t.opp || 1; const a = Math.round(t.aff / n * 100); return html`<div class="tally"><div class="tr"><span>${d.aff_label}</span><div class="bar aff"><i style="width:${a}%"></i></div><b>${a}%</b></div>
  <div class="tr"><span>${d.opp_label}</span><div class="bar opp"><i style="width:${100 - a}%"></i></div><b>${100 - a}%</b></div>
  <p class="muted small">${t.aff + t.opp} votes &middot; ${t.moved} said this debate changed or sharpened their mind.</p></div>`; };

page("/debates/:id", async ({ id }) => {
  const d = await api("/debates/" + id); const by = (k, s) => d.entries.filter(e => e.kind === k && e.side === s);
  const col = k => html`<div class="cols">${["aff", "opp"].map(s => html`<div class="col ${s}"><h4 class="colhead ${s}">${s === "aff" ? d.aff_label : d.opp_label}</h4>
      ${by(k, s).length ? by(k, s).map(e => entryCard(e, d)) : html`<div class="empty small"><p class="muted">No ${KIND[k].toLowerCase()} yet.</p></div>`}</div>`)}</div>`;
  const counters = d.entries.filter(e => e.kind === "counterargument");
  return { title: d.title, html: html`
  <article class="debate">
    <p class="crumbs"><a href="#/debates">Debates</a> / ${d.cname}</p>
    <header class="dhead"><span class="eyebrow">${d.cname} &middot; ${d.entries.length} ${d.entries.length === 1 ? "argument" : "arguments"}</span><h1>${d.title}</h1>
      <p class="question"><span>The question</span>${d.question}</p><p class="lede">${d.summary}</p>
      ${d.proposer ? html`<p class="muted small">Proposed by <a class="who-link" href="#/u/${d.proposer.username}">${d.proposer.name}</a></p>` : ""}
      <div class="row gap wrap">${bmBtn("debate", d.id, d.bookmarked)}<button class="btn primary" data-act="contribute">${icon("plus")} Add an argument</button>${d.can_edit ? html`<button class="btn" data-act="edit-debate">${icon("pencil")} Edit debate</button>` : ""}</div></header>
    <div class="positions"><div class="pos aff"><span class="eyebrow">Affirmative</span><h3>${d.aff_label}</h3><p>${d.aff_summary}</p></div><div class="vsbadge">vs</div><div class="pos opp"><span class="eyebrow">Opposing</span><h3>${d.opp_label}</h3><p>${d.opp_summary}</p></div></div>
    <h2 class="sec">Opening arguments</h2>${col("opening")}
    <h2 class="sec">Rebuttals</h2>${col("rebuttal")}
    <h2 class="sec">Counterarguments &amp; further perspectives</h2>
    ${counters.length ? html`<div class="stack">${counters.map(e => entryCard(e, d))}</div>` : html`<div class="empty small"><p class="muted">No counterarguments yet. Raise a consideration both sides should face.</p></div>`}
    <section class="vote panel"><h2 class="sec nomargin">Your judgement</h2>
      <p class="muted">Which case did you find argued more convincingly? This is about the quality of reasoning and use of evidence, not a verdict on what is true. Results stay hidden until you have voted.</p>
      <form data-form="vote" data-id="${d.id}" class="voteform"><div class="radios"><label class="rad aff"><input type="radio" name="side" value="aff" ${d.my_vote?.side === "aff" ? "checked" : ""} required><span>${d.aff_label}</span></label>
        <label class="rad opp"><input type="radio" name="side" value="opp" ${d.my_vote?.side === "opp" ? "checked" : ""}><span>${d.opp_label}</span></label></div>
        <label class="check-inline"><input type="checkbox" name="moved" ${d.my_vote?.moved ? "checked" : ""}> This debate changed or sharpened my thinking</label>
        <button class="btn primary">${d.my_vote ? "Update my vote" : "Cast my vote"}</button></form>
      <div id="tally">${d.tally ? tallyBars(d.tally, d) : html`<p class="muted small">${d.votes} readers have voted. Tallies appear after you vote.</p>`}</div></section>
    ${commentsSection("debate", d.id, d.comments)}
  </article>`, mount() { window._debate = d; } };
});
ACT["edit-debate"] = () => {
  const d = window._debate; if (!d || !d.can_edit) return;
  const inp = (n, l, max) => html`<label>${l}<input name="${n}" required maxlength="${max}" value="${d[n]}"></label>`;
  const area = (n, l, rows, max) => html`<label>${l}<textarea name="${n}" rows="${rows}" required maxlength="${max}">${d[n]}</textarea></label>`;
  openModal(html`<div class="row between"><h2>Edit debate</h2><button class="icon-btn" data-act="close-modal" aria-label="Close">${icon("x")}</button></div>
  <form class="form" data-form="editdebate">${inp("title", "Topic", 160)}${area("question", "Central question", 2, 400)}
    <label>Category<select name="category">${S.cats.map(c => html`<option value="${c.slug}" ${c.slug === d.category ? "selected" : ""}>${c.name}</option>`)}</select></label>
    ${area("summary", "Why it matters", 3, 800)}
    <div class="grid2"><div>${inp("aff_label", "Affirmative position (short name)", 60)}${area("aff_summary", "Affirmative case", 3, 600)}</div><div>${inp("opp_label", "Opposing position (short name)", 60)}${area("opp_summary", "Opposing case", 3, 600)}</div></div>
    <p class="form-err" id="ed-err"></p><div class="row end gap"><button type="button" class="btn" data-act="close-modal">Cancel</button><button class="btn primary">Save changes</button></div></form>`, { wide: true });
};
FORM.editdebate = async (f, data) => {
  try { await api("/debates/" + window._debate.id, { method: "PUT", body: data }); closeModal(); toast("Debate updated", "ok"); rerender(); }
  catch (e) { $("#ed-err").textContent = e.message; }
};
ACT["edit-entry"] = el => {
  const d = window._debate; const e = d.entries.find(x => x.id === +el.dataset.id); if (!e) return;
  openModal(html`<div class="row between"><h2>Edit your argument</h2><button class="icon-btn" data-act="close-modal" aria-label="Close">${icon("x")}</button></div>
  <form class="form" data-form="editentry" data-eid="${e.id}"><p class="muted small">${KIND[e.kind]} for <b>${e.side === "aff" ? d.aff_label : d.opp_label}</b></p>
    <label>Your argument<textarea name="body" rows="9" required minlength="40" maxlength="4000">${e.body}</textarea></label>
    <label>Supporting Bible passages<textarea name="verses" rows="3" placeholder="One per line, e.g. Romans 9:19-21">${e.verses.map(v => v.label).join("\n")}</textarea></label>
    <label>Sources &amp; references<textarea name="refs" rows="3" placeholder="One per line">${e.refs.join("\n")}</textarea></label>
    <p class="form-err" id="entry-err"></p><div class="row end gap"><button type="button" class="btn" data-act="close-modal">Cancel</button><button class="btn primary">Save changes</button></div></form>`, { wide: true });
};
FORM.editentry = async (f, d) => {
  const lines = s => (s || "").split("\n").map(x => x.trim()).filter(Boolean);
  try { await api(`/debates/${window._debate.id}/entries/${f.dataset.eid}`, { method: "PUT", body: { body: d.body, verses: lines(d.verses), refs: lines(d.refs) } }); closeModal(); toast("Argument updated", "ok"); rerender(); }
  catch (e) { $("#entry-err").textContent = e.message; }
};
ACT["del-entry"] = async el => {
  if (!await confirmBox("Delete this argument?", "It will be removed from the debate. This cannot be undone.")) return;
  await api(`/debates/${window._debate.id}/entries/${el.dataset.id}`, { method: "DELETE" }); toast("Argument deleted"); rerender();
};
FORM.vote = async (f, d) => {
  if (!S.user) return openAuth();
  const r = await api(`/debates/${f.dataset.id}/vote`, { method: "POST", body: { side: d.side, moved: !!d.moved } });
  $("#tally").innerHTML = tallyBars(r.tally, window._debate).s; toast("Vote recorded", "ok");
};
ACT.contribute = () => {
  if (!S.user) return openAuth(); const d = window._debate;
  openModal(html`<div class="row between"><h2>Add to the debate</h2><button class="icon-btn" data-act="close-modal" aria-label="Close">${icon("x")}</button></div>
  <form class="form" data-form="entry"><div class="grid2"><label>Position<select name="side"><option value="aff">${d.aff_label}</option><option value="opp">${d.opp_label}</option></select></label>
    <label>Type<select name="kind"><option value="opening">Opening argument</option><option value="rebuttal">Rebuttal</option><option value="counterargument" selected>Counterargument</option></select></label></div>
  <label>Your argument<textarea name="body" rows="8" required minlength="40" maxlength="4000" placeholder="Make your case. Engage the strongest version of the other side."></textarea></label>
  <label>Supporting Bible passages<textarea name="verses" rows="2" placeholder="One per line, e.g.&#10;Romans 9:19-21&#10;Joshua 24:15"></textarea></label>
  <label>Sources &amp; references<textarea name="refs" rows="3" placeholder="One per line, e.g.&#10;Aquinas, T. Summa Theologiae I, q. 13"></textarea></label>
  <p class="form-err" id="entry-err"></p><div class="row end gap"><button type="button" class="btn" data-act="close-modal">Cancel</button><button class="btn primary">Post</button></div></form>`, { wide: true });
};
FORM.entry = async (f, d) => {
  const lines = s => (s || "").split("\n").map(x => x.trim()).filter(Boolean);
  try { await api(`/debates/${window._debate.id}/entries`, { method: "POST", body: { side: d.side, kind: d.kind, body: d.body, verses: lines(d.verses), refs: lines(d.refs) } }); closeModal(); toast("Argument added", "ok"); rerender(); }
  catch (e) { $("#entry-err").textContent = e.message; }
};
