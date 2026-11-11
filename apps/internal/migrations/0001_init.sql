-- internal.kayaksa.com schema
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('superadmin','admin','editor','employee')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','disabled')),
  pw_hash TEXT,
  pw_changed_at TEXT,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  totp_last_step INTEGER NOT NULL DEFAULT 0,
  recovery TEXT NOT NULL DEFAULT '[]',
  failed INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  last_login TEXT
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('full','pre')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  ip TEXT, ua TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE tokens (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('invite','reset')),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, detail TEXT, ip TEXT
);
CREATE INDEX audit_at ON audit_log(at);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','beta','coming-soon','internal')),
  owner TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#17807E',
  sort INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE partners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','prospect','paused','ended')),
  sectors TEXT NOT NULL DEFAULT '[]',
  services TEXT NOT NULL DEFAULT '[]',
  city TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT 'India',
  website TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '', contact_role TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '', contact_phone TEXT NOT NULL DEFAULT '',
  since TEXT NOT NULL DEFAULT '', nda_until TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX partners_name ON partners(name);
CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX ai_conv_user ON ai_conversations(user_id, updated_at);
CREATE TABLE ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, conv_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX ai_msg_conv ON ai_messages(conv_id, id);
CREATE TABLE cards (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL, template TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE decks (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, inputs TEXT NOT NULL, spec TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE learn_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_id TEXT NOT NULL, lesson_id TEXT NOT NULL, done_at TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id, lesson_id)
);
CREATE TABLE quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL, score INTEGER NOT NULL, passed INTEGER NOT NULL, at TEXT NOT NULL
);
CREATE TABLE certificates (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('course','path')), ref_id TEXT NOT NULL, holder TEXT NOT NULL, title TEXT NOT NULL, issued_at TEXT NOT NULL,
  UNIQUE (user_id, kind, ref_id)
);

INSERT INTO tools (id, name, category, summary, url, status, owner, color, sort, created_at, updated_at) VALUES
 ('nexapair','NexaPair','Third-party risk management','Vendor and third-party lifecycle: onboarding, relationship intelligence, risk tiering, due diligence, monitoring and exit.','https://www.nexapair.ae','live','Technology & AI','#17807E',10,datetime('now'),datetime('now')),
 ('sayusnow','SayUsNow','Ethics and compliance','Cases, conflicts of interest, gifts register, learning, diligence and culture surveys in one platform.','','beta','Technology & AI','#0E2F3C',20,datetime('now'),datetime('now')),
 ('seecounter','SeeCounter','Counterfeiting case repository','Searchable repository of past and ongoing counterfeiting cases, with filtered inbox alerts on new actions.','','coming-soon','Crisis & Resilience','#0B5654',30,datetime('now'),datetime('now')),
 ('docuvow','DocuVow','E-signature and signing','Prepare, send, sign and verify documents, with each signed copy sealed and provable.','','beta','Technology & AI','#2B2680',40,datetime('now'),datetime('now')),
 ('kayak-ai','Kayak AI','Assistant','Kayak''s AI assistant for drafting, research and review, connected to Claude, GPT/Codex or Grok.','/app#/ai','internal','Technology & AI','#2D6A9F',50,datetime('now'),datetime('now')),
 ('kayak-cards','Kayak Business Cards','Brand studio','Brand-locked visiting cards from a prompt, in SVG, PDF, PNG and JPG.','/app#/cards','internal','Brand','#9C630E',60,datetime('now'),datetime('now')),
 ('kayak-decks','Kayak Presentations','Brand studio','Sector- and service-specific presentations in the Kayak master, exported to PowerPoint.','/app#/decks','internal','Brand','#5E4B78',70,datetime('now'),datetime('now')),
 ('kayak-toolbar','KSA Office Toolbar','Office add-in','The Kayak ribbon for Word, PowerPoint and Excel: logos, colours, templates and checks.','/app#/brand?c=Office%20templates%20and%20toolbar','internal','Brand','#3E5563',80,datetime('now'),datetime('now'));

INSERT INTO partners (id, name, kind, status, sectors, services, city, country, website, notes, created_at, updated_at) VALUES
 ('kayak-innovations','Kayak Innovations (OPC) Private Limited','Group company','prospect','["Technology"]','["Intellectual property holding","Product innovation"]','Mumbai','India','','Name reserved under SPICe+ Part A (AC7343381); incorporation pending.',datetime('now'),datetime('now')),
 ('kayak-technology-solutions','Kayak Technology Solutions Private Limited','Group company','active','["Technology"]','["SaaS platforms","Engineering"]','Mumbai','India','','Builds and runs the Kayak tools.',datetime('now'),datetime('now'));
