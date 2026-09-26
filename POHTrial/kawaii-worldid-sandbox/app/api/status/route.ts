import { NextResponse } from "next/server";

export async function GET() {
  const checks = {
    worldAppId: !!process.env.WORLD_APP_ID,
    worldRpId: !!process.env.WORLD_RP_ID,
    rpSigningKey: !!process.env.RP_SIGNING_KEY,
    environment: process.env.WORLD_ENVIRONMENT ?? "not set",
  };

  const allGood = checks.worldAppId && checks.worldRpId && checks.rpSigningKey;

  // DB check
  let dbOk = false;
  try {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    db.prepare("SELECT 1").get();
    dbOk = true;
  } catch {}

  return NextResponse.json({ ...checks, db: dbOk, ready: allGood && dbOk });
}
