"""Bible text access. Both translations are bundled in data/ and are in the public domain, so no API key or outside service is needed.

  web  World English Bible (modern English), data/web.json. The default.
  kjv  King James Version, data/kjv.json.
"""
import json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT = "web"
TRANSLATIONS = [{"id": "web", "name": "WEB", "full": "World English Bible (public domain)", "available": True},
                {"id": "kjv", "name": "KJV", "full": "King James Version (public domain)", "available": True}]

def _load(name):
    with open(os.path.join(ROOT, "data", name + ".json"), encoding="utf-8-sig") as f:
        d = json.load(f)
    return [b["chapters"] for b in d], [b["name"] for b in d]

_TEXT, _NAMES = {}, None
for _t in ("web", "kjv"):
    _TEXT[_t], _n = _load(_t)
    if _NAMES is None: _NAMES = _n

BOOKS = [{"id": i, "name": n, "slug": re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-"),
          "chapters": len(_TEXT["kjv"][i]), "testament": "OT" if i < 39 else "NT"} for i, n in enumerate(_NAMES)]
BY_SLUG = {b["slug"]: b for b in BOOKS}
_ABBR = {"gen": 0, "ex": 1, "exo": 1, "lev": 2, "num": 3, "deut": 4, "dt": 4, "josh": 5, "judg": 6, "ps": 18, "psa": 18, "psalm": 18, "prov": 19,
         "eccl": 20, "ecc": 20, "song": 21, "isa": 22, "jer": 23, "lam": 24, "ezek": 25, "dan": 26, "matt": 39, "mt": 39, "mk": 40, "lk": 41,
         "jn": 42, "rom": 44, "cor": 45, "gal": 47, "eph": 48, "phil": 49, "col": 50, "thess": 51, "tim": 53, "heb": 57, "jas": 58, "rev": 65}

def norm_tr(tr):
    return tr if tr in _TEXT else DEFAULT

def book_by_slug(slug):
    return BY_SLUG.get(slug)

def chapter(book_id, ch, tr=DEFAULT):
    """Verses of one chapter: [{"n": 1, "t": "..."}]. Verses a translation omits (e.g. some WEB verses) are left out."""
    chs = _TEXT[norm_tr(tr)][book_id]
    if not 1 <= ch <= len(chs): return None
    return [{"n": i + 1, "t": t} for i, t in enumerate(chs[ch - 1]) if t]

def verse_text(book_id, ch, v, tr=DEFAULT):
    chs = _TEXT[norm_tr(tr)][book_id]
    if not 1 <= ch <= len(chs): return ""
    vs = chs[ch - 1]
    return vs[v - 1] if 1 <= v <= len(vs) else ""

def ref_label(book_id, ch, v=None, v_end=None):
    s = f"{BOOKS[book_id]['name']} {ch}"
    if v: s += f":{v}" + (f"-{v_end}" if v_end and v_end != v else "")
    return s

def _find_book(name):
    n = re.sub(r"[^a-z0-9 ]", "", name.lower()).strip()
    if not n: return None
    m = re.match(r"^(?:([123])\s*|(i{1,3}|first|second|third)\s+)(.+)$", n)     # "1 john", "1john", "ii kings", never "isaiah"
    prefix = ""
    if m:
        prefix = {"1": "1", "i": "1", "first": "1", "2": "2", "ii": "2", "second": "2", "3": "3", "iii": "3", "third": "3"}[m.group(1) or m.group(2)]; n = m.group(3).strip()
    key = n.replace(" ", "")
    if prefix and key in _ABBR and key in ("cor", "thess", "tim"):
        return {"cor": 45, "thess": 51, "tim": 53}[key] + int(prefix) - 1
    if not prefix and key in _ABBR: return _ABBR[key]
    for b in BOOKS:
        nm = b["name"].lower()
        if prefix:
            if nm.startswith(prefix + " ") and nm[2:].startswith(n) and len(n) >= 2: return b["id"]
        elif nm.startswith(n) and len(n) >= 3 and not nm[0].isdigit(): return b["id"]
        elif nm == n: return b["id"]
    return None

_REF = re.compile(r"^\s*((?:[123]|i{1,3}|first|second|third)?\s*[a-z][a-z .]*?)\s*(\d+)?(?:\s*:\s*(\d+)(?:\s*-\s*(\d+))?)?\s*$", re.I)

def parse_reference(q):
    """'John 3:16', '1 cor 13', 'psalm 23' -> (book_id, chapter, verse, verse_end) or None."""
    m = _REF.match(q or "")
    if not m: return None
    b = _find_book(m.group(1))
    if b is None: return None
    ch = int(m.group(2) or 1)
    if not 1 <= ch <= BOOKS[b]["chapters"]: return None
    v = int(m.group(3)) if m.group(3) else None
    ve = int(m.group(4)) if m.group(4) else None
    return b, ch, v, ve

_FLAT = {}
def _flat(tr):
    if tr not in _FLAT:
        _FLAT[tr] = [(bi, ci + 1, vi + 1, t, t.lower()) for bi, b in enumerate(_TEXT[tr]) for ci, c in enumerate(b) for vi, t in enumerate(c) if t]
    return _FLAT[tr]

def search(q, limit=40, tr=DEFAULT):
    terms = [t for t in re.findall(r"[a-z0-9']+", q.lower()) if t]
    if not terms: return [], 0
    out, total = [], 0
    for bi, ch, v, t, tl in _flat(norm_tr(tr)):
        if all(x in tl for x in terms):
            total += 1
            if len(out) < limit: out.append({"book": bi, "chapter": ch, "verse": v, "text": t, "ref": ref_label(bi, ch, v)})
    return out, total
