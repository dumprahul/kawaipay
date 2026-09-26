# Kawaipay × World ID — Proof of Human Sandbox

A self-contained Next.js sandbox proving the **one-human-per-campaign** Sybil-resistance mechanism for [KawaiiPay](https://github.com/OoviyaManickam) — a Web3 affiliate creator-attention payment platform built for ETHGlobal Tokyo 2026 on Sui.

---

## What problem does this solve?

KawaiiPay lets brands run affiliate campaigns where creators earn commissions on referred sales. Without identity verification, one person could register as 100 different "creators" and drain the campaign budget.

**World ID solves this with zero personal data exposure:**
- One orb-verified human = one slot per campaign
- The uniqueness guarantee is cryptographic, not account-based
- No emails, no KYC, no personal data stored

---

## How it works

### The nullifier trick

World ID produces a **nullifier** — a deterministic identifier scoped to `(human, action)`. KawaiiPay scopes actions per campaign:

```
action: "kawaii-campaign-{campaignId}"
```

This means:
- Same human → Campaign A → same nullifier every time → **DB rejects duplicate**
- Same human → Campaign B → different nullifier (different action) → **allowed**
- Different human → Campaign A → different nullifier → **allowed**

The `UNIQUE(campaign_id, nullifier)` constraint at the database layer enforces this — no application logic can be bypassed.

---

## Sandbox demo flow

```
1. Click "Create Creator Link" on a campaign
       │
       ▼
2. Backend generates RP signature (signRequest)
   action: "kawaii-campaign-{id}"
       │
       ▼
3. IDKit widget opens → "Use the simulator" link appears
       │
       ▼
4. simulator.worldcoin.org → approve "Unique Human" credential
       │
       ▼
5. Proof sent to backend → forwarded to World verify API
   with x-staging-verification-token header
       │
       ▼
6. Nullifier extracted → UNIQUE check → creator link created
   slug: /c/{nullifier[0:8]}-campaign-{id}
```

### Test scenarios

| # | Action | Expected |
|---|--------|----------|
| 1 | Verify → Campaign A | ✓ Creator link created |
| 2 | Same identity → Campaign A again | ✗ Rejected (duplicate nullifier) |
| 3 | Same identity → Campaign B | ✓ Creator link created |
| 4 | Same identity → Campaign C | ✓ Creator link created |
| 5 | Different simulator identity → Campaign A | ✓ Creator link created |
| 6 | Cancel verification | No link created |

All 6 scenarios verified working on staging.

---

## Setup

### 1. World Developer Portal

1. Sign in at [developer.worldcoin.org](https://developer.worldcoin.org)
2. Create an **App** → note `app_id`
3. Create **Actions**: `kawaii-campaign-1`, `kawaii-campaign-2`, `kawaii-campaign-3`
4. Go to **World ID Configuration** → note `rp_id` and generate/copy the **signing key**

### 2. Enable staging verification window

The staging simulator requires a temporary token. Open it via the World MCP API:

```bash
curl -s "https://developer.world.org/api/mcp" \
  -H "Authorization: Bearer YOUR_PORTAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"set_world_id_staging_verification","arguments":{"app_id":"YOUR_APP_ID","enabled":true}}}'
```

Copy the `staging_verification_token` from the response — it lasts 24 hours.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
WORLD_APP_ID=app_staging_xxxx
WORLD_RP_ID=rp_xxxx
RP_SIGNING_KEY=0x_your_private_key_hex
WORLD_STAGING_TOKEN=sk_xxxx          # from step 2
WORLD_ENVIRONMENT=staging
NEXT_PUBLIC_WORLD_APP_ID=app_staging_xxxx
NEXT_PUBLIC_WORLD_ENVIRONMENT=staging
```

### 4. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). All 5 status rows should show **✓ configured**.

---

## Testing

Click **Create Creator Link** on any campaign. The IDKit widget opens with a QR code and a **"Use the simulator"** link at the bottom. Click the simulator link — it opens `simulator.worldcoin.org` with your proof request pre-loaded. Approve the "Unique Human" credential. The creator link appears instantly.

To reset verifications between test runs:

```bash
sqlite3 data/sandbox.db "DELETE FROM creator_links; DELETE FROM verified_creators; DELETE FROM used_nonces;"
```

---

## Project structure

```
app/
  page.tsx                    ← Main UI (campaigns, creator links, test scenarios)
  api/
    campaigns/route.ts        ← GET seeded campaigns
    creator-links/route.ts    ← GET all creator links
    rp-signature/route.ts     ← POST generate RP signature server-side
    verify-proof/route.ts     ← POST verify proof + enforce uniqueness + create link
    status/route.ts           ← GET environment health check
lib/
  db.ts                       ← SQLite schema + seed (campaigns A/B/C)
data/                         ← SQLite database (gitignored)
```

---

## Production integration with KawaiiPay

### Where it fits in the full flow

In the sandbox we gate **link creation** with World ID. In production KawaiiPay, the check happens at **payout** — this is intentional:

```
Creator joins campaign  →  earns commissions  →  requests payout
                                                        │
                                          World ID PoH check here
                                          action: "kawaii-payout-{campaignId}"
                                                        │
                                          Nullifier verified → payout released
                                          on Sui blockchain
```

This is better UX: creators can start earning immediately, and the identity check only happens when real money moves.

### Action scoping for payout

```
action: "kawaii-payout-{campaignId}"
```

Same guarantees as the sandbox:
- One human can only claim payout for a given campaign **once**
- Same human can claim payouts for different campaigns (different action → different nullifier)
- Two different verified humans can both claim from the same campaign

### On Sui — what changes

The creator's Sui wallet address (from zkLogin) replaces the internal `creator_id`. World ID adds the PoH layer on top of zkLogin:

1. **zkLogin** proves: "this wallet is controlled by this Google account"
2. **World ID** proves: "this Google account belongs to a real unique human"
3. **KawaiiPay** combines both: one wallet = one real human = one payout per campaign

### Key design decisions

| Decision | Reason |
|----------|--------|
| `action` scoped per campaign | Same human can legitimately promote multiple campaigns |
| PoH check at payout not signup | Better UX — no friction at onboarding |
| `allow_legacy_proofs: false` | Only accept current World ID 4.0 proofs |
| Server-side RP signature | `RP_SIGNING_KEY` never exposed to client |
| SQLite in sandbox | Zero-dependency local testing; production uses Postgres |

### Environment variables for production

| Variable | Notes |
|----------|-------|
| `WORLD_APP_ID` | Same — from Developer Portal |
| `WORLD_RP_ID` | Same — from Developer Portal |
| `RP_SIGNING_KEY` | Store in HSM or secrets manager, never in env files |
| `WORLD_ENVIRONMENT` | Change to `production` |
| `WORLD_STAGING_TOKEN` | Not needed in production |

---

## Stack

- **Next.js 15** (App Router)
- **@worldcoin/idkit** v4 — IDKit widget + types
- **@worldcoin/idkit-server** — server-side RP signature generation
- **better-sqlite3** — local SQLite for sandbox state
- **Tailwind CSS** — UI styling
