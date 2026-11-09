import { NextResponse } from "next/server";
import type { NoteKind } from "@sidecar/shared";
import { currentUid } from "@/lib/identity";
import { createNote, deleteNote, ensureFolder, listNotes, parseNoteInput } from "@/lib/notebook";

export const dynamic = "force-dynamic";

/** The current browser's notes. Filter with ?conf=<conference>, ?talk=<id> and/or ?kind=note|highlight|favorite. */
export async function GET(req: Request) {
  if (!process.env.ES_URL) return NextResponse.json({ notes: [] });
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind") as NoteKind | null;
  const notes = await listNotes(await currentUid(), { talk_id: q.get("talk") ?? undefined, kind: kind ?? undefined, conference_id: q.get("conf") ?? undefined });
  return NextResponse.json({ notes });
}

/** Unsave a talk: DELETE /api/notes?favorite=<talk id>. */
export async function DELETE(req: Request) {
  const talk = new URL(req.url).searchParams.get("favorite");
  if (!talk) return NextResponse.json({ error: "Say which talk." }, { status: 400 });
  const uid = await currentUid();
  await deleteNote(uid, `fav:${uid}:${talk}`);
  return NextResponse.json({ ok: true });
}

/**
 * Save a note. Send `folder_id` to file it in a folder, or `folder_name` to file it
 * by name (the folder is made if it doesn't exist): that is how the assistant files things.
 */
export async function POST(req: Request) {
  if (!process.env.ES_URL) return NextResponse.json({ error: "Elasticsearch is not configured." }, { status: 503 });
  const body = await req.json().catch(() => null);
  const parsed = parseNoteInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const uid = await currentUid();
  const input = parsed.value;
  const folderName = (body as { folder_name?: unknown })?.folder_name;
  let folder: { id: string; name: string } | null = null;
  if (!input.folder_id && typeof folderName === "string") {
    const f = await ensureFolder(uid, folderName);
    if (f) folder = { id: f.id, name: f.name };
    input.folder_id = f?.id;
  }
  // Say which folder the note really landed in (null = unfiled), so the app never claims a folder it didn't use.
  return NextResponse.json({ ...(await createNote(uid, input)), folder });
}
