import { NextResponse } from "next/server";
import { currentUid } from "@/lib/identity";
import { deleteNote, updateNote } from "@/lib/notebook";

export const dynamic = "force-dynamic";

/** Edit a note's text or move it to a folder. Only the note's owner can. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { text?: unknown; folder_id?: unknown };
  const note = await updateNote(await currentUid(), id, body);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });
  return NextResponse.json(note);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteNote(await currentUid(), id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Note not found." }, { status: 404 });
}
