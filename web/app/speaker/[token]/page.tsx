import { notFound } from "next/navigation";
import type { SpeakerReport } from "@sidecar/shared";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Logo } from "@/components/Logo";
import { SpeakerReportView } from "@/components/SpeakerReportView";
import { buildReport, talkByToken } from "@/lib/speaker";
import { cachedSummary } from "@/lib/speaker-summary";

export const dynamic = "force-dynamic";

// /speaker/<token> — the link a speaker gets for their own talk. The token is
// generated at seed time and never shown to attendees. The page builds the
// report on the server so no attendee-level data is ever sent to a browser.
export default async function SpeakerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const talk = await talkByToken(token);
  if (!talk) notFound();

  const report = await buildReport(talk);
  // Cached per talk: the 20 s auto-refresh doesn't call OpenAI each time.
  const summary = await cachedSummary(talk, report);

  const full: SpeakerReport = { ...report, summary: summary ?? undefined, summary_mode: summary ? "ai" : "none" };

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6">
      <AutoRefresh seconds={20} />
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <span className="chip bg-white">Speaker</span>
      </div>
      <SpeakerReportView report={full} />
    </main>
  );
}
