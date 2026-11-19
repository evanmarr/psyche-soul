/* Groups, profiles, topics, search, guidelines. */
"use strict";
/* ----- groups ----- */
function groupCard(g) {
  return html`<a class="card group" href="#/groups/${g.slug}"><span class="card-ico">${icon(g.icon)}</span><h3>${g.name}</h3><p class="muted">${g.description}</p>
    <div class="row between meta"><span class="muted small">${icon("users")} ${g.members} ${g.members === 1 ? "member" : "members"} &middot; ${g.discussions} discussions</span>
    <button class="btn ${g.is_member ? "" : "primary"} sm" data-act="join" data-slug="${g.slug}">${g.is_member ? "Joined" : "Join"}</button></div></a>`;
}
page("/groups", async () => {
  const d = await api("/groups");
  return { title: "Groups", html: html`<div class="page-head"><div><h1>Groups</h1><p class="lede">Small communities around a shared interest. Join one to take part in its discussions.</p></div>
    <button class="btn primary" data-act="new-group">${icon("plus")} Create a group</button></div><div class="cards">${d.items.map(groupCard)}</div>` };
});
ACT.join = async (el, e) => {
  e.preventDefault(); e.stopPropagation();
  const r = await api(`/groups/${el.dataset.slug}/membership`, { method: "POST", body: {} }); toast(r.is_member ? "You joined the group" : "You left the group", r.is_member ? "ok" : ""); rerender();
};
document.addEventListener("click", e => { const b = e.target.closest('.group [data-act="join"]'); if (b) e.preventDefault(); }, true);
ACT["new-group"] = () => {
  if (!S.user) return openAuth();
  openModal(html`<div class="row between"><h2>Create a group</h2><button class="icon-btn" data-act="close-modal" aria-label="Close">${icon("x")}</button></div>
  <form class="form" data-form="newgroup"><label>Group name<input name="name" required minlength="3" maxlength="60" placeholder="e.g. Church History Reading Circle"></label>
  <label>Description<textarea name="description" rows="4" required minlength="10" maxlength="500" placeholder="What will this group discuss, and who is it for?"></textarea></label>
  <p class="form-err" id="grp-err"></p><div class="row end gap"><button type="button" class="btn" data-act="close-modal">Cancel</button><button class="btn primary">Create group</button></div></form>`);
};
FORM.newgroup = async (f, d) => { try { const r = await api("/groups", { method: "POST", body: d }); closeModal(); toast("Group created", "ok"); go("#/groups/" + r.slug); } catch (e) { $("#grp-err").textContent = e.message; } };
page("/groups/:slug", async ({ slug }, q) => {
  const g = await api("/groups/" + slug); const tab = q.tab || "discussions";
  return { title: g.name, html: html`<p class="crumbs"><a href="#/groups">Groups</a> / ${g.name}</p>
  <header class="ghead"><span class="card-ico big">${icon(g.icon)}</span><div><h1>${g.name}</h1><p class="lede">${g.description}</p><p class="muted small">${g.members} members &middot; created by <a href="#/u/${g.owner}">@${g.owner}</a></p></div>
    <div class="row gap">${g.is_member ? html`<a class="btn primary" href="#/forums/new?group=${g.slug}">${icon("plus")} New discussion</a><button class="btn" data-act="join" data-slug="${g.slug}">Leave</button>` : html`<button class="btn primary" data-act="join" data-slug="${g.slug}">Join group</button>`}</div></header>
  <div class="tabs"><a class="tab ${tab === "discussions" ? "on" : ""}" href="#/groups/${g.slug}">Discussions</a><a class="tab ${tab === "members" ? "on" : ""}" href="#/groups/${g.slug}?tab=members">Members</a></div>
  ${tab === "members" ? html`<div class="cards members">${g.member_list.map(m => html`<a class="card mem" href="#/u/${m.username}">${avatar(m, 44)}<span><b>${m.name}</b><br><span class="muted small">@${m.username}${m.owner ? " · owner" : ""}</span></span></a>`)}</div>`
    : html`<div class="panel list">${g.items.length ? g.items.map(discRow) : emptyState("No discussions yet", g.is_member ? "Start the first one." : "Join the group to start one.")}</div>`}` };
});

/* ----- topics ----- */
const SUBTOPICS = [["metaphysics", "Metaphysics"], ["epistemology", "Epistemology"], ["ethics", "Ethics"], ["logic", "Logic"], ["philosophy-of-mind", "Philosophy of mind"], ["philosophy-of-religion", "Philosophy of religion"],
  ["political-philosophy", "Political philosophy"], ["aesthetics", "Aesthetics"], ["ancient", "Ancient philosophy"], ["medieval", "Medieval philosophy"], ["modern", "Modern philosophy"], ["existentialism", "Existentialism"]];
