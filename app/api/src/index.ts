import Fastify from "fastify";
import { Pool } from "pg";

// Layer ownership per brief §4a: this process owns authorization, transactions,
// payments, and background jobs. No business logic in edge functions.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = Fastify({ logger: true });

app.get("/healthz", async () => {
  const r = await pool.query("SELECT 1 AS ok");
  return { ok: r.rows[0].ok === 1, service: "garaj-api" };
});

app.get("/v1/shops", async () => {
  const r = await pool.query(
    'SELECT id, name, shop_type AS "shopType", tax_regime AS "taxRegime", plan, city FROM shops ORDER BY name'
  );
  return { shops: r.rows };
});

app.get<{ Params: { shopId: string } }>("/v1/shops/:shopId/orders", async (req, reply) => {
  const { shopId } = req.params;
  const r = await pool.query(
    `SELECT o.id, o.status, o.intake_at AS "intakeAt", o.promised_at AS "promisedAt",
            c.full_name_am AS "customerNameAm", c.phone AS "customerPhone",
            v.make, v.model, v.plate_number AS "plateNumber"
       FROM orders o
       JOIN customers c ON c.id = o.customer_id AND c.shop_id = o.shop_id
       JOIN vehicles v  ON v.id = o.vehicle_id  AND v.shop_id = o.shop_id
      WHERE o.shop_id = $1
      ORDER BY o.intake_at DESC`,
    [shopId]
  );
  // Tenant binding note (§4b): every join/relation is shop-scoped; composite FKs make
  // cross-shop rows impossible. Authorization middleware lands with real auth (G3).
  return { orders: r.rows };
});

const port = Number(process.env.PORT ?? 8787);

app.get<{ Params: { shopId: string } }>(
  "/v1/shops/:shopId/estimate-demo",
  async (req, reply) => {
    const { shopId } = req.params;
    const shop = await pool.query(
      `SELECT id, name, tax_regime AS "taxRegime" FROM shops WHERE id = $1`,
      [shopId]
    );
    if (!shop.rows[0]) return reply.status(404).send({ error: "shop_not_found" });

    const head = await pool.query(
      `SELECT v.id AS "versionId", v.revision, v.status, v.sent_at AS "sentAt",
              v.token_expires_at AS "tokenExpiresAt", v.subtotal_etb AS "subtotalEtb",
              v.tax_etb AS "taxEtb", v.tax_type AS "taxType", v.total_etb AS "totalEtb",
              o.id AS "orderId", o.promised_at AS "promisedAt", o.notes_am AS "orderNotes",
              c.full_name_am AS "customerNameAm", c.phone AS "customerPhone",
              v2.make, v2.model, v2.plate_number AS "plateNumber",
              s.name AS "shopName", s.tax_regime AS "shopTaxRegime"
         FROM estimates e
         JOIN estimate_versions v  ON v.id = e.current_version_id AND v.shop_id = e.shop_id
         JOIN orders o             ON o.id = e.order_id AND o.shop_id = e.shop_id
         JOIN customers c          ON c.id = o.customer_id AND c.shop_id = o.shop_id
         JOIN vehicles v2          ON v2.id = o.vehicle_id AND v2.shop_id = o.shop_id
         JOIN shops s              ON s.id = e.shop_id
        WHERE e.shop_id = $1 AND v.status = 'sent'
        LIMIT 1`,
      [shopId]
    );
    if (!head.rows[0])
      return reply
        .status(404)
        .send({ error: "no_sent_estimate", hint: "demo seeds: shop a1 has the sent estimate" });

    const versionId = head.rows[0].versionId;
    const lines = await pool.query(
      `SELECT id, line_kind AS kind, name_am AS "nameAm", name_en AS "nameEn",
              qty, unit_price_etb AS "unitPriceEtb"
         FROM estimate_lines
        WHERE version_id = $1 AND shop_id = $2
        ORDER BY created_at, id`,
      [versionId, shopId]
    );
    // Demo exposes the link exactly as a customer received it via SMS (§6d):
    // server-side approve/decline endpoint + token lockout lands in G2.
    return reply.send({ ...head.rows[0], lines: lines.rows });
  }
);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
