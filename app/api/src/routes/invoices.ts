import type { FastifyInstance } from "fastify";
import { pool } from "../db";
import { ethiopianYear, round2 } from "../services/tax";
import { isUuid } from "../services/validate";
import { randomBytes } from "node:crypto";

async function invoicePayload(client: any, shopId: string, invoiceId: string) {
  const inv = await client.query(
    `SELECT i.id, i.invoice_number AS "invoiceNumber", i.fiscal_year_et AS "fiscalYearEt",
            i.subtotal_etb AS "subtotalEtb", i.tax_etb AS "taxEtb", i.tax_type AS "taxType",
            i.total_etb AS "totalEtb", i.amount_paid_etb AS "amountPaidEtb",
            i.status, i.issued_at AS "issuedAt", i.due_at AS "dueAt",
            o.id AS "orderId", c.full_name_am AS "customerNameAm", c.phone AS "customerPhone",
            v.make, v.model, v.plate_number AS "plateNumber"
       FROM invoices i
       JOIN orders o    ON o.id = i.order_id AND o.shop_id = i.shop_id
       JOIN customers c ON c.id = o.customer_id AND c.shop_id = i.shop_id
       JOIN vehicles v  ON v.id = o.vehicle_id  AND v.shop_id = i.shop_id
      WHERE i.id = $1 AND i.shop_id = $2`,
    [invoiceId, shopId]
  );
  if (!inv.rows[0]) return null;
  const lines = await client.query(
    `SELECT line_kind AS "lineKind", name_am AS "nameAm", qty,
            line_subtotal_etb AS "lineSubtotalEtb", line_tax_etb AS "lineTaxEtb",
            line_total_etb AS "lineTotalEtb"
       FROM invoice_lines WHERE invoice_id = $1 AND shop_id = $2 ORDER BY created_at, id`,
    [invoiceId, shopId]
  );
  const payments = await client.query(
    `SELECT method, amount_etb AS "amountEtb", provider_ref AS "providerRef",
            paid_at AS "paidAt"
       FROM payments WHERE invoice_id = $1 AND shop_id = $2 AND kind = 'receipt'
      ORDER BY paid_at`,
    [invoiceId, shopId]
  );
  const QRCode = await import("qrcode");
  const qrDataUrl = await QRCode.default.toDataURL(
    `garaj://invoice/${inv.rows[0].invoiceNumber}`,
    { margin: 1, width: 240 }
  );
  return { ...inv.rows[0], lines: lines.rows, payments: payments.rows, qrDataUrl };
}

