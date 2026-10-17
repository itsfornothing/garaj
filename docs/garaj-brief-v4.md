# GarAj (ጋራዥ) — Agent brief v4 (final, audit-merged)

**Build a validated Ethiopian garage management SaaS, using REA to behaviorally study Shopmonkey's workflow — and let evidence, not assumptions, set pricing, channels, and scope.**

You are a coding agent. This brief is the complete specification. Do not ask clarifying questions except for the two blocking items in §16 (trademark alternative; pilot go/no-go). Make decisions, record every one in `docs/decisions.md` with evidence, and continue. Produce observable evidence at every milestone.

## v4 changelog (from v3 — what your review demanded, merged)

1. **"No competitors in Ethiopia" removed.** Three local competitors verified live (Finix Automotive, TAB Technologies, Meda Garage), plus further leads (YanolTech, regional SaaS, FOSS substitutes). Product positioning is now evidence-driven (§2d).
2. **Market validation is a first-class workstream.** Garage interviews (user-owned; agent-produced instruments) must confirm the problem, workflows, and willingness-to-pay before go-live commitment. Pricing and channel defaults are provisional hypotheses until pilot evidence (§12).
3. **Tax rules are provisional until verified.** TOT/VAT rates, thresholds, TIN rules, invoice legality are implemented behind the `tax_regime` engine but must be signed off by current MoR guidance + an Ethiopian tax professional before real financial documents (§3c).
4. **Tenant isolation is enforced at the database layer** via composite foreign keys, plus a mandatory cross-shop RLS attack test suite (§5c, §13).
5. **Financial modeling corrected:** estimator versions + immutable lines + per-line approval events; payment attempts separated from confirmed payments; partial payments and balances; invoice `paid` no longer auto-implies order paid (§4b, §6c).
6. **Workflow transitions, corrections, and audit trail specified** (§4b, §6a, §6c).
7. **Telegram demoted from fixed default to testable channel.** Channel router ships at go-live; the default comes from pilot evidence (§2d, §15 decision 6).
8. **Architecture trimmed:** inventory remains schema-only (no stock-accounting claims); subscription automation stays minimal; Calay time convention deferred until pilot evidence supports it (§9).
9. **REA install flow updated** (`npx --yes rea-agents@latest setup`; review and approve plan; `doctor` is diagnostic only) (§2a).
10. **Chapa instructions pinned to the current API version at implementation time**, including duplicate-event handling (§8).
11. **Execution re-sequenced into five gates** with explicit agent/human task split and exit conditions (§1).

---

## 1. Execution gates (the order of work)

| Gate | Name | Agent tasks | Human tasks (cannot be agented) | Exit condition |
|---|---|---|---|---|
| **G0** | Reconnaissance & evidence | REA setup; Shopmonkey behavioral investigation; competitor file (§2); build interview guide + capture sheet | None | Evidence-based workflow spec + competitor findings documented |
| **G1** | Validate riskiest assumptions | Spikes 1–6 (§7); deliver prototype walkthrough script; analyze incoming interview data | **User:** 10–15 garage interviews (general/tire/EV mix in Addis); competitor leads verified; observe real intake-to-cash flows | Spikes documented w/ limits; interview summary + willingness-to-pay signal recorded in `docs/evidence/` |
| **G2** | Design the minimum secure product | Finalize schema w/ tenant binding, estimator versions, payment accounting, transition matrix, audit log, offline conflict spec; security test suite written **before** feature code | User: pricing hypothesis review | Reviewed schema + security tests passing on fixtures + written acceptance criteria |
| **G3** | Build core garage workflow | Implement intake → inspection → estimate → approval → repair → invoice → payment; histories; Amharic i18n; daily summary | None | E2E tests incl. failed payments, corrected estimates, offline sync passing |
| **G4** | Pilot with real garages | Instrument telemetry; support tooling; pilot protocol doc | **User:** run pilot with consenting garages; distribute prototypes; schedule payments | Pilot report: task completion, approval response rates per channel, actual payments; **user's go/no-go** |

Rules: **before G1 exits, the agent may only do** Shopmonkey research, competitor research, research instruments, integration spikes, schema prototypes, and throwaway approval-flow demos. The agent does not wait for interviews to run that work — but its assumptions never leave config. The **G3 core workflow starts only after G1 exits** (interview summary + willingness-to-pay signal recorded in `docs/evidence/`), or an explicit user override recorded in `decisions.md`. The agent stops at G0/G1/G4 human-dependent exits and §16 blockers; no post-pilot scope without user instruction.

---

## 2. Phase 0 (G0): REA + competition + research instruments

### 2a. REA setup (verify versions first)

Fetch the current README at `https://github.com/morluto/rea` and `https://rea.tools` guides before installing; REA ships fast and this brief's commands may be stale. Expected flow as of brief writing:

```bash
npx --yes rea-agents@latest setup   # review the proposed plan; approve
# restart your coding agent after setup
npx --yes rea-agents@latest doctor  # diagnostic — does NOT prove the agent loaded every tool
```

Record verified commands and `doctor` output in `docs/rea_setup.md`.

### 2b. Shopmonkey investigation — clean-room rules

**Access:** your own trial account, your own fictional shop, fictional data only.

**REA lane (closed cloud SaaS — no binaries, no ASAR):**

| REA capability | Use |
|---|---|
| Browser analysis | Walk each workflow in your session; capture states/transitions |
| HAR captures (your own session) | Intake → estimate → approval → invoice → payment; infer the behavioral data model |
| Android APK analysis (REA + JADX) | Technician apps: photo capture, offline queueing, upload behavior — **behavioral** observation only |

