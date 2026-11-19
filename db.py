"""SQLite access and schema for Psyche & Soul."""
import os, sqlite3, time

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("PSYCHE_DB", os.path.join(ROOT, "data", "psyche.db"))

SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE, email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  pw_hash TEXT NOT NULL, display_name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS categories(slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, icon TEXT NOT NULL, sort INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS groups_(id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'users', owner_id INTEGER REFERENCES users(id), created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS group_members(group_id INTEGER NOT NULL REFERENCES groups_(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, joined_at INTEGER NOT NULL, PRIMARY KEY(group_id,user_id));
CREATE TABLE IF NOT EXISTS discussions(id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id), category TEXT NOT NULL REFERENCES categories(slug),
  label TEXT NOT NULL DEFAULT 'discussion', tags TEXT NOT NULL DEFAULT '', group_id INTEGER REFERENCES groups_(id),
  created_at INTEGER NOT NULL, last_activity INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0, is_debate_thread INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, target_type TEXT NOT NULL, target_id INTEGER NOT NULL,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE, author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type,target_id);
CREATE TABLE IF NOT EXISTS reactions(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL, kind TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,target_type,target_id));
CREATE TABLE IF NOT EXISTS bookmarks(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL,
  ref TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,kind,ref));
CREATE TABLE IF NOT EXISTS highlights(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, book INTEGER NOT NULL,
  chapter INTEGER NOT NULL, verse INTEGER NOT NULL, color TEXT NOT NULL, PRIMARY KEY(user_id,book,chapter,verse));
CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, verse_end INTEGER NOT NULL, body TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS history(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, book INTEGER NOT NULL,
  chapter INTEGER NOT NULL, read_at INTEGER NOT NULL, PRIMARY KEY(user_id,book,chapter));
CREATE TABLE IF NOT EXISTS plans(id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, days TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS plan_progress(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE, completed TEXT NOT NULL DEFAULT '[]', started_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,plan_id));
CREATE TABLE IF NOT EXISTS debates(id INTEGER PRIMARY KEY, title TEXT NOT NULL, question TEXT NOT NULL, summary TEXT NOT NULL,
  category TEXT NOT NULL, aff_label TEXT NOT NULL, opp_label TEXT NOT NULL, aff_summary TEXT NOT NULL, opp_summary TEXT NOT NULL,
  created_at INTEGER NOT NULL, last_activity INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS debate_entries(id INTEGER PRIMARY KEY, debate_id INTEGER NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  side TEXT NOT NULL, kind TEXT NOT NULL, author_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL,
  verses TEXT NOT NULL DEFAULT '[]', refs TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS debate_votes(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  debate_id INTEGER NOT NULL REFERENCES debates(id) ON DELETE CASCADE, side TEXT NOT NULL, moved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, PRIMARY KEY(user_id,debate_id));
CREATE TABLE IF NOT EXISTS articles(id INTEGER PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL,
  author TEXT NOT NULL, summary TEXT NOT NULL, body TEXT NOT NULL, label TEXT NOT NULL DEFAULT 'discussion', tags TEXT NOT NULL DEFAULT '',
  read_minutes INTEGER NOT NULL DEFAULT 5, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL, link TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts(key TEXT NOT NULL, at INTEGER NOT NULL);
"""

def connect():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    return c

def init():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    c = connect(); c.executescript(SCHEMA); c.commit(); c.close()

def now(): return int(time.time())
