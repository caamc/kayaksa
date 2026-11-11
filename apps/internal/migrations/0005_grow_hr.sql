-- Grow & Connect (Kayak Network groups, referrals, network emails, competitor watch) and
-- HR & Admin (People Masters, roles and responsibilities, celebrations).

-- 14 · Kayak Network: four groups, referral tracking and group emails
ALTER TABLE partners ADD COLUMN grp TEXT NOT NULL DEFAULT 'bp_consulting';
ALTER TABLE partners ADD COLUMN email_opt_out INTEGER NOT NULL DEFAULT 0;
UPDATE partners SET grp = 'affiliate' WHERE kind = 'Group company' OR kind = 'Affiliate';
UPDATE partners SET grp = 'bp_vendor' WHERE kind IN ('Technology partner');
UPDATE partners SET grp = 'senior_advisor' WHERE kind = 'Subject expert';
CREATE INDEX partners_grp ON partners(grp);
CREATE TABLE referrals (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')), -- in: they referred work to Kayak; out: Kayak referred work to them
  opportunity TEXT NOT NULL, client TEXT NOT NULL DEFAULT '', cluster TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'introduced' CHECK (status IN ('introduced','meeting','proposal','won','lost','parked')),
  value_inr INTEGER NOT NULL DEFAULT 0, fee_pct REAL NOT NULL DEFAULT 0, fee_paid INTEGER NOT NULL DEFAULT 0,
  referred_on TEXT NOT NULL, closed_on TEXT, owner TEXT, notes TEXT NOT NULL DEFAULT '',
  created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX referrals_partner ON referrals(partner_id);
CREATE TABLE network_mail (
  id TEXT PRIMARY KEY, grp TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
  recipients INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0,
  by_user TEXT, created_at TEXT NOT NULL
);

-- 17 · Website management: competitor watch (public headlines and links only; robots.txt respected)
CREATE TABLE competitors (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
  last_checked TEXT, last_status TEXT NOT NULL DEFAULT '', items INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 100
);
CREATE TABLE competitor_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  title TEXT NOT NULL, url TEXT NOT NULL, first_seen TEXT NOT NULL, UNIQUE(competitor_id, url)
);
CREATE INDEX competitor_items_seen ON competitor_items(first_seen);
CREATE TABLE competitor_briefs (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL, model TEXT NOT NULL, by_user TEXT, created_at TEXT NOT NULL);
INSERT INTO competitors (id, name, url, sort) VALUES
 ('deloitte','Deloitte India','https://www.deloitte.com/in/en/insights.html',1),
 ('pwc','PwC India','https://www.pwc.in/research-and-insights-hub.html',2),
 ('ey','EY India','https://www.ey.com/en_in/insights',3),
 ('kpmg','KPMG India','https://kpmg.com/in/en/insights.html',4),
 ('bdo','BDO India','https://www.bdo.in/en-gb/insights',5),
 ('gt','Grant Thornton Bharat','https://www.grantthornton.in/insights/',6),
 ('rsm','RSM India','https://www.rsm.global/india/insights',7),
 ('bakertilly','Baker Tilly India','https://www.bakertilly.in/insights',8);

-- 24 · People Masters: five registers. Ordinary fields in `data`; sensitive personal data sealed
-- with PII_ENCRYPTION_KEY in `sealed`, revealed only to administrators, and every reveal is audited.
CREATE TABLE masters (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('employee','partner','director','client','distributor')),
  name TEXT NOT NULL, entity TEXT NOT NULL DEFAULT 'KSA', status TEXT NOT NULL DEFAULT 'active',
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  data TEXT NOT NULL DEFAULT '{}', sealed TEXT,
  lawful_basis TEXT NOT NULL DEFAULT '', purpose TEXT NOT NULL DEFAULT '',
  notice_version TEXT NOT NULL DEFAULT '', consent_at TEXT, retention_until TEXT,
  dob_md TEXT, joined_on TEXT, wishes INTEGER NOT NULL DEFAULT 1, -- celebrations (month-day only; the year is never shown)
  created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX masters_kind ON masters(kind, name);
CREATE TABLE celebrations_sent (master_id TEXT NOT NULL, kind TEXT NOT NULL, year INTEGER NOT NULL, at TEXT NOT NULL, PRIMARY KEY (master_id, kind, year));

-- 23 · Roles and responsibilities
CREATE TABLE roles (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, entity TEXT NOT NULL DEFAULT 'KSA', reports_to TEXT,
  purpose TEXT NOT NULL DEFAULT '', responsibilities TEXT NOT NULL DEFAULT '[]', kpis TEXT NOT NULL DEFAULT '[]',
  authorities TEXT NOT NULL DEFAULT '[]', statutory INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE role_holders (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  since TEXT NOT NULL, primary_holder INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (role_id, user_id)
);
