-- Kayak Learn is paid: orders, GST invoices and course access (enrolments).
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,            -- course | path
  ref_id TEXT NOT NULL,
  title TEXT NOT NULL,
  list_paise INTEGER NOT NULL,
  taxable_paise INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0,
  sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_org TEXT,
  buyer_gstin TEXT,
  buyer_address TEXT,
  buyer_state TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',   -- created | requested | paid | failed | refunded | cancelled
  method TEXT,                               -- razorpay | bank | manual
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  invoice_no TEXT UNIQUE,
  note TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  refunded_at TEXT
);
CREATE INDEX orders_user ON orders(user_id, created_at);
CREATE INDEX orders_gw ON orders(gateway_order_id);
CREATE TABLE enrolments (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  order_id TEXT,
  granted_by TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  PRIMARY KEY (user_id, course_id)
);
CREATE TABLE invoice_seq (fy TEXT PRIMARY KEY, n INTEGER NOT NULL);
