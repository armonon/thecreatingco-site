"""SQLite persistence: queue, memory, telemetry. One file, WAL mode, stdlib only."""
import json
import os
import sqlite3
import time
import uuid
from datetime import datetime, timezone

ENGINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKSPACE = os.path.dirname(ENGINE_DIR)
DEFAULT_DB = os.environ.get("MKTG_DB", os.path.join(ENGINE_DIR, "data", "mktg.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id TEXT PRIMARY KEY, name TEXT, product TEXT, tier TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'active', goal TEXT, opus_reviews_used INTEGER DEFAULT 0,
  created_at TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY, campaign_id TEXT, task_type TEXT NOT NULL, title TEXT,
  payload TEXT, priority INTEGER DEFAULT 50, status TEXT DEFAULT 'QUEUED',
  role TEXT, preferred_model TEXT, fallback_model TEXT, model_used TEXT,
  complexity INTEGER DEFAULT 1, creativity INTEGER DEFAULT 0, importance INTEGER DEFAULT 1, risk INTEGER DEFAULT 0,
  token_budget INTEGER, tool_budget INTEGER, reasoning TEXT,
  retry_count INTEGER DEFAULT 0, rewrite_count INTEGER DEFAULT 0,
  dependencies TEXT DEFAULT '[]', parent_id TEXT, review_level TEXT DEFAULT 'none',
  created_at TEXT, started_at TEXT, completed_at TEXT, lease_until REAL,
  result_reference TEXT, error TEXT
);
CREATE INDEX IF NOT EXISTS tasks_status ON tasks(status, priority);
CREATE TABLE IF NOT EXISTS results (
  task_id TEXT PRIMARY KEY, role TEXT, model TEXT, content TEXT, meta TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS model_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, day TEXT, provider TEXT, model TEXT, role TEXT,
  task_id TEXT, campaign_id TEXT, task_type TEXT, input_tokens INTEGER, output_tokens INTEGER,
  cached_tokens INTEGER, est_cost REAL, latency_ms INTEGER, ok INTEGER, error_kind TEXT,
  retry INTEGER, tokens_estimated INTEGER, prompt_chars INTEGER, reasoning TEXT
);
CREATE INDEX IF NOT EXISTS calls_day ON model_calls(day);
CREATE TABLE IF NOT EXISTS provider_health (
  provider TEXT PRIMARY KEY, status TEXT, reason TEXT, until REAL, failures INTEGER DEFAULT 0, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS leads (
  lead_id TEXT PRIMARY KEY, name TEXT, org TEXT, platform TEXT, url TEXT, url_norm TEXT,
  email TEXT, email_norm TEXT, handle TEXT, campaign_id TEXT, product TEXT, relevance TEXT,
  status TEXT DEFAULT 'prospect', last_contact TEXT, followups INTEGER DEFAULT 0, response TEXT,
  notes TEXT, dnc INTEGER DEFAULT 0, source TEXT, created_at TEXT, updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS leads_url ON leads(url_norm) WHERE url_norm IS NOT NULL AND url_norm != '';
CREATE UNIQUE INDEX IF NOT EXISTS leads_email ON leads(email_norm) WHERE email_norm IS NOT NULL AND email_norm != '';
CREATE TABLE IF NOT EXISTS outreach (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id TEXT, ts TEXT, day TEXT, kind TEXT, channel TEXT,
  subject TEXT, campaign_id TEXT, task_id TEXT, model TEXT
);
CREATE TABLE IF NOT EXISTS dnc (
  key TEXT PRIMARY KEY, reason TEXT, ts TEXT
);
CREATE TABLE IF NOT EXISTS content (
  content_id TEXT PRIMARY KEY, platform TEXT, campaign_id TEXT, body TEXT, body_hash TEXT UNIQUE,
  topic TEXT, cta TEXT, status TEXT DEFAULT 'draft', publish_date TEXT, url TEXT,
  impressions INTEGER, clicks INTEGER, engagement INTEGER, conversions INTEGER,
  model TEXT, task_id TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, campaign_id TEXT, content_id TEXT, platform TEXT,
  audience TEXT, angle TEXT, cta TEXT, model TEXT, impressions INTEGER, clicks INTEGER,
  replies INTEGER, signups INTEGER, conversions INTEGER, engagement INTEGER, cost REAL
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, task_id TEXT, target_task_id TEXT, campaign_id TEXT,
  reviewer TEXT, mode TEXT, verdict TEXT, confidence INTEGER, critical TEXT, changes TEXT
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, kind TEXT, product TEXT, campaign_id TEXT,
  source TEXT, title TEXT, body TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(title, body, product, kind, content='notes', content_rowid='id');
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, body, product, kind) VALUES (new.id, new.title, new.body, new.product, new.kind);
END;
CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body, product, kind) VALUES ('delete', old.id, old.title, old.body, old.product, old.kind);
END;
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, kind TEXT, detail TEXT
);
"""


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def today():
    return datetime.now().astimezone().strftime("%Y-%m-%d")


def new_id(prefix):
    return f"{prefix}_{time.strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"


def connect(path=None):
    path = path or DEFAULT_DB
    if path != ":memory:":
        os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    conn.executescript(SCHEMA)
    return conn


def event(conn, kind, detail):
    conn.execute("INSERT INTO events(ts, kind, detail) VALUES (?,?,?)",
                 (now_iso(), kind, json.dumps(detail) if not isinstance(detail, str) else detail))


def kv_get(conn, key, default=None):
    r = conn.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
    return json.loads(r["value"]) if r else default


def kv_set(conn, key, value):
    conn.execute("INSERT INTO kv(key,value,updated_at) VALUES (?,?,?) "
                 "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
                 (key, json.dumps(value), now_iso()))
