import { NextResponse } from "next/server";
import { currentUid } from "@/lib/identity";
import { deleteFolder } from "@/lib/notebook";

export const dynamic = "force-dynamic";

/** Delete a folder. Its notes are kept, just unfiled. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteFolder(await currentUid(), id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Folder not found." }, { status: 404 });
}
