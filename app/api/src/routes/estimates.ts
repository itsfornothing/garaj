import type { FastifyInstance } from "fastify";
import { pool, type DbClient } from "../db";
import { hashToken, createApprovalToken } from "../services/crypto";
import { FX_CONFIG, computeTotals, round2 } from "../services/tax";
import { capStr, isUuid, MAX_LINES, MAX_LINE_IDS, numBetween } from "../services/validate";

// G2 estimate approval — token TTL / lockout policy (§6d).
const LOCKOUT_FAILS = 5;
const LOCKOUT_WINDOW = "15 minutes";
const TOKEN_TTL = "72 hours";

type LinkError = { error: string; messageAm: string };

const LINK_ERRORS: Record<string, LinkError> = {
  invalid: { error: "link_invalid", messageAm: "የማገናኛው ትክክል አይደለም።" },
  expired:
    { error: "link_expired", messageAm: "የማገናኛው ጊዜ አልቋል። ጋራዥዎን ደውለው አዲስ አገናኝ እንዲልክ ጠይቁ።" },
  locked: { error: "locked", messageAm: "ብዙ ውድቅ ሙከራዎች — ለ15 ደቂቃ ተቀናቅቧል።" },
};

// Single-source lookup: hash → version (token hash is globally UNIQUE).
async function findVersionByTokenExact(client: DbClient, rawToken: string) {
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

function linkState(v: any) {
  if (!v) return "invalid";
  if (v.status !== "sent") return "invalid";
  if (new Date(v.tokenExpiresAt) < new Date()) return "expired";
  return "ok";
}

export default async function estimateRoutes(app: FastifyInstance) {
  // Order-scoped estimate: operator builds/updates the draft from canned jobs +
  // parts (server-side FX for imported parts). Each save creates a new immutable
  // revision; the previous version (if sent/approved) is left untouched so any
  // already-shared customer link stays valid.
  app.post<{ Params: { shopId: string; orderId: string } }>(
    "/v1/shops/:shopId/orders/:orderId/estimate",
    async (req, reply) => {
      const { shopId, orderId } = req.params;
      if (!isUuid(shopId) || !isUuid(orderId))
        return reply.status(400).send({ error: "bad_id" });

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
      if ((body.services?.length ?? 0) > MAX_LINES || (body.parts?.length ?? 0) > MAX_LINES) {
        return reply.status(400).send({ error: "too_many_lines", max: MAX_LINES });
      }
      // Hardening: numeric + text caps so bad input is a clean 400, not a DB 500.
      for (const s of body.services ?? []) {
        if (s.nameAm && capStr(s.nameAm, 200) === undefined)
          return reply.status(400).send({ error: "bad_service_line" });
        if (
          s.laborHours !== undefined &&
          s.laborHours !== null &&
          numBetween(s.laborHours, 0, 1_000) === undefined
        )
          return reply.status(400).send({ error: "bad_labor_hours" });
        if (
          s.laborRateEtb !== undefined &&
          s.laborRateEtb !== null &&
          numBetween(s.laborRateEtb, -1, 10_000_000) === undefined
        )
          return reply.status(400).send({ error: "bad_labor_rate" });
      }
      for (const p of body.parts ?? []) {
        if (capStr(p.nameAm, 200) === undefined)
          return reply.status(400).send({ error: "bad_part_line" });
        if (p.nameEn !== undefined && p.nameEn !== null && capStr(p.nameEn, 200) === undefined)
          return reply.status(400).send({ error: "bad_part_line" });
        if (
          p.costOriginal === undefined ||
          p.costOriginal === null ||
          numBetween(p.costOriginal, 0, 10_000_000) === undefined
        )
          return reply.status(400).send({ error: "bad_part_cost" });
        if (p.currency && !(p.currency in FX_CONFIG.rates))
          return reply.status(400).send({ error: "bad_currency" });
        if (p.qty !== undefined && p.qty !== null && numBetween(p.qty, 0, 10_000) === undefined)
          return reply.status(400).send({ error: "bad_part_qty" });
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
      if (!isUuid(shopId) || !isUuid(orderId))
        return reply.status(400).send({ error: "bad_id" });

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
          const token = createApprovalToken();
          const upd = await client.query(
            `UPDATE estimate_versions
                SET status = 'sent', sent_at = now(),
                    token_expires_at = now() + interval '${TOKEN_TTL}',
                    approval_token_hash = $1, token_used_at = NULL
              WHERE id = $2 AND shop_id = $3 AND status = 'draft'
             RETURNING token_expires_at AS "expiresAt"`,
            [token.hash, fromVersion, shopId]
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
            token: token.raw,
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
        const token = createApprovalToken();
        const ins = await client.query(
          `INSERT INTO estimate_versions
             (estimate_id, shop_id, revision, status, sent_at, token_expires_at,
              approval_token_hash, subtotal_etb, tax_etb, tax_type, total_etb)
           VALUES ($1, $2, $3, 'sent', now(), now() + interval '${TOKEN_TTL}',
                   $4, $5, $6, $7, $8)
           RETURNING id, token_expires_at AS "expiresAt"`,
          [estimateId, shopId, nextRevision, token.hash,
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
          token: token.raw,
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
      const token = (req.query.token ?? "").slice(0, 200);
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
      const token = req.params.token.slice(0, 200);
      const body = (req.body ?? {}) as {
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
        if (body.lineIds.length > MAX_LINE_IDS || body.lineIds.some((id) => !isUuid(id))) {
          return reply.status(400).send({ error: "bad_line_ids" });
        }
        if (!["declined", "deferred", "revised_estimate_requested"].includes(body.remainderDecision ?? ""))
          return reply.status(400).send({ error: "remainder_required" });
      }
      if (body.last4 !== undefined) {
        const last4 = String(body.last4);
        if (!/^[0-9]{4}$/.test(last4)) {
          return reply.status(400).send({ error: "last4_mismatch", remaining: LOCKOUT_FAILS });
        }
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
}
