"""Create and populate the database with sample content. Run: python3 seed.py [--reset]"""
import json, os, random, sys
import db, bible, security
from seed_content import *

def run(reset=False, demo=True):
    if reset and db.REMOTE:
        raise SystemExit("--reset only works on the local database. To rebuild Turso, delete the database in the Turso dashboard and create a new one.")
    if reset:
        for ext in ("", "-wal", "-shm"):
            if os.path.exists(db.DB_PATH + ext): os.remove(db.DB_PATH + ext)
    db.init()
    c = db.connect()
    if c.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
        print("Database already has data (use --reset to rebuild)."); return
    now = db.now(); H = 3600
    ago = lambda hrs: int(now - hrs * H)
    uid = {}
    for i, (u, name, bio) in enumerate(USERS):
        pw = security.hash_password("PsycheDemo1!") if (u == "demo" and demo) else "pbkdf2$0$!$!"   # sample users cannot log in
        cur = c.execute("INSERT INTO users(username,email,pw_hash,display_name,bio,avatar,created_at) VALUES(?,?,?,?,?,?,?)",
                        (u, f"{u}@example.com", pw, name, bio, "", ago(24 * (200 - i * 11))))
        uid[u] = cur.lastrowid
    for i, (slug, name, desc, icon) in enumerate(CATEGORIES):
        c.execute("INSERT INTO categories VALUES(?,?,?,?,?)", (slug, name, desc, icon, i))
    gid = {}
    for slug, name, desc, icon, owner in GROUPS:
        cur = c.execute("INSERT INTO groups_(slug,name,description,icon,owner_id,created_at) VALUES(?,?,?,?,?,?)", (slug, name, desc, icon, uid[owner], ago(24 * 90)))
        gid[slug] = cur.lastrowid
        c.execute("INSERT INTO group_members VALUES(?,?,?)", (cur.lastrowid, uid[owner], ago(24 * 90)))
    rnd = random.Random(7)
    memberships = {"reformed-theology": ["rachel_kim", "david_okafor", "marcus_bell", "thomas_ashby"], "biblical-greek": ["rachel_kim", "demo", "marcus_bell"],
        "christian-apologetics": ["thomas_ashby", "rachel_kim", "sofia_marin", "demo", "marcus_bell"], "philosophy-of-religion": ["sofia_marin", "thomas_ashby", "rachel_kim", "amara_lindqvist"],
        "cognitive-psychology": ["amara_lindqvist", "eleanor_vance", "sofia_marin", "demo"], "faith-and-mental-health": ["david_okafor", "eleanor_vance", "marcus_bell", "demo", "rachel_kim"]}
    for g, members in memberships.items():
        for m in members:
            c.execute("INSERT OR IGNORE INTO group_members VALUES(?,?,?)", (gid[g], uid[m], ago(rnd.randint(24, 24 * 80))))
    dids = []
    users = list(uid.values())
    for d in DISCUSSIONS:
        created = ago(d["hrs"]); last = created
        cur = c.execute("INSERT INTO discussions(title,body,author_id,category,label,tags,group_id,created_at,last_activity,views,is_debate_thread) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                        (d["title"], d["body"], uid[d["author"]], d["cat"], d["label"], d["tags"], gid.get(d["group"]) if d["group"] else None, created, created, d["views"], d["thread"]))
        did = cur.lastrowid; dids.append(did); cids = []
        for a, body, parent, h in d["comments"]:
            ts = ago(h)
            cc = c.execute("INSERT INTO comments(target_type,target_id,parent_id,author_id,body,created_at) VALUES('discussion',?,?,?,?,?)",
                           (did, cids[parent] if parent is not None else None, uid[a], body, ts))
            cids.append(cc.lastrowid); last = max(last, ts)
        c.execute("UPDATE discussions SET last_activity=? WHERE id=?", (last, did))
        for u in rnd.sample(users, rnd.randint(2, 7)):
            c.execute("INSERT OR IGNORE INTO reactions VALUES(?,?,?,?,?)", (u, "discussion", did, rnd.choice(["like", "like", "insightful", "gracious"]), created + 600))
        for cid in cids:
            for u in rnd.sample(users, rnd.randint(0, 3)):
                c.execute("INSERT OR IGNORE INTO reactions VALUES(?,?,?,?,?)", (u, "comment", cid, rnd.choice(["like", "insightful", "gracious"]), now))
    bid = []
    for k, d in enumerate(DEBATES):
        t0 = ago(24 * max(1, 14 - k * 2))
        cur = c.execute("INSERT INTO debates(title,question,summary,category,aff_label,opp_label,aff_summary,opp_summary,created_at,last_activity) VALUES(?,?,?,?,?,?,?,?,?,?)",
                        (d["title"], d["question"], d["summary"], d["cat"], d["aff"], d["opp"], d["aff_sum"], d["opp_sum"], t0, t0))
        deb = cur.lastrowid; bid.append(deb); last = t0
        for j, (side, kind, author, body, verses, refs) in enumerate(d["entries"]):
            ts = t0 + (j + 1) * 7200; last = ts
            author = "editors"                                       # debate positions are editorial, not user posts
            verses = [list(v) if not isinstance(v, str) else list(bible.parse_reference(v)) for v in verses]
            assert all(len(v) == 4 and v[2] for v in verses), (d["title"], verses)
            c.execute("INSERT INTO debate_entries(debate_id,side,kind,author_id,body,verses,refs,created_at) VALUES(?,?,?,?,?,?,?,?)",
                      (deb, side, kind, uid[author], body, json.dumps(verses), json.dumps(refs), ts))
        c.execute("UPDATE debates SET last_activity=? WHERE id=?", (last, deb))
        for u in users:
            if u != uid["demo"] and rnd.random() < 0.75:
                c.execute("INSERT OR IGNORE INTO debate_votes VALUES(?,?,?,?,?)", (u, deb, rnd.choice(["aff", "opp"]), int(rnd.random() < 0.25), last))
    for a, body, h in [("marcus_bell", "Helpful that both sides cite the Confession and the Fathers. The definitions in the discussion thread cleared up a lot for me.", 20),
                       ("eleanor_vance", "The Frankfurt and agent-causation exchange is the heart of it. Appreciate that both sides acknowledge where their view is hard.", 10)]:
        c.execute("INSERT INTO comments(target_type,target_id,parent_id,author_id,body,created_at) VALUES('debate',?,NULL,?,?,?)", (bid[0], uid[a], body, ago(h)))
    aids = []
    for i, (typ, cat, title, author, label, tags, mins, summ, body) in enumerate(ARTICLES):
        cur = c.execute("INSERT INTO articles(title,type,category,author,summary,body,label,tags,read_minutes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                        (title, typ, cat, author, summ, body, label, tags, mins, ago(24 * (3 + i * 4))))
        aids.append(cur.lastrowid)
    plans = [("john-21", "The Gospel of John in 21 Days", "One chapter a day through the fourth Gospel.", [[f"John {i}"] for i in range(1, 22)]),
             ("mark-16", "Mark in 16 Days", "The shortest Gospel, read at a steady pace.", [[f"Mark {i}"] for i in range(1, 17)]),
             ("proverbs-31", "Proverbs: A Chapter a Day for a Month", "Wisdom literature for ordinary days.", [[f"Proverbs {i}"] for i in range(1, 32)]),
             ("mind-and-soul-7", "Mind & Soul: A 7-Day Reading", "Seven passages on the inner life: being known, renewed minds, peace, wisdom, time, resurrection and creation.",
              [[f"{b} {ch}"] for b, ch, _ in PLAN_THEMATIC])]
    pid = {}
    for slug, name, desc, days in plans:
        cur = c.execute("INSERT INTO plans(slug,name,description,days) VALUES(?,?,?,?)", (slug, name, desc, json.dumps(days)))
        pid[slug] = cur.lastrowid
    d = uid["demo"]; john = bible.BY_SLUG["john"]["id"]; rom = bible.BY_SLUG["romans"]["id"]
    for ch in range(1, 6):
        c.execute("INSERT INTO history VALUES(?,?,?,?)", (d, john, ch, ago(24 * (6 - ch) + 3)))
    for bk, ch in [("romans", 12), ("psalms", 23), ("philippians", 4)]:
        c.execute("INSERT INTO history VALUES(?,?,?,?)", (d, bible.BY_SLUG[bk]["id"], ch, ago(24 * 7)))
    c.execute("INSERT INTO plan_progress VALUES(?,?,?,?)", (d, pid["john-21"], json.dumps([1, 2, 3, 4, 5]), ago(24 * 6)))
    for v in (16, 17): c.execute("INSERT INTO highlights VALUES(?,?,?,?,?)", (d, john, 3, v, "gold"))
    c.execute("INSERT INTO highlights VALUES(?,?,?,?,?)", (d, rom, 12, 2, "purple"))
    c.execute("INSERT INTO notes(user_id,book,chapter,verse,verse_end,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
              (d, rom, 12, 2, 2, "Renewal of the mind comes before the transformation of behavior. Worth comparing with the research on habit and reappraisal.", ago(100), ago(100)))
    c.execute("INSERT INTO bookmarks VALUES(?,?,?,?)", (d, "verse", f"{rom}:12:2", ago(80)))
    c.execute("INSERT INTO bookmarks VALUES(?,?,?,?)", (d, "article", str(aids[0]), ago(60)))
    c.execute("INSERT INTO bookmarks VALUES(?,?,?,?)", (d, "discussion", str(dids[0]), ago(40)))
    c.execute("INSERT INTO notifications(user_id,text,link,created_at) VALUES(?,?,?,?)", (d, "Welcome to Psyche & Soul! Start with the Bible reader or the debates.", "#/debates", ago(1)))
    c.commit(); c.close()
    print("Seeded: users", len(USERS), "discussions", len(DISCUSSIONS), "debates", len(DEBATES), "articles", len(ARTICLES))

if __name__ == "__main__":
    run("--reset" in sys.argv, demo="--no-demo" not in sys.argv)
