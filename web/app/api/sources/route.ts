import { NextResponse } from "next/server";
import { sourceStatus, syncOutsideEvents } from "@/lib/sources";

export const dynamic = "force-dynamic";

/** Which of Luma, Slack and X are connected (keys set). */
export async function GET() {
  return NextResponse.json({ sources: sourceStatus() });
}

// "Refresh" in the app. Anyone using the app can press it, so it is limited to
// once every 30 seconds per server to protect the Luma, Slack and X quotas.
const COOLDOWN_MS = 30_000;
let lastRun = 0;

export async function POST() {
  if (!process.env.ES_URL) return NextResponse.json({ error: "Elasticsearch is not configured." }, { status: 503 });
  if (Date.now() - lastRun < COOLDOWN_MS) return NextResponse.json({ error: "Refreshed a moment ago. Try again shortly." }, { status: 429 });
  lastRun = Date.now();
  return NextResponse.json({ results: await syncOutsideEvents() });
}
