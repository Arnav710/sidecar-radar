import { notFound } from "next/navigation";
import { PeopleGraph } from "@/components/PeopleGraph";
import { getTalk } from "@/lib/talks";

export const dynamic = "force-dynamic";

// Projector view: everyone in this talk, linked by shared problems (bold) and
// shared interests (dashed). Edges appear live as people ask questions.
export default async function GraphPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalk(id);
  if (!talk) notFound();
  return <PeopleGraph talk={{ id: talk.id, title: talk.title, room_id: talk.room_id }} />;
}
