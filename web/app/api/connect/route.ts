import type { ConnectResponse } from "@sidecar/shared";
import { withSpan } from "@sidecar/shared/otel";
import { myCards } from "@/lib/connect";
import { currentUid } from "@/lib/identity";
import { getPerson } from "@/lib/matching";
import { getTalk } from "@/lib/talks";

export const dynamic = "force-dynamic";

// My blind match cards. Polled every few seconds by /connect, so a "they want
// to meet you" or a mutual match shows up without a refresh.
export async function GET() {
  const uid = await currentUid();
  return withSpan("sidecar.connect", {}, async (set) => {
    const me = await getPerson(uid);
    if (!me) {
      const body: ConnectResponse = { me: { ready: false }, cards: [] };
      return Response.json(body);
    }
    const cards = await myCards(me);
    set({ "sidecar.cards.count": cards.length, "sidecar.cards.mutual": cards.filter((c) => c.state === "mutual").length });
    // The talk where I last asked: the graph on /connect shows that room.
    const talkId = me.asked_in.at(-1) ?? me.talk_ids[0];
    const talk = talkId ? await getTalk(talkId) : null;
    const body: ConnectResponse = {
      me: { ready: true, display_name: me.display_name, talk_id: talkId, talk_title: talk?.title, my_problems: me.problem_list.slice(0, 3) },
      cards,
    };
    return Response.json(body);
  });
}
