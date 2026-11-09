import { withSpan } from "@sidecar/shared/otel";
import { wantToMeet } from "@/lib/connect";
import { currentUid } from "@/lib/identity";
import { getPerson } from "@/lib/matching";

export const dynamic = "force-dynamic";

// "Want to meet". Only a person in the pair can say it; when both have, the
// names and the conversation kit are revealed to both.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getPerson(await currentUid());
  if (!me) return Response.json({ error: "Ask a question or create your profile first." }, { status: 400 });

  return withSpan("sidecar.match.want", {}, async (set) => {
    const card = await wantToMeet(me, id);
    if (!card) return Response.json({ error: "match not found" }, { status: 404 });
    set({ "sidecar.match.state": card.state, "sidecar.match.kind": card.kind });
    return Response.json(card);
  });
}
