import { NextResponse } from "next/server";
import type { NoteKind } from "@sidecar/shared";
import { currentUid } from "@/lib/identity";
import { createNote, listNotes, parseNoteInput } from "@/lib/notebook";

export const dynamic = "force-dynamic";

/** The current browser's notes. Filter with ?talk=<id> and/or ?kind=note|highlight|favorite. */
export async function GET(req: Request) {
  if (!process.env.ES_URL) return NextResponse.json({ notes: [] });
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind") as NoteKind | null;
  const notes = await listNotes(await currentUid(), { talk_id: q.get("talk") ?? undefined, kind: kind ?? undefined });
  return NextResponse.json({ notes });
}

export async function POST(req: Request) {
  if (!process.env.ES_URL) return NextResponse.json({ error: "Elasticsearch is not configured." }, { status: 503 });
  const parsed = parseNoteInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return NextResponse.json(await createNote(await currentUid(), parsed.value));
}
