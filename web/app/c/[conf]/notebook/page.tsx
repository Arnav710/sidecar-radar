import { notFound } from "next/navigation";
import { AppShell, Page } from "@/components/AppShell";
import { NotebookView } from "@/components/NotebookView";
import { getConference } from "@/lib/conferences";
import { listTalks } from "@/lib/talks";

export const dynamic = "force-dynamic";

export default async function NotebookPage({ params }: { params: Promise<{ conf: string }> }) {
  const { conf: confId } = await params;
  const conf = getConference(confId);
  if (!conf) notFound();

  const { talks } = await listTalks();
  const talkTitles = Object.fromEntries(talks.map((t) => [t.id, t.title]));

  return (
    <AppShell conf={conf} active="notebook">
      <Page wide>
        <p className="eyebrow">{conf.name}</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Notebook</h1>
        <p className="mt-2 text-ink-soft">Your notes, highlights and saved talks, in folders. Export them any time, or use them to build your recap.</p>
        <div className="mt-8">
          <NotebookView talkTitles={talkTitles} />
        </div>
      </Page>
    </AppShell>
  );
}
