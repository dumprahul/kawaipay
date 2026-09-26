import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { NextRequest } from "next/server";

const VERIFY_BASE = "https://developer.world.org/api/v4/verify";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { campaignId, idkitResult, signal } = body;

  if (!campaignId || !idkitResult) {
    return NextResponse.json({ error: "campaignId and idkitResult are required" }, { status: 400 });
  }

  const rpId = process.env.WORLD_RP_ID;
  const appId = process.env.WORLD_APP_ID;
  if (!rpId || !appId) {
    return NextResponse.json({ error: "WORLD_RP_ID or WORLD_APP_ID not configured" }, { status: 500 });
  }

  const action = `kawaii-campaign-${campaignId}`;

  // --- 1. Verify proof with World Developer endpoint ---
  let nullifier: string;
  try {
    const verifyRes = await fetch(`${VERIFY_BASE}/${rpId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.WORLD_STAGING_TOKEN
          ? { "x-staging-verification-token": process.env.WORLD_STAGING_TOKEN }
          : {}),
      },
      body: JSON.stringify(idkitResult),
    });

    const verifyData = await verifyRes.json();
    console.log("[verify-proof] World API status:", verifyRes.status);
    console.log("[verify-proof] World API response:", JSON.stringify(verifyData));

    if (!verifyRes.ok) {
      console.error("[verify-proof] World rejected proof:", verifyData);
      return NextResponse.json(
        { error: "Proof verification failed", detail: verifyData },
        { status: 400 }
      );
    }

    // nullifier is in responses[0].nullifier for v4, or top-level for v3
    const result = idkitResult as { responses?: Array<{ nullifier?: string }>; protocol_version?: string };
    nullifier =
      result.responses?.[0]?.nullifier ??
      (verifyData as { nullifier?: string }).nullifier ??
      "";

    if (!nullifier) {
      console.error("[verify-proof] no nullifier found in result or response:", JSON.stringify({ idkitResult, verifyData }));
      return NextResponse.json({ error: "No nullifier found" }, { status: 400 });
    }
  } catch (e) {
    console.error("[verify-proof] network error:", e);
    return NextResponse.json({ error: "Failed to reach World verification endpoint" }, { status: 502 });
  }

  const db = getDb();

  // --- 2. Replay protection — nonce must be fresh ---
  const nonce = idkitResult?.nonce as string | undefined;
  if (nonce) {
    const used = db.prepare("SELECT 1 FROM used_nonces WHERE nonce = ?").get(nonce);
    if (used) {
      return NextResponse.json({ error: "Duplicate verification — proof already used" }, { status: 409 });
    }
    db.prepare("INSERT INTO used_nonces (nonce, nullifier) VALUES (?, ?)").run(nonce, nullifier);
  }

  // --- 3. Upsert verified creator by nullifier ---
  db.prepare(
    "INSERT OR IGNORE INTO verified_creators (nullifier) VALUES (?)"
  ).run(nullifier);

  const creator = db.prepare(
    "SELECT id FROM verified_creators WHERE nullifier = ?"
  ).get(nullifier) as { id: number };

  // --- 4. Check campaign exists ---
  const campaign = db.prepare("SELECT id, name FROM campaigns WHERE id = ?").get(campaignId) as
    | { id: number; name: string }
    | undefined;

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // --- 5. Enforce UNIQUE(campaign_id, creator_id) ---
  const existing = db
    .prepare("SELECT slug FROM creator_links WHERE campaign_id = ? AND creator_id = ?")
    .get(campaign.id, creator.id) as { slug: string } | undefined;

  if (existing) {
    return NextResponse.json(
      {
        error: "Already linked",
        message: "You already have a creator link for this campaign. One verified human can create only one creator link per campaign.",
        slug: existing.slug,
      },
      { status: 409 }
    );
  }

  // --- 6. Create creator link ---
  const slug = `c/${nullifier.slice(0, 8)}-campaign-${campaign.id}`;
  try {
    db.prepare(
      "INSERT INTO creator_links (campaign_id, creator_id, slug) VALUES (?, ?, ?)"
    ).run(campaign.id, creator.id, slug);
  } catch (e: unknown) {
    // DB-level UNIQUE constraint fired (race condition safety net)
    if (e instanceof Error && e.message.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "Already linked", message: "Creator link already exists for this campaign." },
        { status: 409 }
      );
    }
    throw e;
  }

  return NextResponse.json({ success: true, slug, campaignName: campaign.name });
}
