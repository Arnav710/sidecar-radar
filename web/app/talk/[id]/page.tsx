import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { TalkSession } from "@/components/TalkSession";
import { getConference } from "@/lib/conferences";
import { getTalk } from "@/lib/talks";

export const dynamic = "force-dynamic";

export default async function TalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalk(id);
  if (!talk) notFound();
  const conf = getConference(talk.conference_id);

  // Only public fields go to the browser (never the speaker token).
  return (
    <AppShell conf={conf} active="schedule">
      <TalkSession
        conference={conf?.id}
        serverNow={Date.now()}
        talk={{
          id: talk.id, title: talk.title, abstract: talk.abstract, speaker: talk.speaker, room_id: talk.room_id, start: talk.start, end: talk.end,
          level: talk.level, topics: talk.topics, accessibility: talk.accessibility,
        }}
      />
    </AppShell>
  );
}
