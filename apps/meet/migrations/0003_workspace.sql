-- Kayak Meet workspace: signed-in accounts for Kayak employees and invited clients, persistent
-- channels and direct messages, threads, tasks and projects, and per-channel integrations.
-- Privacy by design: clients see only the channels they were added to, and only the people in them.

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  org TEXT,                                   -- client organisation (blank for Kayak)
  kind TEXT NOT NULL CHECK (kind IN ('employee','client')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','disabled')),
  totp_secret TEXT,                           -- sealed; clients only (employees use the Kayak Internal 2FA)
  totp_last INTEGER,                          -- last accepted time step (stops code replay)
  lang TEXT NOT NULL DEFAULT 'en',            -- preferred language for translation
  invited_by TEXT,
  invite_hash TEXT,                           -- SHA-256 of the current one-time invitation token
  invite_expires TEXT,
  notice_version TEXT,                        -- privacy notice accepted at first sign-in
  created_at TEXT NOT NULL,
  last_seen TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                        -- SHA-256 of the cookie token
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('full','pre')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  ip TEXT, ua TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE sso_used (j TEXT PRIMARY KEY, at INTEGER NOT NULL);

CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('channel','project','dm')),
  topic TEXT,
  private INTEGER NOT NULL DEFAULT 1,         -- 0 = any Kayak employee can join; clients always need adding
  external INTEGER NOT NULL DEFAULT 0,        -- 1 = has client members (shown with a badge)
  due TEXT,                                   -- projects: target date
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  dm_key TEXT UNIQUE                          -- sorted member ids, for direct messages
);

CREATE TABLE channel_members (
  channel_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  last_read INTEGER NOT NULL DEFAULT 0,
  muted INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL,
  PRIMARY KEY (channel_id, member_id)
);
CREATE INDEX cm_member ON channel_members(member_id);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  member_id TEXT,                             -- NULL for system messages
  parent_id INTEGER,                          -- thread replies
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',          -- text | system | meeting | file
  meta TEXT,                                  -- JSON (meeting id, file key, …)
  reactions TEXT,                             -- JSON {emoji: [member ids]}
  created_at TEXT NOT NULL,
  edited_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX msg_channel ON messages(channel_id, id);
CREATE INDEX msg_parent ON messages(parent_id);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','review','done')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assignee TEXT,
  due TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  done_at TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX tasks_channel ON tasks(channel_id, status);
CREATE INDEX tasks_assignee ON tasks(assignee, status);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX files_channel ON files(channel_id);

CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('slack','webhook')),
  label TEXT,
  secret TEXT NOT NULL,                       -- sealed URL (and signing secret for webhooks)
  events TEXT NOT NULL DEFAULT '["recap","task"]',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_status TEXT
);

-- Meetings started from a channel, breakout rooms and webinar Q&A.
ALTER TABLE meetings ADD COLUMN channel_id TEXT;
ALTER TABLE meetings ADD COLUMN parent_id TEXT;
CREATE TABLE qa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  votes TEXT NOT NULL DEFAULT '[]',
  answered INTEGER NOT NULL DEFAULT 0,
  at TEXT NOT NULL
);
CREATE INDEX qa_m ON qa(meeting_id);
