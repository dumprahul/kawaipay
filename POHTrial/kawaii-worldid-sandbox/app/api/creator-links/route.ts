import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const links = db.prepare(`
      SELECT cl.id, cl.slug, cl.created_at,
             c.name  AS campaign_name,
             c.id    AS campaign_id
      FROM creator_links cl
      JOIN campaigns c ON c.id = cl.campaign_id
      ORDER BY cl.created_at DESC
    `).all();
    return NextResponse.json({ links });
  } catch (e) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
