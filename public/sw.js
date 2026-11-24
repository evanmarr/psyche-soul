/* Psyche & Soul service worker: makes the site installable and usable offline.
   - app files: served from cache, refreshed in the background (so updates arrive on the next visit)
   - public API data: network first, falling back to the last copy you saw
   - personal data (account, notes lists, notifications) is never stored by the worker
   - whole-Bible downloads are kept by the page itself in the "ps-offline" cache
   Bump VERSION when you change the list of app files below. */
const VERSION = "v2";
const SHELL_CACHE = "ps-shell-" + VERSION, API_CACHE = "ps-api";
const SHELL = ["/", "/css/app.css", "/css/light.css", "/js/theme.js", "/js/core.js", "/js/poster.js", "/js/bible.js", "/js/forums.js", "/js/debates.js",
  "/js/library.js", "/js/study.js", "/js/verse.js", "/js/community.js", "/js/home.js", "/js/main.js", "/img/logo.png", "/img/favicon.png",
  "/img/background.jpg", "/img/icon-192.png", "/manifest.webmanifest"];
const PRIVATE = [/^\/api\/me$/, /^\/api\/notifications/, /^\/api\/bookmarks/, /^\/api\/bible\/mine/, /^\/api\/progress/, /^\/api\/admin/, /^\/api\/bible\/pack/, /^\/api\/lists$/];

self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("ps-shell-") && k !== SHELL_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try { const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
  catch (err) { const hit = await cache.match(req); if (hit) return hit; throw err; }
}
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName), hit = await cache.match(req);
  const fresh = fetch(req).then(res => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await fresh) || Response.error();
}

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/adm1n")) return;                                        // the admin page is never cached
    if (url.pathname.startsWith("/api/")) {
      const key = url.pathname + (url.searchParams.get("mine") ? "?mine" : "");
      if (PRIVATE.some(rx => rx.test(key))) return;
      e.respondWith(networkFirst(req, API_CACHE).catch(() => new Response(JSON.stringify({ error: "You appear to be offline." }), { status: 503, headers: { "Content-Type": "application/json" } })));
      return;
    }
    if (req.mode === "navigate") {                                                        // page loads: try the network, else the cached app
      e.respondWith(fetch(req).catch(() => caches.match("/", { cacheName: SHELL_CACHE })));
      return;
    }
    e.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(staleWhileRevalidate(req, "ps-fonts"));
});
