import type { CapLimits } from "./types.js";

/** One tick is 5 seconds of attention (spec section 1). */
export const TICK_SECONDS = 5;

export const SCORER_VERSION = "1.0.0";

/** 0.5 for the first WARMUP_HOURS after a link's first tick, else 1.0. */
export const WARMUP_FACTOR = 0.5;
export const WARMUP_HOURS = 24;

export const DEFAULT_CAP_LIMITS: CapLimits = {
  linkHourlyCap: 5_000_000,
  sourceHourlyCap: 1_000_000,
};

/** Domain-separation prefixes for the two things the Oracle signer signs (spec sections 3, 12). */
export const PAYOUT_DOMAIN = "KAWAIPAY_PAYOUT_V1";
export const VERDICT_DOMAIN = "KAWAIPAY_VERDICT_V1";

export const BATCH_INTERVAL_MS = 10_000;
export const ATT_TTL_MS = 60_000;
export const MAX_ITEMS_PER_BATCH = 100;
export const MIN_SETTLE_UNITS = 1_000;
/** Up to one hour of 5-second ticks per attestation (spec section 7, attestation building step 2). */
export const MAX_TICKS_PER_ATTESTATION = 720;
/** A link is settled even under MIN_SETTLE_UNITS once its oldest pending tick is this old (step 6). */
export const SKIP_MIN_SETTLE_AGE_MS = 300_000;
export const MIRROR_MAX_LAG_MS = 30_000;
export const INDEXER_POLL_MS = 1_000;

export const SENTINEL_INTERVAL_MS = 60_000;
export const FREEZE_MIN_UNITS = 500_000;
export const FREEZES_PER_HOUR = 20;

export const MIN_LINK_BUDGET = 10_000;

export const ORACLE_PRICE_UNITS = 5_000;
export const X402_NETWORK = "sui:testnet";

export const SESSION_TTL_MS = 15_000;
export const HEARTBEAT_INTERVAL_MS = 5_000;
