CREATE TABLE bans (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  identity  TEXT NOT NULL UNIQUE,
  reason    TEXT NOT NULL DEFAULT '',
  added_at  INTEGER NOT NULL,
  added_by  TEXT
);

CREATE TABLE webhooks (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  url       TEXT NOT NULL,
  kind      TEXT NOT NULL DEFAULT 'discord',
  events    TEXT NOT NULL DEFAULT '[]',
  enabled   INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE webhook_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id  INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  status_code INTEGER,
  response    TEXT,
  fired_at    INTEGER NOT NULL
);
CREATE INDEX webhook_log_wh_idx ON webhook_log(webhook_id, fired_at DESC);

CREATE TABLE scheduler_jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  cron_expr   TEXT NOT NULL,
  action      TEXT NOT NULL,
  payload     TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE TABLE scheduler_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id    INTEGER NOT NULL REFERENCES scheduler_jobs(id) ON DELETE CASCADE,
  action    TEXT NOT NULL,
  result    TEXT,
  ran_at    INTEGER NOT NULL
);
CREATE INDEX scheduler_log_job_idx ON scheduler_log(job_id, ran_at DESC);
