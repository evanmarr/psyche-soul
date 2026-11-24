"""Study paths (curated, with progress) and reading lists (made by members)."""
import re
import bible, db
from framework import route, HTTPError
from routes import rows, one, person, TYPES

def _int(s): return int(s) if str(s).isdigit() else 0

# ------------------------------------------------------------------ study paths
def _step_info(r, st):
    """Resolve a stored step into something the page can show and link to."""
    out = {"id": st["id"], "kind": st["kind"], "title": st["title"], "note": st["note"], "link": None, "meta": ""}
    if st["kind"] == "library":
        a = r.db.execute("SELECT id, title, author, type FROM articles WHERE id=?", (_int(st["ref"]),)).fetchone()
        if a: out.update(link=f"#/library/{a['id']}", meta=f"{TYPES.get(a['type'], a['type'])} · {a['author']}", title=a["title"])
    elif st["kind"] == "bible":
        p = bible.parse_reference(st["ref"])
        if p:
            b, ch, v, ve = p
            out.update(link=f"#/bible/{bible.BOOKS[b]['slug']}/{ch}" + (f"?v={v}" + (f"-{ve}" if ve and ve != v else "") if v else ""), meta=bible.ref_label(b, ch, v, ve))
    return out

@route("GET", "/api/study")
def study_home(r):
    paths = rows(r.db.execute("""SELECT p.slug, p.title, p.description, p.level,
        (SELECT COUNT(*) FROM study_path_steps s WHERE s.path_id=p.id) steps,
        (SELECT COUNT(*) FROM path_progress g JOIN study_path_steps s ON s.id=g.step_id WHERE s.path_id=p.id AND g.user_id=?) done
        FROM study_paths p ORDER BY p.sort, p.id""", (r.uid,)))
    return {"paths": paths}

@route("GET", "/api/study/<slug>")
def study_path(r):
    p = one(r.db.execute("SELECT id, slug, title, description, level FROM study_paths WHERE slug=?", (r.params["slug"],)))
    if not p: raise HTTPError(404, "Study path not found.")
    done = {x["step_id"] for x in r.db.execute("SELECT step_id FROM path_progress WHERE user_id=?", (r.uid,))} if r.user else set()
    steps = []
    for st in r.db.execute("SELECT * FROM study_path_steps WHERE path_id=? ORDER BY position", (p["id"],)).fetchall():
        info = _step_info(r, st); info["done"] = st["id"] in done; steps.append(info)
    p.pop("id"); p["steps"] = steps
    return p

@route("POST", "/api/study/steps/<sid>")
def toggle_step(r):
    r.need_user(); sid = _int(r.params["sid"])
    if not r.db.execute("SELECT 1 FROM study_path_steps WHERE id=?", (sid,)).fetchone(): raise HTTPError(404, "Step not found.")
    ex = r.db.execute("SELECT 1 FROM path_progress WHERE user_id=? AND step_id=?", (r.uid, sid)).fetchone()
    if ex: r.db.execute("DELETE FROM path_progress WHERE user_id=? AND step_id=?", (r.uid, sid))
    else: r.db.execute("INSERT INTO path_progress VALUES(?,?,?)", (r.uid, sid, db.now()))
    return {"done": not ex}

# ------------------------------------------------------------------ reading lists
MAX_LISTS, MAX_ITEMS = 50, 200

@route("GET", "/api/lists")
def lists(r):
    if r.q("mine") == "1":
        r.need_user(); aid = _int(r.q("article"))
        items = rows(r.db.execute("""SELECT l.id, l.title, l.description, l.created_at,
            (SELECT COUNT(*) FROM reading_list_items i WHERE i.list_id=l.id) n,
            (SELECT COUNT(*) FROM reading_list_items i WHERE i.list_id=l.id AND i.article_id=?) has
            FROM reading_lists l WHERE l.user_id=? ORDER BY l.created_at DESC""", (aid, r.uid)))
        for x in items: x["has"] = bool(x["has"])
        return {"items": items}
    items = rows(r.db.execute("""SELECT l.id, l.title, l.description, l.created_at, u.username a_username, u.display_name a_name, u.avatar a_avatar,
        (SELECT COUNT(*) FROM reading_list_items i WHERE i.list_id=l.id) n
        FROM reading_lists l JOIN users u ON u.id=l.user_id ORDER BY l.created_at DESC LIMIT 60"""))
    return {"items": [{"id": x["id"], "title": x["title"], "description": x["description"], "n": x["n"], "created_at": x["created_at"], "owner": person(x)} for x in items]}

