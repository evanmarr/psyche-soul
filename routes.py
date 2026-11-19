"""All JSON endpoints."""
import json, re, datetime
import bible, db, security
from framework import route, HTTPError
from seed_content import LABELS

REACTIONS = ("like", "insightful", "gracious")
COLORS = ("gold", "purple", "green", "blue", "rose")
ENTRY_KINDS = ("opening", "rebuttal", "counterargument")
USERNAME = re.compile(r"^[A-Za-z0-9_]{3,24}$")
EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")

def rows(cur): return [dict(r) for r in cur.fetchall()]
def one(cur): r = cur.fetchone(); return dict(r) if r else None

def person(r, p="a_"):
    return {"username": r[p + "username"], "name": r[p + "name"], "avatar": r[p + "avatar"]}

AUTHOR_COLS = "u.username a_username, u.display_name a_name, u.avatar a_avatar"

def clean_tags(s):
    out = []
    for t in re.split(r"[,\s]+", (s or "").lower()):
        t = re.sub(r"[^a-z0-9-]", "", t)
        if t and t not in out: out.append(t[:24])
    return out[:5]

def notify(c, user_id, text, link, actor_id=None):
    if user_id and user_id != actor_id:
        c.execute("INSERT INTO notifications(user_id,text,link,created_at) VALUES(?,?,?,?)", (user_id, text, link, db.now()))

def public_user(u):
    return {"id": u["id"], "username": u["username"], "name": u["display_name"], "bio": u["bio"], "avatar": u["avatar"], "joined": u["created_at"]}

# ---------------------------------------------------------------- session / account
def _limited(r, key, limit, window):
    r.db.execute("DELETE FROM login_attempts WHERE at<?", (db.now() - window,))
    n = r.db.execute("SELECT COUNT(*) FROM login_attempts WHERE key=?", (key,)).fetchone()[0]
    if n >= limit: raise HTTPError(429, "Too many attempts. Please wait a few minutes and try again.")

def _start_session(r, user_id):
    tok = security.new_token(); now = db.now()
    r.db.execute("INSERT INTO sessions VALUES(?,?,?,?)", (tok, user_id, now, now + 30 * 86400))
    r.set_cookie(tok, 30 * 86400)

@route("GET", "/api/me")
def me(r):
    d = r.db.execute("SELECT pw_hash FROM users WHERE username='demo'").fetchone()
    cfg = {"esv": bool(bible.ESV_KEY), "labels": LABELS, "demo": bool(d and not d["pw_hash"].startswith("pbkdf2$0$"))}
    if not r.user: return {"user": None, "config": cfg}
    unread = r.db.execute("SELECT COUNT(*) FROM notifications WHERE user_id=? AND read=0", (r.uid,)).fetchone()[0]
    return {"user": public_user(r.user), "unread": unread, "config": cfg}

@route("POST", "/api/register")
def register(r):
    _limited(r, "reg:" + r.ip, 10, 3600)
    username, email = r.field("username", 3, 24), r.field("email", 5, 254).lower()
    name, pw = r.field("name", 1, 60, False) or username, r.body.get("password", "")
    if not USERNAME.match(username): raise HTTPError(400, "Usernames use letters, numbers and underscores (3-24 characters).")
    if not EMAIL.match(email): raise HTTPError(400, "Please enter a valid email address.")
    if not isinstance(pw, str) or len(pw) < 8 or len(pw) > 200: raise HTTPError(400, "Password must be at least 8 characters.")
    if r.db.execute("SELECT 1 FROM users WHERE username=? OR email=?", (username, email)).fetchone(): raise HTTPError(409, "That username or email is already registered.")
    r.db.execute("INSERT INTO login_attempts VALUES(?,?)", ("reg:" + r.ip, db.now()))
    cur = r.db.execute("INSERT INTO users(username,email,pw_hash,display_name,bio,avatar,created_at) VALUES(?,?,?,?,?,?,?)",
                       (username, email, security.hash_password(pw), name, "", "", db.now()))
    _start_session(r, cur.lastrowid)
    notify(r.db, cur.lastrowid, "Welcome to Psyche & Soul. Say hello in the introductions thread.", "#/forums", None)
    return {"ok": True}

@route("POST", "/api/login")
def login(r):
    ident = r.field("username", 1, 254).lower(); pw = r.body.get("password", "")
    key = f"login:{r.ip}:{ident}"
    _limited(r, key, 8, 600)
    u = r.db.execute("SELECT * FROM users WHERE username=? OR email=?", (ident, ident)).fetchone()
    if not u or not isinstance(pw, str) or not security.verify_password(pw, u["pw_hash"]):
        r.db.execute("INSERT INTO login_attempts VALUES(?,?)", (key, db.now())); r.db.commit()
        raise HTTPError(401, "Incorrect username or password.")
    _start_session(r, u["id"])
    return {"ok": True}

@route("POST", "/api/logout")
def logout(r):
    from framework import COOKIE
    from http.cookies import SimpleCookie
    c = SimpleCookie(r.h.headers.get("Cookie", ""))
    if COOKIE in c: r.db.execute("DELETE FROM sessions WHERE token=?", (c[COOKIE].value,))
    r.set_cookie("", 0)

@route("PUT", "/api/me")
def update_me(r):
    r.need_user()
    name, bio = r.field("name", 1, 60), r.field("bio", 0, 600, False)
    av = r.body.get("avatar", None)
    if av is not None:
        if av != "" and not (isinstance(av, str) and re.match(r"^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$", av) and len(av) < 180_000):
            raise HTTPError(400, "Profile pictures must be PNG, JPEG or WebP and under about 130 KB.")
        r.db.execute("UPDATE users SET avatar=? WHERE id=?", (av, r.uid))
    r.db.execute("UPDATE users SET display_name=?, bio=? WHERE id=?", (name, bio, r.uid))
    return public_user(r.db.execute("SELECT * FROM users WHERE id=?", (r.uid,)).fetchone())

@route("POST", "/api/me/password")
def change_password(r):
    r.need_user(); cur, new = r.body.get("current", ""), r.body.get("new", "")
    if not security.verify_password(cur, r.user["pw_hash"]): raise HTTPError(403, "Your current password is incorrect.")
    if not isinstance(new, str) or len(new) < 8: raise HTTPError(400, "New password must be at least 8 characters.")
    r.db.execute("UPDATE users SET pw_hash=? WHERE id=?", (security.hash_password(new), r.uid))

