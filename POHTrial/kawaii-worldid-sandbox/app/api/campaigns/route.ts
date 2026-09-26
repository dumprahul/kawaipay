import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const campaigns = db.prepare("SELECT * FROM campaigns ORDER BY id").all();
    return NextResponse.json({ campaigns });
  } catch (e) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
