import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";

// Layer ownership per brief §4a: this process owns authorization, transactions,
// payments, and background jobs. No business logic in edge functions.

const dbUrl =
  process.env.DATABASE_URL ?? "postgres://garaj@localhost:5433/garaj_dev";

// Hosted providers (Neon/Railway) require TLS; local .pgdev does not.
const ssl = /sslmode=(require|verify)/.test(dbUrl) ? { rejectUnauthorized: false } : false;

// Single long-running process: modest pool cap, direct connection
// (pg_try_advisory_lock in §4a cron needs a real session — no pgbouncer here).
const pool = new Pool({ connectionString: dbUrl, max: 10, ssl });
const app = Fastify({ logger: true });

// Browser-direct calls: client components and the mobile webview hit foreign
// origins. Reflect the request origin; no cookies exist to protect yet.
app.register(cors, { origin: true });

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

type Line = { qty: string; unitPriceEtb: string; taxKind: string };

function computeTotals(lines: Line[], regime: string) {
  const sub = (kind: string) =>
    lines
      .filter((l) => l.taxKind === kind)
      .reduce((s, l) => s + Number(l.qty) * Number(l.unitPriceEtb), 0);
  const subtotal = sub("labor") + sub("part");
  let tax = 0;
  let taxType = "exempt";
  if (regime === "vat_15") {
    tax = subtotal * 0.15;
    taxType = "vat_15";
  } else if (regime === "tot_10_2") {
    tax = sub("labor") * 0.1 + sub("part") * 0.02;
    taxType = "tot_10_2";
  }
  const total = subtotal + tax;
  const r2 = (n: number) => n.toFixed(2);
  return { subtotalEtb: r2(subtotal), taxEtb: r2(tax), taxType, totalEtb: r2(total) };
}

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

// ---------------------------------------------------------------------------
// G2 estimate approval — the customer link is a real 256-bit token, stored as
// SHA-256 only; raw shown once at "send" (simulating the SMS body).
// ---------------------------------------------------------------------------

const LOCKOUT_FAILS = 5;
const LOCKOUT_WINDOW = "15 minutes";
const TOKEN_TTL = "72 hours";

// Single-source lookup: hash → version (token hash is globally UNIQUE).
async function findVersionByTokenExact(client: any, rawToken: string) {
  const v = await client.query(
    `SELECT v.id, v.shop_id AS "shopId", v.status, v.token_expires_at AS "tokenExpiresAt",
            v.subtotal_etb AS "subtotalEtb", v.tax_etb AS "taxEtb", v.tax_type AS "taxType",
            v.total_etb AS "totalEtb", v.revision, v.sent_at AS "sentAt",
            e.order_id AS "orderId", e.id AS "estimateId",
            s.name AS "shopName", s.tax_regime AS "shopTaxRegime",
            o.promised_at AS "promisedAt", o.notes_am AS "orderNotes",
            c.full_name_am AS "customerNameAm", c.phone AS "customerPhone",
            ve.make, ve.model, ve.plate_number AS "plateNumber"
       FROM estimate_versions v
       JOIN estimates e    ON e.id = v.estimate_id AND e.shop_id = v.shop_id
       JOIN shops s        ON s.id = v.shop_id
       JOIN orders o       ON o.id = e.order_id AND o.shop_id = v.shop_id
       JOIN customers c    ON c.id = o.customer_id AND c.shop_id = v.shop_id
       JOIN vehicles ve    ON ve.id = o.vehicle_id AND ve.shop_id = v.shop_id
      WHERE v.approval_token_hash = $1
      LIMIT 1`,
    [hashToken(rawToken)]
  );
  return v.rows[0];
}

const LINK_ERRORS = {
  invalid: { error: "link_invalid", messageAm: "የማገናኛው ትክክል አይደለም።" },
  expired: { error: "link_expired", messageAm: "የማገናኛው ጊዜ አልቋል። ጋራዥዎን ደውለው አዲስ አገናኝ እንዲልክ ጠይቁ።" },
  locked: { error: "locked", messageAm: "ብዙ ውድቅ ሙከራዎች — ለ15 ደቂቃ ተቀናቅቧል።" },
} as const;

function linkState(v: any) {
  if (!v) return "invalid";
  if (v.status !== "sent") return "invalid";
  if (new Date(v.tokenExpiresAt) < new Date()) return "expired";
  return "ok";
}

