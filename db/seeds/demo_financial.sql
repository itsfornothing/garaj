-- GarAj demo seeds — financial lifecycle (companion to demo.sql)
-- Estimate-approval demo: shop1 (sent, awaiting click-through)
-- Complete paid flows: shop2 (VAT 15%) + shop3 (TOT 10%/2%) + settled renewals.
-- Fiscal year: EC 2019 (Hamle 2019 EC = July 2026 GC per brief appendix; property tests are final arbiter).

BEGIN;

-- shop1: inspection that produced the sent estimate
INSERT INTO inspections (id, order_id, shop_id, tech_id, notes_am) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', '55555555-5555-5555-5555-555555555102', '11111111-1111-1111-1111-1111111111a1', '22222222-2222-2222-2222-222222222102', 'ፓዶቹ ውጤት ወደ ማስተካተታቸው ደርሷል');

-- estimates + versions + lines
INSERT INTO estimates (id, order_id, shop_id, status) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '55555555-5555-5555-5555-555555555102', '11111111-1111-1111-1111-1111111111a1', 'sent'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '55555555-5555-5555-5555-555555555103', '11111111-1111-1111-1111-1111111111a2', 'approved'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '55555555-5555-5555-5555-555555555104', '11111111-1111-1111-1111-1111111111a3', 'approved');

INSERT INTO estimate_versions (id, estimate_id, shop_id, revision, status, sent_at, token_expires_at, approval_token_hash, subtotal_etb, tax_etb, tax_type, total_etb) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '11111111-1111-1111-1111-1111111111a1', 1, 'sent', now() - interval '40 hours', now() + interval '32 hours', 'seed-demo-hash-not-real', 1850, 109, 'tot_10_2', 1959),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '11111111-1111-1111-1111-1111111111a2', 1, 'approved', now() - interval '8 days', now() - interval '8 days' + interval '72 hours', 'seed-demo-hash-2', 31400, 4710, 'vat_15', 36110),
  ('cccccccc-cccc-cccc-cccc-cccccccccc03', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '11111111-1111-1111-1111-1111111111a3', 1, 'approved', now() - interval '6 days', now() - interval '6 days' + interval '72 hours', 'seed-demo-hash-3', 1500, 150, 'tot_10_2', 1650);

UPDATE estimates SET current_version_id = 'cccccccc-cccc-cccc-cccc-cccccccccc01' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01';
UPDATE estimates SET current_version_id = 'cccccccc-cccc-cccc-cccc-cccccccccc02' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
UPDATE estimates SET current_version_id = 'cccccccc-cccc-cccc-cccc-cccccccccc03' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03';

INSERT INTO estimate_lines (id, version_id, shop_id, line_kind, name_am, name_en, qty, unit_price_etb, tax_kind, source_order_service_id, source_order_part_id) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddd01', 'cccccccc-cccc-cccc-cccc-cccccccccc01', '11111111-1111-1111-1111-1111111111a1', 'service', 'ብሬክ ፓድ መሙላት', 'Brake pads replacement', 3, 300, 'labor', '88888888-8888-8888-8888-888888888801', NULL),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', 'cccccccc-cccc-cccc-cccc-cccccccccc01', '11111111-1111-1111-1111-1111111111a1', 'part', 'ብሬክ ፓድ ስብስብ', 'Brake pad set', 1, 950, 'part', NULL, '99999999-9999-9999-9999-999999999901'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd03', 'cccccccc-cccc-cccc-cccc-cccccccccc02', '11111111-1111-1111-1111-1111111111a2', 'service', 'ጎማ መቀየር', 'Tire change', 0.5, 400, 'labor', '88888888-8888-8888-8888-888888888802', NULL),
  ('dddddddd-dddd-dddd-dddd-dddddddddd04', 'cccccccc-cccc-cccc-cccc-cccccccccc02', '11111111-1111-1111-1111-1111111111a2', 'part', 'ጎማ 175/65R14', 'Tire 175/65R14', 4, 7800, 'part', NULL, '99999999-9999-9999-9999-999999999902'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd05', 'cccccccc-cccc-cccc-cccc-cccccccccc03', '11111111-1111-1111-1111-1111111111a3', 'service', 'ባትሪ ትክክለኝነት ምርመራ', 'Battery health check', 2.5, 600, 'labor', '88888888-8888-8888-8888-888888888803', NULL);

-- invoices (from approved versions) + immutable lines
INSERT INTO invoices (id, shop_id, order_id, estimate_version_id, invoice_number, fiscal_year_et, tax_type, tax_etb, subtotal_etb, total_etb, amount_paid_etb, status, issued_at) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '11111111-1111-1111-1111-1111111111a2', '55555555-5555-5555-5555-555555555103', 'cccccccc-cccc-cccc-cccc-cccccccccc02', 'INV-2019/00001', 2019, 'vat_15', 4710, 31400, 36110, 36110, 'paid', now() - interval '8 days'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '11111111-1111-1111-1111-1111111111a3', '55555555-5555-5555-5555-555555555104', 'cccccccc-cccc-cccc-cccc-cccccccccc03', 'INV-2019/00002', 2019, 'tot_10_2', 150, 1500, 1650, 1650, 'paid', now() - interval '6 days');

