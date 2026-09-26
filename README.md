# KawaiiPay

**Verified-attention affiliate commerce on Sui.** Creators share real product links, buyers' genuine on-page attention is scored by an oracle, and creators get paid in USDC — settled on-chain, automatically, no manual payout runs. Identity is zkLogin (no seed phrase, no wallet extension) and, beyond a creator's first couple of payouts, real-human verification via World ID gates the rest.

- **Live app:** https://kawaiipay-nu.vercel.app
- **Network:** Sui **testnet**
- **Package ID:** `0x783ffc3f10c07ed01ba7799b92f2bbd663c1b2bbe3ac574dc03598e2f6a93e03`

---

## Table of contents

- [What this actually does](#what-this-actually-does)
- [Architecture](#architecture)
- [Smart contracts](#smart-contracts-sui-move)
- [The PTB relayer (batcher)](#the-ptb-relayer-batcher)
- [zkLogin — wallet-less identity](#zklogin--wallet-less-identity)
- [World ID — why, and how](#world-id--why-and-how)
- [x402 — pay-per-request oracle access](#x402--pay-per-request-oracle-access)
- [Backend services](#backend-services)
- [Frontend](#frontend)
- [Data flow, end to end](#data-flow-end-to-end)
- [Deployment](#deployment)
- [Local development](#local-development)
- [Repository layout](#repository-layout)

---

## What this actually does

1. A **product owner** signs in (zkLogin), lists a product, and funds a real on-chain escrow (`campaign::create`) with testnet USDC.
2. A **creator** signs in, generates a real on-chain affiliate link for that product (`link::create`) — permissionless, anyone can mint one for an open campaign.
3. The product owner **funds that specific link** (`link::fund`) from the campaign's shared escrow — a link starts at zero budget on purpose; funding it is a deliberate allocation, not automatic.
4. A **buyer** opens the creator's link. The moment the page loads, a real session/heartbeat protocol starts reporting attention signals (viewport visibility, focus, scroll, pointer activity) to the backend every 5 seconds.
5. An **oracle scorer** (`packages/oracle-core`) turns each heartbeat into a verdict — `pay`, `pay_reduced`, `hold`, or `reject` — based on real signals (gap regularity, stats-repeat detection, IP class, interaction requirements), not a black box.
6. A **PTB relayer** (the batcher) periodically batches every link's accrued, unpaid attention into one signed Programmable Transaction Block and calls `payout::settle` on-chain — the creator receives real USDC directly to their wallet.
7. Once a creator's free payout allowance is used up, further payouts are held until they **verify Proof of Humanity with World ID** — re-verified weekly.
8. Separately, a small always-on service demonstrates **x402**: it continuously pays real, on-chain micropayments to consume a paid oracle endpoint, proving the whole payment rail works end-to-end without any human in the loop.

Every number in this app — balances, payout history, analytics — is read from real Postgres state that mirrors real on-chain events. Nothing is mocked.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (Vercel)                              │
│   Next.js 16 · fullmain/  ·  zkLogin (Enoki)  ·  World ID (IDKit)           │
└───────────────┬───────────────────────────────────────────────┬─────────────┘
                │ REST (fetch)                                  │ IDKit widget
                ▼                                                ▼
┌───────────────────────────┐                     ┌──────────────────────────────┐
│      gateway (Railway)     │                     │      World ID (staging)      │
│  session/start · heartbeat  │                     │  RP-signed verify, nullifier │
│  campaigns · creator links   │                    └──────────────────────────────┘
│  /v1/worldid/* (verify)      │
└──────────┬──────────────────┘
           │ writes real ticks/accruals/verified_creators
           ▼
┌─────────────────────────────┐        ┌───────────────────────────────────┐
│         Postgres             │◄──────►│        workers (Railway)          │
│  (Supabase, mirrors chain)   │        │  one process, four/five loops:    │
└──────────┬────────────────────┘        │  • indexer  — chain → Postgres    │
           │                              │  • batcher  — Postgres → chain    │
           │                              │    (the PTB relayer)              │
           │                              │  • sentinel — fraud re-analysis   │
           │                              │  • log-writer — audit log blobs   │
           │                              │  • x402-payer — continuous x402   │
           ▼                              └──────────────┬─────────────────────┘
┌─────────────────────────────┐                            │ signed PTBs
│   Sui testnet (Move)         │◄───────────────────────────┘
│  oracle_registry · campaign  │
│  link · payout                │
└──────────┬────────────────────┘
           │ x402-gated HTTP
           ▼
┌─────────────────────────────┐
│      oracle-api (Railway)     │  sells verified-attention scoring per request,
│  x402 payment-required gate   │  paid for by real on-chain USDC via a facilitator
└───────────────────────────────┘
```

---

## Smart contracts (Sui Move)

Deployed once to **testnet**, four modules in one package:

| | |
|---|---|
| **Package ID** | `0x783ffc3f10c07ed01ba7799b92f2bbd663c1b2bbe3ac574dc03598e2f6a93e03` |
| **Oracle registry object** | `0xf3d190c8ad619ded4d8bc47b8299e4577c17a9ce5b761475b56cb956d8d52f9b` |
| **USDC type used** | `0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC` (real testnet USDC) |
| **Publish digest** | `6ESsMA3gSUHgfs3eYvFn1mujg8nHGC2Rz98XyvfULP3M` |

**`contracts/sources/`:**

- **`oracle_registry.move`** — holds the oracle's Ed25519 signer public key, `AdminCap`/`FreezeCap` for governance. Every `payout::settle` call verifies its attestation against this registry's signer.
- **`campaign.move`** — a product owner's escrow. `create` deposits USDC and returns a `CampaignCap`; `top_up` (permissionless) adds more escrow; `set_params`/`set_active` (cap-gated) tune rate limits.
- **`link.move`** — a creator's affiliate link. `create` is **permissionless** when `open_links: true` — any signed-in creator can mint one against an open campaign, no owner approval needed. `fund` (requires the owner's `CampaignCap`) moves USDC from the campaign's shared escrow into that specific link's own balance — a link starts at **zero budget on purpose**, funding it is a deliberate, explicit owner action. `freeze`/`unfreeze` are oracle-registry-gated (fraud response).
- **`payout.move`** — `settle` is the only way money moves to a creator. It verifies an Ed25519-signed attestation (campaign, link, sequence, seconds verified, amount, log root, expiry) against the registry's oracle signer, enforces rate/cap/epoch limits from the campaign's own parameters, and asserts the **link's own budget** covers the amount (`E_BUDGET`) before transferring USDC straight to the creator and emitting `PayoutSettled`.

Every one of these calls is signed and submitted for real — nothing in the payout path is simulated.

---

## The PTB relayer (batcher)

`services/batcher` is the one process with real signing authority over settlements — a **relayer** that assembles and submits **Programmable Transaction Blocks (PTBs)** on a fixed poll loop (`BATCH_INTERVAL_MS`, default 10s):

1. Selects every link with unbatched, `pay`-verdict attention ticks, not frozen, with no batch already in flight.
2. Filters that set through the **World ID payout gate** (below) — a creator over their free-payout allowance and not currently verified has their links held for the next cycle rather than dropped.
3. For every surviving link, builds a real Ed25519-signed attestation (the same domain-separated payload `payout::settle` verifies on-chain) and assembles **one PTB with one `payout::settle` Move call per link** — batching many creators' payouts into a single transaction.
4. **Dry-runs and bisects** the batch first: if one link's call would abort, it's pulled out and the rest still settle — one bad item never blocks everyone else's payout.
5. Signs and submits the final PTB with a dedicated **relayer keypair** (distinct from the oracle's attestation-signing key — two separate trust roles, one submits transactions, the other authorizes amounts).
6. Records `building → submitted → confirmed/failed` in Postgres at every step, so a mid-flight crash is recoverable on restart (`resolveUnknownOutcome` re-queries the chain rather than guessing).

Leader election (a Postgres session-level advisory lock) ensures only one batcher instance ever submits at a time, even if the process restarts.

---

## zkLogin — wallet-less identity

Every signed-in user gets a **real Sui address derived from their Google identity** — no seed phrase, no browser extension, no private key the user ever has to manage.

- Implemented via **[Enoki](https://docs.enoki.mystenlabs.com)** (Mysten Labs' hosted zkLogin infrastructure) rather than a self-hosted prover — the original DIY implementation against Mysten's shared public dev prover hit real, reproducible rate limits and occasional proof-verification failures under load; Enoki's paid, dedicated prover/salt service is reliable at demo/production traffic.
- Login flow: pick a role (Buyer / Creator / Product Owner) → Google OAuth → Enoki verifies the JWT, fetches salt + ZK proof, derives the Sui address → session persisted (survives new tabs and browser restarts).
- Every on-chain action a creator or owner takes (`link::create`, `link::fund`, `campaign::create`, personal-message signatures for setting product metadata) is signed by `EnokiKeypair`, a real `Signer` — the same interface a raw Ed25519 keypair implements, so the rest of the app's transaction-building code doesn't know or care that the signature is a zkLogin proof underneath.
- Buyers get a lighter path: plain Google OAuth with no zkLogin/Sui derivation at all, since buyers don't need an on-chain identity.

---

## World ID — why, and how

**The problem:** `link::create` is deliberately permissionless (any creator can mint a link with no approval step). Without an identity check somewhere, one person could spin up unlimited wallets, each minting links and each collecting a "new creator" free payout allowance — Sybil-farming the free tier indefinitely.

**Why World ID specifically, and not just "require more zkLogin":** zkLogin proves *"this wallet is controlled by this Google account"* — but a real Sybil attacker can create unlimited Google accounts too. World ID's orb/biometric verification proves something zkLogin structurally cannot: *this wallet is controlled by one unique physical human*, via a cryptographic **nullifier** that's stable per-human-per-action but reveals nothing else about their identity.

**Where it sits in the payout path (not the login path):** a creator's **first 2 payouts** (across every link they own, not per-link) settle immediately, no verification needed — new creators get paid right away. From the **3rd payout onward**, the batcher holds every settlement for that creator until they've verified within the last **7 days**. Verification doesn't expire silently either — it's a real weekly re-proof, not a one-time check.

**How the flow actually works** (`services/gateway/src/worldId.ts`, `components/WorldIdVerification.tsx`):

1. `POST /v1/worldid/rp-signature` — the gateway signs an RP (Relying Party) context server-side via `@worldcoin/idkit-server`, action = `kawaii-creator-payout` (one fixed action, forever — not per-campaign, since this gates *payout eligibility*, not campaign participation).
2. The frontend opens World's real `IDKitRequestWidget` with that signed context — the user scans/verifies through the World App.
3. `POST /v1/worldid/verify` — the gateway sends the completed proof to World's own live verify API (`developer.world.org`), extracts the nullifier, and **upserts `verified_creators` keyed by Sui address**. The nullifier column is `UNIQUE` at the database level: the same physical human cannot hold "verified" status on two different Sui addresses simultaneously — a second address attempting to verify with the same nullifier is rejected outright.
4. `GET /v1/worldid/status` — real-time "N free payouts left" / "verified until \<date\>" shown right in the creator dashboard.

The batcher enforces all of this independently every cycle (`services/batcher/src/worldIdGate.ts`) — a blocked link isn't failed or dropped, it's simply held for a later cycle once the creator verifies, and every hold is logged as a structured `WORLD_ID_REQUIRED`/`WORLD_ID_EXPIRED` alert visible in the batcher's own logs.

---

## x402 — pay-per-request oracle access

`services/oracle-api` sells its verified-attention scoring as a **paid API**, gated by the [x402 protocol](https://www.x402.org/): call it with no payment and it returns `402 Payment Required` with the exact price/asset/recipient it accepts; attach a real signed USDC payment in the `X-PAYMENT` header and it settles through a live x402 facilitator before returning a result.

To make that payment rail visibly continuous rather than a one-off demo call, `services/x402-payer` runs as a permanent loop (bundled into `workers`): every 5 seconds it acts as its own paying client — discovers the current price from oracle-api's own `402` response (no hardcoded price on either side), builds and signs a real on-chain USDC transfer for exactly that amount, and settles it through the same facilitator a real third-party caller would use. Every cycle is a genuine, separately-verifiable on-chain transaction.

---

## Backend services

All under `services/`, one Postgres (Supabase) shared across everything:

| Service | Role |
|---|---|
| **gateway** | Public HTTP API: `session/start`, `heartbeat`, campaign/link listing & metadata, World ID verification. The only service buyers' and creators' browsers talk to directly. |
| **oracle-api** | Sells verified-attention scoring behind an x402 payment gate — a separate paid product from the real settlement pipeline above. |
| **batcher** | The PTB relayer — see above. |
| **indexer** | Polls the chain for `CampaignCreated`/`LinkCreated`/`LinkFunded`/`PayoutSettled`/etc. and mirrors them into Postgres. Everything the frontend reads (budgets, settlement history) is this mirror, kept honest by periodic reconciliation against the chain. |
| **sentinel** | An independent, continuously-running second pass over recorded attention ticks, looking for fraud patterns the inline scorer might miss. |
| **log-writer** | Writes signed audit-log blobs for every batch, so a settlement's underlying attention data is independently verifiable after the fact. |
| **x402-payer** | The continuous x402 demo loop — see above. |
| **workers** | A single Railway process bundling batcher + indexer + sentinel + log-writer + x402-payer, so all five long-running loops fit one free-tier service slot; each fails independently without taking the others down. |

Shared logic lives in `packages/`: `oracle-core` (the real scoring/fraud/weighting algorithm and PTB attestation building), `shared` (schemas, canonical JSON, Postgres/metrics helpers), `sdk` (the embeddable third-party tracking script this app's own frontend also vendors a copy of).

---

## Frontend

`fullmain/` — Next.js 16 (App Router, Turbopack), deployed on Vercel.

- **`/login`** — the real entry point after the landing page: role selection + zkLogin sign-in.
- **`/shop`, `/product/[id]`, `/category/[slug]`, `/search`** — real product browsing, backed entirely by on-chain campaigns with Postgres-only display metadata (title/description/image — never touches the Move contract, freely editable without a new transaction).
- **Generate-link modal** — a signed-in creator clicking a product gets a focused flow to mint a real affiliate link, with a live Suiscan link to the result — nothing is "shareable" until `link::create` actually confirms on-chain.
- **`/creator/payouts`, `/creator/analytics`, `/owner/analytics`** — dedicated pages, every number sourced live from the gateway (real settlement history, real accrual totals, real budgets) — no mock data anywhere in this app.
- **Product Owner dashboard** — list a product (funds a real campaign escrow) and fund individual creator links from that escrow — the step that actually makes a link payable.
- **World ID verification card** — real `IDKitRequestWidget` flow in the creator dashboard.

---

## Data flow, end to end

```
buyer opens creator's link (?via=linkId)
        │
        ▼
useAttentionTracking → POST /v1/session/start  (gateway)
        │  every 5s while the tab is open
        ▼
POST /v1/heartbeat  →  oracle-core scoreTick()  →  ticks + accruals (Postgres)
        │
        ▼  (batcher's poll loop, every ~10s)
selectEligibleLinks → World ID gate → dry-run/bisect → sign PTB → payout::settle (chain)
        │
        ▼
indexer observes PayoutSettled → settlements + accruals.settled_total (Postgres)
        │
        ▼
/creator/payouts and /creator/analytics read it — real numbers, no delay beyond the above
```

---

## Deployment

- **Backend** — Railway: `gateway`, `oracle-api`, `workers` (the five-loop bundle), plus a Redis plugin. Postgres is Supabase (session-mode connection string — required for the batcher's advisory lock).
- **Frontend** — Vercel, auto-deployed from `main`.
- **Contracts** — published once to Sui testnet (see [Smart contracts](#smart-contracts-sui-move)); redeploying the app never redeploys the Move package.

---

## Local development

```bash
# Backend (from repo root)
pnpm install
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, PACKAGE_ID, etc.
pnpm --filter @kawaipay/gateway run dev
pnpm --filter @kawaipay/workers run dev     # batcher + indexer + sentinel + log-writer + x402-payer
pnpm --filter @kawaipay/oracle-api run dev

# Frontend
cd fullmain
npm install
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_* values
npm run dev
```

Each service's own `test/` directory has a real test suite (`pnpm test`) running against a real local Postgres — not mocks.

---

## Repository layout

```
contracts/        Sui Move package (oracle_registry, campaign, link, payout)
packages/
  oracle-core/     Scoring, fraud weighting, PTB attestation building
  shared/          Schemas, canonical JSON, Postgres/metrics helpers
  sdk/             Embeddable third-party attention-tracking script
services/
  gateway/         Public API — sessions, heartbeats, campaigns, World ID
  oracle-api/       x402-gated verified-attention scoring product
  batcher/          PTB relayer — the only service that settles payouts
  indexer/          Chain → Postgres mirror
  sentinel/         Independent fraud re-analysis
  log-writer/       Signed audit-log blobs
  x402-payer/       Continuous x402 payment demo loop
  workers/          Combined Railway deployment of the five loops above
fullmain/          Next.js frontend (Vercel)
db/migrations/     Postgres schema
```
