import { notFound } from "next/navigation";
import { LiveTalk } from "@/components/LiveTalk";
import { getTalk } from "@/lib/talks";

export const dynamic = "force-dynamic";

export default async function TalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalk(id);
  if (!talk) notFound();
  // Only public fields go to the browser (never the speaker token).
  return (
    <LiveTalk
      talk={{ id: talk.id, title: talk.title, speaker: talk.speaker, room_id: talk.room_id, start: talk.start, end: talk.end, level: talk.level }}
    />
  );
}
