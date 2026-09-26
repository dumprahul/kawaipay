import { NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit-server";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { campaignId } = await req.json();

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  const signingKey = process.env.RP_SIGNING_KEY;
  if (!signingKey) {
    return NextResponse.json({ error: "RP_SIGNING_KEY not configured" }, { status: 500 });
  }

  try {
    const action = `kawaii-campaign-${campaignId}`;
    const raw = signRequest({
      signingKeyHex: signingKey,
      action,
      ttl: 300,
    });

    const rpId = process.env.WORLD_RP_ID;
    if (!rpId) {
      return NextResponse.json({ error: "WORLD_RP_ID not configured" }, { status: 500 });
    }

    // Map RpSignature → RpContext field names expected by IDKit widget
    const rp_context = {
      rp_id: rpId,
      nonce: raw.nonce,
      created_at: raw.createdAt,
      expires_at: raw.expiresAt,
      signature: raw.sig,
    };

    return NextResponse.json({ rp_context, action });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[rp-signature] failed:", msg);
    return NextResponse.json({ error: "RP signature generation failed" }, { status: 500 });
  }
}