INSERT INTO invoice_lines (id, invoice_id, shop_id, line_kind, name_am, name_en, qty, unit_price_etb, tax_rate, tax_type, line_subtotal_etb, line_tax_etb, line_total_etb, source_estimate_line_id) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffff01', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '11111111-1111-1111-1111-1111111111a2', 'service', 'ጎማ መቀየር', 'Tire change', 0.5, 400, 0.15, 'VAT', 200, 30, 230, 'dddddddd-dddd-dddd-dddd-dddddddddd03'),
  ('ffffffff-ffff-ffff-ffff-ffffffffff02', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '11111111-1111-1111-1111-1111111111a2', 'part', 'ጎማ 175/65R14', 'Tire 175/65R14', 4, 7800, 0.15, 'VAT', 31200, 4680, 35880, 'dddddddd-dddd-dddd-dddd-dddddddddd04'),
  ('ffffffff-ffff-ffff-ffff-ffffffffff03', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '11111111-1111-1111-1111-1111111111a3', 'service', 'ባትሪ ትክክለኝነት ምርመራ', 'Battery health check', 2.5, 600, 0.10, 'TOT_service', 1500, 150, 1650, 'dddddddd-dddd-dddd-dddd-dddddddddd05');

-- sequences allocated
INSERT INTO invoice_sequences (shop_id, fiscal_year_et, last_seq) VALUES
  ('11111111-1111-1111-1111-1111111111a2', 2019, 1),
  ('11111111-1111-1111-1111-1111111111a3', 2019, 1);
INSERT INTO billing_sequences (shop_id, fiscal_year_et, last_seq) VALUES
  ('11111111-1111-1111-1111-1111111111a1', 2019, 1),
  ('11111111-1111-1111-1111-1111111111a2', 2019, 1),
  ('11111111-1111-1111-1111-1111111111a3', 2019, 1);

-- renewal billing records (starter = 1,500 ETB), all settled
INSERT INTO billing_records (id, shop_id, kind, plan, period_start, period_end, billing_number, amount_etb, amount_paid_etb, status) VALUES
  ('23456789-2345-2345-2345-234523450001', '11111111-1111-1111-1111-1111111111a1', 'subscription_renewal', 'starter', CURRENT_DATE - 5, CURRENT_DATE + 25, 'BILL-2019/0001', 1500, 1500, 'paid'),
  ('23456789-2345-2345-2345-234523450002', '11111111-1111-1111-1111-1111111111a2', 'subscription_renewal', 'starter', CURRENT_DATE - 5, CURRENT_DATE + 25, 'BILL-2019/0002', 1500, 1500, 'paid'),
  ('23456789-2345-2345-2345-234523450003', '11111111-1111-1111-1111-1111111111a3', 'subscription_renewal', 'starter', CURRENT_DATE - 5, CURRENT_DATE + 25, 'BILL-2019/0003', 1500, 1500, 'paid');

INSERT INTO subscriptions (id, shop_id, plan, period_start, period_end, status, outcome_billing_record_id) VALUES
  ('12345678-1234-1234-1234-123456780001', '11111111-1111-1111-1111-1111111111a1', 'starter', CURRENT_DATE - 5, CURRENT_DATE + 25, 'active', '23456789-2345-2345-2345-234523450001'),
  ('12345678-1234-1234-1234-123456780002', '11111111-1111-1111-1111-1111111111a2', 'starter', CURRENT_DATE - 5, CURRENT_DATE + 25, 'active', '23456789-2345-2345-2345-234523450002'),
  ('12345678-1234-1234-1234-123456780003', '11111111-1111-1111-1111-1111111111a3', 'starter', CURRENT_DATE - 5, CURRENT_DATE + 25, 'active', '23456789-2345-2345-2345-234523450003');

