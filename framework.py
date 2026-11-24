"""Minimal routing layer on top of http.server: JSON in/out, cookie sessions, security headers."""
import json, mimetypes, os, re, time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs, unquote
import db

ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(ROOT, "public")
COOKIE = "ps_session"
ADMIN_COOKIE = "ps_admin"
SECURE = os.environ.get("PSYCHE_SECURE", "") == "1" or bool(os.environ.get("VERCEL"))
ROUTES = []

class HTTPError(Exception):
    def __init__(self, status, message): self.status, self.message = status, message

def route(method, pattern):
    rx = re.compile("^" + re.sub(r"<(\w+)>", r"(?P<\1>[^/]+)", pattern) + "$")
    def deco(fn): ROUTES.append((method, rx, fn)); return fn
    return deco

class Req:
    def __init__(self, handler, method, path, query, body, params):
        self.h, self.method, self.path, self.query, self.body, self.params = handler, method, path, query, body, params
        self.db = db.connect(); self.user = None; self.cookies_out = []; self.ip = (handler.headers.get("X-Forwarded-For", "").split(",")[0].strip() or handler.client_address[0])
        self._auth()
    def _auth(self):
        c = SimpleCookie(self.h.headers.get("Cookie", ""))
        if COOKIE in c:
            r = self.db.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?", (c[COOKIE].value, db.now())).fetchone()
            self.user = r
    def q(self, name, default=""): return (self.query.get(name) or [default])[0]
    def qi(self, name, default=0, lo=0, hi=10**9):
        try: return max(lo, min(hi, int(self.q(name, str(default)))))
        except ValueError: return default
    @property
    def uid(self): return self.user["id"] if self.user else 0
    def need_user(self):
        if not self.user: raise HTTPError(401, "Please sign in to do that.")
        return self.user
    def field(self, name, lo=0, hi=10000, required=True):
        v = self.body.get(name, "")
        v = v.strip() if isinstance(v, str) else ""
        if required and len(v) < max(lo, 1): raise HTTPError(400, f"'{name}' is required" + (f" (at least {lo} characters)" if lo > 1 else "."))
        if len(v) < lo and v: raise HTTPError(400, f"'{name}' must be at least {lo} characters.")
        if len(v) > hi: raise HTTPError(400, f"'{name}' is too long (max {hi} characters).")
        return v
    def set_cookie(self, token, max_age, name=COOKIE, samesite="Lax"):
        self.cookies_out.append(f"{name}={token}; Path=/; HttpOnly; SameSite={samesite}; Max-Age={max_age}" + ("; Secure" if SECURE else ""))
    @property
    def is_admin(self):
        c = SimpleCookie(self.h.headers.get("Cookie", ""))
        if ADMIN_COOKIE not in c: return False
        return bool(self.db.execute("SELECT 1 FROM admin_sessions WHERE token=? AND expires_at>?", (c[ADMIN_COOKIE].value, db.now())).fetchone())
    def need_admin(self):
        if not self.is_admin: raise HTTPError(401, "Admin sign-in required.")

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")

class Handler(BaseHTTPRequestHandler):
    server_version = "PsycheSoul/1.0"
    def log_message(self, fmt, *a):
        if os.environ.get("PSYCHE_LOG"): super().log_message(fmt, *a)

    def _send(self, status, body, ctype, extra=None):
        self.send_response(status)
        self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff"); self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Content-Security-Policy", CSP); self.send_header("X-Frame-Options", "DENY")
        for k, v in (extra or []): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)

    def _json(self, status, obj, cookies=()):
        self._send(status, json.dumps(obj, ensure_ascii=False).encode(), "application/json; charset=utf-8",
                   [("Cache-Control", "no-store")] + [("Set-Cookie", c) for c in cookies])

    def _static(self, path):
        rel = "index.html" if path in ("/", "") else "adm1n.html" if path.rstrip("/") == "/adm1n" else unquote(path.lstrip("/"))
        if rel.startswith("public/"): rel = rel[7:]
        full = os.path.normpath(os.path.join(STATIC, rel))
        if not full.startswith(STATIC + os.sep) or not os.path.isfile(full):
            if "." not in os.path.basename(rel): full = os.path.join(STATIC, "index.html")     # SPA fallback
            else: return self._json(404, {"error": "Not found"})
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "image/svg+xml"): ctype += "; charset=utf-8"
        with open(full, "rb") as f: data = f.read()
        self._send(200, data, ctype, [("Cache-Control", "no-cache")])

    def _dispatch(self, method):
        u = urlsplit(self.path)
        query = parse_qs(u.query)
        if u.path in ("/api/index", "/api/index.py") and "path" in query:        # Vercel rewrite target
            real = "/api/" + query.pop("path")[0].strip("/")
            u = u._replace(path=real, query="&".join(f"{k}={v}" for k, vs in query.items() for v in vs))
        if not u.path.startswith("/api/"):
            if method != "GET": return self._json(405, {"error": "Method not allowed"})
            return self._static(u.path)
        body = {}
        if method != "GET":
            if self.headers.get("X-Requested-With") != "psyche": return self._json(403, {"error": "Missing request header."})
            n = int(self.headers.get("Content-Length") or 0)
            if n > 400_000: return self._json(413, {"error": "Request too large."})
            raw = self.rfile.read(n) if n else b""
            try: body = json.loads(raw or b"{}")
            except ValueError: return self._json(400, {"error": "Invalid JSON."})
            if not isinstance(body, dict): return self._json(400, {"error": "Expected a JSON object."})
        for m, rx, fn in ROUTES:
            mt = rx.match(u.path)
            if m == method and mt:
                req = Req(self, method, u.path, parse_qs(u.query), body, {k: unquote(v) for k, v in mt.groupdict().items()})
                try:
                    out = fn(req); req.db.commit()
                    return self._json(200, out if out is not None else {"ok": True}, req.cookies_out)
                except HTTPError as e:
                    req.db.rollback(); return self._json(e.status, {"error": e.message}, req.cookies_out)
                except PermissionError as e:
                    return self._json(403, {"error": str(e)})
                except Exception as e:                                     # never leak internals
                    req.db.rollback(); import traceback; traceback.print_exc()
                    return self._json(500, {"error": "Something went wrong on our side."})
                finally: req.db.close()
        self._json(404, {"error": "Not found"})

    def do_GET(self): self._dispatch("GET")
    def do_POST(self): self._dispatch("POST")
    def do_PUT(self): self._dispatch("PUT")
    def do_DELETE(self): self._dispatch("DELETE")

def serve(port, host="127.0.0.1"):
    try: srv = ThreadingHTTPServer((host, port), Handler)
    except OSError as e:
        print(f"\nCould not start: port {port} is already in use (Psyche & Soul may already be running).\n"
              f"  Open http://{host}:{port} to see it, stop the old one with:  lsof -ti :{port} | xargs kill\n"
              f"  or start this one on another port:  PORT={port + 1} python3 server.py\n"); raise SystemExit(1)
    srv.daemon_threads = True
    print(f"Psyche & Soul running at http://{host}:{port}"); srv.serve_forever()
