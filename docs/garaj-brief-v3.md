# GarAj (ጋራዥ) — Agent brief v3 (final)

**Build an Ethiopian garage management SaaS, using REA to behaviorally reverse-engineer Shopmonkey's workflow.**

You are a coding agent. This brief is the complete specification. Do not ask clarifying questions, except for the single blocking item listed in §14. Make decisions, record every one of them in `docs/decisions.md`, and continue. Produce evidence at every milestone.

## v3 changelog (what changed from v2 — for your own orientation)

1. Tax engine: flat 15% VAT replaced by a per-shop `tax_regime` (VAT / Turnover Tax / exempt). Unregistered garages must never print "15% VAT."
2. Billing: manual monthly invoice + Chapa payment link + cron is the **primary** subscription rail, not a fallback. Added verify-on-redirect resilience for failed webhooks.
3. Telegram is a **first-class, go-live notification channel**, not post-launch. Amharic SMS segment math corrected to 70 (single) / 67 (concatenated) characters.
4. Offline: dashboard architected as a client-side SPA/PWA; RSC-dependent navigation stays only on public pages. Photo uploads queue offline.
5. Authority naming corrected: **Ministry of Revenues (MoR)**, not ERCA (dissolved 2021). Manual EFD receipt-number entry + "proforma" labeling for non-EFD documents.
6. REA lane clarified: browser observation + HAR captures + Android APK analysis. Static inspection of Shopmonkey's client bundles is **banned** (clean-room).
7. Fiscal-calendar converter is property-tested against real published dates; no prose claim (including earlier claims in this project's documents) is trusted.
8. Approval links require last-4-digits phone confirmation before revealing totals.
9. Invoice numbering made concurrency-safe; idempotency enforced in our layer, not assumed in Chapa's.
10. Plate-number validation demoted to warning-only (multi-format reality of Ethiopian plates).
11. Backups/PITR; `Africa/Addis_Ababa` display pin; SMS test-number consent protocol.
12. Statistics section: TOT rates sourced; SMS cost and Telegram metrics marked "measure in spikes."

---

## Scope boundary: what "done" means

**Go-live scope:**
- Phase 0 (REA setup + investigation) complete; findings documented
- Job board, repair order, estimate, invoice, payment
- Customer and vehicle profiles
- Ethiopian calendar on all customer-facing documents (property-tested converter)
- SMS estimate approval flow **with Telegram approval as co-primary channel**
- Chapa payment integration (sandbox verified end-to-end, then production)
- Starter and Standard subscription tiers (cron + payment-link billing)
- One report: daily summary
- Full Amharic translation
- All integration spikes passing

**Post-launch backlog (everything else in this brief):** multi-location, EV diagnostic code mapping, FX margin reports, retention analytics, editable SMS templates, Pro tier, supplier parts catalog sharing.

The agent must not mark go-live complete and proceed to backlog items without an explicit user instruction. When go-live scope is finished, stop and wait.

---

## 0. Non-negotiable constraints

1. **Amharic first, English second.** Every screen, label, error, and notification exists in Amharic (Ge'ez). English is a toggle, never the default.
2. **ETB only on customer-facing surfaces.** Internal cost fields may record an original foreign currency, but the customer never sees a non-ETB total.
3. **Chapa for all digital payments.** No Stripe, PayPal, or USD-first gateways. Chapa routes to Telebirr, CBE Birr, eBirr, M-Pesa (via the Kacha interoperability switch), and bank cards in one integration.
4. **Tax engine, not a flat rate.** Every shop has a `tax_regime` (§3c). The invoice calculator is a single tested function of (regime, line items). Never print tax not permitted by the shop's regime.
5. **Mobile-first, degraded-connectivity-capable.** Must function on 3G. Offline scope is explicit in §7.
6. **No features requiring infrastructure Ethiopia cannot supply.** No ALLDATA/MOTOR labor guides, no Nexpart ordering, no VIN registry lookup, no US BNPL.
7. **Pricing in ETB** (§9). No public USD prices.
8. **Phone OTP authentication** (Supabase Auth), not email.
9. **Timezone pin:** all displayed timestamps render in `Africa/Addis_Ababa`; storage is UTC `timestamptz` everywhere.
10. **Notification channel economics:** every outbound message template has a known character count and segment count (SMS) or zero marginal cost (Telegram), recorded in `packages/shared/notifications.ts`.
11. **Commit per milestone.** Update `docs/decisions.md` and `docs/progress.md` at every phase end. State what is real. Never write "100% complete" or "fully verified" — state exactly what you observed and what remains unproven.

---

## 1. Why this product exists (context for decisions)

Ethiopia has roughly 1.2–1.4 million registered vehicles (varies by source/year; treat as a directional estimate); about half are in Addis Ababa. Fuel-vehicle imports are banned (2024), so the ICE fleet ages and needs more maintenance, while Chinese EVs (BYD, Chery, Geely, JAC, Haval) enter faster than the service infrastructure can absorb. Only a handful of garages can service EVs; EV owners report queues and overcharging; many EVs wait weeks for parts from China.

No garage management software exists for this market. Every shop runs on copybook invoices, phone calls, and verbal estimates.

The digital payment layer is established (Telebirr, CBE Birr, M-Pesa via Kacha, eBirr), and Chapa reaches all of it through one API. The opportunity is the gap between the fleet, the payment rails, and zero purpose-built shop tools.

---

## 2. Phase 0: install REA and investigate Shopmonkey

### 2a. Verify the install path first

Fetch the current README at `https://github.com/morluto/rea` (and `https://rea.tools` guides) and confirm the install commands before running anything. REA ships fast; the commands below are **expected as of brief writing**, not guaranteed:

```bash
npx -y rea-agents setup --yes
npx -y rea-agents doctor
```

Record verified commands and full `doctor` output in `docs/rea_setup.md`.

### 2b. Clean-room rules (read before any investigation)

**Access:** create your own Shopmonkey trial account with your own email, a fictional shop name, and fictional test data only.

**The REA lane for this target** (a closed cloud SaaS — no binaries, no ASAR):

| REA capability | Use |
|---|---|
| Browser analysis (page structure, scripts, network observation) | Walk each workflow in your own session; capture states and transitions |
| Saved network captures (HAR) | Record your own session while exercising: intake → estimate → approval → invoice → payment; analyze payloads to infer the behavioral data model |
| Android APK analysis (REA + JADX) | On Shopmonkey's technician apps: observe photo-inspection capture, offline queueing, upload patterns **behaviorally** |

**Explicitly banned (clean-room):**
- Copying Shopmonkey source code, CSS, assets, colors, icons, UI trade dress, sample data, or content
- Downloading and statically analyzing their minified JS bundles / validation schemas (even though tooling exists — we do not want their expression, only our own understanding of the workflow category)
- Replicating exact variable names, API endpoint spellings, or DB column names

The REA output is a behavioral specification: *what* the software does, never *how it is implemented*. This is the same relationship any two accounting products have when both implement double-entry bookkeeping.

**Honesty rule:** if a feature cannot be observed in your trial, write "not observed in trial." Do not invent it.

**Write findings to `docs/shopmonkey_analysis/`:**
- `workflow.md` — repair-order state machine, Mermaid diagram, every status + trigger
- `data_model.md` — entities (customer, vehicle, order, service line, part line, estimate, invoice, payment), fields, relationships
- `ui_patterns.md` — job board structure, estimate builder, communication initiation
- `communication_flow.md` — how estimates/invoices reach customers; what the approval page shows; what approval records
- `inspection_flow.md` — technician photo/note capture; how inspections attach to estimates
- `reporting.md` — dashboard and standard report metrics

### 2c. Gap analysis

Write `docs/gap_analysis.md` before any product code. Classify each Shopmonkey feature:

| Class | Meaning | Examples |
|---|---|---|
| Keep | Identical workflow | Job board, estimate→invoice, photo inspections |
| Adapt | Exists, needs Ethiopian changes | Communication → Telegram/SMS; payments → Chapa; dates → Ethiopian calendar |
| Replace | Assumes US infrastructure | ALLDATA → local labor-rate table; Nexpart → supplier directory |
| Add | Ethiopia needs it, Shopmonkey lacks it | EV parts waitlist, FX cost fields, tax engine, Ethiopian calendar |
| Drop | No Ethiopian equivalent | QuickBooks sync, US BNPL, VIN lookup, email marketing |

---

## 3. Compliance (build into foundation, before go-live)

### 3a. Data protection — PDPA Proclamation 1321/2024

- Explicit consent at customer creation: checkbox with the Amharic statement that the customer agrees their phone number and vehicle history are used only by this garage. Store `consent_at` timestamp.
- Data-subject export: "Export my data" action on the customer profile (XLSX of all their orders, vehicles, invoices) — also satisfies §6e export requirement.
- Third-party sharing limited to Chapa (payments) and the notification provider(s) — stated in the in-app privacy notice.
- Backups: nightly automated Supabase backup + PITR enabled in Phase 1 config; monthly manual export step documented. Garages' invoice history is existential data.

### 3b. Payment data

- Never store card/wallet credentials. Chapa owns the checkout. We store only `chapa_tx_ref` and payment status.
- **Idempotency is our job:** one `chapa_tx_ref` generated per invoice, `UNIQUE(chapa_tx_ref)` in the schema, and a guard before every initiation call. Retry with the same invoice ID must never create a second charge. Do not assume Chapa natively deduplicates.
- Verify every webhook signature (HMAC per current Chapa docs, `crypto.timingSafeEqual`).
- **Resilience:** webhooks fail under Ethiopian connectivity. On the customer's success-redirect return path, call Chapa's transaction-verify endpoint and reconcile state. Webhook + verify-polling are both first-class paths.

### 3c. Tax engine — Ministry of Revenues (MoR) rules

Note: ERCA was dissolved in 2021; authority is the Ministry of Revenues. All naming, comments, and docs must say MoR.

| Regime | Applies to | Invoice tax |
|---|---|---|
| `vat_15` | MoR VAT-registered shops (annual turnover ≥ 1,000,000 ETB) | 15% VAT |
| `tot_10_2` | Unregistered shops | Turnover Tax: **10% on services/labor, 2% on goods/parts** (Proclamation 308/2002) — never print "VAT" |
| `exempt` | Doesn't apply/exception cases | No tax line |

- `shops.tax_regime` is the single source; the calculator function in `packages/shared/tax.ts` is pure and fully unit-tested (both TOT split lines appear as separate line items: labor and parts taxed at their own rates).
- B2B invoices include buyer TIN when provided.

**VAT vs tax invoices for VAT-registered shops (EFD):** official fiscal receipts come from Electronic Fiscal Devices (EFDs). GarAj's generated document for a VAT shop is a **proforma/commercial record**, not a fiscal tax invoice, unless the shop also issues an EFD receipt. Therefore:
- Add a manual `efd_receipt_number` field on invoices for `vat_15` shops (they physically press an EFD and record the number).
- Non-EFD invoices for VAT shops carry a printed label: "This document is not a fiscal tax invoice unless accompanied by an EFD receipt" (Amharic wording stored in i18n).
- Schema comment reserved: future ERCA/MoR e-receipt integration.

### 3d. Invoice compliance (MoR)

- Sequential invoice numbers per shop per Ethiopian fiscal year: `INV-{ethiopian_year}/{seq}` (e.g., `INV-2019/0001`). Never reuse or skip. Generated under `SELECT ... FOR UPDATE` inside the invoicing transaction on the `invoice_sequences` row; unique constraint on `invoice_number`; **concurrency test required** (two simultaneous invoice creations for the same shop produce adjacent numbers, no gaps).
- Seller TIN on every invoice; buyer TIN when B2B.
- Both Ethiopian and Gregorian dates; the Ethiopian fiscal year (runs from Hamle 1) appears on the invoice.
- TIN validation: 10 digits, per MoR documentation; validator function with source noted.

### 3e. Name and trademark — **the only blocking-await-user item**

Search before committing: Ethiopian Intellectual Property Office register, Google Play ("garaj", "ጋራዥ"), Apple App Store, Ethio Telecom business directory. Record findings in `docs/decisions.md`. If a collision exists, propose alternatives (FixEt, GaraMed, ShopAj, ...) and **stop and wait for user confirmation**. Everything else in this brief proceeds without asking.

---

## 4. Phase 1: project setup and architecture

### 4a. Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend shell | Next.js 14 (App Router), TypeScript, Tailwind | SSR for public pages (`garaj.et/a/[token]` approval, marketing); App Router stays **out of the offline path** (see 4b) |
| Dashboard runtime | Client-side SPA/PWA inside dashboard routes | TanStack Query + `persistQueryClient` (IndexedDB via `idb-keyval`), optimistic mutations, Service Worker sync queue. RSC transitions must not be the vehicle for offline job-board work |
| Backend | Node.js + Fastify, TypeScript | Typed, large Ethiopian dev pool |
| Database | PostgreSQL via Supabase | RLS, real-time job board, PITR backups |
| Auth | Supabase Auth (phone OTP) | 6-digit SMS OTP; email never required |
| Payments | Chapa API | Sandbox first (Spike 1) |
| Storage | Supabase Storage | Client-side compressed uploads only |
| Notifications | Telegram bot (co-primary) + SMS (via Spike-2-validated provider) | Channel selection per customer |
| i18n | next-intl | `am` primary, `en` secondary |
| Fonts | Noto Serif/Sans Ethiopic (SIL OFL 1.1), self-hosted | No CDN dependency |
| Hosting | Vercel + Supabase Edge Functions / Railway | No production-ready local cloud in Ethiopia |

### 4b. Repository structure

```
garaj-ethiopia/
├── apps/
│   ├── web/                          # Next.js (public pages + shell)
│   │   ├── app/
│   │   │   ├── [locale]/             # am/ and en/
│   │   │   ├── a/[token]/            # public approval page (SSR, online-only)
│   │   │   └── app/                  # dashboard: client-side SPA/PWA zone
│   │   │       ├── dashboard/        # job board
│   │   │       ├── orders/  customers/  vehicles/  inventory/
│   │   │       ├── staff/  reports/  settings/
│   │   ├── components/
│   │   ├── i18n/am.json  i18n/en.json
│   │   └── public/fonts/
│   └── api/                          # Fastify
│       ├── routes/  models/  middleware/
│       └── integrations/
│           ├── chapa.ts              # init + webhook + verify fallback
│           ├── telegram.ts           # bot: estimate cards with inline buttons
│           ├── sms.ts                # provider-agnostic sender
│           └── notifications.ts      # channel router (telegram-first, sms fallback)
├── packages/
│   ├── shared/
│   │   ├── ethiopian-calendar.ts     # EC/GC converter + clock (§5, Spike 4)
│   │   ├── tax.ts                    # tax regime calculator
│   │   ├── permissions.ts            # can(shop, feature) gating
│   │   └── notifications.ts          # templates with segment counts
├── spikes/                           # throwaway integration experiments; never imported
├── supabase/
│   ├── migrations/
│   └── seed.sql                      # realistic Ethiopian data (§4d)
└── docs/
    ├── shopmonkey_analysis/  rea_setup.md  gap_analysis.md
    ├── decisions.md  progress.md  compliance.md
```

### 4c. Database schema

```sql
-- Shops
CREATE TABLE shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  sub_city text,
  city text NOT NULL DEFAULT 'Addis Ababa',
  phone text NOT NULL,
  email text,
  tin text,                                -- 10 digits (validator in shared)
  logo_url text,
  shop_type text NOT NULL,                 -- 'auto_repair','ev_service','tire','detail','general'
  -- IMPORTANT: future multi-shop ownership requires migrating users to a
  -- shops_x_users role join table; phone UNIQUENESS here is a go-live constraint only.
  tax_regime text NOT NULL DEFAULT 'tot_10_2'
    CHECK (tax_regime IN ('vat_15','tot_10_2','exempt')),
  plan text NOT NULL DEFAULT 'starter',    -- 'starter','standard','pro'
  plan_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Users (future: user_shop_roles join table for multi-shop)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  phone text NOT NULL UNIQUE,
  full_name_am text NOT NULL,
  full_name_en text,
  role text NOT NULL,                      -- 'owner','manager','technician','receptionist'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Customers (PDPA consent + Telegram channel choice)
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  phone text NOT NULL,
  full_name_am text NOT NULL,
  full_name_en text,
  email text,
  tin text,
  telegram_handle text,                    -- if provided: zero-cost channel
  preferred_channel text NOT NULL DEFAULT 'sms'
    CHECK (preferred_channel IN ('sms','telegram')),
  consent_given boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, phone)
);

-- Vehicles (plate validation is app-level, warning-only, multi-format)
CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  make text NOT NULL,                      -- incl. BYD, Chery, Geely, JAC, Haval, Loncin...
  model text NOT NULL,
  year int,
  plate_number text,
  vin text,
  fuel_type text NOT NULL CHECK (fuel_type IN
    ('petrol','diesel','lpg','bev','hev','phev','other')),
  odometer int,
  odometer_unit text DEFAULT 'km',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Repair orders  status: received → inspection → estimate_sent → approved
--                          → in_progress → complete → paid
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  status text NOT NULL DEFAULT 'received',
  assigned_tech_id uuid REFERENCES users(id),
  intake_at timestamptz NOT NULL DEFAULT now(),
  promised_at timestamptz,
  completed_at timestamptz,
  notes_am text, notes_en text,
  odometer_in int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE canned_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  name_am text NOT NULL, name_en text,
  labor_hours numeric(5,2),
  labor_rate_etb numeric(10,2),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE order_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  canned_job_id uuid REFERENCES canned_jobs(id),
  name_am text NOT NULL, name_en text,
  labor_hours numeric(5,2),
  labor_rate_etb numeric(10,2) NOT NULL,
  tech_id uuid REFERENCES users(id),
  notes_am text
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  name text NOT NULL, phone text, address text,
  currency text NOT NULL DEFAULT 'ETB'     -- 'ETB','CNY','USD','AED','EUR'
);

CREATE TABLE order_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  part_name_am text NOT NULL, part_name_en text,
  part_number text,
  supplier_id uuid REFERENCES suppliers(id),
  qty numeric(8,2) NOT NULL DEFAULT 1,
  cost_original numeric(10,2),
  original_currency text DEFAULT 'ETB',
  fx_rate numeric(12,4),                   -- manual rate + date captured
  cost_etb numeric(10,2) NOT NULL,
  markup_pct numeric(5,2) DEFAULT 0,
  sell_price_etb numeric(10,2) NOT NULL
);

CREATE TABLE inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  tech_id uuid REFERENCES users(id),
  notes_am text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES inspections(id),
  storage_url text NOT NULL,
  media_type text NOT NULL,                -- 'photo','video'
  caption_am text, caption_en text,
  file_size_bytes int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  status text NOT NULL DEFAULT 'draft',   -- 'draft','sent','approved','declined','expired'
  sent_at timestamptz,
  approval_method text,                    -- 'telegram','sms_link','in_person','phone_call'
  approved_at timestamptz,
  approved_by_phone text,
  subtotal_etb numeric(10,2),
  tax_etb numeric(10,2),
  tax_type text,                           -- 'vat' | 'tot' (mirrors tax_regime at approval time)
  discount_etb numeric(10,2) DEFAULT 0,
  total_etb numeric(10,2),
  approval_token text UNIQUE,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  estimate_id uuid REFERENCES estimates(id),
  invoice_number text NOT NULL UNIQUE,     -- INV-{ethiopian_year}/{seq}
  fiscal_year_et int NOT NULL,
  tax_type text NOT NULL,                  -- 'vat' | 'tot' | none (regime snapshot)
  tax_etb numeric(10,2) NOT NULL,          -- 0 permitted under 'exempt'
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'unpaid',   -- 'unpaid','paid','voided'
  subtotal_etb numeric(10,2) NOT NULL,
  discount_etb numeric(10,2) DEFAULT 0,
  total_etb numeric(10,2) NOT NULL,
  efd_receipt_number text,                 -- MANUAL entry for vat_15 shops; reserved
  created_at timestamptz NOT NULL DEFAULT now()   -- for future MoR e-receipt integration
);

CREATE TABLE invoice_sequences (
  shop_id uuid NOT NULL REFERENCES shops(id),
  fiscal_year_et int NOT NULL,
  last_seq int NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, fiscal_year_et)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  amount_etb numeric(10,2) NOT NULL,
  method text NOT NULL                     -- 'telebirr','cbe_birr','ebirr','mpesa',
    CHECK (method IN                        -- 'card','cash','bank_transfer'
      ('telebirr','cbe_birr','ebirr','mpesa','card','cash','bank_transfer')),
  chapa_tx_ref text UNIQUE,                -- UNIQUE = our idempotency backstop
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- Deferred features: schema now to avoid later migrations
CREATE TABLE parts_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  order_id uuid REFERENCES orders(id),
  part_name_am text NOT NULL, part_name_en text,
  part_number text,
  supplier_id uuid REFERENCES suppliers(id),
  expected_arrival_at timestamptz,
  arrived_at timestamptz,
  customer_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  part_name_am text NOT NULL, part_name_en text,
  part_number text,
  supplier_id uuid REFERENCES suppliers(id),
  qty_on_hand numeric(8,2) NOT NULL DEFAULT 0,
  reorder_point numeric(8,2) DEFAULT 0,
  cost_etb numeric(10,2),
  sell_price_etb numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Channel-agnostic notification log (sms | telegram)
CREATE TABLE notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  order_id uuid REFERENCES orders(id),
  customer_id uuid REFERENCES customers(id),
  channel text NOT NULL CHECK (channel IN ('sms','telegram')),
  to_address text NOT NULL,                -- phone or telegram handle
  message text NOT NULL,
  segments int,                            -- SMS only: UCS-2 segments billed
  provider text,
  provider_message_id text,
  status text NOT NULL DEFAULT 'queued',   -- 'queued','sent','delivered','failed'
  sent_at timestamptz,
  delivery_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 4d. Seed data — realistic, no placeholders

Common vehicles: Toyota Corolla (2005–2018), HiAce minibus, Bajaj three-wheeler, Isuzu NPR, BYD Atto 3, Chery Tiggo, Geely Emgrand, JAC EV, Haval H6.
Common services (Amharic first): ዘይት ለወጥ (oil change), ብሬክ ጥገና (brake), ሞተር ቱዩን-አፕ (tune-up), ትራስሚሽን ሰርቪስ, ኤሌክትሪካል ምርመራ, የባትሪ ጤና ምርመራ.
Three shops: general garage (Kirkos), EV specialist (Bole), tire shop (Akaki Kality). Suppliers: Merkato parts dealers, Chinese-parts importers. Customers: fabricated common Amharic name patterns. Use a realistic tax mix so the tax engine is exercised: at least one `vat_15`, one `tot_10_2` shop.

---

## 5. Phase 1.5: integration spikes (before Phase 2 — throwaway code, `spikes/`, results → `docs/decisions.md`)

### Spike 1: Chapa payments, end-to-end
1. Test account; init 100 ETB to a test number; complete with test credentials.
2. Receive + verify webhook signature (`crypto.timingSafeEqual`).
3. **Implement the verify-on-redirect fallback:** suppress the webhook, then drive the success-redirect page and reconcile via `GET verify/{tx_ref}` — both paths must converge to the same paid state.
4. Simulate refund/void; document behavior.
5. **Answer:** does Chapa production support recurring subscriptions? Record either way — the design assumes **manual monthly invoice + cron is the primary rail** regardless.

### Spike 2: Amharic SMS (needs one real number — see consent protocol)
1. Africa's Talking first; confirm current Ethiopia coverage/delivery docs.
2. Send a real SMS in Amharic to a real Ethiopian number. **Ethics rule:** request a test number and consent from the user (one short, non-blocking message in `docs/decisions.md`); do not stall other phases waiting for it.
3. Measure: segments (UCS-2: 70 single / **67 per segment when concatenated**), latency, per-segment cost, delivery receipts, sender-ID form (alphanumeric vs numeric route).
4. Regardless of AT result, list the local-aggregator option generically: an Ethiopian-registered aggregator that can whitelist an alphanumeric sender ID (`GARAJ`) with Ethio Telecom/INSA; document the registration lead time (commonly 2–4 weeks — verify).
5. **Answer:** primary provider + fallback; cost/segment in ETB; delivery-receipt support; expected sender-ID lead time.
6. Consequence rule: all go-live Amharic templates are authored to fit the measured budget (aim 1 segment; 2 segments permitted only if deliberately accepted in `decisions.md`). Template strings live in `packages/shared/notifications.ts` with character/segment counts asserted in unit tests.

### Spike 3: Telegram bot (now go-live, not post-launch)
1. Build a minimal bot; deliver an estimate as a rich card with two inline buttons: approve / need-more-info.
2. Confirm clicking approve hits our API (secure callback with token), and the result lands in `notifications_log` with channel `'telegram'`.
3. Measure Amharic rendering, message cost (0), and delivery latency vs SMS.
4. **Answer:** is Telegram the default approval channel when the customer provides a handle, with SMS as fallback? (Expected: yes.)

### Spike 4: inspection photo on low-end 3G
Client-side compress to <200 KB (`browser-image-compression`, MIT), upload to Supabase Storage under DevTools 3G throttling. Measure compress + upload time. Target: <8 s. If missed, reduce target or add progress/cancel UI. Confirm the offline queue covers photo retries (3 attempts).

### Spike 5: Ethiopian calendar engine — property-test, don't trust prose
1. Try `ethiopian-calendar` (npm); if unmaintained/wrong, write a zero-dependency converter in `packages/shared/ethiopian-calendar.ts`.
2. **Do not trust any prose claim about specific date equivalences** (including earlier project documents). Build a property test from real published anchors across 50+ years:
   - Enkutatash dates (Meskerem 1) as published year-by-year (Sept 11, and Sept 12 in the year following a Gregorian leap year)
   - Pagume 5 vs 6 (Ec leap-year rule: every 4th Ethiopian year)
   - Ethiopian millennium anchor: Meskerem 1, 2000 EC = September 12, 2007 GC
   - Fiscal-year start (Hamle 1) behavior across a non-leap and a leap Ethiopian year — tested against published government dates, not asserted in this brief
3. Ethiopian clock: `ET_hour = (GC_24h − 6) mod 12` with day/night labels (ጠዋት/ከሰዓት/ማታ). Decision: display convention on customer-facing documents only or all timestamps (record in §14).
4. If any library/prose conflicts with test results, the **test table wins** and the conflict is recorded.

### Spike 6: offline queue architecture proof
Minimal PWA shell: TanStack Query + `persistQueryClient` (IndexedDB) + Service Worker. Prove: job board renders offline from cache, a status change queues and syncs on reconnect, photo upload retries. Verify no RSC navigation is required for dashboard flows. Record what queues vs. blocks (feeds §7 exactly).

---

## 6. Phase 2: core workflow (go-live scope)

### 6a. Job board (kanban)

| Status | Amharic | Trigger |
|---|---|---|
| received | ተቀብሎ | Vehicle checked in |
| inspection | ምርመራ ላይ | Technician assigned |
| estimate_sent | ግምት ተላከ | Estimate delivered |
| approved | ፈቃድ ተሰጠ | Customer confirmed |
| in_progress | ሥራ ላይ | Work started |
| complete | ተጠናቋል | Invoice issued |
| paid | ተከፍሏል | Payment recorded |

Cards: customer Amharic name, vehicle (make/model/plate), assigned tech, promised date; red border when past-due; filter by technician and fuel type (EV/ICE); drag on desktop, tap-and-select on mobile; live updates via Supabase real-time.

### 6b. Repair order and estimate

- Create from board or profile; auto-fill vehicle by plate from our registry (no external lookups).
- Service lines (Amharic required, canned-job one-tap) and parts lines (FX-aware: original currency + manual rate → `cost_etb`).
- Inspection photos attach (compressed per Spike 4).
- Totals via `packages/shared/tax.ts` honoring shop `tax_regime` (VAT 15%, or TOT 10% labor / 2% parts as separate lines).
- PDF estimate in Amharic with shop identity, TIN, and both calendars.

**Customer approval (Telegram-first, SMS-second; not "e-signature"):**
1. On send: `approval_token` (16 hex), 72-hour expiry, `garaj.et/a/{token}`.
2. Channel: if `preferred_channel = 'telegram'` (and handle present) → rich card with inline buttons; else SMS link (`provider_message_id` logged either way).
3. **Link privacy:** before showing totals, the public page asks the recipient to confirm the **last 4 digits of the customer's phone number**. On mismatch, show only "An estimate is waiting — visit the garage" without amounts.
4. Actions: approve all / approve selected lines / request callback.
5. Record timestamp, confirming phone/approval method. Amharic label is "ማረጋገጫ" (confirmation); legal note: "ይህ ማረጋገጫ ለጥገናው ሥምምነት ሆኖ ያገለግላል።" Never call it an e-signature.
6. Shop notified on response; one reminder at 48h within the character budget.

### 6c. Invoice and payment

- One-click convert; invoice number via `SELECT ... FOR UPDATE` sequence (concurrency-tested).
- PDF: MoR-format fields — TINs, line items, tax lines per regime (`vat_15` shops additionally record/label EFD status; non-EFD documents carry the "not a fiscal tax invoice" label), both calendars, fiscal year.
- Payment: Chapa checkout link (SMS/Telegram) or counter QR; cash recorded manually.
- Webhook (verified + idempotent, `chapa_tx_ref` UNIQUE) AND verify-on-redirect fallback must both converge to paid; move order → paid; send Amharic receipt via the customer's channel.

### 6d. Customers and vehicles

- Search by phone (primary) and Amharic name.
- Profiles: consent state, orders, vehicles, outstanding invoices; vehicle service history + odometer trail.
- CSV bulk import: phone, names, make/model/plate. **Plate format is warning-only, never a rejection** — Ethiopian plates vary by region/series and a new unified format is rolling out (Directive 1050/2025); flag non-matching rows as "check" and import anyway.
- "Export my data" per customer (XLSX) — PDPA (§3a).

### 6e. Report: daily summary (only go-live report)

Orders by status, revenue collected (ETB), outstanding invoices (count + total), new customers; both calendars; XLSX export.

---

## 7. Offline strategy (exact)

**Works offline (cached / queued):**
- View job board, orders, customers, vehicles (last sync)
- Add notes to existing orders
- Queue status changes (applied on reconnect, conflict-dated)
- Photo capture + queue upload; retry ≤ 3× in background

**Requires connectivity:**
- Creating new customers/orders
- Sending estimates/invoices (Telegram or SMS)
- Chapa payments
- Initial login (OTP)

Implementation per Spike 6: client-side PWA (TanStack Query + IndexedDB persistence + optimistic mutations + Service Worker queue). State of every queueable op is persisted so a crash never lost a status change. Record in `decisions.md` and mirror this exact list.

---

## 8. Fif permanent skips and deferrals (each needs a `decisions.md` row)

| Feature | Class | Reason |
|---|---|---|
| ALLDATA / MOTOR labor guides | Permanent drop | No Ethiopian/China-EV coverage |
| Nexpart / PartsTech ordering | Permanent drop | Not operational in Ethiopia |
| QuickBooks sync | Permanent drop | Not used by Ethiopian SMEs |
| US BNPL | Permanent drop | No local equivalent |
| VIN registry lookup | Permanent drop | Registry not publicly accessible |
| Shopmonkey bundle static analysis | Permanent drop | Clean-room violation; not needed |
| Email marketing | Post-launch | Low Ethiopian email engagement |
| Multi-location dashboard | Post-launch | After first multi-location customer |
| EV diagnostic code mapping | Post-launch | Manual data collection required |
| FX margin reports | Post-launch | Schema ready; build after go-live |
| Editable SMS templates | Post-launch | Go-live ships fixed, budget-tested templates |
| Pro tier + EV modules | Post-launch | After paying customers |

---

## 9. Subscription plans (ETB, monthly via Chapa — cron is the primary rail)

| Plan | ETB/mo | Limits | Go-live? |
|---|---|---|---|
| ጀማሪ / Starter | 1,500 | 1 user; 30 orders/mo; no SMS reminders (Telegram included); 1 location | Yes |
| መደበኛ / Standard | 3,500 | 5 users; unlimited orders; 100 SMS (or unlimited Telegram); 1 location | Yes |
| ፕሮ / Pro | 7,000 | Unlimited users/orders; multi-location; EV log; priority support | Post-launch |

Recurring billing design (assume manual rail unless Chapa docs prove otherwise in Spike 1):
- Day −3 cron: calendar-aware reminder to owner (Telegram + SMS) with a Chapa one-time renewal link
- Payment webhook/verify extends `plan_expires_at` +30 days; first month charged at signup
- Daily cron reconciles expiries; gates via `can(shop, feature)` in `packages/shared/permissions.ts` (DB-level truth); single-source-of-truth comment required

---

## 10. Testing

- **Unit:** Ethiopian calendar property tests (§5, Spike 5 — the anchor table is the truth); tax engine per regime incl. TOT split; ETB formatting; VAT/TOT invoice rendering; sequence generation; SMS character/segment count (`70/67` rules) asserted for every template; TIN and plate validators (plate = warning semantics).
- **Integration:** Chapa sandbox — webhook path AND suppressed-webhook verify path (both must converge); Supabase RLS; Telegram bot callback → approval state; SMS send + delivery receipt (Spike 2 only).
- **Concurrency:** two simultaneous invoice creations → adjacent numbers, zero gaps (`SELECT ... FOR UPDATE` proof).
- **E2E (Playwright):** full lifecycle intake → estimate → approval (Telegram branch AND SMS-link branch, including last-4 confirmation) → invoice → payment (both webhook and verify paths) → paid; job-board transitions; XLSX exports.
- **i18n:** every `en.json` key has `am.json` counterpart; no English visible when `am` active; Ethiopic renders with self-hosted fonts.
- **Performance:** job-board first view and a tap-status transition under 3G throttling within stated budgets from Spike 4/6.

---

## 11. Verification format (every phase → `docs/progress.md`)

- Phase name, date; what was built (files/modules).
- Test commands + exact terminal output pasted.
- What was NOT built and why.
- One thing still unproven or risky.
- Go/no-go recommendation for the next phase.
- Never claim "complete," "verified," or "production-ready" beyond what was observed.

---

## 12. Permissions (blocking vs. deciding)

**Blocking — stop and wait for the user:** only §3e (trademark collision alternative). **Everything else:** you decide, record the decision + evidence in `docs/decisions.md`, and continue. Non-blocking user inputs you may request without waiting: test phone number + consent (Spikes 2), Telegram test handle.

---

## 13. Required early decisions (write all in `docs/decisions.md` before code)

1. Trademark findings (§3e) — blocking only if collision.
2. SMS provider primary/fallback; cost/segment; delivery receipts; sender-ID lead time (Spike 2).
3. Chapa recurring availability; verify-endpoint fallback behavior (Spike 1).
4. Calendar: library or own implementation; license; property-test results — including what the tests showed about fiscal-year boundary dates.
5. Telegram as default approval channel — confirm from Spike 3 evidence.
6. Offline queue list (mirror §7 exactly — no more, no less).
7. Timezone: `Africa/Addis_Ababa` display everywhere; storage UTC `timestamptz`.
8. TIN validator source (MoR docs).
9. Ethiopian clock scope: customer-facing documents only vs. all timestamps — decide and record consequences.
10. Photo compression target confirmed by Spike 4.
11. Tax regime default per shop type; UI to switch regime (owner-only permission).
12. Code/comments in English; all user-facing strings in `am.json`/`en.json`; no hardcoded Amharic in components.

---

## 14. Statistics appendix (sourced; do not invent more)

| Claim | Source | Confidence |
|---|---|---|
| ~1.2–1.4M registered vehicles; ~half in Addis | Ethiopian Roads Authority / AlignEthiopia 2023 | Directional |
| Fuel-vehicle import ban (2024, first worldwide) | AP / Ethiopian government / IEA | Confirmed |
| EV service capacity gutted vs. demand; parts waits | VOA/AP/Fortune 2024–25 reporting | Anecdotal context — not a public marketing claim |
| 4.7T Birr digital transactions (June 2023) | AfricaNenda / NBE | High |
| Chapa: 18 banks, 14 payment methods, 100M+ txns | Chapa / etradeforall 2025 | High |
| Local SaaS pricing anchor ~5,000 ETB/mo | Shega Media 2025 (Yonet Systems) | Single data point |
| VAT 15% only for VAT-registered (≥1M ETB turnover) | MoR / Procl. 308/2002 | Confirmed |
| TOT: 2% goods / 10% services | Proclamation 308/2002 | Confirmed |
| ERCA dissolved; responsibilities under Ministry of Revenues | Ethiopian government 2021 reorganization | Confirmed |
| UCS-2 SMS: 70 chars single / 67 concatenated | GSM standards (3GPP TS 23.038) | Confirmed |
| SMS segment cost (0.40–0.65 ETB) and Telegram urban penetration | Not verifiable from a desk | **Measure in Spikes 2–3; do not cite externally until measured** |
| Hamle 1 fiscal-year start date | Not asserted in code/tests | **Spike 5 property tests decide; prose does not** |

---

*End of brief. When go-live scope is complete and verified per §11, stop and report against §13 decisions.*