@route("GET", "/api/notifications")
def notifications(r):
    r.need_user()
    return {"items": rows(r.db.execute("SELECT id,text,link,read,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 30", (r.uid,)))}

@route("POST", "/api/notifications/read")
def notifications_read(r):
    r.need_user(); r.db.execute("UPDATE notifications SET read=1 WHERE user_id=?", (r.uid,))

# ---------------------------------------------------------------- categories & discussions
@route("GET", "/api/categories")
def categories(r):
    return {"items": rows(r.db.execute("""SELECT c.*, (SELECT COUNT(*) FROM discussions d WHERE d.category=c.slug AND d.group_id IS NULL) discussions
        FROM categories c ORDER BY sort"""))}

def _discussion_rows(r, where="", args=(), sort="new", limit=30, offset=0):
    order = {"new": "d.created_at DESC", "popular": "(likes*3 + replies*2 + d.views/25) DESC, d.created_at DESC", "active": "d.last_activity DESC"}.get(sort, "d.created_at DESC")
    sql = f"""SELECT d.id,d.title,d.body,d.category,d.label,d.tags,d.created_at,d.last_activity,d.views,d.group_id,{AUTHOR_COLS}, g.slug gslug, g.name gname, c.name cname,
      (SELECT COUNT(*) FROM comments x WHERE x.target_type='discussion' AND x.target_id=d.id) replies,
      (SELECT COUNT(*) FROM reactions x WHERE x.target_type='discussion' AND x.target_id=d.id) likes,
      (SELECT COUNT(*) FROM bookmarks b WHERE b.user_id=? AND b.kind='discussion' AND b.ref=CAST(d.id AS TEXT)) bookmarked
      FROM discussions d JOIN users u ON u.id=d.author_id JOIN categories c ON c.slug=d.category LEFT JOIN groups_ g ON g.id=d.group_id
      {where} ORDER BY {order} LIMIT ? OFFSET ?"""
    out = []
    for x in rows(r.db.execute(sql, (r.uid, *args, limit, offset))):
        out.append({"id": x["id"], "title": x["title"], "excerpt": x["body"][:240], "category": x["category"], "category_name": x["cname"], "label": x["label"],
                    "tags": [t for t in x["tags"].split(",") if t], "created_at": x["created_at"], "last_activity": x["last_activity"], "views": x["views"],
                    "replies": x["replies"], "likes": x["likes"], "bookmarked": bool(x["bookmarked"]), "author": person(x),
                    "group": {"slug": x["gslug"], "name": x["gname"]} if x["gslug"] else None})
    return out

@route("GET", "/api/discussions")
def discussions(r):
    conds, args = [], []
    cat, q, tag, author, label, grp = r.q("cat"), r.q("q").strip(), r.q("tag"), r.q("author"), r.q("label"), r.q("group")
    if grp: conds.append("g.slug=?"); args.append(grp)
    elif not q and not author: conds.append("d.group_id IS NULL")
    if cat and cat != "all": conds.append("d.category=?"); args.append(cat)
    if label: conds.append("d.label=?"); args.append(label)
    if tag: conds.append("(',' || d.tags || ',') LIKE ?"); args.append(f"%,{re.sub(r'[^a-z0-9-]', '', tag.lower())},%")
    if author: conds.append("u.username=?"); args.append(author)
    if r.q("saved") == "1": conds.append("EXISTS(SELECT 1 FROM bookmarks b WHERE b.user_id=? AND b.kind='discussion' AND b.ref=CAST(d.id AS TEXT))"); args.append(r.uid)
    if q:
        for w in re.findall(r"\w+", q)[:6]:
            conds.append("(d.title LIKE ? OR d.body LIKE ? OR d.tags LIKE ?)"); args += [f"%{w}%"] * 3
    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    total = r.db.execute(f"SELECT COUNT(*) FROM discussions d JOIN users u ON u.id=d.author_id LEFT JOIN groups_ g ON g.id=d.group_id {where}", args).fetchone()[0]
    return {"items": _discussion_rows(r, where, args, r.q("sort", "new"), r.qi("limit", 30, 1, 100), r.qi("offset")), "total": total}

def _comment_tree(r, ttype, tid):
    cs = rows(r.db.execute(f"""SELECT c.id,c.parent_id,c.body,c.created_at,{AUTHOR_COLS} FROM comments c JOIN users u ON u.id=c.author_id
        WHERE c.target_type=? AND c.target_id=? ORDER BY c.created_at""", (ttype, tid)))
    rx = {}
    for x in r.db.execute("SELECT target_id,kind,COUNT(*) n FROM reactions WHERE target_type='comment' AND target_id IN (SELECT id FROM comments WHERE target_type=? AND target_id=?) GROUP BY target_id,kind", (ttype, tid)):
        rx.setdefault(x["target_id"], {})[x["kind"]] = x["n"]
    mine = {x["target_id"]: x["kind"] for x in r.db.execute("SELECT target_id,kind FROM reactions WHERE user_id=? AND target_type='comment'", (r.uid,))}
    return [{"id": x["id"], "parent_id": x["parent_id"], "body": x["body"], "created_at": x["created_at"], "author": person(x),
             "reactions": rx.get(x["id"], {}), "mine": mine.get(x["id"])} for x in cs]

@route("GET", "/api/discussions/<id>")
def discussion(r):
    did = int(r.params["id"]) if r.params["id"].isdigit() else 0
    if r.q("view", "1") == "1": r.db.execute("UPDATE discussions SET views=views+1 WHERE id=?", (did,))
    items = _discussion_rows(r, "WHERE d.id=?", (did,))
    if not items: raise HTTPError(404, "Discussion not found.")
    d = items[0]
    d["body"] = r.db.execute("SELECT body FROM discussions WHERE id=?", (did,)).fetchone()["body"]
    rx = {x["kind"]: x["n"] for x in r.db.execute("SELECT kind,COUNT(*) n FROM reactions WHERE target_type='discussion' AND target_id=? GROUP BY kind", (did,))}
    mine = r.db.execute("SELECT kind FROM reactions WHERE user_id=? AND target_type='discussion' AND target_id=?", (r.uid, did)).fetchone()
    d["reactions"], d["mine"] = rx, mine["kind"] if mine else None
    d["comments"] = _comment_tree(r, "discussion", did)
    return d