-- attempts + receipts (one settlement per attempt; provider_ref anchors replay safety)
INSERT INTO payment_attempts (id, invoice_id, billing_record_id, shop_id, kind, provider, provider_tx_ref, amount_requested_etb, status, settled_at, verified_reason) VALUES
  ('11223344-1122-3344-1122-334411220001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', NULL, '11111111-1111-1111-1111-1111111111a2', 'customer', 'chapa', 'CHAPASEED-0001', 36110, 'succeeded', now() - interval '8 days', 'webhook'),
  ('11223344-1122-3344-1122-334411220002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', NULL, '11111111-1111-1111-1111-1111111111a3', 'customer', 'chapa', 'CHAPASEED-0002', 1650, 'succeeded', now() - interval '6 days', 'redirect_poll'),
  ('11223344-1122-3344-1122-334411220003', NULL, '23456789-2345-2345-2345-234523450001', '11111111-1111-1111-1111-1111111111a1', 'subscription', 'chapa', 'CHAPASEED-SUB1', 1500, 'succeeded', now() - interval '5 days', 'webhook'),
  ('11223344-1122-3344-1122-334411220004', NULL, '23456789-2345-2345-2345-234523450002', '11111111-1111-1111-1111-1111111111a2', 'subscription', 'chapa', 'CHAPASEED-SUB2', 1500, 'succeeded', now() - interval '5 days', 'webhook'),
  ('11223344-1122-3344-1122-334411220005', NULL, '23456789-2345-2345-2345-234523450003', '11111111-1111-1111-1111-1111111111a3', 'subscription', 'chapa', 'CHAPASEED-SUB3', 1500, 'succeeded', now() - interval '5 days', 'webhook');

INSERT INTO payments (id, invoice_id, billing_record_id, shop_id, attempt_id, provider_ref, kind, method, amount_etb, recorded_by, paid_at) VALUES
  ('55667788-5566-7788-5566-556655660001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', NULL, '11111111-1111-1111-1111-1111111111a2', '11223344-1122-3344-1122-334411220001', 'CHAPASEED-0001', 'receipt', 'telebirr', 36110, '22222222-2222-2222-2222-222222222201', now() - interval '8 days'),
  ('55667788-5566-7788-5566-556655660002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', NULL, '11111111-1111-1111-1111-1111111111a3', '11223344-1122-3344-1122-334411220002', 'CHAPASEED-0002', 'receipt', 'telebirr', 1650, '22222222-2222-2222-2222-222222222301', now() - interval '6 days'),
  ('55667788-5566-7788-5566-556655660003', NULL, '23456789-2345-2345-2345-234523450001', '11111111-1111-1111-1111-1111111111a1', '11223344-1122-3344-1122-334411220003', 'CHAPASEED-SUB1', 'receipt', 'telebirr', 1500, '22222222-2222-2222-2222-222222222101', now() - interval '5 days'),
  ('55667788-5566-7788-5566-556655660004', NULL, '23456789-2345-2345-2345-234523450002', '11111111-1111-1111-1111-1111111111a2', '11223344-1122-3344-1122-334411220004', 'CHAPASEED-SUB2', 'receipt', 'telebirr', 1500, '22222222-2222-2222-2222-222222222201', now() - interval '5 days'),
  ('55667788-5566-7788-5566-556655660005', NULL, '23456789-2345-2345-2345-234523450003', '11111111-1111-1111-1111-1111111111a3', '11223344-1122-3344-1122-334411220005', 'CHAPASEED-SUB3', 'receipt', 'telebirr', 1500, '22222222-2222-2222-2222-222222222301', now() - interval '5 days');

-- waitlist sample (shop2: waiting on a tire size)
INSERT INTO parts_waitlist (id, shop_id, supplier_id, part_name_am, part_name_en, part_number, expected_arrival_at) VALUES
  ('88889999-8888-9999-8888-999988890001', '11111111-1111-1111-1111-1111111111a2', '77777777-7777-7777-7777-777777777102', 'ድርቅ ጥቅም ላይ የተዘጋጀ ጎማ', 'Aslow tire', 'TR-ASLOW-X', now() + interval '7 days');

-- audit + notification samples
INSERT INTO audit_log (id, shop_id, actor_user_id, action, entity, entity_id, channel) VALUES
  ('abcdef12-abcd-ef12-abcd-abcdef120001', '11111111-1111-1111-1111-1111111111a1', '22222222-2222-2222-2222-222222222102', 'estimate.sent', 'estimate_version', 'cccccccc-cccc-cccc-cccc-cccccccccc01', 'app'),
  ('abcdef12-abcd-ef12-abcd-abcdef120002', '11111111-1111-1111-1111-1111111111a2', '22222222-2222-2222-2222-222222222201', 'invoice.issued', 'invoice', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'app');

INSERT INTO notifications_log (id, shop_id, kind, channel, to_address, body, segments, cost_etb, status, provider_message_id, sent_at, delivered_at) VALUES
  ('98765432-9876-5432-9876-543298760001', '11111111-1111-1111-1111-1111111111a1', 'estimate_link', 'sms', '+2519113010111', 'ሰሎሞን፣ ግምት ይሺታል: garaj.et/a/demo-link', 1, 0.35, 'delivered', 'AT-SEED-0001', now() - interval '40 hours', now() - interval '40 hours' + interval '2 minutes');

COMMIT;
