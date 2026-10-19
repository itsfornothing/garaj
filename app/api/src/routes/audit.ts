import type { FastifyInstance } from "fastify";
import { pool } from "../db";
import { isUuid } from "../services/validate";

export default async function auditRoutes(app: FastifyInstance) {
  // Audit trail across the shop (nav "Audit" section reads this).
  app.get<{ Params: { shopId: string } }>(
    "/v1/shops/:shopId/audit",
    async (req, reply) => {
      const { shopId } = req.params;
      if (!isUuid(shopId)) return reply.status(400).send({ error: "bad_id" });
      const r = await pool.query(
        `SELECT id, created_at AS "at", actor_user_id AS "actorUserId",
                action, entity AS "refType", entity_id AS "refId",
                before, after, channel
           FROM audit_log
          WHERE shop_id = $1
          ORDER BY created_at DESC
          LIMIT 60`,
        [shopId]
      );
      return { entries: r.rows };
    }
  );
}
