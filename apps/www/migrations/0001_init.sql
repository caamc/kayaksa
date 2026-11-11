-- www.kayaksa.com schema. Managed from internal.kayaksa.com (bound there as WWW_DB).
CREATE TABLE articles (
  id TEXT PRIMARY KEY,                 -- URL slug: /insights/<id>
  section TEXT NOT NULL, cluster TEXT NOT NULL DEFAULT '', pattern TEXT NOT NULL DEFAULT 'chevron-wake',
  mins INTEGER NOT NULL DEFAULT 5, title TEXT NOT NULL, dek TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '[]',     -- JSON array of paragraphs; "## " starts a heading
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at TEXT, updated_at TEXT NOT NULL, author TEXT NOT NULL DEFAULT ''
);
CREATE TABLE enquiries (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('contact','career')), source TEXT NOT NULL DEFAULT 'form',
  name TEXT NOT NULL, email TEXT NOT NULL, organisation TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '', message TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', transcript TEXT NOT NULL DEFAULT '',
  page TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','closed','spam')), notes TEXT NOT NULL DEFAULT '',
  consent_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX enquiries_created ON enquiries(created_at);
CREATE TABLE subscribers (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, list TEXT NOT NULL CHECK (list IN ('confluence','seecounter')),
  filters TEXT NOT NULL DEFAULT '{}', frequency TEXT NOT NULL DEFAULT 'weekly',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','unsubscribed')),
  token_hash TEXT NOT NULL, consent_at TEXT NOT NULL, created_at TEXT NOT NULL, confirmed_at TEXT, unsubscribed_at TEXT,
  UNIQUE (email, list)
);
CREATE TABLE cases (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing','closed')),
  jurisdiction TEXT NOT NULL DEFAULT '', authority TEXT NOT NULL DEFAULT '', action_date TEXT, source_url TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX cases_date ON cases(published, action_date);
-- Cookieless statistics: daily counts only, no identifiers.
CREATE TABLE stat_views (day TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path));
CREATE TABLE stat_dims (day TEXT NOT NULL, dim TEXT NOT NULL, value TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, dim, value));
CREATE TABLE stat_vitals (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, path TEXT NOT NULL, lcp INTEGER, cls REAL, inp INTEGER, ttfb INTEGER);
CREATE INDEX stat_vitals_day ON stat_vitals(day);
CREATE TABLE kay_usage (day TEXT PRIMARY KEY, chats INTEGER NOT NULL DEFAULT 0, voice INTEGER NOT NULL DEFAULT 0, tts_chars INTEGER NOT NULL DEFAULT 0);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, detail TEXT, ip TEXT);
