import { Pool, type PoolClient } from "pg";

// Layer ownership per brief §4a: this process owns authorization, transactions,
// payments, and background jobs. No business logic in edge functions.

export const dbUrl =
  process.env.DATABASE_URL ?? "postgres://garaj@localhost:5433/garaj_dev";

// Hosted providers (Neon/Railway) require TLS; local .pgdev does not.
const ssl =
  /sslmode=(require|verify)/.test(dbUrl) ? { rejectUnauthorized: false } : false;

// Single long-running process: modest pool cap, direct connection
// (pg_try_advisory_lock in §4a cron needs a real session — no pgbouncer here).
export const pool = new Pool({ connectionString: dbUrl, max: 10, ssl });

export type DbClient = PoolClient;