page("/topics", async () => ({ title: "Topics", html: html`<div class="page-head"><div><h1>Topics</h1><p class="lede">Browse every area of conversation.</p></div></div>
  <div class="cards">${S.cats.map(c => html`<a class="card" href="#/topic/${c.slug}"><span class="card-ico">${icon(c.icon)}</span><h3>${c.name}</h3><p class="muted">${c.description}</p><span class="muted small">${c.discussions} discussions</span></a>`)}</div>` }));
page("/topic/:slug", async ({ slug }) => {
  const c = await api("/topics/" + slug);
  return { title: c.name, html: html`<p class="crumbs"><a href="#/topics">Topics</a> / ${c.name}</p>
  <header class="thead"><span class="card-ico big">${icon(c.icon)}</span><div><h1>${c.name}</h1><p class="lede">${c.description}</p></div><a class="btn primary" href="#/forums/new?cat=${c.slug}" data-need-login>${icon("plus")} New discussion</a></div></header>
  ${c.slug === "philosophy" ? html`<section><h2 class="sec">Areas of philosophy</h2><div class="chips wrapchips">${SUBTOPICS.map(([t, n]) => html`<a class="chip" href="#/forums?tag=${t}">${n}</a>`)}</div>
    <div class="note-box">${icon("info")}<p><b>Keeping categories honest.</b> Philosophy posts here are labelled so you can tell what a <b>classical source</b> says from a <b>philosophical theory</b> or argument, and both from <b>theological positions</b>. We do not present a philosophical argument as church teaching, or the reverse.</p></div></section>` : ""}
  <section><div class="row between"><h2 class="sec">Active discussions</h2><a class="link" href="#/forums?cat=${c.slug}">All discussions ${icon("right")}</a></div><div class="panel list">${c.discussions.length ? c.discussions.map(discRow) : emptyState("No discussions yet")}</div></section>
  ${c.debates.length ? html`<section><h2 class="sec">Debates</h2><div class="panel list">${c.debates.map(d => html`<a class="hrow" href="#/debates/${d.id}"><b>${d.title}</b><span class="muted">${d.question}</span></a>`)}</div></section>` : ""}
  ${c.articles.length ? html`<section><h2 class="sec">From the library</h2><div class="panel list">${c.articles.map(a => html`<a class="hrow" href="#/library/${a.id}"><b>${a.title}</b><span class="muted">${a.author}</span></a>`)}</div></section>` : ""}
  ` };
});

/* ----- search ----- */
page("/search", async (_, q) => {
  const term = (q.q || "").trim(); $("#q").value = term;
  if (term.length < 2) return { html: html`<div class="empty big"><h1>Search</h1><p class="muted">Type at least two characters to search discussions, Bible passages, library articles, debates and topics.</p></div>` };
  const d = await api("/search" + qs({ q: term }));
  const none = !d.verses.length && !d.discussions.length && !d.articles.length && !d.debates.length && !d.topics.length && !d.reference;
  const sec = (t, body, more = "") => html`<section><div class="row between"><h2 class="sec">${t}</h2>${more}</div>${body}</section>`;
  return { title: `Search: ${term}`, html: html`<h1>Results for &ldquo;${term}&rdquo;</h1>
  ${d.reference ? html`<a class="jump" href="#/bible/${d.reference.book}/${d.reference.chapter}${d.reference.verse ? "?v=" + d.reference.verse : ""}">${icon("book")}<span>Open <b>${d.reference.label}</b> in the Bible reader</span>${icon("right")}</a>` : ""}
  ${none ? emptyState("No results", "Try different words, or browse the topics in the sidebar.") : ""}
  ${d.topics.length ? sec("Topics", html`<div class="chips wrapchips">${d.topics.map(t => html`<a class="chip" href="#/topic/${t.slug}">${t.name}</a>`)}</div>`) : ""}
  ${d.verses.length ? sec("Bible passages (KJV)", html`<div class="panel list">${d.verses.map(r => html`<a class="vres" href="#/bible/${r.book}/${r.chapter}?v=${r.verse}"><b>${r.ref}</b><span>${hilite(r.text, term)}</span></a>`)}</div>`, d.verse_total > d.verses.length ? html`<a class="link" href="#/bible/search?q=${encodeURIComponent(term)}">All ${d.verse_total} verses ${icon("right")}</a>` : "") : ""}
  ${d.discussions.length ? sec("Discussions", html`<div class="panel list">${d.discussions.map(discRow)}</div>`, html`<a class="link" href="#/forums?q=${encodeURIComponent(term)}">More ${icon("right")}</a>`) : ""}
  ${d.debates.length ? sec("Debates", html`<div class="panel list">${d.debates.map(x => html`<a class="hrow" href="#/debates/${x.id}"><b>${x.title}</b><span class="muted">${x.question}</span></a>`)}</div>`) : ""}
  ${d.articles.length ? sec("Library", html`<div class="panel list">${d.articles.map(a => html`<a class="hrow" href="#/library/${a.id}"><b>${a.title}</b><span class="muted">${typeNames[a.type]} &middot; ${a.author}</span></a>`)}</div>`, html`<a class="link" href="#/library?q=${encodeURIComponent(term)}">More ${icon("right")}</a>`) : ""}` };
});

