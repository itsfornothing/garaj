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
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
