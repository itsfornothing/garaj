-- GarAj initial schema — transcribed from docs/garaj-brief-v4.md §4b (v4.2, 2026-10-17)
-- Tenant-binding pattern: every child row carries shop_id; every parent is UNIQUE(id, shop_id);
-- child FKs reference (parent_id, shop_id) so a row can never point into another garage's data.
-- Requires PostgreSQL 14+ (gen_random_uuid, num_nonnulls, GENERATED ALWAYS ... STORED).

CREATE TABLE shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text, sub_city text,
  city text NOT NULL DEFAULT 'Addis Ababa',
  phone text NOT NULL, email text,
  tin text,
  logo_url text,
  shop_type text NOT NULL,
  tax_regime text NOT NULL DEFAULT 'tot_10_2'
    CHECK (tax_regime IN ('vat_15','tot_10_2','exempt')),
  plan text NOT NULL DEFAULT 'starter',
  plan_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  phone text NOT NULL UNIQUE,
  full_name_am text NOT NULL, full_name_en text,
  role text NOT NULL,           -- 'owner','manager','technician','receptionist'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, shop_id)
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  phone text NOT NULL,
  full_name_am text NOT NULL, full_name_en text,
  email text, tin text,
  telegram_handle text,
  preferred_channel text NOT NULL DEFAULT 'sms' CHECK (preferred_channel IN ('sms','telegram')),
  consent_given boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  name_key text GENERATED ALWAYS AS (lower(regexp_replace(full_name_am, '\s+', ' ', 'g'))) STORED,
  UNIQUE(shop_id, phone),
  UNIQUE(id, shop_id)
);
CREATE INDEX idx_customers_name ON customers (shop_id, name_key);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  customer_id uuid NOT NULL,
  make text NOT NULL, model text NOT NULL, year int,
  plate_number text,            -- validation is warning-only (multi-format reality, Directive 1050/2025)
  vin text,
  fuel_type text NOT NULL CHECK (fuel_type IN ('petrol','diesel','lpg','bev','hev','phev','other')),
  odometer int, odometer_unit text DEFAULT 'km',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (customer_id, shop_id) REFERENCES customers(id, shop_id),
  UNIQUE(id, shop_id)
);
CREATE INDEX idx_vehicles_plate ON vehicles (shop_id, plate_number);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  customer_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','inspection','estimate_sent','estimate_declined',
                      'approved','in_progress','complete','paid','cancelled')),
  assigned_tech_id uuid,
  intake_at timestamptz NOT NULL DEFAULT now(),
  promised_at timestamptz, completed_at timestamptz,
  notes_am text, notes_en text,
  odometer_in int,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (customer_id, shop_id) REFERENCES customers(id, shop_id),
  FOREIGN KEY (vehicle_id, shop_id) REFERENCES vehicles(id, shop_id),
  FOREIGN KEY (assigned_tech_id, shop_id) REFERENCES users(id, shop_id),
  UNIQUE(id, shop_id)
);
CREATE INDEX idx_orders_board ON orders (shop_id, status);

CREATE TABLE canned_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  name_am text NOT NULL, name_en text,
  labor_hours numeric(5,2), labor_rate_etb numeric(10,2),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(id, shop_id)
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  name text NOT NULL, phone text, address text,
  currency text NOT NULL DEFAULT 'ETB',
  UNIQUE(id, shop_id)
);

CREATE TABLE order_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id),
  canned_job_id uuid,
  name_am text NOT NULL, name_en text,
  labor_hours numeric(5,2), labor_rate_etb numeric(10,2) NOT NULL,
  tech_id uuid,
  notes_am text,
  FOREIGN KEY (order_id, shop_id) REFERENCES orders(id, shop_id),
  FOREIGN KEY (canned_job_id, shop_id) REFERENCES canned_jobs(id, shop_id),
  FOREIGN KEY (tech_id, shop_id) REFERENCES users(id, shop_id),
  UNIQUE(id, shop_id)
);

