import { NextRequest, NextResponse } from "next/server";

const PROVER_URL =
  process.env.NEXT_PUBLIC_PROVER_URL ||
  "https://prover-dev.mystenlabs.com/v1";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const res = await fetch(PROVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
