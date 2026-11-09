import type { ApplyResponse } from "@sidecar/shared";
import { applyToWork, tryAi } from "@/lib/ai";
import { currentUid } from "@/lib/identity";
import { getProfile, whoIs } from "@/lib/profiles";
import { getTalk } from "@/lib/talks";
import { linesSince } from "@/lib/transcripts";

export const dynamic = "force-dynamic";

// "Apply to my work": tie what has been said to what this person said they are building.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalk(id);
  if (!talk) return Response.json({ error: "talk not found" }, { status: 404 });

  const profile = await getProfile(await currentUid());
  if (!profile?.working_on) {
    const body: ApplyResponse = { text: "Add what you are working on to your profile, and Sidecar can connect talks to it.", mode: "extract" };
    return Response.json(body);
  }

  const lines = (await linesSince(id)).slice(-40).map((l) => l.text);
  if (lines.length === 0) {
    const body: ApplyResponse = { text: "Nothing has been said yet. Try again once the talk is underway.", mode: "extract" };
    return Response.json(body);
  }

  const written = await tryAi(() => applyToWork(talk.title, lines, whoIs(profile)));
  const body: ApplyResponse = written
    ? { text: written, mode: "ai" }
    : { text: `You are working on: ${profile.working_on}\nThe latest from the talk: “${lines.slice(-2).join(" ")}”`, mode: "extract" };
  return Response.json(body);
}
