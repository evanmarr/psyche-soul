/* Admin area: lives at /adm1n and is not linked from anywhere on the site. */
"use strict";
const AD = { tab: "overview", q: "" };
const app = () => $("#app");
const clip = (s, n = 140) => (s.length > n ? s.slice(0, n) + "…" : s);
const siteLink = h => `/#${h}`;

async function show() {
  const me = await api("/admin/me");
  if (!me.admin) return loginView();
  await dashboard();
}

function loginView() {
  app().innerHTML = html`<div class="admin-login"><img src="/img/logo.png" height="64" alt=""><h1>Admin</h1>
    <form class="form" data-form="adminlogin"><label>Password<input name="password" type="password" autocomplete="current-password" required autofocus></label>
    <p class="form-err" id="adm-err" role="alert"></p><button class="btn primary wide">Sign in</button></form></div>`.s;
}
FORM.adminlogin = async (f, d) => {
  try { await api("/admin/login", { method: "POST", body: d }); await show(); }
  catch (e) { $("#adm-err").textContent = e.message; f.reset(); }
};
ACT["admin-logout"] = async () => { await api("/admin/logout", { method: "POST", body: {} }); loginView(); };

const TABS = [["overview", "Overview"], ["users", "Users"], ["discussions", "Discussions"], ["comments", "Comments"], ["debates", "Debates"], ["arguments", "Arguments"], ["groups", "Groups"]];

async function dashboard() {
  const head = html`<header class="admin-head"><div class="row gap"><img src="/img/logo.png" height="44" alt=""><h1>Admin</h1></div>
    <div class="row gap"><a class="btn sm" href="/" target="_blank" rel="noopener">View site</a><button class="btn sm" data-act="admin-logout">Sign out</button></div></header>
    <nav class="tabs" aria-label="Admin sections">${TABS.map(([k, l]) => html`<button class="tab ${AD.tab === k ? "on" : ""}" data-act="admin-tab" data-tab="${k}">${l}</button>`)}</nav>`;
  let body;
  try { body = await tabBody(); }
  catch (e) { if (e.status === 401) return loginView(); throw e; }
  app().innerHTML = html`${head}<div class="admin-body-inner">${body}</div>`.s;
  hydrateIcons(app());
}
ACT["admin-tab"] = async el => { AD.tab = el.dataset.tab; AD.q = ""; await dashboard(); };

const table = (cols, rows, empty) => rows.length ? html`<div class="atable-wrap"><table class="atable"><thead><tr>${cols.map(c => html`<th>${c}</th>`)}</tr></thead><tbody>${rows}</tbody></table></div>` : html`<div class="empty"><p class="muted">${empty}</p></div>`;
const delBtn = (kind, id, label = "Delete") => html`<button class="btn sm danger" data-act="admin-del" data-kind="${kind}" data-id="${id}">${label}</button>`;