@route("POST", "/api/discussions")
def create_discussion(r):
    u = r.need_user()
    title, body = r.field("title", 5, 200), r.field("body", 10, 10000)
    cat, label = r.body.get("category", ""), r.body.get("label", "discussion")
    if not r.db.execute("SELECT 1 FROM categories WHERE slug=?", (cat,)).fetchone(): raise HTTPError(400, "Please choose a category.")
    if label not in LABELS: raise HTTPError(400, "Invalid label.")
    gid = None
    if r.body.get("group"):
        g = r.db.execute("SELECT g.id FROM groups_ g JOIN group_members m ON m.group_id=g.id AND m.user_id=? WHERE g.slug=?", (r.uid, r.body["group"])).fetchone()
        if not g: raise HTTPError(403, "Join the group before posting in it.")
        gid = g["id"]
    t = db.now()
    cur = r.db.execute("INSERT INTO discussions(title,body,author_id,category,label,tags,group_id,created_at,last_activity) VALUES(?,?,?,?,?,?,?,?,?)",
                       (title, body, u["id"], cat, label, ",".join(clean_tags(r.body.get("tags", ""))), gid, t, t))
    return {"id": cur.lastrowid}

@route("DELETE", "/api/discussions/<id>")
def delete_discussion(r):
    r.need_user(); did = int(r.params["id"]) if r.params["id"].isdigit() else 0
    d = r.db.execute("SELECT author_id FROM discussions WHERE id=?", (did,)).fetchone()
    if not d: raise HTTPError(404, "Not found.")
    if d["author_id"] != r.uid: raise HTTPError(403, "You can only delete your own discussions.")
    r.db.execute("DELETE FROM comments WHERE target_type='discussion' AND target_id=?", (did,))
    r.db.execute("DELETE FROM reactions WHERE target_type='discussion' AND target_id=?", (did,))
    r.db.execute("DELETE FROM bookmarks WHERE kind='discussion' AND ref=?", (str(did),))
    r.db.execute("DELETE FROM discussions WHERE id=?", (did,))

def _target(r, ttype, tid):
    if ttype == "discussion":
        t = r.db.execute("SELECT id,author_id,title FROM discussions WHERE id=?", (tid,)).fetchone(); link = f"#/d/{tid}"
    elif ttype == "debate":
        t = r.db.execute("SELECT id,0 author_id,title FROM debates WHERE id=?", (tid,)).fetchone(); link = f"#/debates/{tid}"
    elif ttype == "comment":
        t = r.db.execute("SELECT c.id,c.author_id,c.target_type,c.target_id FROM comments c WHERE c.id=?", (tid,)).fetchone(); link = None
    else: t = None
    if not t: raise HTTPError(404, "That item no longer exists.")
    return t, link

@route("POST", "/api/comments")
def add_comment(r):
    u = r.need_user(); ttype = r.body.get("type"); tid = r.body.get("id")
    if ttype not in ("discussion", "debate") or not isinstance(tid, int): raise HTTPError(400, "Invalid target.")
    body = r.field("body", 2, 5000)
    t, link = _target(r, ttype, tid)
    parent = r.body.get("parent_id"); pa = None
    if parent is not None:
        p = r.db.execute("SELECT author_id FROM comments WHERE id=? AND target_type=? AND target_id=?", (parent, ttype, tid)).fetchone()
        if not p: raise HTTPError(400, "The comment you're replying to no longer exists.")
        pa = p["author_id"]
    now = db.now()
    cur = r.db.execute("INSERT INTO comments(target_type,target_id,parent_id,author_id,body,created_at) VALUES(?,?,?,?,?,?)", (ttype, tid, parent, u["id"], body, now))
    if ttype == "discussion":
        r.db.execute("UPDATE discussions SET last_activity=? WHERE id=?", (now, tid))
        notify(r.db, t["author_id"], f"{u['display_name']} replied to \"{t['title'][:60]}\"", link, u["id"])
    else: r.db.execute("UPDATE debates SET last_activity=? WHERE id=?", (now, tid))
    if pa and pa != t["author_id"]: notify(r.db, pa, f"{u['display_name']} replied to your comment", link, u["id"])
    return {"id": cur.lastrowid}

@route("DELETE", "/api/comments/<id>")
def delete_comment(r):
    r.need_user(); cid = int(r.params["id"]) if r.params["id"].isdigit() else 0
    c = r.db.execute("SELECT author_id FROM comments WHERE id=?", (cid,)).fetchone()
    if not c: raise HTTPError(404, "Not found.")
    if c["author_id"] != r.uid: raise HTTPError(403, "You can only delete your own comments.")
    r.db.execute("DELETE FROM comments WHERE id=?", (cid,))

@route("POST", "/api/react")
def react(r):
    u = r.need_user(); ttype, tid, kind = r.body.get("type"), r.body.get("id"), r.body.get("kind", "like")
    if ttype not in ("discussion", "comment") or not isinstance(tid, int) or kind not in REACTIONS: raise HTTPError(400, "Invalid reaction.")
    t, _ = _target(r, ttype, tid)
    cur = r.db.execute("SELECT kind FROM reactions WHERE user_id=? AND target_type=? AND target_id=?", (u["id"], ttype, tid)).fetchone()
    if cur and cur["kind"] == kind:
        r.db.execute("DELETE FROM reactions WHERE user_id=? AND target_type=? AND target_id=?", (u["id"], ttype, tid)); mine = None
    else:
        r.db.execute("INSERT OR REPLACE INTO reactions VALUES(?,?,?,?,?)", (u["id"], ttype, tid, kind, db.now())); mine = kind
        if not cur: notify(r.db, t["author_id"], f"{u['display_name']} reacted to your {'post' if ttype == 'discussion' else 'comment'}",
                           f"#/d/{tid}" if ttype == "discussion" else "#/forums", u["id"])
    rx = {x["kind"]: x["n"] for x in r.db.execute("SELECT kind,COUNT(*) n FROM reactions WHERE target_type=? AND target_id=? GROUP BY kind", (ttype, tid))}
    return {"reactions": rx, "mine": mine}

