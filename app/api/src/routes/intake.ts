import type { FastifyInstance } from "fastify";
import { pool } from "../db";
import { capStr, isPhone, isUuid, numBetween } from "../services/validate";

const FUELS = ["petrol", "diesel", "lpg", "bev", "hev", "phev", "other"];

export default async function intakeRoutes(app: FastifyInstance) {
  // G3 intake, step 1: plate/phone/name search across this shop's vehicles+customers.
  app.get<{ Params: { shopId: string }; Querystring: { q?: string } }>(
    "/v1/shops/:shopId/vehicles",
    async (req, reply) => {
      const { shopId } = req.params;
      const q = (req.query.q ?? "").trim().slice(0, 64);
      if (!isUuid(shopId)) return reply.status(400).send({ error: "bad_id" });
      if (q.length < 2) return { results: [] };
      const like = "%" + q.replace(/[%_\\]/g, "\\$&") + "%";
      const r = await pool.query(
        `SELECT v.id, v.make, v.model, v.plate_number AS "plateNumber",
                v.customer_id AS "customerId",
                c.full_name_am AS "customerNameAm", c.phone AS "customerPhone",
                c.consent_given AS "consentGiven"
           FROM vehicles v
           JOIN customers c ON c.id = v.customer_id AND c.shop_id = v.shop_id
          WHERE v.shop_id = $1
            AND (v.plate_number ILIKE $2 OR c.phone LIKE $2 OR c.name_key ILIKE $2)
          ORDER BY (v.plate_number IS NULL), v.plate_number, c.full_name_am
          LIMIT 8`,
        [shopId, like]
      );
      return { results: r.rows };
    }
  );

  // G3 intake, step 2: create the order. Consent is a hard requirement — it seeds
  // customers.consent_given/at (§??: approval links and records depend on it).
  app.post<{ Params: { shopId: string } }>(
    "/v1/shops/:shopId/intake",
    async (req, reply) => {
      const { shopId } = req.params;
      const body = (req.body ?? {}) as {
        vehicleId?: string;
        customerId?: string;
        plate?: string;
        make?: string;
        model?: string;
        fuelType?: string;
        phone?: string;
        customerNameAm?: string;
        consent?: boolean;
        notesAm?: string;
        odometerIn?: number;
      };
      if (!isUuid(shopId)) return reply.status(400).send({ error: "bad_id" });
      if (body.consent !== true) {
        return reply.status(400).send({
          error: "consent_required",
          messageAm: "የደንበኛ ፍቃድ ማረጋገጥ አስፈላጊ ነው።",
        });
      }

      // Hardening: caps on free-text fields (oversized input now a clean 400).
      const overLimit = (v: unknown, max: number) =>
        typeof v === "string" && v.trim().length > max;
      if (overLimit(body.plate, 32)) return reply.status(400).send({ error: "plate_too_long" });
      if (overLimit(body.make, 60)) return reply.status(400).send({ error: "make_too_long" });
      if (overLimit(body.model, 60)) return reply.status(400).send({ error: "model_too_long" });
      if (overLimit(body.customerNameAm, 120))
        return reply.status(400).send({ error: "customer_name_too_long" });
      if (overLimit(body.notesAm, 1000))
        return reply.status(400).send({ error: "notes_too_long" });
      if (
        body.odometerIn !== undefined &&
        body.odometerIn !== null &&
        numBetween(body.odometerIn, 0, 2_000_000) === undefined
      ) {
        return reply.status(400).send({ error: "bad_odometer" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let customerId: string;
        let vehicleId: string | null = null;

        if (body.vehicleId) {
          if (!isUuid(body.vehicleId)) {
            await client.query("ROLLBACK");
            return reply.status(400).send({ error: "bad_id" });
          }
          const v = await client.query(
            "SELECT id, customer_id FROM vehicles WHERE id = $1 AND shop_id = $2",
            [body.vehicleId, shopId]
          );
          if (!v.rows[0]) {
            await client.query("ROLLBACK");
            return reply.status(404).send({ error: "vehicle_not_found" });
          }
          vehicleId = v.rows[0].id;
          customerId = v.rows[0].customer_id;
          if (body.customerId && body.customerId !== customerId) {
            await client.query("ROLLBACK");
            return reply.status(400).send({ error: "customer_vehicle_mismatch" });
          }
        } else {
          // New vehicle: resolve the customer by explicit id or by phone find-or-create.
          if (body.customerId) {
            const c = await client.query(
              "SELECT id FROM customers WHERE id = $1 AND shop_id = $2",
              [body.customerId, shopId]
            );
            if (!c.rows[0]) {
              await client.query("ROLLBACK");
              return reply.status(404).send({ error: "customer_not_found" });
            }
            customerId = c.rows[0].id;
          } else {
            if (!body.phone || !body.customerNameAm) {
              await client.query("ROLLBACK");
              return reply.status(400).send({
                error: "customer_required",
                messageAm: "የደንበኛው ስልክ ቁጥር እና ሙሉ ስም ያስፈልጋሉ።",
              });
            }
            if (!isPhone(body.phone)) {
              await client.query("ROLLBACK");
              return reply.status(400).send({ error: "bad_phone" });
            }
            const c = await client.query(
              `SELECT id FROM customers WHERE shop_id = $1 AND phone = $2 FOR UPDATE`,
              [shopId, body.phone]
            );
            if (c.rows[0]) {
              customerId = c.rows[0].id;
            } else {
              const ins = await client.query(
                `INSERT INTO customers (shop_id, phone, full_name_am, consent_given, consent_at)
                 VALUES ($1, $2, $3, true, now()) RETURNING id`,
                [shopId, body.phone, body.customerNameAm.trim().slice(0, 120)]
              );
              customerId = ins.rows[0].id;
            }
          }
          if (!body.make || !body.model) {
            await client.query("ROLLBACK");
            return reply.status(400).send({
              error: "vehicle_required",
              messageAm: "የተሽከርካሪው ዘመን (make) እና ሞዴል ያስፈልጋሉ።",
            });
          }
          if (!FUELS.includes(body.fuelType ?? "")) {
            await client.query("ROLLBACK");
            return reply.status(400).send({ error: "fuel_type_required" });
          }
          const v = await client.query(
            `INSERT INTO vehicles (shop_id, customer_id, make, model, plate_number, fuel_type)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [
              shopId,
              customerId,
              body.make.trim().slice(0, 60),
              body.model.trim().slice(0, 60),
              body.plate?.trim().slice(0, 32) || null,
              body.fuelType,
            ]
          );
          vehicleId = v.rows[0].id;
        }

        // Consent provenance: stamp only customers who haven't consented yet.
        await client.query(
          `UPDATE customers SET consent_given = true, consent_at = now()
            WHERE id = $1 AND shop_id = $2 AND consent_given = false`,
          [customerId, shopId]
        );

        const o = await client.query(
          `INSERT INTO orders (shop_id, customer_id, vehicle_id, notes_am, odometer_in)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [
            shopId,
            customerId,
            vehicleId,
            body.notesAm?.trim().slice(0, 1000) || null,
            body.odometerIn ?? null,
          ]
        );
        const orderId = o.rows[0].id;

        await client.query(
          `INSERT INTO audit_log (shop_id, action, entity, entity_id, channel, after)
           VALUES ($1, 'order_intake', 'orders', $2, 'app', $3)`,
          [shopId, orderId, JSON.stringify({ vehicleId, customerId, consent: true })]
        );

        await client.query("COMMIT");

        const row = await client.query(
          `SELECT o.id, o.status, o.intake_at AS "intakeAt",
                  c.full_name_am AS "customerNameAm", c.phone AS "customerPhone",
                  v.make, v.model, v.plate_number AS "plateNumber"
             FROM orders o
             JOIN customers c ON c.id = o.customer_id AND c.shop_id = o.shop_id
             JOIN vehicles v  ON v.id = o.vehicle_id  AND v.shop_id = o.shop_id
            WHERE o.id = $1 AND o.shop_id = $2`,
          [orderId, shopId]
        );
        return reply.status(201).send(row.rows[0]);
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    }
  );
}
