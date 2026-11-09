import { NextResponse } from "next/server";
import { currentUid } from "@/lib/identity";
import { createFolder, listFolders } from "@/lib/notebook";

export const dynamic = "force-dynamic";

/** The current browser's folders. The first visit creates a few starter folders. */
export async function GET() {
  if (!process.env.ES_URL) return NextResponse.json({ folders: [] });
  return NextResponse.json({ folders: await listFolders(await currentUid()) });
}

export async function POST(req: Request) {
  if (!process.env.ES_URL) return NextResponse.json({ error: "Elasticsearch is not configured." }, { status: 503 });
  const { name } = (await req.json().catch(() => ({}))) as { name?: unknown };
  const result = await createFolder(await currentUid(), name);
  return "error" in result ? NextResponse.json(result, { status: 400 }) : NextResponse.json(result);
}
