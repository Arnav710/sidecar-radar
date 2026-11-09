import { NextResponse } from "next/server";
import { listEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

/** Side events (Luma, Slack, X) from now on, soonest first. */
export async function GET() {
  return NextResponse.json({ events: await listEvents() });
}
