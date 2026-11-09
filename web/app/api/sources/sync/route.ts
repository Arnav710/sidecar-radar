import { NextResponse } from "next/server";
import { syncOutsideEvents } from "@/lib/sources";

export const dynamic = "force-dynamic";

/**
 * Pull side events from Luma, Slack and X into Elasticsearch.
 * Protected by SYNC_TOKEN (send it as the `x-sync-token` header). With no
 * SYNC_TOKEN set the route is off, so nobody can trigger it by accident.
 */
export async function POST(req: Request) {
  const token = process.env.SYNC_TOKEN;
  if (!token || req.headers.get("x-sync-token") !== token) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (!process.env.ES_URL) return NextResponse.json({ error: "Elasticsearch is not configured." }, { status: 503 });
  return NextResponse.json({ results: await syncOutsideEvents() });
}
