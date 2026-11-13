-- Profiles, photos, professional status, Activity feed, synced settings and Meet Calls.
ALTER TABLE members ADD COLUMN title TEXT;
ALTER TABLE members ADD COLUMN dept TEXT;
ALTER TABLE members ADD COLUMN phone TEXT;
ALTER TABLE members ADD COLUMN location TEXT;
ALTER TABLE members ADD COLUMN pronouns TEXT;
ALTER TABLE members ADD COLUMN bio TEXT;
ALTER TABLE members ADD COLUMN tz TEXT;
ALTER TABLE members ADD COLUMN links TEXT;                -- JSON [{label,url}]
ALTER TABLE members ADD COLUMN avatar_key TEXT;           -- R2 key of the profile photo
ALTER TABLE members ADD COLUMN avatar_v INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN presence TEXT NOT NULL DEFAULT 'auto';  -- auto, available, busy, dnd, brb, away, offline
ALTER TABLE members ADD COLUMN presence_until TEXT;
ALTER TABLE members ADD COLUMN status_text TEXT;
ALTER TABLE members ADD COLUMN status_emoji TEXT;
ALTER TABLE members ADD COLUMN status_until TEXT;
ALTER TABLE members ADD COLUMN ooo_until TEXT;            -- out of office
ALTER TABLE members ADD COLUMN ooo_note TEXT;
ALTER TABLE members ADD COLUMN prefs TEXT;                -- JSON settings synced across devices

CREATE TABLE activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,         -- who sees it
  at TEXT NOT NULL,
  kind TEXT NOT NULL,              -- mention, reply, reaction, dm, added, task, meeting, call, missed, system
  actor_id TEXT,
  channel_id TEXT,
  ref TEXT,                        -- message id, task id, meeting id or call id
  text TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX activity_member ON activity (member_id, id DESC);

CREATE TABLE calls (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  caller_id TEXT NOT NULL,
  video INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  answered_at TEXT,
  ended_at TEXT,
  state TEXT NOT NULL DEFAULT 'ringing'   -- ringing, live, ended, missed, declined, cancelled
);
CREATE TABLE call_parties (
  call_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ringing',  -- ringing, joined, declined, missed, left
  PRIMARY KEY (call_id, member_id)
);
CREATE INDEX call_parties_member ON call_parties (member_id, state);

-- Cast to a screen: a TV, projector PC or meeting-room display opens meet.kayaksa.com/cast and shows a code;
-- someone signed in enters the code to send a meeting to that screen.
CREATE TABLE cast_codes (
  code TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  link TEXT,
  title TEXT,
  sent_by TEXT,
  sent_at TEXT
);
