import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { jwtDecode } from "jwt-decode";

// Self-hosted salt derivation — no external approval needed.
// salt = HMAC-SHA256(secret, sub) → deterministic per user, per app.
// IMPORTANT: back up SALT_SECRET — losing it means users lose their address.
const SALT_SECRET = process.env.SALT_SECRET || "dev-salt-secret-change-in-prod";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  let sub: string;
  try {
    const decoded = jwtDecode<{ sub: string }>(token);
    if (!decoded.sub) throw new Error("no sub");
    sub = decoded.sub;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  // zkLogin expects salt as a decimal string that fits in a u128
  // Take first 16 bytes of HMAC → parse as hex bigint → decimal string
  const hex = createHmac("sha256", SALT_SECRET)
    .update(sub)
    .digest("hex")
    .slice(0, 32); // 16 bytes = 128 bits, fits u128

  const salt = BigInt("0x" + hex).toString();

  return NextResponse.json({ salt });
}