# ---------------------------------------------------------------- bookmarks
@route("POST", "/api/bookmarks")
def toggle_bookmark(r):
    r.need_user(); kind, ref = r.body.get("kind"), str(r.body.get("ref", ""))
    if kind not in ("verse", "discussion", "article", "debate") or not re.match(r"^[0-9:]{1,16}$", ref): raise HTTPError(400, "Invalid bookmark.")
    ex = r.db.execute("SELECT 1 FROM bookmarks WHERE user_id=? AND kind=? AND ref=?", (r.uid, kind, ref)).fetchone()
    if ex: r.db.execute("DELETE FROM bookmarks WHERE user_id=? AND kind=? AND ref=?", (r.uid, kind, ref))
    else: r.db.execute("INSERT INTO bookmarks VALUES(?,?,?,?)", (r.uid, kind, ref, db.now()))
    return {"bookmarked": not ex}

def _bookmarks(r, uid):
    out = {"verses": [], "discussions": [], "articles": [], "debates": []}
    for b in r.db.execute("SELECT kind,ref FROM bookmarks WHERE user_id=? ORDER BY created_at DESC", (uid,)).fetchall():
        k, ref = b["kind"], b["ref"]
        if k == "verse":
            bk, ch, v = (int(x) for x in ref.split(":"))
            out["verses"].append({"ref": ref, "label": bible.ref_label(bk, ch, v), "book": bible.BOOKS[bk]["slug"], "chapter": ch, "verse": v, "text": bible.verse_text(bk, ch, v)})
        elif k == "discussion":
            x = _discussion_rows(r, "WHERE d.id=?", (int(ref),))
            if x: out["discussions"].append(x[0])
        elif k == "article":
            x = one(r.db.execute("SELECT id,title,type,author,summary FROM articles WHERE id=?", (int(ref),)))
            if x: out["articles"].append(x)
        elif k == "debate":
            x = one(r.db.execute("SELECT id,title,question FROM debates WHERE id=?", (int(ref),)))
            if x: out["debates"].append(x)
    return out

@route("GET", "/api/bookmarks")
def bookmarks(r):
    r.need_user(); return _bookmarks(r, r.uid)

# ---------------------------------------------------------------- Bible
def _book(slug):
    b = bible.book_by_slug(slug)
    if not b: raise HTTPError(404, "Book not found.")
    return b

@route("GET", "/api/bible/books")
def bible_books(r):
    return {"books": bible.BOOKS, "translations": [{"id": "kjv", "name": "KJV", "full": "King James Version (public domain)", "available": True},
            {"id": "esv", "name": "ESV", "full": "English Standard Version (via ESV API)", "available": bool(bible.ESV_KEY)}]}

@route("GET", "/api/bible/passage")
def bible_passage(r):
    b = _book(r.q("book")); ch = r.qi("chapter", 1, 1, 200); tr = r.q("tr", "kjv")
    if ch > b["chapters"]: raise HTTPError(404, "Chapter not found.")
    try: verses = bible.chapter(b["id"], ch, tr)
    except PermissionError as e: raise HTTPError(409, str(e))
    except Exception: raise HTTPError(502, "The ESV service could not be reached. Try again or switch to KJV.")
    out = {"book": b, "chapter": ch, "translation": tr, "verses": verses, "highlights": {}, "notes": [], "bookmarks": [], "read": False}
    i = b["id"]
    prev = (bible.BOOKS[i], ch - 1) if ch > 1 else ((bible.BOOKS[i - 1], bible.BOOKS[i - 1]["chapters"]) if i > 0 else None)
    nxt = (bible.BOOKS[i], ch + 1) if ch < b["chapters"] else ((bible.BOOKS[i + 1], 1) if i < 65 else None)
    out["prev"] = {"book": prev[0]["slug"], "name": prev[0]["name"], "chapter": prev[1]} if prev else None
    out["next"] = {"book": nxt[0]["slug"], "name": nxt[0]["name"], "chapter": nxt[1]} if nxt else None
    if r.user:
        out["highlights"] = {x["verse"]: x["color"] for x in r.db.execute("SELECT verse,color FROM highlights WHERE user_id=? AND book=? AND chapter=?", (r.uid, i, ch))}
        out["notes"] = rows(r.db.execute("SELECT id,verse,verse_end,body,updated_at FROM notes WHERE user_id=? AND book=? AND chapter=? ORDER BY verse,id", (r.uid, i, ch)))
        out["bookmarks"] = [int(x["ref"].split(":")[2]) for x in r.db.execute("SELECT ref FROM bookmarks WHERE user_id=? AND kind='verse' AND ref LIKE ?", (r.uid, f"{i}:{ch}:%"))]
        if r.q("record", "1") == "1":
            r.db.execute("INSERT OR REPLACE INTO history VALUES(?,?,?,?)", (r.uid, i, ch, db.now()))
        out["read"] = bool(r.db.execute("SELECT 1 FROM history WHERE user_id=? AND book=? AND chapter=?", (r.uid, i, ch)).fetchone())
    return out

@route("POST", "/api/bible/highlight")
def highlight(r):
    r.need_user(); b = _book(r.body.get("book", "")); ch = r.body.get("chapter"); vs = r.body.get("verses"); color = r.body.get("color")
    if not isinstance(ch, int) or not isinstance(vs, list) or not vs or len(vs) > 200 or not all(isinstance(v, int) and v > 0 for v in vs): raise HTTPError(400, "Invalid selection.")
    if color is not None and color not in COLORS: raise HTTPError(400, "Invalid colour.")
    for v in vs:
        if color: r.db.execute("INSERT OR REPLACE INTO highlights VALUES(?,?,?,?,?)", (r.uid, b["id"], ch, v, color))
        else: r.db.execute("DELETE FROM highlights WHERE user_id=? AND book=? AND chapter=? AND verse=?", (r.uid, b["id"], ch, v))

@route("POST", "/api/bible/notes")
def add_note(r):
    r.need_user(); b = _book(r.body.get("book", "")); ch, v, ve = r.body.get("chapter"), r.body.get("verse"), r.body.get("verse_end") or r.body.get("verse")
    if not all(isinstance(x, int) and x > 0 for x in (ch, v, ve)): raise HTTPError(400, "Invalid verse.")
    body = r.field("body", 1, 4000); t = db.now()
    cur = r.db.execute("INSERT INTO notes(user_id,book,chapter,verse,verse_end,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", (r.uid, b["id"], ch, v, ve, body, t, t))
    return {"id": cur.lastrowid}

