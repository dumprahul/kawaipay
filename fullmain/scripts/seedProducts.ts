// Bulk-create real campaigns (on-chain campaign::create + Postgres metadata), bypassing
// the manual zkLogin UI flow. Signs with a plain Ed25519 keypair instead of zkLogin — the
// gateway's metadata signature check (isValidPersonalMessageSignature) is scheme-agnostic,
// so a plain Ed25519 signature is verified exactly the same way a zkLogin one would be.
//
// Usage: npx tsx scripts/seedProducts.ts
// Requires SEED_SELLER_SECRET_KEY in .env.local — a funded testnet Sui address (SUI for
// gas, USDC for escrow) in the bech32 `suiprivkey1...` form.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SuiGraphQLClient } from "@mysten/sui/graphql";

// ── Minimal .env.local loader (no dotenv dependency — this repo doesn't have it) ──────
function loadEnvLocal() {
  const path = resolve(__dirname, "../.env.local");
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8080";
const SUI_NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";
const GRAPHQL_URL = `https://graphql.${SUI_NETWORK}.sui.io/graphql`;

const PACKAGE_ID = "0x783ffc3f10c07ed01ba7799b92f2bbd663c1b2bbe3ac574dc03598e2f6a93e03";
const USDC_TYPE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
const DEFAULT_MAX_RATE_MULTIPLIER = 10;
const DEFAULT_PER_SETTLE_CAP_DIVISOR = 2;
const USDC_DECIMALS = 1_000_000;

const secretKey = process.env.SEED_SELLER_SECRET_KEY;
if (!secretKey) {
  throw new Error("SEED_SELLER_SECRET_KEY not found in .env.local");
}
const keypair = Ed25519Keypair.fromSecretKey(secretKey);
const sellerAddress = keypair.getPublicKey().toSuiAddress();

const suiClient = new SuiGraphQLClient({ url: GRAPHQL_URL, network: SUI_NETWORK });

// ── Product data — 12 seed listings across the app's existing categories ──────────────
interface SeedProduct {
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  priceUsd: number;
  escrowUsd: number; // total USDC deposited into the campaign's escrow
}

const PRODUCTS: SeedProduct[] = [
  { title: "Everyday Canvas Tote", category: "Fashion", description: "Durable cotton canvas tote for daily errands and light shopping trips.", imageUrl: "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800", priceUsd: 28, escrowUsd: 1.6 },
  { title: "Merino Wool Crewneck", category: "Fashion", description: "Breathable, itch-free merino wool sweater for cool-weather layering.", imageUrl: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800", priceUsd: 68, escrowUsd: 1.6 },
  { title: "Vitamin C Brightening Serum", category: "Beauty", description: "Lightweight daily serum with 15% vitamin C for an even, brighter tone.", imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800", priceUsd: 34, escrowUsd: 1.6 },
  { title: "Ceramide Repair Moisturizer", category: "Beauty", description: "Rich barrier-repair cream for dry and sensitive skin, fragrance-free.", imageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800", priceUsd: 26, escrowUsd: 1.6 },
  { title: "Wireless Noise-Cancelling Earbuds", category: "Electronics", description: "True wireless earbuds with active noise cancellation and 30h battery life.", imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800", priceUsd: 89, escrowUsd: 1.6 },
  { title: "USB-C Fast Charger, 65W", category: "Electronics", description: "Compact GaN charger with 65W output — fits a laptop and a phone at once.", imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800", priceUsd: 32, escrowUsd: 1.6 },
  { title: "Ceramic Pour-Over Coffee Set", category: "Home", description: "Hand-glazed ceramic dripper and carafe for a slow, clean pour-over cup.", imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800", priceUsd: 44, escrowUsd: 1.6 },
  { title: "Linen Throw Blanket", category: "Home", description: "Pre-washed linen blanket, breathable enough for year-round use.", imageUrl: "https://images.unsplash.com/photo-1580301762395-83c8f7e8a3e6?w=800", priceUsd: 52, escrowUsd: 1.6 },
  { title: "Foldable Travel Yoga Mat", category: "Wellness", description: "1.5mm ultralight mat that folds down to fit any carry-on.", imageUrl: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800", priceUsd: 38, escrowUsd: 1.6 },
  { title: "Magnesium Glycinate Capsules", category: "Wellness", description: "High-absorption magnesium for sleep and muscle recovery, 90ct.", imageUrl: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=800", priceUsd: 22, escrowUsd: 1.6 },
  { title: "Atomic Habits Boxed Set", category: "Books", description: "Hardcover boxed set of three bestselling habit-building books.", imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800", priceUsd: 46, escrowUsd: 1.6 },
  { title: "Leather Journal & Pen Set", category: "Books", description: "Refillable leather-bound journal with a matching fountain pen.", imageUrl: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=800", priceUsd: 36, escrowUsd: 1.6 },
];

async function getUsdcBalance(address: string): Promise<{ totalBaseUnits: number; coinObjectIds: string[] }> {
  const { objects } = await suiClient.core.listCoins({ owner: address, coinType: USDC_TYPE });
  let total = 0;
  const ids: string[] = [];
  for (const coin of objects) {
    total += Number(coin.balance ?? 0);
    ids.push(coin.objectId);
  }
  return { totalBaseUnits: total, coinObjectIds: ids };
}

function findCreatedObjectId(
  executed: { effects?: { changedObjects: { objectId: string; idOperation: string }[] }; objectTypes?: Record<string, string> },
  objectType: string,
): string | null {
  const changed = executed.effects?.changedObjects ?? [];
  const types = executed.objectTypes ?? {};
  for (const obj of changed) {
    if (obj.idOperation === "Created" && types[obj.objectId] === objectType) return obj.objectId;
  }
  return null;
}

async function createCampaignOnChain(ratePerSecondBaseUnits: number, escrowBaseUnits: number): Promise<{ digest: string; campaignId: string }> {
  const { totalBaseUnits, coinObjectIds } = await getUsdcBalance(sellerAddress);
  if (totalBaseUnits < escrowBaseUnits || coinObjectIds.length === 0) {
    throw new Error(`Insufficient USDC: need ${escrowBaseUnits}, have ${totalBaseUnits} at ${sellerAddress}`);
  }

  const tx = new Transaction();
  tx.setSender(sellerAddress);

  const [primary, ...rest] = coinObjectIds;
  if (rest.length > 0) {
    tx.mergeCoins(tx.object(primary!), rest.map((id) => tx.object(id)));
  }
  const [deposit] = tx.splitCoins(tx.object(primary!), [escrowBaseUnits]);

  const [cap] = tx.moveCall({
    target: `${PACKAGE_ID}::campaign::create`,
    typeArguments: [USDC_TYPE],
    arguments: [
      deposit,
      tx.pure.u64(ratePerSecondBaseUnits),
      tx.pure.u64(ratePerSecondBaseUnits * DEFAULT_MAX_RATE_MULTIPLIER),
      tx.pure.u64(Math.floor(escrowBaseUnits / DEFAULT_PER_SETTLE_CAP_DIVISOR)),
      tx.pure.u64(escrowBaseUnits),
      tx.pure.bool(true),
    ],
  });
  tx.transferObjects([cap!], sellerAddress);

  const bytes = await tx.build({ client: suiClient });
  const { signature } = await keypair.signTransaction(bytes);
  const result = await suiClient.core.executeTransaction({
    transaction: bytes,
    signatures: [signature],
    include: { effects: true, objectTypes: true },
  });

  const executed = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
  if (!executed.status.success) {
    throw new Error(`campaign::create failed on-chain: ${JSON.stringify(executed.status.error)}`);
  }

  const campaignId = findCreatedObjectId(executed, `${PACKAGE_ID}::campaign::Campaign<${USDC_TYPE}>`);
  if (!campaignId) {
    throw new Error("campaign::create succeeded but no Campaign object was found in its effects");
  }
  return { digest: executed.digest, campaignId };
}

function campaignMetadataSigningMessage(campaignId: string, fields: { title: string; category: string; description: string; imageUrl: string; priceUsd: number }): Uint8Array {
  const obj: Record<string, unknown> = { campaignId, ...fields };
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
  return new TextEncoder().encode(JSON.stringify(sorted));
}

async function waitForCampaign(campaignId: string, timeoutMs = 15_000, intervalMs = 750): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await fetch(`${GATEWAY_URL}/v1/campaigns/${campaignId}`);
    if (res.ok) return;
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for indexer to pick up campaign ${campaignId}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function setCampaignMetadata(campaignId: string, fields: { title: string; category: string; description: string; imageUrl: string; priceUsd: number }): Promise<void> {
  const message = campaignMetadataSigningMessage(campaignId, fields);
  const { signature } = await keypair.signPersonalMessage(message);
  const res = await fetch(`${GATEWAY_URL}/v1/campaigns/${campaignId}/metadata`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, signature }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PUT metadata failed (${res.status}): ${body}`);
  }
}

async function main() {
  console.log(`Seeding ${PRODUCTS.length} products as seller ${sellerAddress} on ${SUI_NETWORK}...\n`);

  const results: { title: string; campaignId?: string; digest?: string; error?: string }[] = [];

  for (const product of PRODUCTS) {
    process.stdout.write(`- ${product.title} ... `);
    try {
      const escrowBaseUnits = Math.round(product.escrowUsd * USDC_DECIMALS);
      const ratePerSecondBaseUnits = Math.max(1, Math.round(escrowBaseUnits / 10000 / 5));

      const { digest, campaignId } = await createCampaignOnChain(ratePerSecondBaseUnits, escrowBaseUnits);
      await waitForCampaign(campaignId);
      await setCampaignMetadata(campaignId, {
        title: product.title,
        category: product.category,
        description: product.description,
        imageUrl: product.imageUrl,
        priceUsd: product.priceUsd,
      });

      results.push({ title: product.title, campaignId, digest });
      console.log(`OK  campaignId=${campaignId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ title: product.title, error: message });
      console.log(`FAILED  ${message}`);
    }
  }

  const ok = results.filter((r) => r.campaignId).length;
  console.log(`\nDone: ${ok}/${PRODUCTS.length} succeeded.`);
  const failures = results.filter((r) => r.error);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f.title}: ${f.error}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