CREATE TABLE order_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id),
  part_name_am text NOT NULL, part_name_en text, part_number text,
  supplier_id uuid,
  qty numeric(8,2) NOT NULL DEFAULT 1,
  cost_original numeric(10,2), original_currency text DEFAULT 'ETB',
  fx_rate numeric(12,4), fx_rate_date date,
  cost_etb numeric(10,2) NOT NULL,
  markup_pct numeric(5,2) DEFAULT 0,
  sell_price_etb numeric(10,2) NOT NULL,
  FOREIGN KEY (order_id, shop_id) REFERENCES orders(id, shop_id),
  FOREIGN KEY (supplier_id, shop_id) REFERENCES suppliers(id, shop_id),
  UNIQUE(id, shop_id)
);

CREATE TABLE inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id),
  tech_id uuid,
  notes_am text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, shop_id) REFERENCES orders(id, shop_id),
  FOREIGN KEY (tech_id, shop_id) REFERENCES users(id, shop_id),
  UNIQUE(id, shop_id)
);

CREATE TABLE media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id),
  storage_url text NOT NULL,
  media_type text NOT NULL,
  caption_am text, caption_en text,
  file_size_bytes int,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (inspection_id, shop_id) REFERENCES inspections(id, shop_id),
  UNIQUE(id, shop_id)
);

CREATE TABLE estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','approved','declined','superseded','expired')),
  current_version_id uuid,       -- circular ref: FK added via ALTER after estimate_versions exists
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, shop_id) REFERENCES orders(id, shop_id),
  UNIQUE(id, shop_id)
);

CREATE TABLE estimate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id),
  revision int NOT NULL DEFAULT 1,   -- re-sent estimates = new immutable revision
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','approved','declined','expired','superseded')),
  sent_at timestamptz, token_expires_at timestamptz,
  approval_token_hash text UNIQUE,   -- SHA-256 of the raw token (raw shown once at send; never stored)
  token_used_at timestamptz,         -- consumed atomically by the first successful action
  subtotal_etb numeric(10,2), tax_etb numeric(10,2), tax_type text,
  discount_etb numeric(10,2) DEFAULT 0,
  total_etb numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (estimate_id, shop_id) REFERENCES estimates(id, shop_id),
  UNIQUE(id, shop_id),
  UNIQUE(estimate_id, shop_id, revision)
);

ALTER TABLE estimates ADD
  FOREIGN KEY (current_version_id, shop_id) REFERENCES estimate_versions(id, shop_id);

CREATE TABLE estimate_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id),
  line_kind text NOT NULL CHECK (line_kind IN ('service','part')),
  name_am text NOT NULL, name_en text,
  qty numeric(8,2) NOT NULL DEFAULT 1,
  unit_price_etb numeric(10,2) NOT NULL,     -- labor: rate; part: sell price
  tax_kind text NOT NULL,                    -- 'labor' | 'part' (drives TOT/VAT split)
  source_order_service_id uuid, source_order_part_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (version_id, shop_id) REFERENCES estimate_versions(id, shop_id),
  UNIQUE(id, shop_id)
);

CREATE TABLE estimate_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id),
  decision text NOT NULL CHECK (decision IN
    ('approved_all','approved_lines','declined','callback_requested')),
  remainder_decision text                    -- required when decision = 'approved_lines'
    CHECK (remainder_decision IN ('declined','deferred','revised_estimate_requested')),
  approver_phone text,
  approver_channel text,                     -- 'sms_link','telegram','in_person','phone_call'
  confirmed_last4 boolean NOT NULL DEFAULT false, -- flips to true ONLY after last-4 verification
  token_hash text,                           -- SHA-256 of the presented token (raw token never stored)
  lockout_state text,                        -- server-side rate-limit/lockout on token+shop (not IP/session)
  recorded_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  FOREIGN KEY (version_id, shop_id) REFERENCES estimate_versions(id, shop_id),
  UNIQUE(id, shop_id)
);

