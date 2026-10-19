// Shared crypto primitives for G2 approval links (§6d).
// The customer link is a real 256-bit token, stored as SHA-256 only;
// the raw value is shown once at "send" (simulating the SMS body).

import { randomBytes, createHash } from "node:crypto";

export const hashToken = (raw: string) =>
  createHash("sha256").update(raw).digest("hex");

// Fresh one-time approval link: raw goes to the customer (SMS later), hash to the DB.
export const createApprovalToken = () => {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
};
