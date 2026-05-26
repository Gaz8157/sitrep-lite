CREATE TABLE users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL CHECK(role IN ('owner','head_admin','admin','moderator','viewer','demo')),
  totp_secret     TEXT,
  totp_backup_codes TEXT,
  discord_id      TEXT UNIQUE,
  discord_username TEXT,
  avatar_path     TEXT,
  background_path TEXT,
  created_at      INTEGER NOT NULL,
  last_login_at   INTEGER,
  last_login_ip   TEXT,
  disabled        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX users_role_idx ON users(role);

CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  last_used_at    INTEGER NOT NULL,
  ip              TEXT,
  user_agent      TEXT,
  remember        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

CREATE TABLE pending_2fa (
  token           TEXT PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at      INTEGER NOT NULL
);

CREATE TABLE password_resets (
  token           TEXT PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  used_at         INTEGER
);

CREATE TABLE audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts              INTEGER NOT NULL,
  actor_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  target          TEXT,
  ip              TEXT,
  user_agent      TEXT,
  data            TEXT
);
CREATE INDEX audit_log_ts_idx ON audit_log(ts DESC);
CREATE INDEX audit_log_actor_idx ON audit_log(actor_user_id, ts DESC);
