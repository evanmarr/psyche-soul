"""Database access. Local development uses a SQLite file; production (Vercel) uses Turso, a hosted SQLite service,
through its HTTP API. Both speak the same SQL, so the rest of the app does not care which one it gets.

Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to use Turso."""
import base64, http.client, json, os, sqlite3, time
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("PSYCHE_DB", os.path.join(ROOT, "data", "psyche.db"))
TURSO_URL = os.environ.get("TURSO_DATABASE_URL", "").strip()
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "").strip()
REMOTE = bool(TURSO_URL)

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE, email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  pw_hash TEXT NOT NULL, display_name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS categories(slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, icon TEXT NOT NULL, sort INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS groups_(id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'users', owner_id INTEGER REFERENCES users(id), created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS group_members(group_id INTEGER NOT NULL REFERENCES groups_(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, joined_at INTEGER NOT NULL, PRIMARY KEY(group_id,user_id));
CREATE TABLE IF NOT EXISTS discussions(id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id), category TEXT NOT NULL REFERENCES categories(slug),
  label TEXT NOT NULL DEFAULT 'discussion', tags TEXT NOT NULL DEFAULT '', group_id INTEGER REFERENCES groups_(id),
  created_at INTEGER NOT NULL, last_activity INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0, is_debate_thread INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, target_type TEXT NOT NULL, target_id INTEGER NOT NULL,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE, author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type,target_id);
CREATE TABLE IF NOT EXISTS reactions(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL, kind TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,target_type,target_id));
CREATE TABLE IF NOT EXISTS bookmarks(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL,
  ref TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,kind,ref));
CREATE TABLE IF NOT EXISTS highlights(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, book INTEGER NOT NULL,
  chapter INTEGER NOT NULL, verse INTEGER NOT NULL, color TEXT NOT NULL, PRIMARY KEY(user_id,book,chapter,verse));
CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, verse_end INTEGER NOT NULL, body TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS history(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, book INTEGER NOT NULL,
  chapter INTEGER NOT NULL, read_at INTEGER NOT NULL, PRIMARY KEY(user_id,book,chapter));
CREATE TABLE IF NOT EXISTS plans(id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, days TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS plan_progress(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE, completed TEXT NOT NULL DEFAULT '[]', started_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,plan_id));
CREATE TABLE IF NOT EXISTS debates(id INTEGER PRIMARY KEY, title TEXT NOT NULL, question TEXT NOT NULL, summary TEXT NOT NULL,
  category TEXT NOT NULL, aff_label TEXT NOT NULL, opp_label TEXT NOT NULL, aff_summary TEXT NOT NULL, opp_summary TEXT NOT NULL,
  created_at INTEGER NOT NULL, last_activity INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS debate_entries(id INTEGER PRIMARY KEY, debate_id INTEGER NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  side TEXT NOT NULL, kind TEXT NOT NULL, author_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL,
  verses TEXT NOT NULL DEFAULT '[]', refs TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS debate_votes(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  debate_id INTEGER NOT NULL REFERENCES debates(id) ON DELETE CASCADE, side TEXT NOT NULL, moved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, PRIMARY KEY(user_id,debate_id));
CREATE TABLE IF NOT EXISTS articles(id INTEGER PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL,
  author TEXT NOT NULL, summary TEXT NOT NULL, body TEXT NOT NULL, label TEXT NOT NULL DEFAULT 'discussion', tags TEXT NOT NULL DEFAULT '',
  read_minutes INTEGER NOT NULL DEFAULT 5, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL, link TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts(key TEXT NOT NULL, at INTEGER NOT NULL);
"""

# ------------------------------------------------------------------------ Turso over HTTP (no dependencies)
class Row(dict):
    """A result row: row["name"], row[0] and dict(row) all work, like sqlite3.Row."""
    def __getitem__(self, k): return list(self.values())[k] if isinstance(k, int) else dict.__getitem__(self, k)

class RemoteCursor:
    def __init__(self, rows=(), lastrowid=None, rowcount=0): self.rows, self.lastrowid, self.rowcount, self._i = list(rows), lastrowid, rowcount, 0
    def fetchone(self):
        if self._i < len(self.rows): self._i += 1; return self.rows[self._i - 1]
        return None
    def fetchall(self): r, self._i = self.rows[self._i:], len(self.rows); return r
    def __iter__(self): return iter(self.fetchall())

def _enc(v):
    if v is None: return {"type": "null"}
    if isinstance(v, bool): return {"type": "integer", "value": str(int(v))}
    if isinstance(v, int): return {"type": "integer", "value": str(v)}
    if isinstance(v, float): return {"type": "float", "value": v}
    if isinstance(v, (bytes, bytearray)): return {"type": "blob", "base64": base64.b64encode(v).decode()}
    return {"type": "text", "value": str(v)}

def _dec(c):
    t = c.get("type")
    if t == "null": return None
    if t == "integer": return int(c["value"])
    if t == "float": return float(c["value"])
    if t == "blob": return base64.b64decode(c.get("base64", ""))
    return c.get("value")

class RemoteConn:
    def __init__(self, url, token):
        u = urlsplit(url.replace("libsql://", "https://", 1))
        self.scheme, self.host, self.token = u.scheme, u.netloc, token
        self._http = None
    def _post(self, payload):
        body = json.dumps(payload).encode()
        for attempt in (0, 1):
            try:
                if self._http is None:
                    self._http = (http.client.HTTPSConnection if self.scheme == "https" else http.client.HTTPConnection)(self.host, timeout=20)
                self._http.request("POST", "/v2/pipeline", body, {"Authorization": "Bearer " + self.token, "Content-Type": "application/json"})
                res = self._http.getresponse(); data = res.read()
                if res.status != 200: raise RuntimeError(f"Database error {res.status}: {data[:200]!r}")
                return json.loads(data)
            except (http.client.HTTPException, OSError):
                self._http = None
                if attempt: raise
    def execute(self, sql, args=()):
        reqs = [{"type": "execute", "stmt": {"sql": "PRAGMA foreign_keys=ON"}},
                {"type": "execute", "stmt": {"sql": sql, "args": [_enc(a) for a in args]}}, {"type": "close"}]
        res = self._post({"requests": reqs})["results"][1]
        if res["type"] == "error":
            msg = res["error"].get("message", "database error")
            raise (sqlite3.IntegrityError if "constraint" in msg.lower() else RuntimeError)(msg)
        r = res["response"]["result"]; cols = [c["name"] for c in r["cols"]]
        rows = [Row(zip(cols, (_dec(c) for c in row))) for row in r["rows"]]
        lid = r.get("last_insert_rowid")
        return RemoteCursor(rows, int(lid) if lid is not None else None, r.get("affected_row_count", 0))
    def executescript(self, script):
        for stmt in script.split(";"):
            if stmt.strip() and not stmt.strip().upper().startswith("PRAGMA"): self.execute(stmt)
    def commit(self): pass
    def rollback(self): pass
    def close(self):
        if self._http: self._http.close(); self._http = None

def connect():
    if REMOTE: return RemoteConn(TURSO_URL, TURSO_TOKEN)
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    return c

def init():
    if REMOTE:
        c = connect(); c.executescript(SCHEMA); c.close(); return
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    c = connect(); c.execute("PRAGMA journal_mode=WAL"); c.executescript(SCHEMA); c.commit(); c.close()

def now(): return int(time.time())
