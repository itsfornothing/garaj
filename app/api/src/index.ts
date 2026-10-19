import Fastify from "fastify";
import cors from "@fastify/cors";
import { pool } from "./db";
import { rateLimit, type RateKey } from "./services/ratelimit";
import intakeRoutes from "./routes/intake";
import orderRoutes from "./routes/orders";
import estimateRoutes from "./routes/estimates";
import invoiceRoutes from "./routes/invoices";
import auditRoutes from "./routes/audit";

const app = Fastify({ logger: true });

// Browser-direct calls: client components and the mobile webview hit foreign
// origins. Reflect the request origin; no cookies exist to protect yet.
app.register(cors, { origin: true });

// Hardening pass: per-IP sliding-window limits on every surface. Sensitive
// POSTs (payment, customer decision) get the tightest budget. /healthz is exempt.
app.addHook("onRequest", async (req, reply) => {
  const url: string = (req as any).routeOptions?.url ?? req.url ?? "";
  if (url === "/healthz") return;
  let key: RateKey = "read";
  if (req.method === "POST") {
    if (url.endsWith("/intake")) key = "intake";
    else if (url.endsWith("/decide")) key = "decide";
    else if (url.endsWith("/pay")) key = "pay";
    else if (url.endsWith("/status")) key = "status";
    else key = "estimate";
  }
  if (!rateLimit(req.ip ?? "unknown", key, reply)) return reply;
});

// Shop-level reads + status machine belong with intake's domain tables;
// module split below mirrors the operator workflow.
app.register(orderRoutes);
app.register(intakeRoutes);
app.register(estimateRoutes);
app.register(invoiceRoutes);
app.register(auditRoutes);

app.get("/healthz", async () => {
  const r = await pool.query("SELECT 1 AS ok");
  return { ok: r.rows[0].ok === 1, service: "garaj-api" };
});

const port = Number(process.env.PORT ?? 8787);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
