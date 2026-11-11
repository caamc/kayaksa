-- Phase 2 and 3 of the internal portal: dashboards, Kayak AI memory, certifications, launches,
-- whiteboards, the briefing studio, client tools monitoring, the studio, the store and updates.

-- Kayak AI usage per day and model, for the cost dashboard
CREATE TABLE IF NOT EXISTS ai_usage (day TEXT NOT NULL, model TEXT NOT NULL, kind TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, chars_in INTEGER NOT NULL DEFAULT 0, chars_out INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, model, kind));

-- Kayak AI memory: proposed from conversations, screened, used only once an administrator approves
CREATE TABLE IF NOT EXISTS ai_memory (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, by_user TEXT, source TEXT, text TEXT NOT NULL, category TEXT, status TEXT NOT NULL DEFAULT 'pending', screen TEXT, reviewed_by TEXT, reviewed_at TEXT);
CREATE INDEX IF NOT EXISTS ai_memory_status ON ai_memory(status);
-- Approved answers Kayak AI can give again without calling an outside model
CREATE TABLE IF NOT EXISTS ai_cache (id INTEGER PRIMARY KEY AUTOINCREMENT, q_norm TEXT NOT NULL UNIQUE, question TEXT NOT NULL, answer TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT, hits INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'approved');
-- Digital footprint reports
CREATE TABLE IF NOT EXISTS footprint_reports (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, by_user TEXT, scope TEXT NOT NULL, status TEXT NOT NULL, report TEXT, error TEXT);

-- Certification journeys for Kayak, its affiliates and its tools
CREATE TABLE IF NOT EXISTS certifications (id TEXT PRIMARY KEY, entity TEXT NOT NULL, standard TEXT NOT NULL, scope TEXT, body TEXT, status TEXT NOT NULL DEFAULT 'planned', owner TEXT, start_date TEXT, target_date TEXT, achieved_date TEXT, expiry_date TEXT, cost_est INTEGER, cost_actual INTEGER, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cert_steps (id INTEGER PRIMARY KEY AUTOINCREMENT, cert_id TEXT NOT NULL, ord INTEGER NOT NULL, title TEXT NOT NULL, days INTEGER NOT NULL DEFAULT 0, owner TEXT, due_date TEXT, done_at TEXT, evidence TEXT);
CREATE INDEX IF NOT EXISTS cert_steps_cert ON cert_steps(cert_id, ord);

-- Launch monitor: one launch per application, with the work that must finish first
CREATE TABLE IF NOT EXISTS launches (id TEXT PRIMARY KEY, app TEXT NOT NULL, url TEXT, owner TEXT, target_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned', launched_at TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS launch_items (id INTEGER PRIMARY KEY AUTOINCREMENT, launch_id TEXT NOT NULL, ord INTEGER NOT NULL, title TEXT NOT NULL, category TEXT, days INTEGER NOT NULL DEFAULT 1, cost INTEGER NOT NULL DEFAULT 0, owner TEXT, accountable TEXT, due_date TEXT, status TEXT NOT NULL DEFAULT 'todo', done_at TEXT, blocker TEXT);
CREATE INDEX IF NOT EXISTS launch_items_launch ON launch_items(launch_id, ord);

-- Whiteboards
CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, title TEXT NOT NULL, owner TEXT NOT NULL, data TEXT NOT NULL, thumb TEXT, shared INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

-- Briefing and capability studio, benchmark reports
CREATE TABLE IF NOT EXISTS briefs (id TEXT PRIMARY KEY, kind TEXT NOT NULL, brand TEXT NOT NULL, client TEXT NOT NULL, industry TEXT, service TEXT, status TEXT NOT NULL, data TEXT, error TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

-- Client tools: deployments and monitoring
CREATE TABLE IF NOT EXISTS client_deployments (id TEXT PRIMARY KEY, client TEXT NOT NULL, tool TEXT NOT NULL, plan TEXT, region TEXT, status TEXT NOT NULL DEFAULT 'pilot', seats INTEGER, start_date TEXT, renewal_date TEXT, value INTEGER, owner TEXT, url TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS monitors (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, tool TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS monitor_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, monitor_id TEXT NOT NULL, at TEXT NOT NULL, ok INTEGER NOT NULL, status INTEGER, ms INTEGER, error TEXT);
CREATE INDEX IF NOT EXISTS monitor_checks_m ON monitor_checks(monitor_id, at);
CREATE TABLE IF NOT EXISTS incidents (id INTEGER PRIMARY KEY AUTOINCREMENT, monitor_id TEXT, title TEXT NOT NULL, started_at TEXT NOT NULL, resolved_at TEXT, notes TEXT);

-- Studio idea wall, Kayakers Update, Kayakers Store
CREATE TABLE IF NOT EXISTS ideas (id INTEGER PRIMARY KEY AUTOINCREMENT, by_user TEXT NOT NULL, text TEXT NOT NULL, tag TEXT, votes INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS idea_votes (idea_id INTEGER NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (idea_id, user_id));
CREATE TABLE IF NOT EXISTS updates (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT, by_user TEXT, auto INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS update_reacts (update_id INTEGER NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (update_id, user_id, emoji));
CREATE TABLE IF NOT EXISTS store_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, by_user TEXT NOT NULL, item TEXT NOT NULL, brand TEXT, variant TEXT, size TEXT, qty INTEGER NOT NULL DEFAULT 1, note TEXT, status TEXT NOT NULL DEFAULT 'requested', created_at TEXT NOT NULL);

-- Small settings store (social profiles and similar), editable by administrators
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT);