-- Per-line approvals (normalized — arrays cannot enforce that approved lines
-- belong to the right version/shop; the version-match rule
-- (line.version_id = approval.version_id) is trigger-enforced at the API layer, §13)
CREATE TABLE estimate_approval_lines (
  approval_id uuid NOT NULL,
  estimate_line_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id),
  PRIMARY KEY (approval_id, estimate_line_id),
  FOREIGN KEY (approval_id, shop_id) REFERENCES estimate_approvals(id, shop_id),
  FOREIGN KEY (estimate_line_id, shop_id) REFERENCES estimate_lines(id, shop_id)
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  order_id uuid NOT NULL,
  estimate_version_id uuid NOT NULL,         -- always from an approved version
  invoice_number text NOT NULL UNIQUE,       -- INV-{ethiopian_year}/{seq}
  fiscal_year_et int NOT NULL,
  tax_type text NOT NULL, tax_etb numeric(10,2) NOT NULL,
  subtotal_etb numeric(10,2) NOT NULL,
  discount_etb numeric(10,2) DEFAULT 0,
  total_etb numeric(10,2) NOT NULL,          -- computed at issue from APPROVED lines snapshot
  amount_paid_etb numeric(10,2) NOT NULL DEFAULT 0
    CHECK (amount_paid_etb >= 0 AND amount_paid_etb <= total_etb),
  balance_due_etb numeric(10,2) GENERATED ALWAYS AS (total_etb - amount_paid_etb) STORED,
  status text NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid','partial','paid','voided')),
  issued_at timestamptz NOT NULL DEFAULT now(), due_at timestamptz,
  efd_receipt_number text,                   -- manual, vat_15 shops; reserved for MoR e-receipt
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, shop_id) REFERENCES orders(id, shop_id),
  FOREIGN KEY (estimate_version_id, shop_id) REFERENCES estimate_versions(id, shop_id),
  UNIQUE(id, shop_id)
);
CREATE INDEX idx_invoices_order ON invoices (order_id);

CREATE TABLE invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id),
  line_kind text NOT NULL CHECK (line_kind IN ('service','part')),
  name_am text NOT NULL, name_en text,
  qty numeric(8,2) NOT NULL, unit_price_etb numeric(10,2) NOT NULL,
  tax_rate numeric(5,4) NOT NULL DEFAULT 0, tax_type text,
  line_subtotal_etb numeric(10,2) NOT NULL,
  line_tax_etb numeric(10,2) NOT NULL DEFAULT 0,
  line_total_etb numeric(10,2) NOT NULL,
  source_estimate_line_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invoice_id, shop_id) REFERENCES invoices(id, shop_id),
  UNIQUE(id, shop_id)
);

CREATE TABLE invoice_sequences (
  shop_id uuid NOT NULL REFERENCES shops(id),
  fiscal_year_et int NOT NULL,
  last_seq int NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, fiscal_year_et)
);

CREATE TABLE billing_sequences (
  shop_id uuid NOT NULL REFERENCES shops(id),
  fiscal_year_et int NOT NULL,
  last_seq int NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, fiscal_year_et)
);

-- Our subscription billing documents (sold TO the garage). Separate sequence —
-- not repair-order invoices. Compliance treatment of our own invoicing is provisional (§3c).
CREATE TABLE billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  kind text NOT NULL CHECK (kind IN ('subscription_renewal')),
  plan text NOT NULL,
  period_start date NOT NULL, period_end date NOT NULL,
  billing_number text NOT NULL UNIQUE,        -- BILL-{ethiopian_year}/{seq}; allocated under
                                              -- SELECT ... FOR UPDATE on billing_sequences
  amount_etb numeric(10,2) NOT NULL,
  amount_paid_etb numeric(10,2) NOT NULL DEFAULT 0
    CHECK (amount_paid_etb BETWEEN 0 AND amount_etb),
  status text NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid','partial','paid','voided')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, shop_id)
);

