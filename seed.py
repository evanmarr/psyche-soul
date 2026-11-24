"""Create and fill the database with starter content: categories, groups, library, reading plans.
No users, discussions or debates are created; the community starts empty.

Run: python3 seed.py [--reset]      (local file, or Turso when TURSO_DATABASE_URL is set; --reset wipes first)"""
import json, os, sys
import db, bible
from seed_content import *

TABLES = ("login_attempts", "notifications", "debate_votes", "debate_entries", "debates", "plan_progress", "plans", "history", "notes", "highlights",
          "bookmarks", "reactions", "comments", "discussions", "group_members", "groups_", "categories", "sessions", "users", "articles")

def ensure_study_paths(c):
    """Add the starter study paths if there are none yet (safe to run on a live database; never touches existing content)."""
    if c.execute("SELECT COUNT(*) FROM study_paths").fetchone()[0]: return 0
    n = 0
    for i, p in enumerate(STUDY_PATHS):
        cur = c.execute("INSERT INTO study_paths(slug,title,description,level,sort) VALUES(?,?,?,?,?)", (p["slug"], p["title"], p["description"], p["level"], i))
        pid = cur.lastrowid
        for pos, (kind, ref, title, note) in enumerate(p["steps"], 1):
            if kind == "library":
                a = c.execute("SELECT id, title FROM articles WHERE title LIKE ?", (ref + "%",)).fetchone()
                if not a: print("  (missing library item:", ref, ")"); continue
                ref, title = str(a["id"]), a["title"]
            c.execute("INSERT INTO study_path_steps(path_id,position,kind,ref,title,note) VALUES(?,?,?,?,?,?)", (pid, pos, kind, ref, title, note))
        n += 1
    return n

def run(reset=False):
    if reset and db.REMOTE:
        c = db.connect()                                      # drop everything (children first), then rebuild below
        for t in TABLES: c.execute(f"DROP TABLE IF EXISTS {t}")
        c.close(); print("Remote database cleared.")
    elif reset:
        for ext in ("", "-wal", "-shm"):
            if os.path.exists(db.DB_PATH + ext): os.remove(db.DB_PATH + ext)
    db.init()
    c = db.connect()
    if c.execute("SELECT COUNT(*) FROM categories").fetchone()[0]:
        added = ensure_study_paths(c); c.commit()
        print("Database already has data (use --reset to rebuild)." + (f" Added {added} study paths." if added else "")); return
    now = db.now(); ago = lambda hrs: int(now - hrs * 3600)
    for i, (slug, name, desc, icon) in enumerate(CATEGORIES):
        c.execute("INSERT INTO categories VALUES(?,?,?,?,?)", (slug, name, desc, icon, i))
    for slug, name, desc, icon in GROUPS:
        c.execute("INSERT INTO groups_(slug,name,description,icon,owner_id,created_at) VALUES(?,?,?,?,NULL,?)", (slug, name, desc, icon, ago(24 * 90)))
    for i, (typ, cat, title, author, label, tags, mins, summ, body) in enumerate(ARTICLES):
        c.execute("INSERT INTO articles(title,type,category,author,summary,body,label,tags,read_minutes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                  (title, typ, cat, author, summ, body, label, tags, mins, ago(24 * (3 + i * 4))))
    plans = [("john-21", "The Gospel of John in 21 Days", "One chapter a day through the fourth Gospel.", [[f"John {i}"] for i in range(1, 22)]),
             ("mark-16", "Mark in 16 Days", "The shortest Gospel, read at a steady pace.", [[f"Mark {i}"] for i in range(1, 17)]),
             ("proverbs-31", "Proverbs: A Chapter a Day for a Month", "Wisdom literature for ordinary days.", [[f"Proverbs {i}"] for i in range(1, 32)]),
             ("mind-and-soul-7", "Mind & Soul: A 7-Day Reading", "Seven passages on the inner life: being known, renewed minds, peace, wisdom, time, resurrection and creation.",
              [[f"{b} {ch}"] for b, ch, _ in PLAN_THEMATIC])]
    for slug, name, desc, days in plans:
        c.execute("INSERT INTO plans(slug,name,description,days) VALUES(?,?,?,?)", (slug, name, desc, json.dumps(days)))
    ensure_study_paths(c)
    c.commit(); c.close()
    print("Seeded:", len(CATEGORIES), "categories,", len(GROUPS), "groups,", len(ARTICLES), "library items,", len(plans), "reading plans. No users or discussions.")

if __name__ == "__main__":
    run("--reset" in sys.argv)
