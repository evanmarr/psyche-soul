/* Homepage. */
"use strict";
const HOME_FILTERS = [["all", "All"], ["theology", "Theology"], ["philosophy", "Philosophy"], ["debates", "Debates"]];
async function homeList(f) {
  if (f === "debates") { const d = await api("/debates"); return html`${d.items.slice(0, 5).map(debateRow)}`; }
  const d = await api("/discussions" + qs({ cat: f === "all" ? "" : f, sort: "active", limit: 5 }));
  return d.items.length ? html`${d.items.map(discRow)}` : emptyState("Nothing here yet");
}
ACT["home-filter"] = async el => {
  $$("#hfilters .fchip").forEach(c => c.classList.toggle("on", c === el));
  const box = $("#hlist"); box.classList.add("loading"); box.innerHTML = (await homeList(el.dataset.f)).s; hydrateIcons(box); box.classList.remove("loading");
};
ACT["votd-bm"] = async el => {
  const d = await api("/bookmarks", { method: "POST", body: { kind: "verse", ref: el.dataset.ref } });
  el.classList.toggle("on", d.bookmarked); el.setAttribute("aria-pressed", d.bookmarked); toast(d.bookmarked ? "Verse saved" : "Removed from bookmarks", d.bookmarked ? "ok" : "");
};
page("/", async () => {
  const [list, votd, deb, lib, prog] = await Promise.all([homeList("all"), api("/votd"), api("/debates"), api("/library"), S.user ? api("/progress").catch(() => null) : null]);
  const quick = [["book", "Read the Bible", "WEB · KJV · Annotate · Quote", "#/bible", "feature"], ["chat", "Join a Discussion", "Theology · Philosophy · More", "#/forums"], ["scale", "Debate a Topic", "Structured · Civil · In-Depth", "#/debates"], ["layers", "Explore the Library", "Articles · Resources · Essays", "#/library"]];
  const feat = deb.items[0] || null;
  return { title: "", html: html`
  <section class="hero" aria-label="Psyche and Soul"><div class="hero-art"></div><div class="hero-inner">
    <h1 class="hero-title">Psyche <span class="amp">&amp;</span> Soul</h1>
    <p class="hero-sub"><span>Theology</span><i>&bull;</i><span>Philosophy</span><i>&bull;</i><span>Discussion</span></p>
    <p class="hero-tag">Where the love of wisdom meets the study of the soul.</p></div></section>
  <section class="quick">${quick.map(([ic, t, s, h, f]) => html`<a class="qcard ${f || ""}" href="${h}"><span class="qico">${icon(ic)}</span><span class="qtxt"><b>${t}</b><small>${s}</small></span>${icon("right", "qarrow")}</a>`)}</section>
  <div class="home-grid">
    <section class="panel recent"><header class="phead2"><h2>Recent Discussions</h2><div class="fchips" id="hfilters">${HOME_FILTERS.map(([k, l], i) => html`<button class="fchip ${i === 0 ? "on" : ""}" data-act="home-filter" data-f="${k}">${l}</button>`)}</div></header>
      <div class="list flat" id="hlist">${list}</div><footer class="pfoot"><a class="link" href="#/forums">Browse all discussions ${icon("right")}</a></footer></section>
    <aside class="side-col">
      <section class="panel votd"><header class="phead2"><h2>${icon("book")} Verse of the Day</h2><button class="icon-btn bm ${votd.bookmarked ? "on" : ""}" data-act="votd-bm" data-ref="${votd.ref}" aria-pressed="${votd.bookmarked}" aria-label="Bookmark this verse">${icon("bookmark")}</button></header>
        <p class="vref"><a href="#/bible/${votd.book}/${votd.chapter}?v=${votd.verse}">${votd.label}</a> <span>(${votd.translation})</span></p><blockquote class="vtext">&ldquo;${votd.text}&rdquo;</blockquote>
        <a class="link" href="#/bible/${votd.book}/${votd.chapter}?v=${votd.verse}">Read the chapter ${icon("right")}</a></section>
      <section class="panel reading"><header class="phead2"><h2>${icon("book")} Your Reading</h2></header>
        ${!S.user ? html`<p class="muted">Sign in to track your reading progress and pick up where you left off.</p><button class="btn primary" data-act="auth">Sign in</button>`
        : prog && prog.current ? html`<div class="rrow"><b>${prog.current.name}</b><span class="muted">${prog.current.read} of ${prog.current.chapters} chapters</span></div><div class="prog"><i style="width:${Math.round(prog.current.read / prog.current.chapters * 100)}%"></i></div>
          <p class="eyebrow">Recently read</p><div class="chips tight">${prog.recent.map(r => html`<a class="chip" href="#/bible/${r.book}/${r.chapter}">${r.label}</a>`)}</div>
          <a class="btn primary wide" href="#/bible/${prog.current.book}/${prog.current.last_chapter}">Continue reading</a>`
        : html`<p class="muted">You have not read anything yet. Open a chapter and it will appear here.</p><a class="btn primary" href="#/bible/john/1">Start with John</a>`}</section>
    </aside></div>
  <div class="home-grid two">
    <section class="panel"><header class="phead2"><h2>${icon("scale")} Featured Debate</h2><a class="link" href="#/debates">All debates</a></header>
      ${feat ? html`<a class="feature-link" href="#/debates/${feat.id}"><h3>${feat.title}</h3><p class="muted">${feat.question}</p><div class="sides"><span class="side aff">${feat.aff_label}</span><span class="vs">vs</span><span class="side opp">${feat.opp_label}</span></div></a></section>` : html`<div class="feature-link"><h3>No debates yet</h3><p class="muted">Pose a question, set out two positions, and invite others to argue them well.</p><a class="btn primary" href="#/debates/new" data-need-login>Propose the first debate</a></div></section>`}
    <section class="panel"><header class="phead2"><h2>${icon("layers")} From the Library</h2><a class="link" href="#/library">Browse</a></header>
      <div class="list flat">${lib.items.slice(0, 3).map(a => html`<a class="hrow col" href="#/library/${a.id}"><b>${a.title}</b><span class="muted">${typeNames[a.type]} &middot; ${a.author}</span></a>`)}</div></section>
  </div>
  <section class="topics-strip"><h2 class="sec">Explore topics</h2><div class="chips wrapchips">${S.cats.map(c => html`<a class="chip" href="#/topic/${c.slug}">${icon(c.icon)} ${c.name}</a>`)}</div></section>
  <footer class="site-foot"><span>Psyche &amp; Soul &mdash; thoughtful, charitable, evidence-based conversation.</span><span><a href="#/guidelines">Community guidelines</a></span></footer>` };
});
