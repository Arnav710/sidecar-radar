import type { CatchUpResponse } from "@sidecar/shared";
import { offsetSince } from "@sidecar/shared";
import { catchUp, tryAi } from "@/lib/ai";
import { currentUid } from "@/lib/identity";
import { getProfile, whoIs } from "@/lib/profiles";
import { getTalk } from "@/lib/talks";
import { linesSince } from "@/lib/transcripts";

export const dynamic = "force-dynamic";

/** Pick up to `n` lines spread evenly across the talk, for when no AI is available. */
function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return Array.from({ length: n }, (_, i) => items[Math.round((i * (items.length - 1)) / (n - 1))]);
}

// "Catch me up": a short summary of everything said so far, pitched at this attendee.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalk(id);
  if (!talk) return Response.json({ error: "talk not found" }, { status: 404 });

  const lines = await linesSince(id);
  const covered_s = Math.min(offsetSince(talk.start), Math.max(0, ...lines.map((l) => l.offset_s)));
  if (lines.length === 0) {
    const body: CatchUpResponse = { summary: "Nothing has been said yet. Check back in a minute.", covered_s: 0, mode: "extract" };
    return Response.json(body);
  }

  const profile = await getProfile(await currentUid());
  const written = await tryAi(() => catchUp(talk.title, lines.map((l) => l.text), whoIs(profile)));
  const summary = written ?? spread(lines, 5).map((l) => `- ${l.text}`).join("\n");
  const body: CatchUpResponse = { summary, covered_s, mode: written ? "ai" : "extract" };
  return Response.json(body);
}