@route("GET", "/api/lists/<id>")
def list_detail(r):
    lid = _int(r.params["id"])
    l = one(r.db.execute("SELECT l.id, l.user_id, l.title, l.description, l.created_at, u.username a_username, u.display_name a_name, u.avatar a_avatar FROM reading_lists l JOIN users u ON u.id=l.user_id WHERE l.id=?", (lid,)))
    if not l: raise HTTPError(404, "Reading list not found.")
    items = rows(r.db.execute("""SELECT a.id, a.title, a.type, a.author, a.summary, a.read_minutes FROM reading_list_items i
        JOIN articles a ON a.id=i.article_id WHERE i.list_id=? ORDER BY i.added_at""", (lid,)))
    for x in items: x["type_name"] = TYPES.get(x["type"], x["type"])
    return {"id": l["id"], "title": l["title"], "description": l["description"], "created_at": l["created_at"], "owner": person(l),
            "can_edit": bool(r.user and l["user_id"] == r.uid), "items": items}

def _own_list(r):
    r.need_user(); lid = _int(r.params["id"])
    l = r.db.execute("SELECT id, user_id FROM reading_lists WHERE id=?", (lid,)).fetchone()
    if not l: raise HTTPError(404, "Reading list not found.")
    if l["user_id"] != r.uid: raise HTTPError(403, "That is not your list.")
    return lid

@route("POST", "/api/lists")
def create_list(r):
    r.need_user(); title, desc = r.field("title", 3, 80), r.field("description", 0, 400, False)
    if r.db.execute("SELECT COUNT(*) FROM reading_lists WHERE user_id=?", (r.uid,)).fetchone()[0] >= MAX_LISTS: raise HTTPError(400, "You have reached the limit of 50 lists.")
    cur = r.db.execute("INSERT INTO reading_lists(user_id,title,description,created_at) VALUES(?,?,?,?)", (r.uid, title, desc, db.now()))
    lid = cur.lastrowid
    aid = r.body.get("article_id")
    if isinstance(aid, int) and r.db.execute("SELECT 1 FROM articles WHERE id=?", (aid,)).fetchone():
        r.db.execute("INSERT OR IGNORE INTO reading_list_items VALUES(?,?,?)", (lid, aid, db.now()))
    return {"id": lid}

@route("PUT", "/api/lists/<id>")
def edit_list(r):
    lid = _own_list(r); title, desc = r.field("title", 3, 80), r.field("description", 0, 400, False)
    r.db.execute("UPDATE reading_lists SET title=?, description=? WHERE id=?", (title, desc, lid)); return {"id": lid}

@route("DELETE", "/api/lists/<id>")
def delete_list(r):
    lid = _own_list(r); r.db.execute("DELETE FROM reading_list_items WHERE list_id=?", (lid,)); r.db.execute("DELETE FROM reading_lists WHERE id=?", (lid,))

@route("POST", "/api/lists/<id>/items")
def toggle_item(r):
    lid = _own_list(r); aid = r.body.get("article_id")
    if not isinstance(aid, int) or not r.db.execute("SELECT 1 FROM articles WHERE id=?", (aid,)).fetchone(): raise HTTPError(404, "Resource not found.")
    ex = r.db.execute("SELECT 1 FROM reading_list_items WHERE list_id=? AND article_id=?", (lid, aid)).fetchone()
    if ex: r.db.execute("DELETE FROM reading_list_items WHERE list_id=? AND article_id=?", (lid, aid))
    else:
        if r.db.execute("SELECT COUNT(*) FROM reading_list_items WHERE list_id=?", (lid,)).fetchone()[0] >= MAX_ITEMS: raise HTTPError(400, "That list is full.")
        r.db.execute("INSERT INTO reading_list_items VALUES(?,?,?)", (lid, aid, db.now()))
    return {"has": not ex}

@route("DELETE", "/api/lists/<id>/items/<aid>")
def remove_item(r):
    lid = _own_list(r); r.db.execute("DELETE FROM reading_list_items WHERE list_id=? AND article_id=?", (lid, _int(r.params["aid"])))
