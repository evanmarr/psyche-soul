# Psyche & Soul

A theological and philosophical discussion platform: Bible reader, forums, structured debates, library, study paths, reading lists, groups and accounts.

**Stack:** Python 3.9+ standard library only (no installs), SQLite locally and Turso (hosted SQLite) in production, vanilla-JS single-page frontend.

## Run locally

```bash
python3 server.py          # http://127.0.0.1:8080 (local SQLite file; starter content is added on first run)
```

The site starts with no users, discussions or debates. Starter content is topics, groups, the library, reading plans and study paths.
Wipe and rebuild the local database: `python3 seed.py --reset`.

## Deploy (GitHub + Vercel + Turso)

Pages in `public/` are served statically by Vercel. The backend (`api/index.py` -> `framework.py`, `routes.py`, `features.py`, `admin.py`) runs as one Python serverless function. Production data lives in **Turso** (see `db.py`).

1. Push to GitHub. 2. Create a Turso database from the Vercel project's Storage tab (connects `TURSO_DATABASE_URL` and the auth token). 3. Fill/upgrade it from your machine:
   `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... python3 seed.py`
   This is safe to repeat: on a database that already has data it only creates missing tables, adds missing columns and adds the starter study paths. `--reset` wipes everything.
4. Import the repo in Vercel. Run step 3 *before* deploying a version that adds database features.

## Environment variables
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (production database; the token may carry a prefix such as `TURSO_DATABASE_TURSO_AUTH_TOKEN`), `ADMIN_PASSWORD` (admin sign-in, see below), `PORT`/`HOST`/`PSYCHE_DB` (local server), `PSYCHE_SECURE=1` (Secure cookies; automatic on Vercel).

## Admin
Go to `/adm1n` (not linked anywhere) and sign in with the admin password. It can view and delete users (with everything they posted), discussions, comments, debates, arguments and groups. Sessions last 8 hours and use their own cookie; sign-in attempts are rate limited.
The password comes from `ADMIN_PASSWORD`; if that is unset a default is used, which is visible in `admin.py`. **Set `ADMIN_PASSWORD` in Vercel to a long random value** (Settings -> Environment Variables), then redeploy.

## Bible text
Two public-domain translations are bundled, so no API key or outside service is needed: the **World English Bible** (`data/web.json`, the default) and the **King James Version** (`data/kjv.json`). Reference parsing and verse search live in `bible.py`.

## Themes and text size
The site is designed dark. `public/css/light.css` is **generated** from `app.css` by `python3 tools/make_light_theme.py`; run it again after changing `app.css`. Visitors choose theme and text size (Normal / Large / Extra large) from the "Aa" button; the choice is stored in their browser.

## Layout
| File | Purpose |
|---|---|
| `api/index.py`, `vercel.json` | Vercel function entry and routing (`/api/*`, `/adm1n`) |
| `server.py`, `framework.py` | Local server, routing, sessions, security headers |
| `routes.py` | Accounts, Bible, forums, debates, library, groups, search |
| `features.py` | Study paths and reading lists |
| `admin.py` | Admin API |
| `db.py`, `security.py` | Schema and upgrades, SQLite/Turso access, password hashing |
| `bible.py` | Bundled translations, reference parsing, verse search |
| `seed.py`, `seed_content.py` | Starter content |
| `public/` | Frontend (`js/`, `css/`, `img/`, `adm1n.html`) |
| `tools/make_light_theme.py` | Generates the light theme |

## Security notes
HttpOnly + SameSite cookies, `X-Requested-With` required on writes (CSRF), strict CSP, escaped rendering, parameterized SQL, login/registration/admin rate limiting, avatar validation. Not yet built: email verification, password reset, report buttons.

## Content notes
Articles and study paths are original text; the references cited are real works. Posts are labelled (Classical source / Philosophical theory / Theological position / Philosophical argument / Open discussion) so what a text says, what is argued, and what the church teaches stay distinct.
