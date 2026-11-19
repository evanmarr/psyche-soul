"""Bible text access.

Translations
  kjv  King James Version (public domain), bundled in data/kjv.json. Used for development.
  esv  English Standard Version via the official ESV API (https://api.esv.org). Disabled until ESV_API_KEY is set.
       The ESV text is never bundled or stored; it is fetched on demand and held only in a small in-memory cache.
"""
import json, os, re, time, urllib.request, urllib.parse, threading

ROOT = os.path.dirname(os.path.abspath(__file__))
ESV_KEY = os.environ.get("ESV_API_KEY", "").strip()
ESV_URL = os.environ.get("ESV_API_URL", "https://api.esv.org/v3/passage/text/")

with open(os.path.join(ROOT, "data", "kjv.json"), encoding="utf-8-sig") as f:
    _RAW = json.load(f)

BOOKS = [{"id": i, "name": b["name"], "slug": re.sub(r"[^a-z0-9]+", "-", b["name"].lower()).strip("-"),
          "chapters": len(b["chapters"]), "testament": "OT" if i < 39 else "NT"} for i, b in enumerate(_RAW)]
BY_SLUG = {b["slug"]: b for b in BOOKS}
_ABBR = {"gen": 0, "ex": 1, "exo": 1, "lev": 2, "num": 3, "deut": 4, "dt": 4, "josh": 5, "judg": 6, "ps": 18, "psa": 18, "psalm": 18, "prov": 19,
         "eccl": 20, "ecc": 20, "song": 21, "isa": 22, "jer": 23, "lam": 24, "ezek": 25, "dan": 26, "matt": 39, "mt": 39, "mk": 40, "lk": 41,
         "jn": 42, "rom": 44, "cor": 45, "gal": 47, "eph": 48, "phil": 49, "col": 50, "thess": 51, "tim": 53, "heb": 57, "jas": 58, "rev": 65}

def book_by_slug(slug):
    return BY_SLUG.get(slug)

def local_chapter(book_id, chapter):
    chs = _RAW[book_id]["chapters"]
    if not 1 <= chapter <= len(chs): return None
    return [{"n": i + 1, "t": t} for i, t in enumerate(chs[chapter - 1])]

_cache, _lock = {}, threading.Lock()

def esv_chapter(book_id, chapter):
    key = (book_id, chapter)
    with _lock:
        hit = _cache.get(key)
        if hit and time.time() - hit[0] < 600: return hit[1]
    q = urllib.parse.urlencode({"q": f"{BOOKS[book_id]['name']} {chapter}", "include-headings": "false", "include-footnotes": "false",
        "include-verse-numbers": "true", "include-short-copyright": "false", "include-passage-references": "false", "include-first-verse-numbers": "true"})
    req = urllib.request.Request(ESV_URL + "?" + q, headers={"Authorization": "Token " + ESV_KEY})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.load(r)
    text = " ".join(data.get("passages", []))
    parts = re.split(r"\[(\d+)\]", text)
    verses = [{"n": int(parts[i]), "t": re.sub(r"\s+", " ", parts[i + 1]).strip()} for i in range(1, len(parts) - 1, 2)]
    with _lock:
        if len(_cache) > 40: _cache.clear()
        _cache[key] = (time.time(), verses)
    return verses

def chapter(book_id, ch, translation="kjv"):
    if translation == "esv":
        if not ESV_KEY: raise PermissionError("ESV is not configured on this server (set ESV_API_KEY).")
        return esv_chapter(book_id, ch)
    return local_chapter(book_id, ch)

def verse_text(book_id, ch, v):
    c = local_chapter(book_id, ch)
    return c[v - 1]["t"] if c and 1 <= v <= len(c) else ""

def ref_label(book_id, ch, v=None, v_end=None):
    s = f"{BOOKS[book_id]['name']} {ch}"
    if v: s += f":{v}" + (f"-{v_end}" if v_end and v_end != v else "")
    return s

def _find_book(name):
    n = re.sub(r"[^a-z0-9 ]", "", name.lower()).strip()
    if not n: return None
    m = re.match(r"^(1|2|3|i{1,3}|first|second|third)\s*(.+)$", n)
    prefix = ""
    if m:
        prefix = {"1": "1", "i": "1", "first": "1", "2": "2", "ii": "2", "second": "2", "3": "3", "iii": "3", "third": "3"}[m.group(1)]; n = m.group(2).strip()
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

_FLAT = None
def _flat():
    global _FLAT
    if _FLAT is None:
        _FLAT = [(bi, ci + 1, vi + 1, t, t.lower()) for bi, b in enumerate(_RAW) for ci, c in enumerate(b["chapters"]) for vi, t in enumerate(c)]
    return _FLAT

def search(q, limit=40):
    terms = [t for t in re.findall(r"[a-z0-9']+", q.lower()) if t]
    if not terms: return [], 0
    out, total = [], 0
    for bi, ch, v, t, tl in _flat():
        if all(x in tl for x in terms):
            total += 1
            if len(out) < limit: out.append({"book": bi, "chapter": ch, "verse": v, "text": t, "ref": ref_label(bi, ch, v)})
    return out, total
