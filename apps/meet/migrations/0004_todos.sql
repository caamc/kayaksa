-- Personal To-Do list and Planner for Meet by Kayak. A to-do belongs to one person; a deliverable is
-- a to-do with a due date, optionally tied to a client project, that the Planner tracks to its deadline.
CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  text TEXT NOT NULL,
  note TEXT,
  kind TEXT NOT NULL DEFAULT 'todo' CHECK (kind IN ('todo','deliverable')),
  channel_id TEXT,                       -- optional link to a channel / client project
  due TEXT,                              -- YYYY-MM-DD
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX todos_member ON todos(member_id, done, sort);
CREATE INDEX todos_due ON todos(member_id, due);
