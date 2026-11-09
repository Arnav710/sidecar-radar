import { withSpan } from "@sidecar/shared/otel";
import { currentUid } from "@/lib/identity";
import { acceptMeetup, getOrProposeMeetup } from "@/lib/meetup";

export const dynamic = "force-dynamic";

// GET: the meetup for a mutual match (proposed on first request).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await currentUid();
  return withSpan("sidecar.meetup.get", {}, async (set) => {
    const v = await getOrProposeMeetup(uid, id);
    if (!v) return Response.json({ error: "No mutual match, or no shared free time today." }, { status: 404 });
    set({ "sidecar.meetup.state": v.meetup.state, "sidecar.meetup.spot": v.spot.id });
    return Response.json(v);
  });
}

// POST: accept it. When both have, it's added to both schedules.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await currentUid();
  return withSpan("sidecar.meetup.accept", {}, async (set) => {
    const v = await acceptMeetup(uid, id);
    if (!v) return Response.json({ error: "No mutual match." }, { status: 404 });
    set({ "sidecar.meetup.state": v.meetup.state });
    return Response.json(v);
  });
}