export default async function invoiceRoutes(app: FastifyInstance) {
  // Issue invoice from the APPROVED estimate version. Ethiopian fiscal-year
  // sequence guarded by a transaction-scoped advisory lock (§4a pattern).
  app.post<{ Params: { shopId: string; orderId: string } }>(
    "/v1/shops/:shopId/orders/:orderId/invoice",
    async (req, reply) => {
      const { shopId, orderId } = req.params;
      if (!isUuid(shopId) || !isUuid(orderId))
        return reply.status(400).send({ error: "bad_id" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const cur = await client.query(
          `SELECT est.id AS "estimateId", estv.id AS "versionId", estv.status AS "versionStatus",
                  estv.subtotal_etb AS "subtotalEtb", estv.tax_etb AS "taxEtb",
                  estv.tax_type AS "taxType", estv.total_etb AS "totalEtb",
                  estv.revision AS "revision"
             FROM estimates est
             JOIN estimate_versions estv
               ON estv.id = est.current_version_id AND estv.shop_id = est.shop_id
            WHERE est.order_id = $1 AND est.shop_id = $2
              FOR UPDATE OF est, estv`,
          [orderId, shopId]
        );
        const est = cur.rows[0];
        if (!est) {
          await client.query("ROLLBACK");
          return reply.status(404).send({ error: "no_estimate" });
        }
        if (est.versionStatus !== "approved") {
          await client.query("ROLLBACK");
          return reply
            .status(409)
            .send({ error: "estimate_not_approved", status: est.versionStatus });
        }

        // Idempotent: an existing non-voided invoice returns as-is.
        const existing = await client.query(
          `SELECT id FROM invoices WHERE order_id = $1 AND shop_id = $2 AND status <> 'voided' LIMIT 1`,
          [orderId, shopId]
        );
        if (existing.rows[0]) {
          await client.query("COMMIT");
          return reply.send(await invoicePayload(pool, shopId, existing.rows[0].id));
        }

        const fiscalYearEt = ethiopianYear(new Date());
        await client.query(
          `SELECT pg_advisory_xact_lock(hashtext($1))`,
          [`inv:${shopId}:${fiscalYearEt}`]
        );
        const seq = await client.query(
          `SELECT COUNT(*) + 1 AS seq FROM invoices WHERE fiscal_year_et = $1`,
          [fiscalYearEt]
        );
        const invoiceNumber = `INV-${fiscalYearEt}/${String(seq.rows[0].seq).padStart(5, "0")}`;

        // Per-line tax snapshot straight from the approved lines.
        const vLines = await client.query(
          `SELECT id, line_kind, name_am, name_en, qty, unit_price_etb AS "unitPriceEtb", tax_kind
             FROM estimate_lines WHERE version_id = $1 AND shop_id = $2 ORDER BY created_at, id`,
          [est.versionId, shopId]
        );
        const rateOf = (taxKind: string) => {
          if (est.taxType === "vat_15") return 0.15;
          if (est.taxType === "tot_10_2") return taxKind === "labor" ? 0.1 : 0.02;
          return 0;
        };
        const inv = await client.query(
          `INSERT INTO invoices
             (order_id, shop_id, estimate_version_id, invoice_number, fiscal_year_et,
              tax_type, tax_etb, subtotal_etb, total_etb, status, issued_at, due_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unpaid', now(), now() + interval '14 days')
           RETURNING id`,
          [orderId, shopId, est.versionId, invoiceNumber, fiscalYearEt,
           est.taxType, est.taxEtb, est.subtotalEtb, est.totalEtb]
        );
        for (const l of vLines.rows) {
          const rate = rateOf(l.tax_kind);
          const lineSub = round2(Number(l.qty) * Number(l.unitPriceEtb));
          const lineTax = round2(lineSub * rate);
          const lineTotal = round2(lineSub + lineTax);
          await client.query(
            `INSERT INTO invoice_lines
               (invoice_id, shop_id, line_kind, name_am, name_en, qty, unit_price_etb,
                tax_rate, tax_type, line_subtotal_etb, line_tax_etb, line_total_etb,
                source_estimate_line_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [inv.rows[0].id, shopId, l.line_kind, l.name_am, l.name_en, l.qty,
             l.unitPriceEtb, rate, est.taxType, lineSub, lineTax, lineTotal, l.id]
          );
        }

        await client.query(
          `UPDATE orders SET status = 'complete'
            WHERE id = $1 AND shop_id = $2 AND status IN ('approved','in_progress')`,
          [orderId, shopId]
        );
        await client.query(
          `INSERT INTO audit_log (shop_id, action, entity, entity_id, channel, after)
           VALUES ($1, 'invoice_issued', 'invoices', $2, 'app', $3)`,
          [shopId, inv.rows[0].id, JSON.stringify({ invoiceNumber, total: est.totalEtb })]
        );
        await client.query("COMMIT");
        return reply.status(201).send(await invoicePayload(pool, shopId, inv.rows[0].id));
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    }
  );

  app.get<{ Params: { shopId: string; invoiceId: string } }>(
    "/v1/shops/:shopId/invoices/:invoiceId",
    async (req, reply) => {
      const { shopId, invoiceId } = req.params;
      if (!isUuid(shopId) || !isUuid(invoiceId))
        return reply.status(400).send({ error: "bad_id" });
      const payload = await invoicePayload(pool, shopId, invoiceId);
      if (!payload) return reply.status(404).send({ error: "invoice_not_found" });
      return payload;
    }
  );

  // Demo-mode payment: cash at counter or Chapa-simulated electronic receipt.
  // Real provider wiring lands in G4 — the payments row is schema-true today.
  app.post<{ Params: { shopId: string; invoiceId: string } }>(
    "/v1/shops/:shopId/invoices/:invoiceId/pay",
    async (req, reply) => {
      const { shopId, invoiceId } = req.params;
      if (!isUuid(shopId) || !isUuid(invoiceId))
        return reply.status(400).send({ error: "bad_id" });
      const { method } = (req.body ?? {}) as { method?: string };
      const METHODS = ["cash", "telebirr", "cbe_birr", "ebirr", "mpesa", "card", "bank_transfer"];
      if (!method || !METHODS.includes(method)) {
        return reply.status(400).send({ error: "bad_method" });
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const inv = await client.query(
          `SELECT id, status, amount_paid_etb AS "amountPaidEtb", total_etb AS "totalEtb",
                  order_id, invoice_number AS "invoiceNumber"
             FROM invoices WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
          [invoiceId, shopId]
        );
        if (!inv.rows[0]) {
          await client.query("ROLLBACK");
          return reply.status(404).send({ error: "invoice_not_found" });
        }
        const i = inv.rows[0];
        if (i.status === "paid" || i.status === "partial") {
          await client.query("ROLLBACK");
          return reply.status(409).send({ error: "already_paid_or_partial" });
        }
        if (i.status === "voided") {
          await client.query("ROLLBACK");
          return reply.status(409).send({ error: "invoice_voided" });
        }
        const amount = round2(Number(i.totalEtb) - Number(i.amountPaidEtb));
        const providerRef = method === "cash" ? null : `CHAPA-DEMO-${randomBytes(4).toString("hex")}`;
        await client.query(
          `INSERT INTO payments
             (invoice_id, billing_record_id, shop_id, kind, method, amount_etb, provider_ref, paid_at)
           VALUES ($1, NULL, $2, 'receipt', $3, $4, $5, now())`,
          [invoiceId, shopId, method, amount, providerRef]
        );
        await client.query(
          `UPDATE invoices SET amount_paid_etb = $1, status = 'paid' WHERE id = $2 AND shop_id = $3`,
          [Number(i.totalEtb), invoiceId, shopId]
        );
        await client.query(
          `UPDATE orders SET status = 'paid'
            WHERE id = $1 AND shop_id = $2 AND status = 'complete'`,
          [i.order_id, shopId]
        );
        await client.query(
          `INSERT INTO audit_log (shop_id, action, entity, entity_id, channel, after)
           VALUES ($1, 'payment_recorded', 'invoices', $2, 'app', $3)`,
          [shopId, invoiceId, JSON.stringify({ method, amount, providerRef })]
        );
        await client.query("COMMIT");
        return reply.send({
          ok: true,
          invoiceNumber: i.invoiceNumber,
          status: "paid",
          amountPaid: amount,
          method,
          providerRef,
        });
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    }
  );

  // Invoices across the shop (nav "Invoices" section reads this).
  app.get<{ Params: { shopId: string } }>(
    "/v1/shops/:shopId/invoices",
    async (req, reply) => {
      const { shopId } = req.params;
      if (!isUuid(shopId)) return reply.status(400).send({ error: "bad_id" });
      const r = await pool.query(
        `SELECT i.id, i.invoice_number AS "invoiceNumber", i.status,
                i.total_etb AS "totalEtb", i.issued_at AS "issuedAt",
                c.full_name_am AS "customerNameAm",
                v.make, v.model, v.plate_number AS "plateNumber"
           FROM invoices i
           JOIN orders o ON o.id = i.order_id
           JOIN customers c ON c.id = o.customer_id
           JOIN vehicles v ON v.id = o.vehicle_id
          WHERE i.shop_id = $1
          ORDER BY i.issued_at DESC
          LIMIT 100`,
        [shopId]
      );
      return { invoices: r.rows };
    }
  );
}
