// Input validation helpers (hardening pass): every write route trims, caps
// and type-checks its payload so bad input produces a clean 400/409 — never
// an opaque 500 from the database layer.

import { randomBytes } from "node:crypto";

export const isUuid = (s: string | undefined | null): s is string =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const capStr = (s: unknown, max: number): string | undefined => {
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  if (!t) return undefined;
  return t.slice(0, max);
};

// Strictly above `min`, at most `max` (money/quantities — 0 is never valid).
export const numBetween = (v: unknown, min: number, max: number): number | undefined => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= min || n > max) return undefined;
  return n;
};

// Inclusive lower bound (e.g. odometer 0 km is a real value).
export const numAtLeast = (v: unknown, min: number, max: number): number | undefined => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
};

// Loose Ethiopian-ish phone: digits/spaces/dashes, leading optional + — demo-grade,
// intentionally permissive (Ethio Telecom formats vary). Max 32 chars.
export const isPhone = (s: string): boolean =>
  /^[+]?[0-9][0-9\s-]{5,31}$/.test(s);

export const MAX_LINES = 50;
export const MAX_LINE_IDS = 100;

// Sensible-per-call noise for demo provider refs.
export const jitterId = () => randomBytes(4).toString("hex");
