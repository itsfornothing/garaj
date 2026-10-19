import { randomBytes } from "node:crypto";
import type { FastifyReply } from "fastify";

// Lightweight in-memory sliding-window rate limiter (single-process demo).
// Buckets key on client IP + logical group so one hammering client can't starve
// unrelated traffic groups. For multi-node deployment this graduates to Redis.

type Window = { hits: number[] };
const buckets = new Map<string, Window>();

const WINDOW_MS = 60_000;
const MAX_TRACKED = 10_000;

export type RateKey =
  | "read"
  | "intake"
  | "estimate"
  | "decide"
  | "pay"
  | "status";

const LIMITS: Record<RateKey, number> = {
  read: 300,
  intake: 20,
  estimate: 30,
  decide: 10,
  pay: 10,
  status: 60,
};

// Sensible-per-call noise for demo provider refs (bumped here so pay/decide
// routes can share one import).
export const jitterId = () => randomBytes(4).toString("hex");

// Returns true when allowed; false means the 429 has already been sent.
export function rateLimit(
  ip: string,
  key: RateKey,
  reply: FastifyReply
): boolean {
  const windowStart = Date.now() - WINDOW_MS;
  const id = `${key}:${ip}`;
  const b = buckets.get(id) ?? { hits: [] };
  b.hits = b.hits.filter((t) => t > windowStart);
  if (b.hits.length >= LIMITS[key]) {
    const oldest = b.hits[0] ?? Date.now();
    const retrySec = Math.max(1, Math.ceil((oldest - windowStart + WINDOW_MS) / 1000));
    reply
      .status(429)
      .header("Retry-After", String(retrySec))
      .send({ error: "rate_limited", messageAm: "በጣም ብዙ ጥያቄዎች — ጥቂት ጊዜ ይጠብቁ።" });
    return false;
  }
  b.hits.push(Date.now());
  buckets.set(id, b);

  if (buckets.size > MAX_TRACKED) {
    for (const [k, w] of buckets) {
      if (!w.hits.length || w.hits[w.hits.length - 1] < windowStart) buckets.delete(k);
      if (buckets.size <= MAX_TRACKED / 2) break;
    }
  }
  return true;
}