**Banned (clean-room):** copying code/CSS/assets/icons/trade dress/sample data; static analysis of their minified bundles; replicating variable names, endpoint spellings, or DB column names. The output is a behavioral spec: *what* it does, never *how* it is built.

**Honesty rule with v4 labeling.** Every finding in `docs/shopmonkey_analysis/` must be tagged:

- **Observed** — demonstrated in your trial (evidence: specific UI behavior or request)
- **Inferred** — likely but not directly verifiable; state the basis
- **Not observed** — absent from your trial; never claimed absent from the product

Findings files: `workflow.md` (Mermaid state machine), `data_model.md`, `ui_patterns.md`, `communication_flow.md`, `inspection_flow.md`, `reporting.md`.

### 2c. Gap analysis (unchanged in spirit)

Before product code, classify every Shopmonkey feature: Keep / Adapt / Replace / Add / Drop — with the v4 rule: **do not build a feature because Shopmonkey has it; do not claim Shopmonkey lacks one because it wasn't visible in your trial.** Reproduce the workflow category's value, not its full feature set.

### 2d. Competitor validation (replaces the old market claim)

`docs/competitors.md` must establish, for each entry: product evidence (URLs/archived pages), claimed features, pricing if public, adoption signals, what is NOT publicly verifiable. **Ledger (desk-checked 2026-10-17; field-verify in interviews — the v3 reviewer's flyer, presumed truth, proved half-right and then fully right):**

| Lead | Status (desk-checked 2026-10-17) | Required agent action |
|---|---|---|
| Finix Automotive — finix.et, Addis Ababa | **Verified live** (advertises garage management, service history, financial tracking/proforma, scan-to-pay, multi-user) | Full teardown of positioning; note "under development" ambiguity; visit/monitor |
| TAB Technologies — tabtechnologies.com.et, Addis Ababa | **Verified** — services page lists "Garage & workshop management" (job cards, estimates, approvals, mechanic time, parts issue, invoices, vehicle history, fleet accounts, insurance jobs, customer portals; optional ERP inventory link). Project-delivery model (discovery/localisation per client) | Probe: productized SaaS vs. custom delivery? pricing? adoption? model differences vs. GarAj |
| Meda Garage — meda-garage.com.et | **Verified live** — self-described "Ethiopia's auto-service platform" (bilingual Amharic JS gate ⇒ SPA). Unrelated to the physical "Meda Garage" shop in Lideta (map listing) and the MEDA NGO | Teardown requires a real browser (use REA's browser capability); map features vs. GarAj |
| YanolTech — yanoltech.com, Addis Ababa | **Verified lead** — product list includes "Workshop Management" and "Smart Garage" alongside a 200+-projects claim | Verify real product vs. project portfolio; pricing/adoption |
| Regional SaaS — GarageFlow (Kenya, garageflowcrm.com; verified via directory), Mech Connect, GetAFix | Category exists regionally; regional expansion threat | Track pricing/feature movement |
| FOSS/low-cost substitutes — GarageBuddy (MIT, open source), GarageOS (garage-os.app) | Verified catalog presence; local adoption unknown | Know their limits; not teardown targets |

Status vocabulary: **public-claim verified** (the site and its advertising are confirmed) ≠ **adoption/pricing verified** (requires fieldwork — none yet for any competitor). Finix, TAB, and Meda are public-claim verified; none carry verified adoption numbers, and the statistics appendix uses the same distinction.

Also record informal substitutes observed in interviews (paper books, WhatsApp/Telegram threads, verbal estimates, local custom-dev studios like Entro). Claim discipline: GarAj may claim "built for Ethiopian garages and conditions" — it may NOT claim to be "the first / the only" until the competitor file proves otherwise. Differentiation hypotheses to test in interviews: offline reliability, simpler Amharic-first UX, trustworthy customer approvals, fit for small independent garages vs. deliver-local-shop-competitors' rates.

### 2e. Research instruments (agent-deliverable; user-executed)

Produce in `docs/evidence/instruments/`:

1. **Interview guide** (Amharic + English): current workflow for intake, estimates, repair authorization, invoicing, debt collection, repeat customers; where work is lost/delayed; smartphone/connectivity reality; competitor-awareness probes (Finix/TAB/Meda/YanolTech: heard-of? tried? price? why not using?); current tools/alternatives; willingness to pay with concrete price anchors (open-ended first, then the hypothesis tiers); pilot commitment ask.
2. **Capture sheet** + data-entry format so interview results land in a structured file the agent can analyze (`docs/evidence/interviews/*.md` or CSV).
3. **Prototype walkthrough script** for the customer-approval flow and job board (clickable; real tasks, not opinion questions).

---

## 3. Compliance

### 3a. Data protection — PDPA Proclamation 1321/2024

- Consent ("ደንበኛው ስልክ ቁጥሩ..." statement) with `consent_at` timestamp at customer creation.
- "Export my data" XLSX action (doubles as reporting export).
- Third parties limited to Chapa + notification providers, stated in the in-app privacy notice.
- **Treatment as a program, not a checkbox:** before real customer records are collected, `docs/compliance.md` must record a review of lawful-basis categories, transparency notices, data-subject rights, retention limits, security measures, processor relationship mapping, and the cross-border transfer implications of the chosen hosting (Supabase/Vercel are foreign-hosted). Flag unresolved items for the user.
- Nightly Supabase backups + PITR; monthly manual export.

### 3b. Payment data & reconciliation

- Never store card/wallet credentials; store `chapa_tx_ref` refs and statuses only.
- Idempotency in **our** layer: one `provider_tx_ref` per initiation, `UNIQUE` constraint, prerequest guard.
- Webhook signature verification (HMAC as per current docs, `crypto.timingSafeEqual`); **use the current API version at implementation time; implement duplicate-event handling per the docs; re-read the docs on implementation day and record doc version/date in `decisions.md`.**
- Webhook + verify-on-redirect are both first-class paths; both must converge to the same reconciled state.
- Never assume webhook delivery; poll verify on the success redirect as designed in Spike 1.

### 3c. Tax engine — provisional until professionally verified

Authority naming: **Ministry of Revenues (MoR)** (ERCA dissolved 2021).

| Regime | Applies | Invoice tax |
|---|---|---|
| `vat_15` | VAT-registered shops (turnover ≥ 1,000,000 ETB per provisional reading) | 15% VAT |
| `tot_10_2` | Unregistered shops (provisional: Proclamation 308/2002) | TOT **10% services/labor, 2% goods/parts** as separate lines; never print "VAT" |
| `exempt` | Cases where neither applies | No tax lines |

v4 discipline:
- All rates/thresholds/classifications are **provisional constants** in `packages/shared/tax.ts`, each marked with its source and date.
- The user (owner) must have current MoR guidance reviewed — and ideally ratified by an Ethiopian tax professional — **before go-live produces real customer-facing tax documents**. Until sign-off, the invoice UI carries a clearly visible provisional-mode banner and pilot invoices may be marked non-tax-document.
- B2B: buyer TIN (10-digit validator, source-dated).
- VAT shops: manual `efd_receipt_number` input (EFD machine happens outside GarAj); generated docs for VAT shops label "not a fiscal tax invoice unless accompanied by an EFD receipt" (Amharic string).
- Our own subscription billing to shops is itself invoicing: use the separate `BILL-*` sequence (§4b) and include its tax treatment in the same professional review (§8).

### 3d. Invoice compliance

- Sequential per shop per Ethiopian fiscal year: `INV-{ethiopian_year}/{seq}`, generated under `SELECT ... FOR UPDATE`; `UNIQUE(invoice_number)`; **concurrency-tested (no gaps, no dupes)**.
- Voided/corrected invoices keep their number; corrections follow §6's reversal rules (no deletion).
- Both calendars on customer-facing docs (converter property-tested first — §7 Spike 5).

### 3e. Name & trademark — blocking item #1

Search EIPO, Play Store, App Store, Ethio Telecom business records, **and business-name registrations plus existing software products** (the Finix/TAB/Meda category) before committing. Record findings. On collision: propose alternatives and **stop for user confirmation**. A clean search is not legal clearance — note that residual legal review is the user's to commission.

---

## 4. Phase (G2): minimum secure product — schema

### 4a. Stack

| Layer | Choice | Notes |
|---|---|---|
| Public pages | Next.js App Router + SSR (**latest supported major at setup — verify, record version**) | Approval pages (`/a/[token]`), marketing |
| Dashboard runtime | Client-side SPA/PWA | TanStack Query + `persistQueryClient` (IndexedDB via `idb-keyval`), optimistic mutations, Service Worker sync queue. App Router must not mediate dashboard reads/writes. "SPA route" ≠ offline capability — SW caching, IndexedDB persistence, retries, and reconnect behavior must be implemented and tested (§9) |
| Business backend | **Fastify owns it all**: authorization, transactions, payment calls, background jobs/cron | **No business logic in Supabase Edge Functions**; DB triggers limited to integrity; one layer, one owner, documented in `decisions.md` |
| Database | PostgreSQL via Supabase | RLS + PITR |
| Auth | Supabase Auth phone OTP | Amharic-first screens |
| Payments | Chapa API (current version) | §3b |
| Storage | Supabase Storage | Client-compressed uploads |
| Notifications | Channel router: SMS + Telegram (defaults evidence-driven — §15 decision 6) | |
| Deployment targets | **Next.js → Vercel; Fastify API + cron/workers → Railway (persistent container); Supabase = DB/auth/storage only — its Edge Functions hold no business logic** | Ops bar: cron jobs take advisory locks (`pg_try_advisory_lock`) + idempotent steps + retry budget (no duplicate double-runs); secrets from env store (never in repo); health + error alerting; next-intl; Noto Ethiopic self-hosted (no CDN font dependency) |
| Tests | Vitest/Jest + Playwright | Security suite is first-class (§13) |

### 4b. Core schema (v4 financial model + tenant binding)

Key conventions (all tables follow `shops`-scoped design; composite FKs shown where they matter most — apply the same pattern to every shop-scoped relation):

```sql
-- Tenant binding pattern: every child row carries shop_id and every parent is
-- UNIQUE(id, shop_id); child FKs reference (parent_id, shop_id) so a row can
-- never point into another garage's data.

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

CREATE TABLE users (            -- future multi-shop migration: user_shop_roles join table
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
  name_key text GENERATED ALWAYS AS (lower(regexp_replace(full_name_am, '\s+', ' ', 'g'))) STORED, -- search key
  UNIQUE(shop_id, phone),
  UNIQUE(id, shop_id)                       -- tenant-binding anchor for child FKs
);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  customer_id uuid NOT NULL,
  make text NOT NULL, model text NOT NULL, year int,
  plate_number text,                        -- validation warning-only (multi-format, Directive 1050/2025)
  vin text,
  fuel_type text NOT NULL CHECK (fuel_type IN ('petrol','diesel','lpg','bev','hev','phev','other')),
  odometer int, odometer_unit text DEFAULT 'km',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (customer_id, shop_id) REFERENCES customers(id, shop_id),
  UNIQUE(id, shop_id)
);

-- Orders: status machine defined in §6; only legal transitions (role-checked) mutate it
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

-- Draftable order lines (used while the job is open; frozen copies live in estimate/invoice versions)
CREATE TABLE order_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL, shop_id uuid NOT NULL REFERENCES shops(id),
  canned_job_id uuid,
  name_am text NOT NULL, name_en text,
  labor_hours numeric(5,2), labor_rate_etb numeric(10,2) NOT NULL,
  tech_id uuid, notes_am text,
  FOREIGN KEY (order_id, shop_id) REFERENCES orders(id, shop_id),
  FOREIGN KEY (canned_job_id, shop_id) REFERENCES canned_jobs(id, shop_id),
  FOREIGN KEY (tech_id, shop_id) REFERENCES users(id, shop_id),
  UNIQUE(id, shop_id)
);

CREATE TABLE order_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL, shop_id uuid NOT NULL REFERENCES shops(id),
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
  order_id uuid NOT NULL, shop_id uuid NOT NULL REFERENCES shops(id),
  tech_id uuid, notes_am text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, shop_id) REFERENCES orders(id, shop_id),
  FOREIGN KEY (tech_id, shop_id) REFERENCES users(id, shop_id),
  UNIQUE(id, shop_id)
);

CREATE TABLE media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL, shop_id uuid NOT NULL REFERENCES shops(id),
  storage_url text NOT NULL,
  media_type text NOT NULL,
  caption_am text, caption_en text,
  file_size_bytes int,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (inspection_id, shop_id) REFERENCES inspections(id, shop_id),
  UNIQUE(id, shop_id)
);

-- Estimator as versioned document
CREATE TABLE estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL, shop_id uuid NOT NULL REFERENCES shops(id),
  status text NOT NULL DEFAULT 'draft',   -- draft, sent, approved, declined, superseded, expired
  current_version_id uuid,                 -- set after first send
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, shop_id) REFERENCES orders(id, shop_id),
  -- circular ref: FK to estimate_versions added via ALTER below
  UNIQUE(id, shop_id)
);

CREATE TABLE estimate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL, shop_id uuid NOT NULL REFERENCES shops(id),
  revision int NOT NULL DEFAULT 1,         -- re-sent estimates = new immutable revision
  status text NOT NULL DEFAULT 'draft',   -- draft, sent, approved, declined, expired, superseded
  sent_at timestamptz, token_expires_at timestamptz,
  approval_token_hash text UNIQUE,         -- SHA-256 of the raw token (raw shown once at send; never stored)
  token_used_at timestamptz,               -- consumed atomically by the first successful action
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

-- Immutable line copies: the priced thing the customer saw
CREATE TABLE estimate_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL, shop_id uuid NOT NULL REFERENCES shops(id),
  line_kind text NOT NULL CHECK (line_kind IN ('service','part')),
  name_am text NOT NULL, name_en text,
  qty numeric(8,2) NOT NULL DEFAULT 1,
  unit_price_etb numeric(10,2) NOT NULL,   -- labor: rate; part: sell price
  tax_kind text NOT NULL,                  -- 'labor' | 'part' (drives TOT/VAT split)
  source_order_service_id uuid, source_order_part_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (version_id, shop_id) REFERENCES estimate_versions(id, shop_id),
  UNIQUE(id, shop_id)
);

-- What the customer approved: whole version or selected lines
CREATE TABLE estimate_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL, shop_id uuid NOT NULL REFERENCES shops(id),
  decision text NOT NULL CHECK (decision IN
    ('approved_all','approved_lines','declined','callback_requested')),
  remainder_decision text                   -- required when decision = 'approved_lines'
    CHECK (remainder_decision IN ('declined','deferred','revised_estimate_requested')),
  approver_phone text, approver_channel text,   -- 'sms_link','telegram','in_person','phone_call'
  confirmed_last4 boolean NOT NULL DEFAULT false, -- flips to true ONLY after last-4 verification
  token_hash text,                          -- SHA-256 of the presented token (raw token never stored)
  lockout_state text,                       -- server-side rate-limit/lockout on token+shop (not IP/session)
  recorded_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  FOREIGN KEY (version_id, shop_id) REFERENCES estimate_versions(id, shop_id),
  UNIQUE(id, shop_id)
);

-- Per-line approvals (normalized — arrays cannot enforce that approved lines
-- belong to the right version/shop; the version-match rule
-- (line.version_id = approval.version_id) is trigger-enforced)
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
  order_id uuid NOT NULL, estimate_version_id uuid NOT NULL, -- always from an approved version
  invoice_number text NOT NULL UNIQUE,     -- INV-{ethiopian_year}/{seq}
  fiscal_year_et int NOT NULL,
  tax_type text NOT NULL, tax_etb numeric(10,2) NOT NULL,
  subtotal_etb numeric(10,2) NOT NULL,
  discount_etb numeric(10,2) DEFAULT 0,
  total_etb numeric(10,2) NOT NULL,        -- computed at issue from APPROVED lines snapshot
  amount_paid_etb numeric(10,2) NOT NULL DEFAULT 0
    CHECK (amount_paid_etb >= 0 AND amount_paid_etb <= total_etb),
  balance_due_etb numeric(10,2) GENERATED ALWAYS AS (total_etb - amount_paid_etb) STORED,
  status text NOT NULL DEFAULT 'unpaid'   -- unpaid, partial, paid, voided
    CHECK (status IN ('unpaid','partial','paid','voided')),
  issued_at timestamptz NOT NULL DEFAULT now(), due_at timestamptz,
  efd_receipt_number text,                 -- manual, vat_15 shops; reserved for MoR e-receipt
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, shop_id) REFERENCES orders(id, shop_id),
  FOREIGN KEY (estimate_version_id, shop_id) REFERENCES estimate_versions(id, shop_id),
  UNIQUE(id, shop_id)
);

-- Immutable priced lines actually invoiced (snapshot of approved estimate lines)
CREATE TABLE invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL, shop_id uuid NOT NULL REFERENCES shops(id),
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

-- Our subscription billing documents (sold TO the garage). Separate sequence — not
-- repair-order invoices. Compliance treatment of our own invoicing is provisional (§3c).
CREATE TABLE billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  kind text NOT NULL CHECK (kind IN ('subscription_renewal')),
  plan text NOT NULL,
  period_start date NOT NULL, period_end date NOT NULL,
  billing_number text NOT NULL UNIQUE,     -- BILL-{ethiopian_year}/{seq}; allocated under SELECT ... FOR UPDATE on billing_sequences (same concurrency tests as invoices)
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
  invoice_id uuid, billing_record_id uuid, -- exactly one target (repair invoice | subscription billing record)
  shop_id uuid NOT NULL REFERENCES shops(id),
  kind text NOT NULL CHECK (kind IN ('customer','subscription')),
  provider text NOT NULL,                  -- 'chapa'
  provider_tx_ref text UNIQUE,             -- our idempotency anchor
  amount_requested_etb numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated','pending','succeeded','failed','cancelled')),
  initiated_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  verified_reason text,                    -- 'webhook','redirect_poll','manual_reconcile'
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invoice_id, shop_id) REFERENCES invoices(id, shop_id),
  FOREIGN KEY (billing_record_id, shop_id) REFERENCES billing_records(id, shop_id),
  UNIQUE(id, shop_id),
  CHECK (num_nonnulls(invoice_id, billing_record_id) = 1),
  CHECK ((kind = 'customer') = (invoice_id IS NOT NULL))
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid, billing_record_id uuid, -- exactly one target (same entity the attempt settled)
  shop_id uuid NOT NULL REFERENCES shops(id),
  attempt_id uuid,                         -- NULL for cash-at-counter
  provider_ref text,                       -- provider tx id on electronic receipts; UNIQUE ⇒ a webhook retry/replay cannot mint a second receipt
  kind text NOT NULL CHECK (kind IN ('receipt','refund')),
  refund_of_payment_id uuid,               -- every refund names the receipt it reverses; Σ(refunds on a receipt) ≤ receipt.amount — row-locked math + trigger
  method text NOT NULL CHECK (method IN
    ('telebirr','cbe_birr','ebirr','mpesa','card','cash','bank_transfer')),
  amount_etb numeric(10,2) NOT NULL CHECK (amount_etb > 0),
  recorded_by uuid,
  reason text,                             -- required for refunds (app-enforced + tested)
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

-- Subscription periods (minimal automation)
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  plan text NOT NULL,
  period_start date NOT NULL, period_end date NOT NULL,
  status text NOT NULL DEFAULT 'active',
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
  FOREIGN KEY (supplier_id, shop_id) REFERENCES suppliers(id, shop_id),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);
-- No inventory movement ledger in go-live: do not claim stock accounting.

-- Audit trail (who did what to money and approvals)
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  actor_user_id uuid,
  action text NOT NULL,                    -- 'estimate.sent','estimate.approve','invoice.issued'
  entity text NOT NULL, entity_id uuid,   -- 'order.status','payment.record','tax_regime.change',...
  before jsonb, after jsonb,
  channel text,                            -- 'app','sms_link','telegram','system'
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (actor_user_id, shop_id) REFERENCES users(id, shop_id),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);
```

Notification lifecycle table (self-contained — no need to consult v3):

```sql
CREATE TABLE notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id),
  kind text NOT NULL CHECK (kind IN
    ('estimate_link','estimate_reminder','invoice_link','payment_receipt','daily_summary','system')),
  channel text NOT NULL CHECK (channel IN ('sms','telegram')),
  to_address text NOT NULL,
  template_id text, body text NOT NULL,
  segments int,                            -- UCS-2: 1 if ≤70 chars, else ceil(chars/67)
  cost_etb numeric(8,4),
  status text NOT NULL CHECK (status IN ('queued','sent','delivered','failed')),
  provider_message_id text,
  sent_at timestamptz, delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 4c. Seed data

As v3: Ethiopian makes/models (Corolla.., HiAce, Bajaj, Isuzu NPR, BYD Atto 3, Chery Tiggo, Geely Emgrand, JAC EV, Haval), Amharic service names, three shops incl. one `vat_15` and one `tot_10_2`.

---

## 5. Validation spikes (G1 — `spikes/`; results → `docs/decisions.md`)

### Spike 1: Chapa (current API version)

Test account → 100 ETB init to test number → complete → webhook + `timingSafeEqual` signature verification → **duplicate event replay test** → suppress webhook and reconcile via verify endpoint on the redirect (both paths converge in DB state) → refund/void. Record: recurring-subscription availability, doc version/date. Re-read docs **on implementation day**; record deviations.

### Spike 2: Amharic SMS

AT coverage check; one real Amharic SMS (test number + consent requested from user without blocking); segments (70/67), latency, per-segment cost, delivery receipts, sender-ID route. Also generate the generic local-aggregator brief (sender-ID `GARAJ` whitelisting lead time, commonly 2–4 weeks — verify). All go-live templates authored within measured budget; counts unit-asserted.

### Spike 3: Telegram bot

Estimate as rich card with inline approve / need-more-info buttons → secure token callback → logged in `notifications_log`. Measure rendering, cost (0), latency vs SMS. Telegram is a shipped channel; the **default** per customer is decided by pilot data, not by this spike.

### Spike 4: low-end 3G photo

Client-side compress <200 KB (`browser-image-compression`, MIT) → upload under 3G throttling; <8 s target; offline queue + 3 retries confirmed.

### Spike 5: Ethiopian calendar (property tests are the truth)

Try `ethiopian-calendar`; else write zero-dep converter. Property-test against 50+ years of published anchors (Enkutatash dates incl. Sept-12 years after GC leap years; Pagume 5/6; Meskerem 1, 2000 EC = Sept 12, 2007 GC; fiscal-year (Hamle) boundary behavior across non-leap and leap EC years against published government dates). Trust no prose — including anything written in this brief. **This suite passes before any customer-facing document generation is enabled.** Ethiopian clock display (6-hour offset, ጠዋት/ከሰዓት/ማታ labels): implement as a toggle, evaluate display value in the pilot.

### Spike 6: offline queue

Minimal PWA: TanStack Query + IndexedDB persistence + SW. Prove: offline board renders; queued status changes sync; **conflict spec works** (§9). No RSC navigation in dashboard flows.

---

## 6. Workflow definition

### 6a. Status machine + permissions + corrections

| # | Status | Amharic | Allowed transitions | Role allowed |
|---|---|---|---|---|
| 1 | received | ተቀብሎ | → inspection, → cancelled | receptionist/manager |
| 2 | inspection | ምርመራ ላይ | → estimate_sent, → cancelled | technician/receptionist |
| 3 | estimate_sent | ግምት ተላከ | → estimate_declined (customer declined), → approved, → cancelled | customer/system |
| 4 | estimate_declined | ግምት እምቢ | → estimate_sent (revised version sent), → cancelled | receptionist/manager |
| 5 | approved | ፈቃድ ተሰጠ | → in_progress, → cancelled | manager+ |
| 6 | in_progress | ሥራ ላይ | → complete, → cancelled | technician/manager |
| 7 | complete | ተጠናቋል | → paid (balance = 0), → cancelled | manager+ |
| 8 | paid | ተከፍሏል | terminal (void/cancel only via refund trail, manager) | system/manager |
| 9 | cancelled | ተሰርዟል | terminal (money refunded first — see rules) | manager+ |

Rules: status values are guarded by a DB `CHECK` (§4b); transitions are enforced in the trusted backend (`apply_transition`, role-checked; every transition audited). A `declined` estimate records `estimate_versions.status='declined'` **and** moves the order to `estimate_declined`; sending revision n+1 flips the version back to `sent` and the order to `estimate_sent` — nothing is mutated silently. A post-estimate `cancelled` requires a manager and produces an audit entry with reason; money already collected must be refunded via `payments(kind='refund')` **before** cancellation completes. "Invoice paid" is a state of the **invoice**, not the order: an order may close 'cancelled' with a partially paid/voided-invoice trail, and reports must present both. `apply_transition` locks the order row (`SELECT ... FOR UPDATE`) inside its transaction, so concurrent requests cannot bypass transition checks; the E2E suite covers every permitted transition edge and asserts every forbidden edge is rejected.

### 6b. Estimate & approval

- Lines copied immutable into `estimate_lines` at send; totals computed from them + the tax regime snapshot; PDF Amharic (shop identity, TIN, both calendars).
- Send = new immutable version (revision++) with a fresh **256-bit crypto-random** token (base64url), 72-h expiry. The DB stores only a SHA-256 hash — the raw token is presented to the channel exactly once. Lockouts/rate limits are enforced **server-side against the token+shop pair**, independent of IP or browser session.
- **Consumption is atomic:** the first successful verify+action claims the token in one conditional UPDATE (`SET token_used_at = now() WHERE token_used_at IS NULL AND token_expires_at > now()`); concurrent or replayed claims get an "already processed" response, are audited, and cannot move state a second time.
- Channel: router picks `preferred_channel` (default `sms` until pilot evidence; Telegram if handle present and pilot data favors it). SMS link `garaj.et/a/{token}`.
- **Link protection:** last-4 phone confirmation before totals reveal; rate-limit token checks (e.g., ≤5 attempts/hour/IP), all attempts audited; on failure 3× the session locks, staff contact required.
- Actions: approve all / approve selected lines (`decision='approved_lines'` → one row per line in `estimate_approval_lines`) / decline / request callback. `remainder_decision` ('declined' | 'deferred' | 'revised_estimate_requested') is recorded whenever only some lines are approved. Each action stores phone, channel, timestamp in `estimate_approvals` **plus** `audit_log` — approval events are immutable.
- Reminder at 48h inside the character budget.

### 6c. Invoice & payment

- One-click from **approved version** only; approved-lines-only flow (partial approval) invoices only the approved lines and records the balance/remainder decision.
- Numbering: sequence row locked; sequence + fiscal year tested concurrently.
- Lines snapshot into `invoice_lines` with per-line tax (regime snapshot); MoR fields; EFD labeling rules per §3c.
- Payment: Chapa checkout (SMS/Telegram) or counter QR; cash recorded manually; partial payments supported; `amount_paid_etb/balance_due_etb` maintained in the same transaction as the payment record.
- Ingestion: webhook (verified, idempotent, duplicate-replay-safe) **and** verify-on-redirect both reconcile the same `payment_attempt`; confirmed attempt creates the `payments` receipt; attempt ≠ payment; finalize order → paid only when balance = 0.
- Refunds only as explicit `payments(kind='refund')` with actor + reason, linked to the original receipt (`refund_of_payment_id`).
- **Consistency rules:** payment insert + `amount_paid` bump + status recompute happen in one transaction (`apply_payment()`); overpayment is rejected at the DB (`amount_paid ≤ total` CHECK) — cash change handed back is recorded in the payment `notes`; refunds decrease `amount_paid` and may move the invoice back to `partial`; voided invoices keep their full trail and are excluded from outstanding-balance views.
- **Idempotency (whole workflow):** `apply_payment()` retries converge — a webhook replay, verify-poll duplicate, or repeated call for the same `payment_attempts` row returns the first receipt instead of minting a second (enforced by `UNIQUE(attempt_id)` + `UNIQUE(provider_ref)` in the DB, not only application checks).
- **Refund cap (concurrency-safe):** within the refund transaction, `SELECT ... FOR UPDATE` the original receipt; refundable = receipt.amount − Σ(refunds naming that receipt); a request exceeding the remaining refundable amount is rejected — two concurrent refund attempts (e.g., 700 ETB each against a 1,000 ETB receipt) can never both succeed; a DB trigger enforces the same invariant on every path, and the concurrent-refund race is a required test.

### 6d. Customers & vehicles

Phone-first search; histories; CSV bulk import with **warning-only** plate checks (multi-format reality + Directive 1050/2025), row-level error report; "Export my data" (PDPA).

### 6e. Report: daily summary

Orders by status, revenue, outstanding invoices (count + total), new customers; both calendars; XLSX.

---

## 7. Offline strategy (exact)

Works offline: view board/orders/customers/vehicles (last sync); add notes; queue status changes; capture + queue photo uploads (3 retries).
Requires connectivity: new customers/orders; sends (SMS/Telegram); payments; initial OTP login.

Conflict spec (required): every queued mutation carries `op_id` (uuid) and target `op_clock`/version; server applies idempotently by `op_id`, rejects stale versions with a machine-readable conflict; client surfaces conflicts as a queue-clearing dialog where staff picks final values (no silent auto-merge for statuses with money implications); each resolution audited. Queue states survive crashes. Record net/net in `decisions.md` + tests proving all of it.

---

## 8. Billing (G3 minimal; automation stays simple)

Plans (provisional until pilot): ጀማሪ 1,500 ETB · መደበኛ 3,500 ETB · ፕሮ 7,000 ETB (post-launch).
Rail = cron + Chapa one-time link (primary). Renewals are sold **to** the shop as `billing_records` (own `BILL-{ethiopian_year}/{seq}` sequence — not repair-order invoices; compliance treatment provisional per §3c). Settlement, once only: `payment_attempts(kind='subscription')` → `payments` (`UNIQUE(attempt_id)` + `provider_ref` anchor — a billing record cannot be settled twice) → `billing_records.amount_paid/status`; period rows live in `subscriptions`:
- Day −3 reminder (Telegram + SMS) with renewal link; successful reconciliation extends the period; daily cron reconciles expiries.
- Gate via `can(shop, feature)` in `packages/shared/permissions.ts` (DB truth); pricing/channel constants live in config, **not** hard-coded anywhere else.

---

## 9. What is skipped/deferred

Permanent drop: ALLDATA/MOTOR, Nexpart, QuickBooks, US BNPL, VIN lookup, Shopmonkey bundle analysis.
Deferred post-pilot: inventory movement ledger + stock claims (schema-only now), multi-location dashboard, EV diagnostic mapping, FX margin reports, editable notification templates, our own published competitor claims, Pro tier + EV modules, Ethiopian clock default display (evaluate in pilot).

---

## 10. Testing (inflate the security suite to first-class)

- **Tenant isolation suite (mandatory before feature code):** two seeded shops; attempts to read/write cross-shop orders, customers, invoices, media, approval tokens via API and via storage URLs; two-user token swap; cross-shop estimate-approval callback; every attempt must fail — the suite is an acceptance criterion, not an extra.
- Unit: calendar property tests (Spike 5 table) as prerequisite for document generation; tax engine per regime incl. TOT split; ETB formatting; sequence/amount/concurrency tests; notification template segment counts; validators (TIN; plate = warning semantics).
- Payments: webhook path AND suppressed-webhook verify path converge; duplicate-event replay; partial payment balances; refund reversals; attempt-vs-payment separation.
- E2E (Playwright): full lifecycle incl. failed payment then success via verify path; partial approval flow; offline queue + conflict dialog; Amharic rendering under self-hosted fonts.
- i18n key parity; no English in Amharic mode.
- Performance: board view/tap transitions under 3G per Spike 4/6 budgets.

---

## 11. Verification format (every phase → `docs/progress.md`)

Phase, date; what was built (files/modules); test commands + raw output; what was NOT built and why; one unproven/risky thing; go/no-go per section 1's gate. Never "complete/verified/production-ready" beyond evidence. `Observed/Inferred/Not observed` labels required for all Shopmonkey-derived claims.

## 12. Pilot protocol (G4)

Agent prepares: telemetry events (task completion time per job stage; approval response time + channel; deflection/fallback rates; error rates), support tooling, daily problem triage, pilot-report template.
User runs: 3–5 consenting garages × 2–4 weeks; real tasks; payment collections at pilot pricing; interview answers post-pilot.
Report decides: pricing (adjust vs 1,500/3,500 hypothesis), channel defaults (SMS vs Telegram), scope cuts, and the go/no-go — **user's call**.

## 13. Security acceptance criteria (pre-code, pre-launch)

1. Composite-FK tenant binding implemented across all shop-scoped tables (§4b pattern).
2. RLS policies per table incl. storage + realtime; cross-shop attack suite green.
3. Approval-token flow: crypto-random, expiring, rate-limited, last-4-verified, audited.
4. Payment lifecycle: attempt/payment split; idempotent `apply_payment()` (retry/duplicate-webhook safe, DB-keyed via `UNIQUE(attempt_id)` + `UNIQUE(provider_ref)`, not app checks alone); both reconciliation paths converge; refunds explicit, **capped under concurrency** (row-locked refundable math + trigger), linked to their original receipt; payment↔attempt target consistency (+ kind match) trigger-enforced; approval-token consumption atomic (`token_used_at`); approval-line↔version match trigger-enforced; transition concurrency safe (`SELECT ... FOR UPDATE` order-row lock).
5. Audit trail on every money/approval/status action with before/after.
6. No business logic outside Fastify; no client-side trust boundary; no client-side enforcement of plan limits (DB-checked).
7. Every foreign key in §4b audited against the composite-binding pattern — including **write-path** cross-shop tests (not reads only) and payment/attempt target-consistency (trigger-tested).

## 14. Statistics appendix (sourced; verifiable only)

Vehicle fleet ~1.2–1.4M (directional, RA/AlignEthiopia 2023); ~half in Addis (high); fuel-vehicle import ban 2024 (confirmed, AP/IEA); EV service pain (anecdotal 2024, not marketing copy); 4.7T Birr digital transactions (AfricaNenda/NBE, high); Chapa 18 banks/14 methods/100M+ (high); local SaaS anchor 5,000 ETB/mo (single data point); VAT 15% (≥1M ETB threshold, **provisional pending MoR sign-off**); TOT 2%/10% (Procl. 308/2002, **provisional pending MoR sign-off**); MoR name (confirmed); UCS-2 70/67 (3GPP, confirmed); local competitors verified at public-claim level (sites live; adoption unverified): Finix Automotive, Tab Technologies (garage & workshop-management service line), Meda Garage ("auto-service platform", SPA — needs real-browser teardown), + leads YanolTech/GarageFlow/FOSS substitutes (**update ledger before repeating claims**); SMS cost & Telegram use (**measure in spikes/pilot, not desk claims**); Hamle 1 fiscal boundary dates (**Spike 5 tests decide**).

## 15. Early decisions (all → `docs/decisions.md` before code)

1. Trademark findings (§3e) — blocking only on collision.
2. REA verified install commands + doctor output.
3. SMS primary/fallback; cost/segment; delivery receipts; sender-ID lead time (Spike 2).
4. Chapa doc version/date implemented against; duplicate-event behavior; subscription availability.
5. Calendar implementation + license + property-test outcome table.
6. Notification default policy at code time: `sms` default, Telegram available; defaults revisited at G4.
7. Offline queue list + conflict resolution mapping (mirror §9).
8. Timezone `Africa/Addis_Ababa` display pin; UTC storage.
9. TIN validator source-dated.
10. Tax constants table w/ sources+dates; provisional-mode banner active until ref signoff (§3c).
11. Photo compression target from Spike 4.
12. Layer ownership table (Fastify owns everything business; Edge Functions unused for logic).
13. Code/comments English; strings via i18n only.

## 16. Permissions

Blocking — stop and wait for the user: (a) trademark alternative confirmation (§3e); (b) pilot go/no-go (G4 exit). All else: decide, record with evidence, continue. Non-blocking user inputs: test phone number + consent (Spike 2), Telegram test handle, pilot garages.

## 17. Interview/pilot evidence standards (feeds pricing, channel defaults, scope cuts)

- 10–15 garages (geo-mixed Addis: general/tire/EV); observed (not asked-only) current workflows; collected pain ranked by frequency × severity; current-tool inventory incl. informal substitutes; willingness-to-pay signals tied to concrete anchors; pilot-commitment signals recorded separately from enthusiasm.
- **G1 exit bar:** ≥10 completed interviews (≥5 with an observed current workflow), a documented willingness-to-pay signal from ≥3 shops at or above the pilot price, artifacts filed under `docs/evidence/`. Only the user (owner) may authorize the G3 override.
- Where a claim can't be evidenced, record it as hypothesis. The competitor file (§2d) is updated with each field finding.

---

## 18. Readiness checklist (v4.1) — all five must pass before the core screens are built

- [ ] **Schema bootstraps cleanly** — all DDL applies from an empty database, in file order, with no manual steps (circular FKs handled via post-`ALTER`s).
- [ ] **Cross-tenant tests pass** — no cross-shop read, write, approval, payment, media, or storage access succeeds.
- [ ] **Financial lifecycle reconciles** — estimate revisions, partial approvals, partial payments, refunds, voids, and subscription renewals all net correctly.
- [ ] **Approval security defined and tested** — 256-bit hash-stored tokens, safe verification defaults, server-side rate limits/lockouts, expiry, immutable approval events.
- [ ] **Document internally consistent** — section references, status transitions, notification schema, and competitor evidence labels agree throughout.

Evidence rule: each checked box must link to raw command/test output in `docs/progress.md` — a checked box without raw output does not count.

---

*End of brief. Gates per §1; when G3 is complete, stop for the pilot; after G4's go/no-go, await scope instructions.*