/* ----- profile ----- */
async function profilePage(username, tab) {
  const u = await api("/users/" + username); const me = S.user && S.user.username === u.username;
  const tabs = me ? [["discussions", "Discussions"], ["saved", "Saved"], ["reading", "Reading"], ["groups", "Groups"], ["settings", "Settings"]] : [["discussions", "Discussions"], ["groups", "Groups"]];
  if (!tabs.find(t => t[0] === tab)) tab = "discussions";
  const base = me ? "#/profile" : "#/u/" + u.username; let body = "";
  if (tab === "discussions") body = html`<h2 class="sec">Discussion history</h2><div class="panel list">${u.discussions.length ? u.discussions.map(discRow) : emptyState("No discussions yet")}</div>
      ${u.recent_comments.length ? html`<h2 class="sec">Recent replies</h2><div class="panel list">${u.recent_comments.map(c => html`<a class="hrow col" href="#/d/${c.did}"><b>${c.title}</b><span class="muted">${c.body}</span></a>`)}</div>` : ""}`;
  else if (tab === "groups") body = u.groups.length ? html`<div class="cards">${u.groups.map(g => html`<a class="card group" href="#/groups/${g.slug}"><span class="card-ico">${icon(g.icon)}</span><h3>${g.name}</h3></a>`)}</div>` : emptyState("Not in any groups yet", me ? "Browse the groups page to find one." : "");
  else if (tab === "saved") {
    const b = await api("/bookmarks"); const empty = !Object.values(b).some(x => x.length);
    body = empty ? emptyState("Nothing saved yet", "Bookmark verses, discussions, debates and articles to find them here.") : html`
      ${b.verses.length ? html`<h2 class="sec">Verses</h2><div class="stack">${b.verses.map(v => html`<div class="note-card"><a class="ref" href="#/bible/${v.book}/${v.chapter}?v=${v.verse}">${v.label}</a><p class="quote">${v.text}</p></div>`)}</div>` : ""}
      ${b.articles.length ? html`<h2 class="sec">Articles</h2><div class="panel list">${b.articles.map(a => html`<a class="hrow" href="#/library/${a.id}"><b>${a.title}</b><span class="muted">${a.author}</span></a>`)}</div>` : ""}
      ${b.discussions.length ? html`<h2 class="sec">Discussions</h2><div class="panel list">${b.discussions.map(discRow)}</div>` : ""}
      ${b.debates.length ? html`<h2 class="sec">Debates</h2><div class="panel list">${b.debates.map(d => html`<a class="hrow" href="#/debates/${d.id}"><b>${d.title}</b></a>`)}</div>` : ""}`;
  } else if (tab === "reading") {
    const p = await api("/progress");
    body = html`<div class="stat-row"><div class="stat"><b>${p.total_read}</b><span>chapters read</span></div><div class="stat"><b>${p.books.length}</b><span>books started</span></div><div class="stat"><b>${Math.round(p.total_read / p.total * 100)}%</b><span>of the Bible</span></div></div>
      <div class="row gap wrap"><a class="btn primary" href="#/bible">Continue reading</a><a class="btn" href="#/bible/mine">Highlights &amp; notes</a><a class="btn" href="#/bible/plans">Reading plans</a></div>
      <h2 class="sec">Progress by book</h2>${p.books.length ? html`<div class="panel list pad">${p.books.map(b => html`<a class="prow" href="#/bible/${b.slug}/1"><span>${b.name}</span><div class="prog"><i style="width:${Math.round(b.read / b.chapters * 100)}%"></i></div><span class="muted small">${b.read}/${b.chapters}</span></a>`)}</div>` : emptyState("No reading recorded yet")}
      ${p.recent.length ? html`<h2 class="sec">Recently read</h2><div class="chips">${p.recent.map(r => html`<a class="chip" href="#/bible/${r.book}/${r.chapter}">${r.label}</a>`)}</div>` : ""}`;
  } else if (tab === "settings") {
    body = html`<h2 class="sec">Edit profile</h2><form class="form card" data-form="profile"><div class="avatar-edit">${avatar(u, 72)}<div><input type="file" id="avfile" accept="image/png,image/jpeg,image/webp" data-chg="avatar-file" hidden><label for="avfile" class="btn sm">Choose picture</label>
        ${u.avatar ? html` <button type="button" class="btn sm" data-act="avatar-clear">Remove</button>` : ""}<p class="muted small">Square images work best. Resized automatically.</p></div></div><input type="hidden" name="avatar" id="avdata" value="">
      <label>Display name<input name="name" required maxlength="60" value="${u.name}"></label><label>Bio<textarea name="bio" rows="4" maxlength="600" placeholder="Tell the community what you study and what you are curious about.">${u.bio}</textarea></label>
      <p class="form-err" id="prof-err"></p><div class="row end"><button class="btn primary">Save profile</button></div></form>
      <h2 class="sec">Password</h2><form class="form card" data-form="password"><label>Current password<input name="current" type="password" autocomplete="current-password" required></label><label>New password<input name="new" type="password" autocomplete="new-password" minlength="8" required></label>
      <p class="form-err" id="pw-err"></p><div class="row end"><button class="btn">Change password</button></div></form>
      <div class="row"><button class="btn" data-act="logout">${icon("logout")} Sign out</button></div>`;
  }
  return { title: u.name, html: html`<header class="phead">${avatar(u, 96)}<div class="pinfo"><h1>${u.name}</h1><p class="muted">@${u.username} &middot; joined ${dateStr(u.joined)}</p><p class="bio">${u.bio || (me ? "Add a short bio in Settings." : "")}</p></div>
    <div class="stat-row"><div class="stat"><b>${u.stats.discussions}</b><span>discussions</span></div><div class="stat"><b>${u.stats.comments}</b><span>comments</span></div><div class="stat"><b>${u.stats.reactions}</b><span>reactions</span></div><div class="stat"><b>${u.stats.debate_entries}</b><span>debate arguments</span></div></div></header>
  <div class="tabs">${tabs.map(([k, l]) => html`<a class="tab ${tab === k ? "on" : ""}" href="${base}?tab=${k}">${l}</a>`)}</div>${body}` };
}
page("/profile", async (_, q) => S.user ? profilePage(S.user.username, q.tab || "discussions") : { html: requireLogin("Sign in to view your profile") });
page("/u/:username", async ({ username }, q) => profilePage(username, q.tab || "discussions"));
CHG["avatar-file"] = el => {
  const file = el.files[0]; if (!file) return;
  const img = new Image(); const url = URL.createObjectURL(file);
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = c.height = 160; const x = c.getContext("2d"); const s = Math.min(img.width, img.height);
    x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160); URL.revokeObjectURL(url);
    const data = c.toDataURL("image/jpeg", .82); $("#avdata").value = data; const av = $(".avatar-edit .avatar"); if (av) av.outerHTML = `<img class="avatar" src="${data}" width="72" height="72" alt="">`; toast("Picture ready. Save to apply.");
  };
  img.onerror = () => toast("That image could not be read.", "err"); img.src = url;
};
ACT["avatar-clear"] = async () => { await api("/me", { method: "PUT", body: { name: S.user.name, bio: S.user.bio, avatar: "" } }); await loadMe(); toast("Picture removed"); rerender(); };
FORM.profile = async (f, d) => {
  const body = { name: d.name, bio: d.bio }; if (d.avatar) body.avatar = d.avatar;
  try { await api("/me", { method: "PUT", body }); await loadMe(); toast("Profile saved", "ok"); rerender(); } catch (e) { $("#prof-err").textContent = e.message; }
};
FORM.password = async (f, d) => { try { await api("/me/password", { method: "POST", body: d }); f.reset(); toast("Password changed", "ok"); } catch (e) { $("#pw-err").textContent = e.message; } };

