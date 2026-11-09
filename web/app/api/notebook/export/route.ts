import { currentUid } from "@/lib/identity";
import { exportMarkdown } from "@/lib/notebook";

export const dynamic = "force-dynamic";

/** The whole notebook as a Markdown file download. */
export async function GET() {
  if (!process.env.ES_URL) return new Response("Elasticsearch is not configured.", { status: 503 });
  return new Response(await exportMarkdown(await currentUid()), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'attachment; filename="sidecar-notebook.md"',
    },
  });
}
