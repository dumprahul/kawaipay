import type { Pool } from "pg";
import { signRequest } from "@worldcoin/idkit-server";
import type { WorldIdConfig } from "./config.js";

// A single, fixed action for every creator, forever — this isn't per-campaign Sybil
// resistance (a human may legitimately run many campaigns' links), it's "is the wallet
// asking for a payout controlled by a real, unique human" gating payouts themselves.
// Per KAWAIPAY_INTEGRATION.md's nullifier design table: changing this string once real
// verifications exist invalidates every existing uniqueness guarantee, so treat it as
// immutable in production.
const WORLD_ID_ACTION = "kawaii-creator-payout";

const VERIFY_BASE = "https://developer.world.org/api/v4/verify";

export const WORLD_ID_VALIDITY_DAYS = 7;

export interface RpSignatureResult {
  rp_context: {
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  };
  action: string;
}

/** Step 1 of the flow: a server-signed context the client's IDKit widget needs to open. */
export function generateRpSignature(config: WorldIdConfig): RpSignatureResult {
  const raw = signRequest({ signingKeyHex: config.signingKeyHex, action: WORLD_ID_ACTION, ttl: 300 });
  return {
    rp_context: {
      rp_id: config.rpId,
      nonce: raw.nonce,
      created_at: raw.createdAt,
      expires_at: raw.expiresAt,
      signature: raw.sig,
    },
    action: WORLD_ID_ACTION,
  };
}

export type VerifyOutcome =
  | { kind: "verified"; verifiedUntil: string }
  | { kind: "world_rejected"; detail: unknown }
  | { kind: "no_nullifier" }
  | { kind: "replay" }
  | { kind: "nullifier_bound_elsewhere" }
  | { kind: "network_error"; message: string };

/**
 * Step 2: verifies an IDKit proof against World's own verify endpoint, then records
 * this Sui address as a verified real human for WORLD_ID_VALIDITY_DAYS. The nullifier —
 * World ID's per-(human, action) stable identifier — is enforced UNIQUE at the DB level
 * (see migration), so the same physical human can't hold "verified" status on two
 * different Sui addresses at once; re-verifying under a second address is rejected here
 * before it ever reaches that constraint.
 */
export async function verifyWorldIdProof(
  pg: Pool,
  config: WorldIdConfig,
  suiAddress: string,
  idkitResult: unknown,
): Promise<VerifyOutcome> {
  let verifyData: unknown;
  try {
    const res = await fetch(`${VERIFY_BASE}/${config.rpId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.environment === "staging" && config.stagingToken
          ? { "x-staging-verification-token": config.stagingToken }
          : {}),
      },
      body: JSON.stringify(idkitResult),
    });
    verifyData = await res.json();
    if (!res.ok) {
      return { kind: "world_rejected", detail: verifyData };
    }
  } catch (err) {
    return { kind: "network_error", message: err instanceof Error ? err.message : String(err) };
  }

  const result = idkitResult as { responses?: Array<{ nullifier?: string }>; nonce?: string };
  const nullifierHash = result.responses?.[0]?.nullifier ?? (verifyData as { nullifier?: string })?.nullifier;
  if (!nullifierHash) {
    return { kind: "no_nullifier" };
  }

  const nonce = result.nonce;
  if (nonce) {
    const { rows } = await pg.query(`SELECT 1 FROM used_worldid_nonces WHERE nonce = $1`, [nonce]);
    if (rows.length > 0) {
      return { kind: "replay" };
    }
  }

  const { rows: existing } = await pg.query(
    `SELECT sui_address FROM verified_creators WHERE nullifier_hash = $1`,
    [nullifierHash],
  );
  if (existing.length > 0 && existing[0].sui_address !== suiAddress) {
    return { kind: "nullifier_bound_elsewhere" };
  }

  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    if (nonce) {
      await client.query(
        `INSERT INTO used_worldid_nonces (nonce, nullifier_hash) VALUES ($1, $2) ON CONFLICT (nonce) DO NOTHING`,
        [nonce, nullifierHash],
      );
    }
    await client.query(
      `INSERT INTO verified_creators (sui_address, nullifier_hash, verified_at)
       VALUES ($1, $2, now())
       ON CONFLICT (sui_address) DO UPDATE SET nullifier_hash = EXCLUDED.nullifier_hash, verified_at = now()`,
      [suiAddress, nullifierHash],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const { rows: verifiedRows } = await pg.query(
    `SELECT verified_at + interval '${WORLD_ID_VALIDITY_DAYS} days' AS verified_until FROM verified_creators WHERE sui_address = $1`,
    [suiAddress],
  );
  return { kind: "verified", verifiedUntil: verifiedRows[0].verified_until.toISOString() };
}

export interface WorldIdStatus {
  verified: boolean;
  verifiedAt: string | null;
  verifiedUntil: string | null;
  payoutCount: number;
  freePayoutsRemaining: number;
}

/** How many payouts this creator has already settled, across every one of their links. */
async function getPayoutCount(pg: Pool, suiAddress: string): Promise<number> {
  const { rows } = await pg.query(
    `SELECT COUNT(*)::int AS count FROM settlements s JOIN links l ON l.link_id = s.link_id WHERE l.creator = $1`,
    [suiAddress],
  );
  return rows[0]?.count ?? 0;
}

export async function getWorldIdStatus(pg: Pool, suiAddress: string, freePayouts: number): Promise<WorldIdStatus> {
  const [{ rows }, payoutCount] = await Promise.all([
    pg.query(
      `SELECT verified_at, verified_at + interval '${WORLD_ID_VALIDITY_DAYS} days' AS verified_until,
              (verified_at + interval '${WORLD_ID_VALIDITY_DAYS} days' > now()) AS still_valid
       FROM verified_creators WHERE sui_address = $1`,
      [suiAddress],
    ),
    getPayoutCount(pg, suiAddress),
  ]);

  const row = rows[0];
  return {
    verified: row?.still_valid === true,
    verifiedAt: row?.verified_at?.toISOString() ?? null,
    verifiedUntil: row?.verified_until?.toISOString() ?? null,
    payoutCount,
    freePayoutsRemaining: Math.max(0, freePayouts - payoutCount),
  };
}
