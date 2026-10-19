import type { FastifyInstance } from "fastify";
import { pool } from "../db";
import { isUuid } from "../services/validate";

// Shop-level reads + the order status machine. All transitions are optimistic
// (status in WHERE) + audited.

const ADVANCE: Record<string, string[]> = {
  received: ["inspection", "cancelled"],
  inspection: ["cancelled"],
  estimate_sent: [],
  estimate_declined: ["cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["complete", "cancelled"],
  complete: [],
  paid: [],
  cancelled: [],
};

export default async function orderRoutes(app: FastifyInstance) {
  app.get("/v1/shops", async () => {
    const r = await pool.query(
      'SELECT id, name, shop_type AS "shopType", tax_regime AS "taxRegime", plan, city FROM shops ORDER BY name'
    );
    return { shops: r.rows };
  });

  app.get<{ Params: { shopId: string } }>("/v1/shops/:shopId/orders", async (req, reply) => {
    const { shopId } = req.params;
    if (!isUuid(shopId)) return reply.status(400).send({ error: "bad_id" });
    const r = await pool.query(
      `SELECT o.id, o.status, o.intake_at AS "intakeAt", o.promised_at AS "promisedAt",
              c.full_name_am AS "customerNameAm", c.phone AS "customerPhone",
              v.make, v.model, v.plate_number AS "plateNumber",
              est.id AS "estimateId", est.current_version_id AS "estimateVersionId",
              estv.status AS "estimateVersionStatus", estv.revision AS "estimateRevision",
              inv.id AS "invoiceId", inv.invoice_number AS "invoiceNumber",
              inv.status AS "invoiceStatus", inv.total_etb AS "invoiceTotalEtb"
         FROM orders o
         JOIN customers c ON c.id = o.customer_id AND c.shop_id = o.shop_id
         JOIN vehicles v  ON v.id = o.vehicle_id  AND v.shop_id = o.shop_id
         LEFT JOIN estimates est ON est.order_id = o.id AND est.shop_id = o.shop_id
         LEFT JOIN estimate_versions estv
                ON estv.id = est.current_version_id AND estv.shop_id = o.shop_id
         LEFT JOIN LATERAL (
                SELECT id, invoice_number, status, total_etb
                  FROM invoices i
                 WHERE i.order_id = o.id AND i.shop_id = o.shop_id
                   AND i.status <> 'voided'
                 ORDER BY i.issued_at DESC LIMIT 1
              ) inv ON true
        WHERE o.shop_id = $1
        ORDER BY o.intake_at DESC`,
      [shopId]
    );
    // Tenant binding note (§4b): every join/relation is shop-scoped; composite FKs make
    // cross-shop rows impossible. Authorization middleware lands with real auth (G3).
    return { orders: r.rows };
  });

  // Canned jobs + FX desk config for the estimate builder.
  app.get<{ Params: { shopId: string } }>("/v1/shops/:shopId/catalog", async (req, reply) => {
    const { shopId } = req.params;
    if (!isUuid(shopId)) return reply.status(400).send({ error: "bad_id" });
    const r = await pool.query(
      `SELECT id, name_am AS "nameAm", name_en AS "nameEn",
              labor_hours AS "laborHours", labor_rate_etb AS "laborRateEtb"
         FROM canned_jobs
        WHERE shop_id = $1 AND is_active = true
        ORDER BY name_am`,
      [shopId]
    );
    return { jobs: r.rows, fx: (await import("../services/tax")).FX_CONFIG };
  });

  app.post<{ Params: { shopId: string; orderId: string } }>(
    "/v1/shops/:shopId/orders/:orderId/status",
    async (req, reply) => {
      const { shopId, orderId } = req.params;
      if (!isUuid(shopId) || !isUuid(orderId))
        return reply.status(400).send({ error: "bad_id" });
      const { to } = (req.body ?? {}) as { to?: string };
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const cur = await client.query(
          `SELECT o.status FROM orders o WHERE o.id = $1 AND o.shop_id = $2 FOR UPDATE`,
          [orderId, shopId]
        );
        if (!cur.rows[0]) {
          await client.query("ROLLBACK");
          return reply.status(404).send({ error: "order_not_found" });
        }
        const from = cur.rows[0].status;
        if (!ADVANCE[from]?.includes(to ?? "")) {
          await client.query("ROLLBACK");
          return reply
            .status(409)
            .send({ error: "bad_transition", from, to: to ?? null });
        }
        const upd = await client.query(
          `UPDATE orders SET status = $1 WHERE id = $2 AND shop_id = $3 AND status = $4 RETURNING status`,
          [to, orderId, shopId, from]
        );
        await client.query(
          `INSERT INTO audit_log (shop_id, action, entity, entity_id, channel, before, after)
           VALUES ($1, 'order_status_changed', 'orders', $2, 'app', $3, $4)`,
          [shopId, orderId, JSON.stringify({ status: from }), JSON.stringify({ status: to })]
        );
        await client.query("COMMIT");
        return reply.send({ ok: true, status: upd.rows[0].status });
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    }
  );
}
