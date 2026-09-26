-- kawaipay backend schema (spec section 4).
-- Postgres holds durable off-chain state; Sui is the source of truth for money.
-- All amounts are bigint in USDC base units. Constraints, not application code,
-- enforce uniqueness.

-- Mirror of chain state (maintained by the indexer)
CREATE TABLE campaigns (
  campaign_id text PRIMARY KEY,
  seller text NOT NULL,
  coin_type text NOT NULL,
  rate_per_second bigint NOT NULL,
  max_rate_per_second bigint NOT NULL,
  per_settle_cap bigint NOT NULL,
  per_link_epoch_cap bigint NOT NULL,
  active boolean NOT NULL,
  open_links boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Display-only product metadata (title/category/description/image), set by the seller
  -- via a signed PUT after the on-chain campaign::create call. None of this affects
  -- scoring, payout, or trust — it never touches the Move contract, only Postgres —
  -- so it's nullable until the seller sets it and freely editable without a new tx.
  title text,
  category text,
  description text,
  image_url text,
  price_usd numeric
);

CREATE TABLE links (
  link_id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES campaigns,
  creator text NOT NULL,
  frozen boolean NOT NULL DEFAULT false,
  budget_remaining bigint NOT NULL DEFAULT 0,
  next_seq bigint NOT NULL DEFAULT 0, -- chain-confirmed next sequence number
  total_paid bigint NOT NULL DEFAULT 0,
  last_checkpoint bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Attention data (written by the gateway)
CREATE TABLE sessions (
  session_id uuid PRIMARY KEY,
  link_id text NOT NULL REFERENCES links,
  started_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  ended_at timestamptz,
  ip_hash bytea NOT NULL,
  ip_class text NOT NULL, -- residential | datacenter | tor | unknown
  asn integer,
  ua_hash bytea,
  tick_count integer NOT NULL DEFAULT 0
);

CREATE TABLE ticks (
  tick_id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions,
  link_id text NOT NULL,
  seq integer NOT NULL,
  received_at timestamptz NOT NULL,
  server_gap_ms integer,
  features jsonb NOT NULL, -- coarse bucketed features only (section 11)
  score real NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('pay', 'pay_reduced', 'hold', 'reject')),
  weight real NOT NULL,
  amount bigint NOT NULL,
  reasons text[] NOT NULL DEFAULT '{}',
  scorer_version text NOT NULL,
  batch_item_id bigint, -- null until assigned to a batch item
  UNIQUE (session_id, seq)
);
CREATE INDEX ticks_unbatched ON ticks (link_id) WHERE batch_item_id IS NULL AND amount > 0;

CREATE TABLE accruals (
  link_id text PRIMARY KEY REFERENCES links,
  earned_total bigint NOT NULL DEFAULT 0,
  settled_total bigint NOT NULL DEFAULT 0 -- only ever changed from confirmed chain events
);

-- Settlement pipeline (written by the batcher and indexer)
CREATE TABLE batches (
  batch_id bigserial PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('building', 'submitted', 'confirmed', 'failed')),
  tx_digest text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  confirmed_at timestamptz
);

CREATE TABLE batch_items (
  item_id bigserial PRIMARY KEY,
  batch_id bigint NOT NULL REFERENCES batches,
  link_id text NOT NULL REFERENCES links,
  seq bigint NOT NULL,
  amount bigint NOT NULL,
  seconds_verified integer NOT NULL,
  log_root bytea NOT NULL,
  expires_at_ms bigint NOT NULL,
  signature bytea NOT NULL,
  log_blob_id text,
  status text NOT NULL CHECK (status IN ('building', 'submitted', 'confirmed', 'failed'))
);
CREATE UNIQUE INDEX one_live_item_per_link_seq ON batch_items (link_id, seq)
  WHERE status IN ('building', 'submitted', 'confirmed');

CREATE TABLE settlements ( -- one row per PayoutSettled event
  tx_digest text NOT NULL,
  event_seq integer NOT NULL,
  link_id text NOT NULL,
  seq bigint NOT NULL,
  amount bigint NOT NULL,
  seconds_verified bigint NOT NULL,
  log_root bytea NOT NULL,
  checkpoint bigint NOT NULL,
  ts timestamptz NOT NULL,
  PRIMARY KEY (tx_digest, event_seq)
);

CREATE TABLE indexer_cursor (
  name text PRIMARY KEY,
  cursor jsonb NOT NULL
);

-- One row per polled module, touched on every poll (whether or not it found events) so
-- other services (the batcher's INDEXER_LAG_TOO_HIGH guard) can tell the indexer is
-- actually alive and caught up, not just that its last-seen cursor position looks fine.
CREATE TABLE indexer_heartbeat (
  name text PRIMARY KEY,
  last_polled_at timestamptz NOT NULL DEFAULT now()
);

-- Fraud review (written by the sentinel, read by oracle-core)
CREATE TABLE link_risk (
  link_id text PRIMARY KEY REFERENCES links,
  weight_multiplier real NOT NULL DEFAULT 1.0,
  hold boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE risk_flags (
  flag_id bigserial PRIMARY KEY,
  link_id text NOT NULL REFERENCES links,
  rule text NOT NULL,
  level integer NOT NULL CHECK (level IN (1, 2, 3)),
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- x402 API (written by oracle-api)
CREATE TABLE used_payments (
  digest text PRIMARY KEY,
  payer text NOT NULL,
  amount bigint NOT NULL,
  endpoint text NOT NULL,
  response jsonb NOT NULL, -- stored so a retry with the same payment returns the same result
  used_at timestamptz NOT NULL DEFAULT now()
);

-- World ID proof-of-humanity (written by the gateway's /v1/worldid/verify, read by the
-- batcher to gate payouts). A creator's first WORLD_ID_FREE_PAYOUTS settlements need no
-- verification at all; every payout after that needs a row here with verified_at within
-- the last WORLD_ID_VALIDITY_DAYS. nullifier_hash is UNIQUE so the same physical human
-- can't hold verified status on two different Sui addresses at once.
CREATE TABLE verified_creators (
  sui_address text PRIMARY KEY,
  nullifier_hash text UNIQUE NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);

-- Replay protection for World ID proofs, mirroring used_payments above.
CREATE TABLE used_worldid_nonces (
  nonce text PRIMARY KEY,
  nullifier_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
