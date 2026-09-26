# KawaiiPay × World ID — Production Integration Guide

This document describes how the World ID Proof of Human sandbox maps to the production KawaiiPay platform on Sui.

---

## The problem this solves

KawaiiPay affiliate campaigns pay creators a commission when a buyer purchases through their referral link.

**Without identity verification:**
- One person can create 100 wallets and register as 100 "creators" for the same campaign.
- They farm all the referral slots, crowding out real creators.
- The brand's budget is drained by a single Sybil attacker.

**With World ID:**
- One physical human = one slot per campaign, regardless of how many wallets they control.
- The uniqueness guarantee is cryptographic, not account-based.

---

## How it integrates into KawaiiPay

### Creator registration flow

```
Creator wants to join Campaign X
        │
        ▼
KawaiiPay backend generates RP signature
  action: "kawaii-campaign-{campaignId}"
        │
        ▼
Creator opens World app → proves humanity
        │
        ▼
KawaiiPay backend verifies proof with World staging/production API
  extracts nullifier_hash
        │
        ▼
Backend checks: is this nullifier already used for campaign X?
  YES → reject (one human, one slot)
  NO  → register creator, generate affiliate link slug
        │
        ▼
Creator gets their unique affiliate link:
  kawaipay.xyz/c/{slug}
```

### On Sui — what changes

In production, the creator's Sui wallet address replaces the internal `creator_id`.  
The `zkLogin` session already proves wallet ownership; World ID adds the PoH layer on top.

**Combined check:**
1. zkLogin proves: "this wallet is controlled by this Google account"
2. World ID proves: "this Google account belongs to a real unique human"
3. KawaiiPay combines both: "this wallet = this real human" → one slot per campaign

---

## Nullifier design

| Scope | Action string | Nullifier behaviour |
|-------|---------------|---------------------|
| Global uniqueness | `kawaii-creator` | One account ever — too restrictive |
| Per-campaign | `kawaii-campaign-{id}` | ✓ Same human can join multiple campaigns, blocked from joining same campaign twice |
| Per-brand | `kawaii-brand-{id}` | Blocks joining any campaign from same brand — too restrictive |

**Chosen: per-campaign.** A real creator might legitimately promote multiple campaigns from the same brand. Blocking at campaign level prevents Sybil without hurting legitimate multi-campaign creators.

---

## Database schema (production)

Mirrors the sandbox, adapted for Sui:

```sql
CREATE TABLE campaigns (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  brand_id    TEXT NOT NULL,          -- Sui object ID
  budget_mist BIGINT DEFAULT 0,       -- SUI in MIST
  active      BOOLEAN DEFAULT true
);

CREATE TABLE verified_creators (
  id              INTEGER PRIMARY KEY,
  nullifier_hash  TEXT UNIQUE NOT NULL,  -- from World ID
  sui_address     TEXT,                  -- from zkLogin
  verified_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE creator_links (
  id           INTEGER PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  campaign_id  INTEGER NOT NULL REFERENCES campaigns(id),
  creator_id   INTEGER NOT NULL REFERENCES verified_creators(id),
  conversions  INTEGER DEFAULT 0,
  earnings_mist BIGINT DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, creator_id)     -- enforce one slot per human per campaign
);
```

---

## API surface (production)

### `POST /api/campaigns/{id}/join`

Called when a creator clicks "Join campaign". Requires active zkLogin session.

**Request:**
```json
{
  "idkit_result": { ...World ID proof fields... }
}
```

**Success (201):**
```json
{
  "slug": "mc4a8b2f",
  "link": "https://kawaipay.xyz/c/mc4a8b2f"
}
```

**Errors:**
- `409 Already joined` — same nullifier already has a slot for this campaign
- `400 Invalid proof` — World ID verification failed
- `403 Campaign full` — brand has set a max-creator limit

### `GET /api/creator-links`

Returns the current creator's links across all campaigns. Requires active zkLogin session.

---

## Environment variables

| Variable | Where used | Notes |
|----------|------------|-------|
| `WORLD_APP_ID` | Server | From World Developer Portal |
| `WORLD_RP_ID` | Server | From World Developer Portal |
| `RP_SIGNING_KEY` | Server | **Never expose to client** |
| `WORLD_ENVIRONMENT` | Server | `staging` or `production` |
| `NEXT_PUBLIC_WORLD_APP_ID` | Client | Same as `WORLD_APP_ID` |

---

## Switching from staging to production

1. In the World Developer Portal, promote the app from Staging → Production.
2. Update `WORLD_ENVIRONMENT=production` and `NEXT_PUBLIC_WORLD_ENVIRONMENT=production`.
3. The verify endpoint in `/api/verify-proof` already reads the environment:
   ```ts
   const env = process.env.WORLD_ENVIRONMENT === "production" ? "developer" : "staging-developer";
   const verifyUrl = `https://${env}.worldcoin.org/api/v4/verify/${rpId}`;
   ```
4. No other code changes required.

---

## Security notes

- **RP signing key** — HSM or secrets manager in production. Never in `.env` files committed to git.
- **Nullifier stability** — nullifiers are stable per `(human, action)`. Changing the `action` string invalidates all existing uniqueness guarantees. Treat action strings as immutable once used in production.
- **Replay protection** — the `used_nonces` table prevents a valid proof from being submitted twice in a race condition window. The `nonce` in the RP context expires after ~5 minutes (World ID enforced).
- **Creator link slugs** — generated as `nanoid(8)` — 8 chars from a 64-char alphabet = ~281 trillion combinations. Sufficient for affiliate link enumeration resistance.