async function tabBody() {
  const t = AD.tab;
  if (t === "overview") {
    const s = await api("/admin/stats");
    return html`<div class="admin-stats">${Object.entries(s).map(([k, v]) => html`<div class="stat card"><b>${v}</b><span>${k}</span></div>`)}</div>
      <p class="muted">Deleting something here removes it for good. Deleting a user also removes everything they posted. The weak spot in any site like this is the admin password: set a long one with the <code>ADMIN_PASSWORD</code> environment variable in Vercel.</p>`;
  }
  if (t === "users") {
    const d = await api("/admin/users" + qs({ q: AD.q }));
    return html`<form class="inline-search admin-search" data-form="admin-search">${icon("search")}<input name="q" value="${AD.q}" placeholder="Search users by name, username or email..." aria-label="Search users"></form>
      ${table(["User", "Email", "Joined", "Posts", "Comments", "Arguments", ""], d.items.map(u => html`<tr><td><b>${u.display_name}</b><br><a class="muted small" href="${siteLink("/u/" + u.username)}" target="_blank" rel="noopener">@${u.username}</a></td><td>${u.email}</td><td>${ago(u.created_at)}</td><td>${u.discussions}</td><td>${u.comments}</td><td>${u.arguments}</td><td>${delBtn("users", u.id, "Delete user")}</td></tr>`), "No users found.")}`;
  }
  if (t === "discussions") {
    const d = await api("/admin/discussions");
    return table(["Title", "By", "Category", "Replies", "Posted", ""], d.items.map(x => html`<tr><td><a href="${siteLink("/d/" + x.id)}" target="_blank" rel="noopener">${x.title}</a></td><td>@${x.username}</td><td>${x.category}</td><td>${x.replies}</td><td>${ago(x.created_at)}</td><td>${delBtn("discussions", x.id)}</td></tr>`), "No discussions yet.");
  }
  if (t === "comments") {
    const d = await api("/admin/comments");
    return table(["Comment", "By", "On", "Posted", ""], d.items.map(x => html`<tr><td>${clip(x.body)}</td><td>@${x.username}</td><td><a href="${siteLink(x.target_type === "debate" ? "/debates/" + x.target_id : "/d/" + x.target_id)}" target="_blank" rel="noopener">${x.target_type} ${x.target_id}</a></td><td>${ago(x.created_at)}</td><td>${delBtn("comments", x.id)}</td></tr>`), "No comments yet.");
  }
  if (t === "debates") {
    const d = await api("/admin/debates");
    return table(["Debate", "Proposed by", "Category", "Arguments", "Created", ""], d.items.map(x => html`<tr><td><a href="${siteLink("/debates/" + x.id)}" target="_blank" rel="noopener">${x.title}</a></td><td>${x.username ? "@" + x.username : "—"}</td><td>${x.category}</td><td>${x.arguments}</td><td>${ago(x.created_at)}</td><td>${delBtn("debates", x.id)}</td></tr>`), "No debates yet.");
  }
  if (t === "arguments") {
    const d = await api("/admin/arguments");
    return table(["Argument", "By", "In debate", "Type", "Posted", ""], d.items.map(x => html`<tr><td>${clip(x.body)}</td><td>@${x.username}</td><td><a href="${siteLink("/debates/" + x.debate_id)}" target="_blank" rel="noopener">${clip(x.debate, 50)}</a></td><td>${x.kind}, ${x.side === "aff" ? "affirmative" : "opposing"}</td><td>${ago(x.created_at)}</td><td>${delBtn("arguments", x.id)}</td></tr>`), "No arguments yet.");
  }
  const d = await api("/admin/groups");
  return table(["Group", "Members", "Discussions", "Created", ""], d.items.map(x => html`<tr><td><a href="${siteLink("/groups/" + x.slug)}" target="_blank" rel="noopener">${x.name}</a></td><td>${x.members}</td><td>${x.discussions}</td><td>${ago(x.created_at)}</td><td>${delBtn("groups", x.id)}</td></tr>`), "No groups.");
}

FORM["admin-search"] = async (f, d) => { AD.q = d.q || ""; await dashboard(); };
const WARN = {
  users: "This deletes the account and everything it posted: discussions, comments, arguments, notes and lists. It cannot be undone.",
  discussions: "This deletes the discussion and all of its replies.", comments: "This deletes the comment and any replies to it.",
  debates: "This deletes the debate with all its arguments, votes and comments.", arguments: "This deletes the argument.",
  groups: "This deletes the group. Its discussions stay on the site as public discussions.",
};
ACT["admin-del"] = async el => {
  const kind = el.dataset.kind;
  if (!await confirmBox("Delete permanently?", WARN[kind], "Delete")) return;
  await api(`/admin/${kind}/${el.dataset.id}`, { method: "DELETE" }); toast("Deleted", "ok"); await dashboard();
};

/* any 401 from the admin API sends you back to the sign-in form */
const _run = run;
window.run = async fn => { try { return await fn(); } catch (e) { if (e.status === 401) return loginView(); toast(e.message || "Something went wrong.", "err"); } };

show().catch(e => { app().innerHTML = html`<div class="empty big"><h1>Cannot reach the server</h1><p>${e.message}</p></div>`.s; });