/* ----- guidelines ----- */
page("/guidelines", async () => ({ title: "Community guidelines", html: html`<div class="narrow article"><h1>Community guidelines</h1>
  <p class="lede">Psyche &amp; Soul exists for people who want to think seriously about faith and the mind. These guidelines keep that possible.</p>
  <div class="rich body-text"><h3>Be charitable</h3><p>Describe other views the way their best defenders would. Assume good faith. Disagree with arguments, not people.</p>
  <h3>Say what kind of claim you are making</h3><p>Use the labels. <b>Classical source</b> means what a text or thinker actually says. <b>Philosophical theory</b> means a framework that goes beyond the texts. <b>Theological position</b> and <b>Philosophical argument</b> are their own kinds of claim. Do not present a philosophical argument as church teaching, or the reverse.</p>
  <h3>Cite your sources</h3><p>Link or name the Scripture, study, book or tradition you are drawing on. Quote Bible passages with their references; they become links automatically.</p>
  <h3>Care for people</h3><p>Some questions here touch real suffering and doubt. Be gentle, and remember that a person is not an argument. If someone seems to be in crisis, encourage them to contact local emergency services (in the US, call or text 988).</p>
  <h3>Keep debates honest</h3><p>Votes in debates reward the quality of reasoning, not popularity or which view you already hold.</p></div></div>` }));
