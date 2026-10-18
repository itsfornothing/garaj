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

// FX for imported parts — PROVISIONAL desk rate, refresh manually until a
// rate table lands in G4. marginPct = default markup on foreign-currency cost.
const FX_CONFIG = {
  rates: { USD: 138.0, CNY: 19.2, ETB: 1 },
  markupPct: 20,
  asOf: "2026-10 (provisional desk rate)",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Ethiopian calendar year (task: Hamle 1 fiscal boundary pending Spike 5 —
// until then invoice sequences use calendar-year ET, Meskerem 1 ≈ Sep 11).
function ethiopianYear(d: Date): number {
  const gy = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return m > 9 || (m === 9 && day >= 11) ? gy - 7 : gy - 8;
}

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
  const r = await pool.query(
    `SELECT id, name_am AS "nameAm", name_en AS "nameEn",
            labor_hours AS "laborHours", labor_rate_etb AS "laborRateEtb"
       FROM canned_jobs
      WHERE shop_id = $1 AND is_active = true
      ORDER BY name_am`,
    [shopId]
  );
  return { jobs: r.rows, fx: FX_CONFIG };
});

const isUuid = (s: string | undefined) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// G3 intake, step 1: plate/phone/name search across this shop's vehicles+customers.
app.get<{ Params: { shopId: string }; Querystring: { q?: string } }>(
  "/v1/shops/:shopId/vehicles",
  async (req, reply) => {
    const { shopId } = req.params;
    const q = (req.query.q ?? "").trim();
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
app.post<{ Params: { shopId: string } }>("/v1/shops/:shopId/intake", async (req, reply) => {
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
            [shopId, body.phone, body.customerNameAm]
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
      const FUELS = ["petrol", "diesel", "lpg", "bev", "hev", "phev", "other"];
      if (!FUELS.includes(body.fuelType ?? "")) {
        await client.query("ROLLBACK");
        return reply.status(400).send({ error: "fuel_type_required" });
      }
      const v = await client.query(
        `INSERT INTO vehicles (shop_id, customer_id, make, model, plate_number, fuel_type)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [shopId, customerId, body.make, body.model, body.plate?.trim() || null, body.fuelType]
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
      [shopId, customerId, vehicleId, body.notesAm?.trim() || null, body.odometerIn ?? null]
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

// Order-scoped estimate: operator builds/updates the draft from canned jobs +
// parts (server-side FX for imported parts). Each save creates a new immutable
// revision; the previous version (if sent/approved) is left untouched so any
// already-shared customer link stays valid.
app.post<{ Params: { shopId: string; orderId: string } }>(
  "/v1/shops/:shopId/orders/:orderId/estimate",
  async (req, reply) => {
    const { shopId, orderId } = req.params;
    const body = (req.body ?? {}) as {
      services?: {
        cannedJobId?: string;
        nameAm?: string;
        laborHours?: number;
        laborRateEtb?: number;
      }[];
      parts?: {
        nameAm: string;
        nameEn?: string;
        qty?: number;
        costOriginal: number;
        currency: string;
        markupPct?: number;
      }[];
    };
    if (!body.services?.length && !body.parts?.length) {
      return reply.status(400).send({ error: "lines_required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const o = await client.query(
        "SELECT status FROM orders WHERE id = $1 AND shop_id = $2",
        [orderId, shopId]
      );
      if (!o.rows[0]) {
        await client.query("ROLLBACK");
        return reply.status(404).send({ error: "order_not_found" });
      }
      const allowed = ["received", "inspection", "estimate_sent", "estimate_declined"];
      if (!allowed.includes(o.rows[0].status)) {
        await client.query("ROLLBACK");
        return reply
          .status(409)
          .send({ error: "order_locked", status: o.rows[0].status });
      }

      const regime = await client.query("SELECT tax_regime FROM shops WHERE id = $1", [shopId]);
      const taxRegime = regime.rows[0].tax_regime;

      const lines: { line_kind: string; name_am: string; name_en: string | null; qty: number; unitPriceEtb: number; tax_kind: string }[] = [];

      for (const s of body.services ?? []) {
        if (s.cannedJobId) {
          const job = await client.query(
            `SELECT name_am, name_en, labor_hours, labor_rate_etb
               FROM canned_jobs WHERE id = $1 AND shop_id = $2 AND is_active = true`,
            [s.cannedJobId, shopId]
          );
          if (!job.rows[0]) {
            await client.query("ROLLBACK");
            return reply.status(404).send({ error: "job_not_found" });
          }
          const j = job.rows[0];
          lines.push({
            line_kind: "service",
            name_am: j.name_am,
            name_en: j.name_en,
            qty: 1,
            unitPriceEtb: round2(Number(j.labor_hours) * Number(j.labor_rate_etb)),
            tax_kind: "labor",
          });
        } else {
          if (!s.nameAm || !s.laborHours || !s.laborRateEtb) {
            await client.query("ROLLBACK");
            return reply.status(400).send({ error: "service_incomplete" });
          }
          lines.push({
            line_kind: "service",
            name_am: s.nameAm,
            name_en: null,
            qty: 1,
            unitPriceEtb: round2(s.laborHours * s.laborRateEtb),
            tax_kind: "labor",
          });
        }
      }

      for (const p of body.parts ?? []) {
        const fx = FX_CONFIG.rates[p.currency as keyof typeof FX_CONFIG.rates];
        if (!fx || !(p.costOriginal > 0) || !p.nameAm) {
          await client.query("ROLLBACK");
          return reply.status(400).send({ error: "part_incomplete" });
        }
        const markup = Math.min(Math.max(p.markupPct ?? FX_CONFIG.markupPct, 0), 100);
        const costEtb = round2(p.costOriginal * fx * (1 + markup / 100));
        lines.push({
          line_kind: "part",
          name_am: p.nameAm,
          name_en: p.nameEn ?? null,
          qty: p.qty ?? 1,
          unitPriceEtb: costEtb,
          tax_kind: "part",
        });
      }

      // Estimate row + next revision
      const est = await client.query(
        `SELECT id, current_version_id FROM estimates WHERE order_id = $1 AND shop_id = $2 FOR UPDATE`,
        [orderId, shopId]
      );
      let estimateId: string;
      if (!est.rows[0]) {
        const ins = await client.query(
          `INSERT INTO estimates (order_id, shop_id) VALUES ($1, $2) RETURNING id`,
          [orderId, shopId]
        );
        estimateId = ins.rows[0].id;
      } else {
        estimateId = est.rows[0].id;
      }
      const rev = await client.query(
        `SELECT COALESCE(MAX(revision), 0) + 1 AS next FROM estimate_versions WHERE estimate_id = $1 AND shop_id = $2`,
        [estimateId, shopId]
      );
      const nextRevision = rev.rows[0].next;

      const totals = computeTotals(
        lines.map((l) => ({
          qty: String(l.qty),
          unitPriceEtb: String(l.unitPriceEtb),
          taxKind: l.tax_kind,
        })),
        taxRegime
      );

      const v = await client.query(
        `INSERT INTO estimate_versions
           (estimate_id, shop_id, revision, status, subtotal_etb, tax_etb, tax_type, total_etb)
         VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7)
         RETURNING id`,
        [estimateId, shopId, nextRevision, totals.subtotalEtb, totals.taxEtb, totals.taxType, totals.totalEtb]
      );
      const versionId = v.rows[0].id;

      for (const l of lines) {
        await client.query(
          `INSERT INTO estimate_lines
             (version_id, shop_id, line_kind, name_am, name_en, qty, unit_price_etb, tax_kind)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [versionId, shopId, l.line_kind, l.name_am, l.name_en, l.qty, l.unitPriceEtb, l.tax_kind]
        );
      }

      await client.query(
        `UPDATE estimates SET current_version_id = $1 WHERE id = $2 AND shop_id = $3`,
        [versionId, estimateId, shopId]
      );
      await client.query(
        `INSERT INTO audit_log (shop_id, action, entity, entity_id, channel, after)
         VALUES ($1, 'estimate_drafted', 'estimate_versions', $2, 'app', $3)`,
        [shopId, versionId, JSON.stringify({ revision: nextRevision, total: totals.totalEtb })]
      );

      await client.query("COMMIT");
      return reply.status(201).send({
        versionId,
        revision: nextRevision,
        status: "draft",
        ...totals,
        lineCount: lines.length,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
);

// Send the order's estimate: a draft version goes out as-is; otherwise the
// current lines are copied into a fresh immutable revision (a "resend" — the
// previous link keeps working; new link gets a fresh token).
app.post<{ Params: { shopId: string; orderId: string } }>(
  "/v1/shops/:shopId/orders/:orderId/estimate/send",
  async (req, reply) => {
    const { shopId, orderId } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const est = await client.query(
        `SELECT e.id, e.current_version_id
           FROM estimates e WHERE e.order_id = $1 AND e.shop_id = $2 FOR UPDATE`,
        [orderId, shopId]
      );
      if (!est.rows[0]) {
        await client.query("ROLLBACK");
        return reply.status(404).send({ error: "no_estimate" });
      }
      const { id: estimateId, current_version_id: currentVersionId } = est.rows[0];

      const regime = await client.query("SELECT tax_regime FROM shops WHERE id = $1", [shopId]);
      const taxRegime = regime.rows[0].tax_regime;

      const cur = await client.query(
        `SELECT id, status, revision FROM estimate_versions WHERE id = $1 AND shop_id = $2`,
        [currentVersionId, shopId]
      );
      if (!cur.rows[0]) {
        await client.query("ROLLBACK");
        return reply.status(409).send({ error: "empty_estimate" });
      }
      const isDraft = cur.rows[0].status === "draft";
      const curRevision = cur.rows[0].revision;
      const fromVersion = cur.rows[0].id;
      const rev = await client.query(
        `SELECT COALESCE(MAX(revision), 0) + 1 AS next FROM estimate_versions WHERE estimate_id = $1 AND shop_id = $2`,
        [estimateId, shopId]
      );
      const nextRevision = rev.rows[0].next;

      if (isDraft) {
        const rawToken = randomBytes(32).toString("base64url");
        const upd = await client.query(
          `UPDATE estimate_versions
              SET status = 'sent', sent_at = now(),
                  token_expires_at = now() + interval '${TOKEN_TTL}',
                  approval_token_hash = $1, token_used_at = NULL
            WHERE id = $2 AND shop_id = $3 AND status = 'draft'
           RETURNING token_expires_at AS "expiresAt"`,
          [hashToken(rawToken), fromVersion, shopId]
        );
        if (!upd.rows[0]) {
          await client.query("ROLLBACK");
          return reply.status(409).send({ error: "estimate_not_draft" });
        }
        await client.query(
          `UPDATE estimates SET status = 'sent' WHERE id = $1 AND shop_id = $2`,
          [estimateId, shopId]
        );
        await client.query(
          `UPDATE orders SET status = 'estimate_sent' WHERE id = $1 AND shop_id = $2`,
          [orderId, shopId]
        );
        await client.query(
          `INSERT INTO audit_log (shop_id, action, entity, entity_id, channel, after)
           VALUES ($1, 'estimate_sent', 'estimate_versions', $2, 'app', $3)`,
          [shopId, fromVersion, JSON.stringify({ revision: curRevision })]
        );
        await client.query("COMMIT");
        return reply.send({
          token: rawToken,
          versionId: fromVersion,
          expiryHours: 72,
        });
      }

      // Resend: copy current lines into a fresh immutable revision + fresh token.
      const oldLines = await client.query(
        `SELECT qty, unit_price_etb AS "unitPriceEtb", tax_kind
           FROM estimate_lines WHERE version_id = $1 AND shop_id = $2`,
        [fromVersion, shopId]
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
        [versionId, fromVersion, shopId]
      );
      await client.query(
        `UPDATE estimates SET current_version_id = $1, status = 'sent' WHERE id = $2 AND shop_id = $3`,
        [versionId, estimateId, shopId]
      );
      await client.query(
        `UPDATE orders SET status = 'estimate_sent' WHERE id = $1 AND shop_id = $2`,
        [orderId, shopId]
      );
      await client.query(
        `INSERT INTO audit_log (shop_id, action, entity, entity_id, channel, after)
         VALUES ($1, 'estimate_sent', 'estimate_versions', $2, 'app', $3)`,
        [shopId, versionId, JSON.stringify({ revision: nextRevision, totals })]
      );
      await client.query("COMMIT");
      return reply.send({
        token: rawToken,
        versionId,
        revision: nextRevision,
        expiresAt: ins.rows[0].expiresAt,
      });
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

// ---------------------------------------------------------------------------
// G3 operator flow: status machine, invoices (Ethiopian fiscal-year numbering),
// payments. All transitions are optimistic (status in WHERE) + audited.
// ---------------------------------------------------------------------------

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

app.post<{ Params: { shopId: string; orderId: string } }>(
  "/v1/shops/:shopId/orders/:orderId/status",
  async (req, reply) => {
    const { shopId, orderId } = req.params;
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

// Issue invoice from the APPROVED estimate version. Ethiopian fiscal-year
// sequence guarded by a transaction-scoped advisory lock (§4a pattern).
app.post<{ Params: { shopId: string; orderId: string } }>(
  "/v1/shops/:shopId/orders/:orderId/invoice",
  async (req, reply) => {
    const { shopId, orderId } = req.params;
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

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