app.post<{ Params: { shopId: string } }>(
  "/v1/shops/:shopId/estimate-demo/send",
  async (req, reply) => {
    const { shopId } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Pick the shop's most recent order that has an estimate.
      const est = await client.query(
        `SELECT e.id, e.current_version_id
           FROM estimates e
           JOIN orders o ON o.id = e.order_id AND o.shop_id = e.shop_id
          WHERE e.shop_id = $1
          ORDER BY o.intake_at DESC
          LIMIT 1
         FOR UPDATE OF e`,
        [shopId]
      );
      if (!est.rows[0]) {
        await client.query("ROLLBACK");
        return reply.status(404).send({ error: "no_estimate" });
      }
      const { id: estimateId, current_version_id: oldVersionId } = est.rows[0];

      const regime = await client.query(
        "SELECT tax_regime FROM shops WHERE id = $1",
        [shopId]
      );
      const taxRegime = regime.rows[0].tax_regime;

      // New immutable revision: fresh lines copied from the previous version.
      const rev = await client.query(
        `SELECT COALESCE(MAX(revision), 0) + 1 AS next FROM estimate_versions WHERE estimate_id = $1 AND shop_id = $2`,
        [estimateId, shopId]
      );
      const nextRevision = rev.rows[0].next;

      const oldLines = await client.query(
        `SELECT qty, unit_price_etb AS "unitPriceEtb", tax_kind FROM estimate_lines WHERE version_id = $1 AND shop_id = $2`,
        [oldVersionId, shopId]
      );
      if (!oldLines.rows.length) {
        await client.query("ROLLBACK");
        return reply.status(409).send({ error: "empty_estimate" });
      }
      const totals = computeTotals(oldLines.rows, taxRegime);

      const rawToken = randomBytes(32).toString("base64url");
      const ins = await client.query(
        `INSERT INTO estimate_versions
           (estimate_id, shop_id, revision, status, sent_at, token_expires_at,
            approval_token_hash, subtotal_etb, tax_etb, tax_type, total_etb)
         VALUES ($1, $2, $3, 'sent', now(), now() + interval '${TOKEN_TTL}',
                 $4, $5, $6, $7, $8)
         RETURNING id, token_expires_at AS "expiresAt"`,
        [estimateId, shopId, nextRevision, hashToken(rawToken),
         totals.subtotalEtb, totals.taxEtb, totals.taxType, totals.totalEtb]
      );
      const versionId = ins.rows[0].id;

      await client.query(
        `INSERT INTO estimate_lines
           (version_id, shop_id, line_kind, name_am, name_en, qty,
            unit_price_etb, tax_kind, source_order_service_id, source_order_part_id)
         SELECT $1, shop_id, line_kind, name_am, name_en, qty,
                unit_price_etb, tax_kind, source_order_service_id, source_order_part_id
           FROM estimate_lines
          WHERE version_id = $2 AND shop_id = $3`,
        [versionId, oldVersionId, shopId]
      );

      await client.query(
        `UPDATE estimates SET current_version_id = $1, status = 'sent' WHERE id = $2 AND shop_id = $3`,
        [versionId, estimateId, shopId]
      );
      await client.query(
        `UPDATE orders SET status = 'estimate_sent'
          WHERE id = (SELECT order_id FROM estimates WHERE id = $1 AND shop_id = $2) AND shop_id = $2`,
        [estimateId, shopId]
      );

      await client.query(
        `INSERT INTO audit_log (shop_id, action, entity, entity_id, channel, after)
         VALUES ($1, 'estimate_sent', 'estimate_versions', $2, 'app', $3)`,
        [shopId, versionId, JSON.stringify({ revision: nextRevision, totals })]
      );

      await client.query("COMMIT");
      // Raw token returned exactly once — this string is what the SMS carries.
      return reply.send({ token: rawToken, versionId, expiresAt: ins.rows[0].expiresAt, revision: nextRevision });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
);

app.get<{ Params: { shopId: string }; Querystring: { token?: string } }>(
  "/v1/shops/:shopId/estimate-demo",
  async (req, reply) => {
    const { shopId } = req.params;
    const { token } = req.query;
    if (!token) {
      return reply.status(403).send({
        ...LINK_ERRORS.invalid,
        hint: "customer links carry ?token= (POST /send returns it once)",
      });
    }
    const client = await pool.connect();
    try {
      const v = await findVersionByTokenExact(client, token);
      const state = linkState(v);
      if (state !== "ok") {
        return reply
          .status(state === "expired" ? 410 : 403)
          .send(LINK_ERRORS[state]);
      }
      if (v.shopId !== shopId) {
        return reply.status(403).send(LINK_ERRORS.invalid);
      }
      const lines = await client.query(
        `SELECT id, line_kind AS kind, name_am AS "nameAm", name_en AS "nameEn",
                qty, unit_price_etb AS "unitPriceEtb"
           FROM estimate_lines
          WHERE version_id = $1 AND shop_id = $2
          ORDER BY created_at, id`,
        [v.id, v.shopId]
      );
      return reply.send({ ...v, lines: lines.rows });
    } finally {
      client.release();
    }
  }
);

app.post<{ Params: { token: string } }>(
  "/v1/estimate-links/:token/decide",
  async (req, reply) => {
    const { token } = req.params;
    const body = req.body as {
      decision?: string;
      lineIds?: string[];
      remainderDecision?: string;
      last4?: string;
    };
    const decision = body.decision;
    if (!["approved_all", "approved_lines", "declined"].includes(decision ?? "")) {
      return reply.status(400).send({ error: "bad_decision" });
    }
    if (decision === "approved_lines") {
      if (!body.lineIds?.length)
        return reply.status(400).send({ error: "lines_required" });
      if (!["declined", "deferred", "revised_estimate_requested"].includes(body.remainderDecision ?? ""))
        return reply.status(400).send({ error: "remainder_required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const v = await findVersionByTokenExact(client, token);
      const state = linkState(v);
      if (state !== "ok") {
        await client.query("ROLLBACK");
        return reply
          .status(state === "expired" ? 410 : 403)
          .send(LINK_ERRORS[state]);
      }

      // Server-side lockout on token+shop (§6d): repeated failed verifications
      // block the link regardless of who holds it.
      const fails = await client.query(
        `SELECT COUNT(*)::int AS n FROM audit_log
          WHERE action = 'approval_last4_fail'
            AND entity = 'estimate_versions' AND entity_id = $1
            AND created_at > now() - interval '${LOCKOUT_WINDOW}'`,
        [v.id]
      );
      if (fails.rows[0].n >= LOCKOUT_FAILS) {
        await client.query("ROLLBACK");
        return reply.status(429).send(LINK_ERRORS.locked);
      }

      const ok4 = body.last4 === String(v.customerPhone).slice(-4);
      if (!ok4) {
        await client.query(
          `INSERT INTO audit_log (shop_id, action, entity, entity_id, channel, before)
           VALUES ($1, 'approval_last4_fail', 'estimate_versions', $2, 'sms_link', $3)`,
          [v.shopId, v.id, JSON.stringify({ decision })]
        );
        await client.query("COMMIT");
        return reply.status(400).send({
          error: "last4_mismatch",
          messageAm: "የስልክ ቁጥርዎ የመጨረሻዎቹ 4 አይመስሉም።",
          remaining: LOCKOUT_FAILS - fails.rows[0].n - 1,
        });
      }

      // Optimistic state flip with row lock: only a still-'sent' version approves.
      const upd = await client.query(
        `UPDATE estimate_versions
            SET status = $1
          WHERE id = $2 AND shop_id = $3 AND status = 'sent'
         RETURNING id`,
        [decision === "declined" ? "declined" : "approved", v.id, v.shopId]
      );
      if (!upd.rows[0]) {
        await client.query("ROLLBACK");
        return reply.status(409).send({ error: "already_decided" });
      }

      let approvalId: string;
      if (decision === "approved_lines") {
        const owned = await client.query(
          `SELECT id FROM estimate_lines
            WHERE version_id = $1 AND shop_id = $2 AND id = ANY($3::uuid[])`,
          [v.id, v.shopId, body.lineIds]
        );
        if (owned.rows.length !== body.lineIds!.length) {
          await client.query("ROLLBACK");
          return reply.status(400).send({ error: "line_not_in_estimate" });
        }
        const a = await client.query(
          `INSERT INTO estimate_approvals
             (version_id, shop_id, decision, remainder_decision, approver_phone,
              approver_channel, confirmed_last4, token_hash)
           VALUES ($1, $2, 'approved_lines', $3, $4, 'sms_link', true, $5)
           RETURNING id`,
          [v.id, v.shopId, body.remainderDecision, v.customerPhone, hashToken(token)]
        );
        approvalId = a.rows[0].id;
        await client.query(
          `INSERT INTO estimate_approval_lines (approval_id, estimate_line_id, shop_id)
           SELECT $1, x, $2 FROM unnest($3::uuid[]) AS x`,
          [approvalId, v.shopId, body.lineIds]
        );
      } else {
        const a = await client.query(
          `INSERT INTO estimate_approvals
             (version_id, shop_id, decision, approver_phone, approver_channel,
              confirmed_last4, token_hash)
           VALUES ($1, $2, $3, $4, 'sms_link', true, $5)
           RETURNING id`,
          [v.id, v.shopId, decision, v.customerPhone, hashToken(token)]
        );
        approvalId = a.rows[0].id;
      }

      // Order machine: approval → approved; decline → estimate_declined (§6a).
      const orderUpd = decision === "declined" ? "estimate_declined" : "approved";
      await client.query(
        `UPDATE orders SET status = $1
          WHERE id = $2 AND shop_id = $3 AND status = 'estimate_sent'`,
        [orderUpd, v.orderId, v.shopId]
      );

      await client.query(
        `INSERT INTO audit_log (shop_id, action, entity, entity_id, channel, after)
         VALUES ($1, 'approval_recorded', 'estimate_versions', $2, 'sms_link', $3)`,
        [v.shopId, v.id, JSON.stringify({ decision, approvalId })]
      );

      await client.query("COMMIT");
      return reply.send({
        ok: true,
        decision,
        versionId: v.id,
        approvedCount:
          decision === "approved_lines" ? body.lineIds!.length : undefined,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
);

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
