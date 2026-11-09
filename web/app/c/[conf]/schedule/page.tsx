import { notFound } from "next/navigation";
import { AppShell, Page } from "@/components/AppShell";
import { dateLabel } from "@/components/format";
import { ScheduleView } from "@/components/ScheduleView";
import { getConference } from "@/lib/conferences";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ params }: { params: Promise<{ conf: string }> }) {
  const { conf: confId } = await params;
  const conf = getConference(confId);
  if (!conf) notFound();

  return (
    <AppShell conf={conf} active="schedule">
      <Page>
        <p className="eyebrow">{dateLabel(conf.start)} · {conf.city}</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Your schedule</h1>
        <p className="mt-2 text-ink-soft">
          Picked for you from {conf.name} and nearby events. Open any session to follow along, or swap it for something else.
        </p>
        <div className="mt-6">
          <ScheduleView conference={conf.id} />
        </div>
      </Page>
    </AppShell>
  );
}
