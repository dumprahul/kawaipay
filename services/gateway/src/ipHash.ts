import { createHash } from "node:crypto";

/**
 * Salted IP hash for storage (spec section 4 invariant 5: no raw IP is ever stored).
 * IP_HASH_SALT MUST be rotated daily per spec section 13.
 */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(salt).update(ip).digest("hex");
}
