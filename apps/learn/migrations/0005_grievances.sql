-- Consumer grievances (Consumer Protection (E-Commerce) Rules, 2020, rule 4): each complaint gets a reference,
-- an acknowledgement with a copy of the complaint as recorded, and must be resolved within one month.
CREATE TABLE grievances (
  id TEXT PRIMARY KEY,           -- reference shown to the consumer, e.g. KLG-20261112-4F7A
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  order_ref TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  created_at TEXT NOT NULL,
  acknowledged_at TEXT,
  due_by TEXT NOT NULL,
  resolved_at TEXT,
  resolution TEXT NOT NULL DEFAULT ''
);
CREATE INDEX grievances_status ON grievances(status, due_by);
