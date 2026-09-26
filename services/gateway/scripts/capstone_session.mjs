// Simulates a real SDK session against the live gateway: session/start, then several
// human-like heartbeats with genuine HMACs (via @kawaipay/shared, the same functions
// the real gateway verifies against).
import { computeHeartbeatMac, heartbeatMacMessage } from "@kawaipay/shared";

const BASE_URL = "http://localhost:8099";
const LINK_ID = "0xc1cd8ba232d6908c082f6334fd6f1c20ec81d58ce6159cc65aa592d8c89a6341";

function humanLikeStats(i) {
  return {
    windowMs: 5000,
    visibleMs: 5000,
    focusedMs: 5000,
    inViewportMs: 5000,
    contentViewportRatio: 1,
    scrollEvents: 2 + (i % 3),
    scrollDepthPct: Math.min(100, 10 + i * 8),
    scrollSpeedMax: 300 + i * 20,
    pointerMoves: 8 + (i % 4),
    pointerCells: 5 + (i % 5),
    touchEvents: 0,
    keyEvents: 0,
    tabSwitches: 0,
  };
}

async function main() {
  const startRes = await fetch(`${BASE_URL}/v1/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkId: LINK_ID, client: { tz: "Asia/Tokyo", viewport: [1280, 720] } }),
  });
  const startBody = await startRes.json();
  console.log("session/start:", JSON.stringify(startBody));
  if (!startBody.tracking) {
    console.error("FAIL: link not tracking");
    process.exit(1);
  }

  const secret = Buffer.from(startBody.secret, "base64");
  let token = startBody.token;
  const sessionId = startBody.sessionId;

  const NUM_TICKS = 6; // 30 seconds of "reading"
  for (let seq = 1; seq <= NUM_TICKS; seq++) {
    const stats = humanLikeStats(seq);
    const mac = computeHeartbeatMac(secret, heartbeatMacMessage(sessionId, seq, token, stats));
    const res = await fetch(`${BASE_URL}/v1/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, seq, token, stats, mac }),
    });
    const body = await res.json();
    console.log(`heartbeat seq=${seq} ->`, res.status, JSON.stringify(body));
    if (!body.ok) {
      console.error("Heartbeat did not succeed, stopping.");
      break;
    }
    token = body.nextToken;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