-- Attempt ≠ payment
CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  billing_record_id uuid,                     -- exactly one target (repair invoice | subscription billing record)
  shop_id uuid NOT NULL REFERENCES shops(id),
  kind text NOT NULL CHECK (kind IN ('customer','subscription')),
  provider text NOT NULL,                     -- 'chapa'
  provider_tx_ref text UNIQUE,                -- our idempotency anchor
  amount_requested_etb numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated','pending','succeeded','failed','cancelled')),
  initiated_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  verified_reason text,                       -- 'webhook','redirect_poll','manual_reconcile'
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invoice_id, shop_id) REFERENCES invoices(id, shop_id),
  FOREIGN KEY (billing_record_id, shop_id) REFERENCES billing_records(id, shop_id),
  UNIQUE(id, shop_id),
  CHECK (num_nonnulls(invoice_id, billing_record_id) = 1),
  CHECK ((kind = 'customer') = (invoice_id IS NOT NULL))
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  billing_record_id uuid,                     -- exactly one target (same entity the attempt settled)
  shop_id uuid NOT NULL REFERENCES shops(id),
  attempt_id uuid,                            -- NULL for cash-at-counter
  provider_ref text,                          -- provider tx id on electronic receipts; UNIQUE ⇒
                                              -- a webhook retry/replay cannot mint a second receipt
  kind text NOT NULL CHECK (kind IN ('receipt','refund')),
  refund_of_payment_id uuid,                  -- every refund names the receipt it reverses;
                                              -- Σ(refunds on a receipt) ≤ receipt.amount — row-locked + trigger
  method text NOT NULL CHECK (method IN
    ('telebirr','cbe_birr','ebirr','mpesa','card','cash','bank_transfer')),
  amount_etb numeric(10,2) NOT NULL CHECK (amount_etb > 0),
  recorded_by uuid,
  reason text,                                -- required for refunds (app-enforced + tested)
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  FOREIGN KEY (invoice_id, shop_id) REFERENCES invoices(id, shop_id),
  FOREIGN KEY (billing_record_id, shop_id) REFERENCES billing_records(id, shop_id),
  FOREIGN KEY (refund_of_payment_id, shop_id) REFERENCES payments(id, shop_id),
  FOREIGN KEY (recorded_by, shop_id) REFERENCES users(id, shop_id),
  FOREIGN KEY (attempt_id, shop_id) REFERENCES payment_attempts(id, shop_id),
  UNIQUE(id, shop_id),
  UNIQUE (attempt_id) DEFERRABLE INITIALLY DEFERRED,  -- one settlement per attempt
  UNIQUE (provider_ref),
  CHECK (num_nonnulls(invoice_id, billing_record_id) = 1),
  CHECK (kind = 'receipt' OR refund_of_payment_id IS NOT NULL)
);
CREATE INDEX idx_payments_invoice ON payments (invoice_id);

-- Subscription periods (minimal automation)
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  plan text NOT NULL,
  period_start date NOT NULL, period_end date NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','cancelled')),
  outcome_billing_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (outcome_billing_record_id, shop_id) REFERENCES billing_records(id, shop_id)
);

-- Deferred: schema now; features NOT in go-live; no reliability claims
CREATE TABLE parts_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  order_id uuid,
  part_name_am text NOT NULL, part_name_en text, part_number text,
  supplier_id uuid,
  expected_arrival_at timestamptz, arrived_at timestamptz,
  customer_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, shop_id) REFERENCES orders(id, shop_id),
  FOREIGN KEY (supplier_id, shop_id) REFERENCES suppliers(id, shop_id),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

CREATE TABLE inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  part_name_am text NOT NULL, part_name_en text, part_number text,
  supplier_id uuid,
  qty_on_hand numeric(8,2) NOT NULL DEFAULT 0,
  reorder_point numeric(8,2) DEFAULT 0,
  cost_etb numeric(10,2), sell_price_etb numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (supplier_id, shop_id) REFERENCES suppliers(id, shop_id)
);
-- No inventory movement ledger in go-live: do not claim stock accounting.

-- Audit trail (who did what to money and approvals)
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  actor_user_id uuid,
  action text NOT NULL,
  entity text NOT NULL, entity_id uuid,
  before jsonb, after jsonb,
  channel text,                               -- 'app','sms_link','telegram','system'
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (actor_user_id, shop_id) REFERENCES users(id, shop_id),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);
CREATE INDEX idx_audit_log_recency ON audit_log (shop_id, created_at);

CREATE TABLE notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id),
  kind text NOT NULL CHECK (kind IN
    ('estimate_link','estimate_reminder','invoice_link','payment_receipt','daily_summary','system')),
  channel text NOT NULL CHECK (channel IN ('sms','telegram')),
  to_address text NOT NULL,
  template_id text, body text NOT NULL,
  segments int,                               -- UCS-2: 1 if ≤70 chars, else ceil(chars/67)
  cost_etb numeric(8,4),
  status text NOT NULL CHECK (status IN ('queued','sent','delivered','failed')),
  provider_message_id text,
  sent_at timestamptz, delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recency ON notifications_log (shop_id, created_at);