@route("PUT", "/api/bible/notes/<id>")
def edit_note(r):
    r.need_user(); body = r.field("body", 1, 4000)
    cur = r.db.execute("UPDATE notes SET body=?, updated_at=? WHERE id=? AND user_id=?", (body, db.now(), r.params["id"], r.uid))
    if not cur.rowcount: raise HTTPError(404, "Note not found.")

@route("DELETE", "/api/bible/notes/<id>")
def delete_note(r):
    r.need_user(); r.db.execute("DELETE FROM notes WHERE id=? AND user_id=?", (r.params["id"], r.uid))

@route("GET", "/api/bible/search")
def bible_search(r):
    q = r.q("q").strip()
    if len(q) < 2: raise HTTPError(400, "Enter at least two characters.")
    ref = bible.parse_reference(q)
    hits, total = bible.search(q, 60)
    out = {"query": q, "total": total, "results": [{**h, "book": bible.BOOKS[h["book"]]["slug"]} for h in hits], "reference": None}
    if ref:
        b, ch, v, ve = ref; out["reference"] = {"label": bible.ref_label(b, ch, v, ve), "book": bible.BOOKS[b]["slug"], "chapter": ch, "verse": v}
    return out

@route("GET", "/api/bible/mine")
def bible_mine(r):
    r.need_user(); out = {}
    out["highlights"] = [{"book": bible.BOOKS[x["book"]]["slug"], "chapter": x["chapter"], "verse": x["verse"], "color": x["color"], "label": bible.ref_label(x["book"], x["chapter"], x["verse"]),
                          "text": bible.verse_text(x["book"], x["chapter"], x["verse"])}
                         for x in r.db.execute("SELECT * FROM highlights WHERE user_id=? ORDER BY book,chapter,verse", (r.uid,))]
    out["notes"] = [{"id": x["id"], "book": bible.BOOKS[x["book"]]["slug"], "chapter": x["chapter"], "verse": x["verse"], "label": bible.ref_label(x["book"], x["chapter"], x["verse"], x["verse_end"]),
                     "body": x["body"], "updated_at": x["updated_at"], "text": bible.verse_text(x["book"], x["chapter"], x["verse"])}
                    for x in r.db.execute("SELECT * FROM notes WHERE user_id=? ORDER BY updated_at DESC", (r.uid,))]
    out["bookmarks"] = _bookmarks(r, r.uid)["verses"]
    out["history"] = [{"book": bible.BOOKS[x["book"]]["slug"], "chapter": x["chapter"], "label": bible.ref_label(x["book"], x["chapter"]), "read_at": x["read_at"]}
                      for x in r.db.execute("SELECT * FROM history WHERE user_id=? ORDER BY read_at DESC LIMIT 30", (r.uid,))]
    return out

@route("GET", "/api/progress")
def progress(r):
    r.need_user()
    h = r.db.execute("SELECT book,chapter,read_at FROM history WHERE user_id=? ORDER BY read_at DESC", (r.uid,)).fetchall()
    per = {}
    for x in h: per.setdefault(x["book"], set()).add(x["chapter"])
    cur = None
    if h:
        b = bible.BOOKS[h[0]["book"]]; cur = {"book": b["slug"], "name": b["name"], "read": len(per[b["id"]]), "chapters": b["chapters"], "last_chapter": h[0]["chapter"]}
    seen, recent = set(), []
    for x in h:
        if (x["book"], x["chapter"]) in seen: continue
        seen.add((x["book"], x["chapter"]))
        recent.append({"book": bible.BOOKS[x["book"]]["slug"], "chapter": x["chapter"], "label": bible.ref_label(x["book"], x["chapter"]), "read_at": x["read_at"]})
        if len(recent) >= 5: break
    books = [{"slug": bible.BOOKS[k]["slug"], "name": bible.BOOKS[k]["name"], "read": len(v), "chapters": bible.BOOKS[k]["chapters"]} for k, v in sorted(per.items())]
    return {"current": cur, "recent": recent, "books": books, "total_read": sum(len(v) for v in per.values()), "total": 1189}

