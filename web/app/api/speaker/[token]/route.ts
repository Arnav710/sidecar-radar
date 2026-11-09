import type { SpeakerReport } from "@sidecar/shared";
import { withSpan } from "@sidecar/shared/otel";
import { speakerReport, tryAi } from "@/lib/ai";
import { buildReport, talkByToken } from "@/lib/speaker";

export const dynamic = "force-dynamic";

// The speaker's feedback hub. The link's token is the only credential, so it
// is never shown to attendees and never logged. The response carries counts
// only: no attendee ids, no question text (review rules 8 and 11).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const talk = await talkByToken(token);
  if (!talk) return Response.json({ error: "Unknown speaker link." }, { status: 404 });

  return withSpan("sidecar.speaker_report", { "sidecar.talk.id": talk.id }, async (set) => {
    const report = await buildReport(talk);

    // Only write the summary once there is something real to summarise.
    const enough = report.people >= report.min_people && (report.clusters.length > 0 || report.spikes.length > 0);
    const summary = enough ? await tryAi(() => speakerReport(talk.title, report.clusters, report.spikes)) : null;

    set({
      "sidecar.report.people": report.people,
      "sidecar.report.questions": report.totals.questions,
      "sidecar.report.clusters": report.clusters.length,
      "sidecar.report.spikes": report.spikes.length,
    });

    const body: SpeakerReport = {
      ...report,
      summary: summary ?? undefined,
      summary_mode: summary ? "ai" : "none",
    };
    return Response.json(body);
  });
}
