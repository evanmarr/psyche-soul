# Psyche & Soul

A theological and psychological discussion platform: Bible reader, forums, structured debates, library, groups and accounts.

**Stack:** Python 3.9+ standard library only (no installs), SQLite database, vanilla-JS single-page frontend.
Chosen for reliability and low maintenance: nothing to `pip install`, one file database, easy to move to Postgres/Flask later (all SQL is isolated in `api.py`).

## Run locally

```bash
python3 server.py          # http://127.0.0.1:8080 (uses a local SQLite file, seeds sample content on first run)
```

Local demo account: **demo / PsycheDemo1!**. Reset sample data: `python3 seed.py --reset`.

## Deploy (GitHub + Vercel + Turso)

The pages in `public/` are served statically by Vercel. The backend (`api/index.py` -> `framework.py` + `routes.py`) runs as one Python serverless function. Because Vercel has no persistent disk, production data lives in **Turso** (hosted SQLite, same SQL as local; see `db.py`).

1. Push to GitHub. 2. Create a Turso database (Vercel dashboard -> Storage -> Turso). 3. Seed it once from your machine:
   `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... python3 seed.py --no-demo`
4. Import the repo in Vercel and make sure the two Turso variables are set. Optional: `ESV_API_KEY`.

## Environment variables
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (production database), `ESV_API_KEY` (ESV text), `PORT`/`HOST`/`PSYCHE_DB` (local server), `PSYCHE_SECURE=1` (Secure cookies; automatic on Vercel).

## ESV
No ESV text is bundled. Get a key at https://api.esv.org and set `ESV_API_KEY`; `bible.py` fetches chapters on demand and the reader shows Crossway's notice. Check Crossway's terms before going public. Until then the reader uses the public-domain KJV (`data/kjv.json`).

## Layout
| File | Purpose |
|---|---|
| `api/index.py`, `vercel.json` | Vercel function entry and routing |
| `server.py`, `framework.py` | Local server, routing, sessions, security headers |
| `routes.py` | All JSON endpoints |
| `db.py`, `security.py` | Schema, SQLite/Turso access, password hashing |
| `bible.py` | KJV + ESV API layer, reference parsing, verse search |
| `seed.py`, `seed_content.py` | Sample users, discussions, debates, articles, groups, plans |
| `public/` | Frontend (`js/`, `css/app.css`, `img/`) |

## Security notes
HttpOnly + SameSite cookies, `X-Requested-With` required on writes (CSRF), strict CSP, escaped rendering, parameterized SQL, login/registration rate limiting, avatar validation.

## Content notes
Articles and debates are original text; the references cited are real works. Posts are labelled (Established research / Theoretical interpretation / Theological position / Philosophical argument / Open discussion) so scientific findings and theological claims stay distinct.
