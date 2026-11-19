# Psyche & Soul

A theological and psychological discussion platform: Bible reader, forums, structured debates, library, groups and accounts.

**Stack:** Python 3.9+ standard library only (no installs), SQLite database, vanilla-JS single-page frontend.
Chosen for reliability and low maintenance: nothing to `pip install`, one file database, easy to move to Postgres/Flask later (all SQL is isolated in `api.py`).

## Run

```bash
cd ~/Desktop/psyche-soul
python3 server.py          # http://127.0.0.1:8080  (seeds sample content on first run)
```

Demo account (sample data, reading progress, notes already in place): **demo / PsycheDemo1!**
Reset the sample data any time: `python3 seed.py --reset`.

Environment variables: `PORT`, `HOST`, `PSYCHE_DB` (database path), `ESV_API_KEY`, `PSYCHE_SECURE=1` (set when served over HTTPS so cookies are `Secure`).

## What you need to configure

1. **ESV text (optional, required for the ESV toggle).** The ESV is copyrighted, so no ESV text is bundled. Get a key at https://api.esv.org, then run `ESV_API_KEY=your-key python3 server.py`. The reader fetches chapters on demand through `bible.py` (`esv_chapter`) and shows Crossway's attribution. Review Crossway's usage/caching terms before going public. Until then the reader uses the public-domain **KJV** (`data/kjv.json`).
2. **Before going public:** put it behind HTTPS (reverse proxy such as Caddy/nginx), set `PSYCHE_SECURE=1`, remove the demo account (`DELETE FROM users WHERE username='demo'`) and the "Use the demo account" button in `static/js/core.js`, and add email verification / password reset (needs an email provider), plus moderation tools.

## Layout

| File | Purpose |
|---|---|
| `server.py`, `framework.py` | HTTP server, routing, sessions, security headers |
| `api.py` | All JSON endpoints |
| `db.py`, `security.py` | Schema, password hashing (PBKDF2-SHA256), tokens |
| `bible.py` | KJV + ESV API integration layer, reference parsing, verse search |
| `seed.py`, `seed_content.py` | Sample users, discussions, debates, articles, groups, plans |
| `static/` | Frontend: `js/` (one file per area), `css/app.css`, `img/` |

## Security notes
HttpOnly + SameSite cookies, `X-Requested-With` required on all writes (CSRF), strict CSP, all user text escaped on render, parameterized SQL, login/registration rate limiting, avatar type/size validation.

## Content notes
Sample articles and debates are original text written for this project; references cited are real works. Posts carry labels (Established research / Theoretical interpretation / Theological position / Philosophical argument / Open discussion) so the platform never blurs scientific findings with theological claims.
