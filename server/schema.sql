-- Frame Beat Trainer - Online Combo Library (Cloudflare D1 / SQLite)
-- Apply locally:  npx wrangler d1 execute fbt-combos --local  --file=./schema.sql
-- Apply remote:   npx wrangler d1 execute fbt-combos --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,          -- Discord user snowflake
  username      TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  avatar        TEXT,
  banned        INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,            -- SHA-256 of bearer token (raw token never stored)
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS combos (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id  TEXT NOT NULL,
  mode          TEXT NOT NULL,             -- classic | modern
  difficulty    TEXT NOT NULL,             -- Beginner | Intermediate | Advanced | Ultra Hard
  position      TEXT,                      -- midscreen | corner | NULL
  title         TEXT NOT NULL,
  title_en      TEXT,
  tags_json     TEXT NOT NULL,
  note_count    INTEGER NOT NULL,
  total_frames  INTEGER NOT NULL,
  body          TEXT NOT NULL,             -- full validated ComboData JSON
  content_hash  TEXT NOT NULL UNIQUE,      -- dedupe identical uploads
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reject_reason TEXT,
  likes         INTEGER NOT NULL DEFAULT 0,
  downloads     INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  approved_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_combos_list ON combos(status, character_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_combos_likes ON combos(status, likes DESC);
CREATE INDEX IF NOT EXISTS idx_combos_downloads ON combos(status, downloads DESC);
CREATE INDEX IF NOT EXISTS idx_combos_new ON combos(status, approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_combos_user ON combos(user_id, created_at DESC);

-- Every authenticated upload attempt (valid or not) counts toward rate limits
CREATE TABLE IF NOT EXISTS upload_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  ip_hash    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON upload_attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_ip ON upload_attempts(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS likes (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  combo_id   TEXT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, combo_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_combo ON likes(combo_id);

-- One counted download per IP per combo per UTC day
CREATE TABLE IF NOT EXISTS download_events (
  combo_id TEXT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  ip_hash  TEXT NOT NULL,
  day      TEXT NOT NULL,
  PRIMARY KEY (combo_id, ip_hash, day)
);
