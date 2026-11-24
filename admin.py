"""Admin area. The page lives at /adm1n and is not linked from anywhere on the site.
Sign-in uses the ADMIN_PASSWORD environment variable (default below). Sessions last 8 hours and use their own cookie."""
import hmac, os
import db, security
from framework import route, HTTPError, ADMIN_COOKIE
from routes import rows, _limited, delete_discussion_rows

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "162534")

@route("POST", "/api/admin/login")
def admin_login(r):
    _limited(r, "adminip:" + r.ip, 5, 600)            # 5 tries per IP per 10 minutes
    _limited(r, "adminall", 40, 600)                  # and 40 across everyone, so guessing from many addresses is slow too
    pw = r.body.get("password", "")
    if not isinstance(pw, str) or not hmac.compare_digest(pw.encode(), ADMIN_PASSWORD.encode()):
        for k in ("adminip:" + r.ip, "adminall"): r.db.execute("INSERT INTO login_attempts VALUES(?,?)", (k, db.now()))
        r.db.commit(); raise HTTPError(401, "Incorrect password.")
    now = db.now(); tok = security.new_token()
    r.db.execute("DELETE FROM admin_sessions WHERE expires_at<?", (now,))
    r.db.execute("INSERT INTO admin_sessions VALUES(?,?)", (tok, now + 8 * 3600))
    r.set_cookie(tok, 8 * 3600, ADMIN_COOKIE, "Strict")

@route("POST", "/api/admin/logout")
def admin_logout(r):
    from http.cookies import SimpleCookie
    c = SimpleCookie(r.h.headers.get("Cookie", ""))
    if ADMIN_COOKIE in c: r.db.execute("DELETE FROM admin_sessions WHERE token=?", (c[ADMIN_COOKIE].value,))
    r.set_cookie("", 0, ADMIN_COOKIE, "Strict")

@route("GET", "/api/admin/me")
def admin_me(r): return {"admin": r.is_admin}

@route("GET", "/api/admin/stats")
def admin_stats(r):
    r.need_admin(); out = {}
    for k, t in (("users", "users"), ("discussions", "discussions"), ("comments", "comments"), ("debates", "debates"), ("arguments", "debate_entries"),
                 ("groups", "groups_"), ("library items", "articles"), ("reading lists", "reading_lists"), ("study paths", "study_paths")):
        out[k] = r.db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    return out

@route("GET", "/api/admin/users")
def admin_users(r):
    r.need_admin(); q = f"%{r.q('q').strip()}%"
    return {"items": rows(r.db.execute("""SELECT u.id, u.username, u.email, u.display_name, u.created_at,
        (SELECT COUNT(*) FROM discussions d WHERE d.author_id=u.id) discussions, (SELECT COUNT(*) FROM comments c WHERE c.author_id=u.id) comments,
        (SELECT COUNT(*) FROM debate_entries e WHERE e.author_id=u.id) arguments
        FROM users u WHERE u.username LIKE ? OR u.email LIKE ? OR u.display_name LIKE ? ORDER BY u.created_at DESC LIMIT 200""", (q, q, q)))}

@route("DELETE", "/api/admin/users/<id>")
def admin_delete_user(r):
    r.need_admin(); uid = int(r.params["id"]) if r.params["id"].isdigit() else 0
    if not r.db.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone(): raise HTTPError(404, "User not found.")
    c = r.db
    for d in c.execute("SELECT id FROM discussions WHERE author_id=?", (uid,)).fetchall(): delete_discussion_rows(c, d["id"])
    c.execute("DELETE FROM comments WHERE author_id=?", (uid,))
    c.execute("DELETE FROM debate_entries WHERE author_id=?", (uid,))
    c.execute("UPDATE debates SET author_id=NULL WHERE author_id=?", (uid,))
    c.execute("UPDATE groups_ SET owner_id=NULL WHERE owner_id=?", (uid,))
    c.execute("DELETE FROM users WHERE id=?", (uid,))          # sessions, bookmarks, notes, lists, progress etc. cascade

@route("GET", "/api/admin/discussions")
def admin_discussions(r):
    r.need_admin()
    return {"items": rows(r.db.execute("""SELECT d.id, d.title, d.category, d.created_at, u.username,
        (SELECT COUNT(*) FROM comments c WHERE c.target_type='discussion' AND c.target_id=d.id) replies FROM discussions d JOIN users u ON u.id=d.author_id ORDER BY d.created_at DESC LIMIT 200"""))}

@route("DELETE", "/api/admin/discussions/<id>")
def admin_delete_discussion(r):
    r.need_admin(); delete_discussion_rows(r.db, int(r.params["id"]) if r.params["id"].isdigit() else 0)

@route("GET", "/api/admin/comments")
def admin_comments(r):
    r.need_admin()
    return {"items": rows(r.db.execute("""SELECT c.id, c.target_type, c.target_id, c.body, c.created_at, u.username FROM comments c JOIN users u ON u.id=c.author_id
        ORDER BY c.created_at DESC LIMIT 150"""))}

@route("DELETE", "/api/admin/comments/<id>")
def admin_delete_comment(r):
    r.need_admin(); r.db.execute("DELETE FROM comments WHERE id=?", (int(r.params["id"]) if r.params["id"].isdigit() else 0,))

@route("GET", "/api/admin/debates")
def admin_debates(r):
    r.need_admin()
    return {"items": rows(r.db.execute("""SELECT d.id, d.title, d.category, d.created_at, u.username,
        (SELECT COUNT(*) FROM debate_entries e WHERE e.debate_id=d.id) arguments FROM debates d LEFT JOIN users u ON u.id=d.author_id ORDER BY d.created_at DESC LIMIT 200"""))}

@route("GET", "/api/admin/arguments")
def admin_arguments(r):
    r.need_admin()
    return {"items": rows(r.db.execute("""SELECT e.id, e.debate_id, e.side, e.kind, e.body, e.created_at, u.username, d.title debate FROM debate_entries e
        JOIN users u ON u.id=e.author_id JOIN debates d ON d.id=e.debate_id ORDER BY e.created_at DESC LIMIT 150"""))}

@route("DELETE", "/api/admin/arguments/<id>")
def admin_delete_argument(r):
    r.need_admin(); r.db.execute("DELETE FROM debate_entries WHERE id=?", (int(r.params["id"]) if r.params["id"].isdigit() else 0,))

@route("DELETE", "/api/admin/debates/<id>")
def admin_delete_debate(r):
    r.need_admin(); did = int(r.params["id"]) if r.params["id"].isdigit() else 0
    r.db.execute("DELETE FROM comments WHERE target_type='debate' AND target_id=?", (did,))
    r.db.execute("DELETE FROM bookmarks WHERE kind='debate' AND ref=?", (str(did),))
    r.db.execute("DELETE FROM debates WHERE id=?", (did,))       # arguments and votes cascade

@route("GET", "/api/admin/groups")
def admin_groups(r):
    r.need_admin()
    return {"items": rows(r.db.execute("""SELECT g.id, g.slug, g.name, g.created_at,
        (SELECT COUNT(*) FROM group_members m WHERE m.group_id=g.id) members, (SELECT COUNT(*) FROM discussions d WHERE d.group_id=g.id) discussions FROM groups_ g ORDER BY g.name"""))}

@route("DELETE", "/api/admin/groups/<id>")
def admin_delete_group(r):
    r.need_admin(); gid = int(r.params["id"]) if r.params["id"].isdigit() else 0
    r.db.execute("UPDATE discussions SET group_id=NULL WHERE group_id=?", (gid,))
    r.db.execute("DELETE FROM groups_ WHERE id=?", (gid,))