@route("GET", "/api/votd")
def votd(r):
    from seed_content import VERSES_OF_DAY
    name, ch, v = VERSES_OF_DAY[datetime.date.today().toordinal() % len(VERSES_OF_DAY)]
    b = bible.BY_SLUG[re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")]
    ref = f"{b['id']}:{ch}:{v}"
    saved = bool(r.user and r.db.execute("SELECT 1 FROM bookmarks WHERE user_id=? AND kind='verse' AND ref=?", (r.uid, ref)).fetchone())
    return {"label": bible.ref_label(b["id"], ch, v), "book": b["slug"], "chapter": ch, "verse": v, "ref": ref, "text": bible.verse_text(b["id"], ch, v), "translation": "KJV", "bookmarked": saved}

def _plan_days(p):
    out = []
    for i, d in enumerate(json.loads(p["days"]), 1):
        items = []
        for s in d:
            ref = bible.parse_reference(s)
            if ref: items.append({"label": s, "book": bible.BOOKS[ref[0]]["slug"], "chapter": ref[1]})
        out.append({"day": i, "items": items})
    return out

@route("GET", "/api/plans")
def plans(r):
    out = []
    for p in r.db.execute("SELECT * FROM plans ORDER BY id").fetchall():
        item = {"slug": p["slug"], "name": p["name"], "description": p["description"], "days": len(json.loads(p["days"])), "joined": False, "completed": 0}
        if r.user:
            pr = r.db.execute("SELECT completed FROM plan_progress WHERE user_id=? AND plan_id=?", (r.uid, p["id"])).fetchone()
            if pr: item["joined"], item["completed"] = True, len(json.loads(pr["completed"]))
        out.append(item)
    return {"items": out}

@route("GET", "/api/plans/<slug>")
def plan(r):
    p = r.db.execute("SELECT * FROM plans WHERE slug=?", (r.params["slug"],)).fetchone()
    if not p: raise HTTPError(404, "Plan not found.")
    out = {"slug": p["slug"], "name": p["name"], "description": p["description"], "days": _plan_days(p), "joined": False, "completed": []}
    if r.user:
        pr = r.db.execute("SELECT completed FROM plan_progress WHERE user_id=? AND plan_id=?", (r.uid, p["id"])).fetchone()
        if pr: out["joined"], out["completed"] = True, json.loads(pr["completed"])
    return out

@route("POST", "/api/plans/<slug>/join")
def plan_join(r):
    r.need_user(); p = r.db.execute("SELECT id FROM plans WHERE slug=?", (r.params["slug"],)).fetchone()
    if not p: raise HTTPError(404, "Plan not found.")
    if r.body.get("leave"): r.db.execute("DELETE FROM plan_progress WHERE user_id=? AND plan_id=?", (r.uid, p["id"]))
    else: r.db.execute("INSERT OR IGNORE INTO plan_progress VALUES(?,?,?,?)", (r.uid, p["id"], "[]", db.now()))

@route("POST", "/api/plans/<slug>/days/<n>")
def plan_day(r):
    r.need_user(); p = r.db.execute("SELECT id,days FROM plans WHERE slug=?", (r.params["slug"],)).fetchone()
    if not p or not r.params["n"].isdigit() or not 1 <= int(r.params["n"]) <= len(json.loads(p["days"])): raise HTTPError(404, "Plan day not found.")
    pr = r.db.execute("SELECT completed FROM plan_progress WHERE user_id=? AND plan_id=?", (r.uid, p["id"])).fetchone()
    if not pr: raise HTTPError(400, "Join the plan first.")
    done = set(json.loads(pr["completed"])); n = int(r.params["n"])
    done.symmetric_difference_update({n})
    r.db.execute("UPDATE plan_progress SET completed=? WHERE user_id=? AND plan_id=?", (json.dumps(sorted(done)), r.uid, p["id"]))
    return {"completed": sorted(done)}

# ---------------------------------------------------------------- debates
@route("GET", "/api/debates")
def debates(r):
    out = []
    for d in r.db.execute("""SELECT d.*, c.name cname,
        (SELECT COUNT(*) FROM debate_entries e WHERE e.debate_id=d.id) entries,
        (SELECT COUNT(*) FROM debate_votes v WHERE v.debate_id=d.id) votes,
        (SELECT COUNT(*) FROM comments x WHERE x.target_type='debate' AND x.target_id=d.id) comments
        FROM debates d JOIN categories c ON c.slug=d.category ORDER BY d.last_activity DESC"""):
        out.append({k: d[k] for k in ("id", "title", "question", "summary", "category", "cname", "aff_label", "opp_label", "entries", "votes", "comments", "last_activity", "created_at")})
    return {"items": out}

def _tally(r, did):
    v = rows(r.db.execute("SELECT side,COUNT(*) n,SUM(moved) moved FROM debate_votes WHERE debate_id=? GROUP BY side", (did,)))
    t = {"aff": 0, "opp": 0, "moved": 0}
    for x in v: t[x["side"]] = x["n"]; t["moved"] += x["moved"] or 0
    return t

@route("GET", "/api/debates/<id>")
def debate(r):
    did = int(r.params["id"]) if r.params["id"].isdigit() else 0
    d = one(r.db.execute("SELECT d.*, c.name cname FROM debates d JOIN categories c ON c.slug=d.category WHERE d.id=?", (did,)))
    if not d: raise HTTPError(404, "Debate not found.")
    d["entries"] = []
    for e in r.db.execute(f"SELECT e.*,{AUTHOR_COLS} FROM debate_entries e JOIN users u ON u.id=e.author_id WHERE e.debate_id=? ORDER BY e.created_at", (did,)):
        vs = [{"label": bible.ref_label(b, ch, v, ve), "book": bible.BOOKS[b]["slug"], "chapter": ch, "verse": v, "text": " ".join(bible.verse_text(b, ch, x) for x in range(v, (ve or v) + 1))}
              for b, ch, v, ve in json.loads(e["verses"])]
        d["entries"].append({"id": e["id"], "side": e["side"], "kind": e["kind"], "body": e["body"], "verses": vs, "refs": json.loads(e["refs"]), "created_at": e["created_at"], "author": person(e)})
    mine = r.db.execute("SELECT side,moved FROM debate_votes WHERE user_id=? AND debate_id=?", (r.uid, did)).fetchone()
    d["my_vote"] = dict(mine) if mine else None
    t = _tally(r, did); d["votes"] = t["aff"] + t["opp"]
    d["tally"] = t if mine else None                # tallies stay hidden until you have judged for yourself
    d["comments"] = _comment_tree(r, "debate", did)
    d["bookmarked"] = bool(r.user and r.db.execute("SELECT 1 FROM bookmarks WHERE user_id=? AND kind='debate' AND ref=?", (r.uid, str(did))).fetchone())
    return d

@route("POST", "/api/debates")
def create_debate(r):
    r.need_user()
    f = {k: r.field(k, lo, hi) for k, lo, hi in (("title", 8, 160), ("question", 10, 400), ("summary", 20, 800), ("aff_label", 2, 60), ("opp_label", 2, 60), ("aff_summary", 20, 600), ("opp_summary", 20, 600))}
    cat = r.body.get("category", "")
    if not r.db.execute("SELECT 1 FROM categories WHERE slug=?", (cat,)).fetchone(): raise HTTPError(400, "Please choose a category.")
    t = db.now()
    cur = r.db.execute("INSERT INTO debates(title,question,summary,category,aff_label,opp_label,aff_summary,opp_summary,created_at,last_activity) VALUES(?,?,?,?,?,?,?,?,?,?)",
                       (f["title"], f["question"], f["summary"], cat, f["aff_label"], f["opp_label"], f["aff_summary"], f["opp_summary"], t, t))
    return {"id": cur.lastrowid}

@route("POST", "/api/debates/<id>/entries")
def debate_entry(r):
    u = r.need_user(); did = int(r.params["id"]) if r.params["id"].isdigit() else 0
    if not r.db.execute("SELECT 1 FROM debates WHERE id=?", (did,)).fetchone(): raise HTTPError(404, "Debate not found.")
    side, kind = r.body.get("side"), r.body.get("kind")
    if side not in ("aff", "opp") or kind not in ENTRY_KINDS: raise HTTPError(400, "Choose a position and a type of contribution.")
    body = r.field("body", 40, 4000)
    if kind == "opening" and r.db.execute("SELECT 1 FROM debate_entries WHERE debate_id=? AND side=? AND kind='opening'", (did, side)).fetchone():
        raise HTTPError(409, "That side already has an opening argument. Add a rebuttal or counterargument instead.")
    if kind == "rebuttal" and not r.db.execute("SELECT 1 FROM debate_entries WHERE debate_id=? AND side<>? AND kind='opening'", (did, side)).fetchone():
        raise HTTPError(409, "A rebuttal answers an opening argument from the other side, and there isn't one yet.")
    verses = []
    for s in (r.body.get("verses") or [])[:8]:
        p = bible.parse_reference(str(s))
        if p and p[2]: verses.append([p[0], p[1], p[2], p[3]])
        else: raise HTTPError(400, f"Could not read the Bible reference '{str(s)[:40]}'. Use a form like John 3:16 or Romans 8:28-30.")
    refs = [str(s).strip()[:300] for s in (r.body.get("refs") or [])[:8] if str(s).strip()]
    t = db.now()
    r.db.execute("INSERT INTO debate_entries(debate_id,side,kind,author_id,body,verses,refs,created_at) VALUES(?,?,?,?,?,?,?,?)", (did, side, kind, u["id"], body, json.dumps(verses), json.dumps(refs), t))
    r.db.execute("UPDATE debates SET last_activity=? WHERE id=?", (t, did))

@route("POST", "/api/debates/<id>/vote")
def debate_vote(r):
    r.need_user(); did = int(r.params["id"]) if r.params["id"].isdigit() else 0
    if not r.db.execute("SELECT 1 FROM debates WHERE id=?", (did,)).fetchone(): raise HTTPError(404, "Debate not found.")
    side = r.body.get("side")
    if side not in ("aff", "opp"): raise HTTPError(400, "Choose a side.")
    r.db.execute("INSERT OR REPLACE INTO debate_votes VALUES(?,?,?,?,?)", (r.uid, did, side, 1 if r.body.get("moved") else 0, db.now()))
    t = _tally(r, did); return {"tally": t, "my_vote": {"side": side, "moved": 1 if r.body.get("moved") else 0}, "votes": t["aff"] + t["opp"]}

# ---------------------------------------------------------------- library
TYPES = {"article": "Article", "essay": "Essay", "research": "Research summary", "biblical": "Biblical studies", "apologetics": "Apologetics", "book": "Recommended book"}

@route("GET", "/api/library")
def library(r):
    conds, args = [], []
    for col, key in (("type", "type"), ("category", "cat"), ("label", "label")):
        if r.q(key) and r.q(key) != "all": conds.append(f"a.{col}=?"); args.append(r.q(key))
    if r.q("tag"): conds.append("(',' || a.tags || ',') LIKE ?"); args.append(f"%,{re.sub(r'[^a-z0-9-]', '', r.q('tag').lower())},%")
    if r.q("saved") == "1": conds.append("EXISTS(SELECT 1 FROM bookmarks b WHERE b.user_id=? AND b.kind='article' AND b.ref=CAST(a.id AS TEXT))"); args.append(r.uid)
    for w in re.findall(r"\w+", r.q("q"))[:6]:
        conds.append("(a.title LIKE ? OR a.summary LIKE ? OR a.author LIKE ? OR a.tags LIKE ? OR a.body LIKE ?)"); args += [f"%{w}%"] * 5
    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    items = rows(r.db.execute(f"""SELECT a.id,a.title,a.type,a.category,a.author,a.summary,a.label,a.tags,a.read_minutes,a.created_at,
        (SELECT COUNT(*) FROM bookmarks b WHERE b.user_id=? AND b.kind='article' AND b.ref=CAST(a.id AS TEXT)) bookmarked FROM articles a {where} ORDER BY a.created_at DESC""", (r.uid, *args)))
    for x in items: x["tags"] = [t for t in x["tags"].split(",") if t]; x["bookmarked"] = bool(x["bookmarked"])
    return {"items": items, "types": TYPES}

@route("GET", "/api/library/<id>")
def article(r):
    aid = int(r.params["id"]) if r.params["id"].isdigit() else 0
    a = one(r.db.execute("""SELECT a.*, c.name cname,(SELECT COUNT(*) FROM bookmarks b WHERE b.user_id=? AND b.kind='article' AND b.ref=CAST(a.id AS TEXT)) bookmarked
        FROM articles a JOIN categories c ON c.slug=a.category WHERE a.id=?""", (r.uid, aid)))
    if not a: raise HTTPError(404, "Resource not found.")
    a["tags"] = [t for t in a["tags"].split(",") if t]; a["bookmarked"] = bool(a["bookmarked"]); a["type_name"] = TYPES.get(a["type"], a["type"])
    a["related"] = rows(r.db.execute("SELECT id,title,type,author FROM articles WHERE category=? AND id<>? LIMIT 3", (a["category"], aid)))
    return a

# ---------------------------------------------------------------- groups
def _group_card(r, g):
    return {"slug": g["slug"], "name": g["name"], "description": g["description"], "icon": g["icon"], "members": g["members"], "is_member": bool(g["is_member"]), "discussions": g["discussions"]}

GROUP_SQL = """SELECT g.*, (SELECT COUNT(*) FROM group_members m WHERE m.group_id=g.id) members,
   (SELECT COUNT(*) FROM group_members m WHERE m.group_id=g.id AND m.user_id=?) is_member,
   (SELECT COUNT(*) FROM discussions d WHERE d.group_id=g.id) discussions FROM groups_ g"""

@route("GET", "/api/groups")
def groups(r):
    return {"items": [_group_card(r, g) for g in r.db.execute(GROUP_SQL + " ORDER BY members DESC, g.name", (r.uid,))]}

@route("GET", "/api/groups/<slug>")
def group(r):
    g = r.db.execute(GROUP_SQL + " WHERE g.slug=?", (r.uid, r.params["slug"])).fetchone()
    if not g: raise HTTPError(404, "Group not found.")
    out = _group_card(r, g)
    out["owner"] = r.db.execute("SELECT username FROM users WHERE id=?", (g["owner_id"],)).fetchone()["username"]
    out["member_list"] = [{"username": m["username"], "name": m["display_name"], "avatar": m["avatar"], "owner": m["id"] == g["owner_id"]}
                          for m in r.db.execute("SELECT u.* FROM group_members m JOIN users u ON u.id=m.user_id WHERE m.group_id=? ORDER BY m.joined_at", (g["id"],))]
    out["items"] = _discussion_rows(r, "WHERE d.group_id=?", (g["id"],), "active", 50)
    return out

@route("POST", "/api/groups")
def create_group(r):
    u = r.need_user(); name, desc = r.field("name", 3, 60), r.field("description", 10, 500)
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "group"
    if r.db.execute("SELECT 1 FROM groups_ WHERE slug=?", (slug,)).fetchone(): raise HTTPError(409, "A group with a similar name already exists.")
    cur = r.db.execute("INSERT INTO groups_(slug,name,description,icon,owner_id,created_at) VALUES(?,?,?,?,?,?)", (slug, name, desc, "users", u["id"], db.now()))
    r.db.execute("INSERT INTO group_members VALUES(?,?,?)", (cur.lastrowid, u["id"], db.now()))
    return {"slug": slug}

@route("POST", "/api/groups/<slug>/membership")
def group_membership(r):
    r.need_user(); g = r.db.execute("SELECT id,owner_id FROM groups_ WHERE slug=?", (r.params["slug"],)).fetchone()
    if not g: raise HTTPError(404, "Group not found.")
    ex = r.db.execute("SELECT 1 FROM group_members WHERE group_id=? AND user_id=?", (g["id"], r.uid)).fetchone()
    if ex:
        if g["owner_id"] == r.uid: raise HTTPError(400, "You created this group, so you can't leave it.")
        r.db.execute("DELETE FROM group_members WHERE group_id=? AND user_id=?", (g["id"], r.uid))
    else: r.db.execute("INSERT INTO group_members VALUES(?,?,?)", (g["id"], r.uid, db.now()))
    return {"is_member": not ex}

# ---------------------------------------------------------------- users, search, home
@route("GET", "/api/users/<username>")
def user_profile(r):
    u = r.db.execute("SELECT * FROM users WHERE username=?", (r.params["username"],)).fetchone()
    if not u: raise HTTPError(404, "User not found.")
    out = public_user(u)
    out["stats"] = {"discussions": r.db.execute("SELECT COUNT(*) FROM discussions WHERE author_id=?", (u["id"],)).fetchone()[0],
                    "comments": r.db.execute("SELECT COUNT(*) FROM comments WHERE author_id=?", (u["id"],)).fetchone()[0],
                    "reactions": r.db.execute("SELECT COUNT(*) FROM reactions x JOIN discussions d ON x.target_type='discussion' AND x.target_id=d.id WHERE d.author_id=?", (u["id"],)).fetchone()[0],
                    "debate_entries": r.db.execute("SELECT COUNT(*) FROM debate_entries WHERE author_id=?", (u["id"],)).fetchone()[0]}
    out["discussions"] = _discussion_rows(r, "WHERE u.username=? AND d.group_id IS NULL", (u["username"],), "new", 20)
    out["groups"] = rows(r.db.execute("SELECT g.slug,g.name,g.icon FROM groups_ g JOIN group_members m ON m.group_id=g.id WHERE m.user_id=? ORDER BY g.name", (u["id"],)))
    out["recent_comments"] = rows(r.db.execute("""SELECT c.id,c.body,c.created_at,d.id did,d.title FROM comments c JOIN discussions d ON c.target_type='discussion' AND c.target_id=d.id
        WHERE c.author_id=? ORDER BY c.created_at DESC LIMIT 8""", (u["id"],)))
    for c in out["recent_comments"]: c["body"] = c["body"][:200]
    return out

@route("GET", "/api/search")
def search(r):
    q = r.q("q").strip()
    if len(q) < 2: return {"query": q, "reference": None, "verses": [], "verse_total": 0, "discussions": [], "articles": [], "debates": [], "topics": []}
    ref = bible.parse_reference(q); reference = None
    if ref: reference = {"label": bible.ref_label(*ref), "book": bible.BOOKS[ref[0]]["slug"], "chapter": ref[1], "verse": ref[2]}
    hits, total = bible.search(q, 6)
    words = re.findall(r"\w+", q)[:6] or [q]
    def like(cols, extra=""):
        return " AND ".join("(" + " OR ".join(f"{c} LIKE ?" for c in cols) + ")" for _ in words), [f"%{w}%" for w in words for _ in cols]
    cond, args = like(["d.title", "d.body", "d.tags"])
    disc = _discussion_rows(r, f"WHERE {cond}", args, "popular", 6)
    cond, args = like(["title", "summary", "author", "tags"])
    arts = rows(r.db.execute(f"SELECT id,title,type,author,summary FROM articles WHERE {cond} LIMIT 6", args))
    cond, args = like(["title", "question", "summary"])
    debs = rows(r.db.execute(f"SELECT id,title,question FROM debates WHERE {cond} LIMIT 4", args))
    topics = rows(r.db.execute("SELECT slug,name,description FROM categories WHERE name LIKE ? OR description LIKE ?", (f"%{q}%", f"%{q}%")))
    return {"query": q, "reference": reference, "verses": [{**h, "book": bible.BOOKS[h["book"]]["slug"]} for h in hits], "verse_total": total,
            "discussions": disc, "articles": arts, "debates": debs, "topics": topics}

@route("GET", "/api/topics/<slug>")
def topic(r):
    c = one(r.db.execute("SELECT * FROM categories WHERE slug=?", (r.params["slug"],)))
    if not c: raise HTTPError(404, "Topic not found.")
    c["articles"] = rows(r.db.execute("SELECT id,title,type,author,summary FROM articles WHERE category=? ORDER BY created_at DESC LIMIT 6", (c["slug"],)))
    c["debates"] = rows(r.db.execute("SELECT id,title,question FROM debates WHERE category=? ORDER BY last_activity DESC LIMIT 4", (c["slug"],)))
    c["discussions"] = _discussion_rows(r, "WHERE d.category=? AND d.group_id IS NULL", (c["slug"],), "active", 8)
    return c
