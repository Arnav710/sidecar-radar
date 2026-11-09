"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Folder, Note } from "@sidecar/shared";
import { formatOffset } from "@sidecar/shared";
import { IconBookmark, IconDownload, IconFolder, IconPlus, IconStar, IconTrash } from "./Icons";

type Filter = { kind: "all" } | { kind: "highlights" } | { kind: "saved" } | { kind: "unfiled" } | { kind: "folder"; id: string };

export function NotebookView({ talkTitles }: { talkTitles: Record<string, string> }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [loaded, setLoaded] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [n, f] = await Promise.all([
      fetch("/api/notes").then((r) => r.json() as Promise<{ notes: Note[] }>),
      fetch("/api/folders").then((r) => r.json() as Promise<{ folders: Folder[] }>),
    ]);
    setNotes(n.notes);
    setFolders(f.folders);
    setLoaded(true);
  }, []);
  useEffect(() => { load().catch(() => setLoaded(true)); }, [load]);

  const visible = useMemo(() => {
    const written = notes.filter((n) => n.kind !== "favorite");
    switch (filter.kind) {
      case "all": return written;
      case "highlights": return written.filter((n) => n.kind === "highlight");
      case "saved": return notes.filter((n) => n.kind === "favorite");
      case "unfiled": return written.filter((n) => !n.folder_id || !folders.some((f) => f.id === n.folder_id));
      case "folder": return written.filter((n) => n.folder_id === filter.id);
    }
  }, [notes, folders, filter]);

  // Group by talk, newest first within each.
  const groups = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of visible) map.set(n.talk_id, [...(map.get(n.talk_id) ?? []), n]);
    return [...map.entries()];
  }, [visible]);

  const count = (f: Filter) => {
    switch (f.kind) {
      case "all": return notes.filter((n) => n.kind !== "favorite").length;
      case "highlights": return notes.filter((n) => n.kind === "highlight").length;
      case "saved": return notes.filter((n) => n.kind === "favorite").length;
      case "unfiled": return notes.filter((n) => n.kind !== "favorite" && (!n.folder_id || !folders.some((x) => x.id === n.folder_id))).length;
      case "folder": return notes.filter((n) => n.kind !== "favorite" && n.folder_id === f.id).length;
    }
  };

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/folders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newFolder }) });
    if (!res.ok) return setError(((await res.json()) as { error?: string }).error ?? "Could not add the folder.");
    setNewFolder("");
    setAdding(false);
    await load();
  }

  async function removeFolder(f: Folder) {
    if (!window.confirm(`Delete the folder "${f.name}"? Its notes are kept, just unfiled.`)) return;
    await fetch(`/api/folders/${f.id}`, { method: "DELETE" });
    if (filter.kind === "folder" && filter.id === f.id) setFilter({ kind: "all" });
    await load();
  }

  async function move(n: Note, folder_id: string) {
    setNotes((all) => all.map((x) => (x.id === n.id ? { ...x, folder_id: folder_id || undefined } : x)));
    await fetch(`/api/notes/${n.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ folder_id }) });
  }

  async function remove(n: Note) {
    setNotes((all) => all.filter((x) => x.id !== n.id));
    await fetch(n.kind === "favorite" ? `/api/notes?favorite=${encodeURIComponent(n.talk_id)}` : `/api/notes/${n.id}`, { method: "DELETE" });
  }

  const items: Array<{ label: string; f: Filter; icon: React.ReactNode }> = [
    { label: "All notes", f: { kind: "all" }, icon: <IconFolder size={16} /> },
    { label: "Highlights", f: { kind: "highlights" }, icon: <IconStar size={16} /> },
    { label: "Saved talks", f: { kind: "saved" }, icon: <IconBookmark size={16} /> },
  ];
  const same = (a: Filter, b: Filter) => a.kind === b.kind && (a.kind !== "folder" || (b.kind === "folder" && a.id === b.id));

  const pick = (label: string, f: Filter, icon: React.ReactNode, onDelete?: () => void) => (
    <li key={label} className="group flex items-center">
      <button type="button" aria-current={same(filter, f) ? "true" : undefined} onClick={() => setFilter(f)}
        className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors ${same(filter, f) ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-paper-2"}`}>
        {icon}<span className="truncate">{label}</span><span className="ml-auto text-xs text-ink-soft">{count(f)}</span>
      </button>
      {onDelete && <button type="button" className="btn btn-ghost btn-icon opacity-0 focus:opacity-100 group-hover:opacity-100" aria-label={`Delete folder ${label}`} onClick={onDelete}><IconTrash size={14} /></button>}
    </li>
  );

  if (!loaded) return <p role="status" className="text-ink-soft">Opening your notebook…</p>;

  return (
    <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
      <aside aria-label="Folders">
        <ul className="space-y-0.5">
          {items.map((i) => pick(i.label, i.f, i.icon))}
        </ul>
        <p className="eyebrow mb-1 mt-5 px-3">Folders</p>
        <ul className="space-y-0.5">
          {folders.map((f) => pick(f.name, { kind: "folder", id: f.id }, <IconFolder size={16} />, () => removeFolder(f)))}
          {pick("Unfiled", { kind: "unfiled" }, <IconFolder size={16} className="opacity-50" />)}
        </ul>
        {adding ? (
          <form onSubmit={addFolder} className="mt-3 px-1">
            <label htmlFor="new-folder" className="sr-only">Folder name</label>
            <input id="new-folder" autoFocus className="input py-1.5 text-sm" placeholder="Folder name" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} maxLength={40} />
            {error && <p role="alert" className="mt-1 text-xs text-bad">{error}</p>}
            <div className="mt-2 flex gap-1.5">
              <button type="submit" className="btn btn-primary btn-sm" disabled={!newFolder.trim()}>Add</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setError(""); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => setAdding(true)}><IconPlus size={14} /> New folder</button>
        )}
      </aside>

      <section aria-label="Notes">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">{visible.length} {filter.kind === "saved" ? "saved talk" : "note"}{visible.length === 1 ? "" : "s"}</p>
          <a href="/api/notebook/export" className="btn btn-sm"><IconDownload size={15} /> Export as Markdown</a>
        </div>

        {groups.length === 0 && (
          <div className="card mt-4 px-6 py-12 text-center">
            <p className="font-semibold">Nothing here yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
              Highlight lines and write notes while you follow a talk, and save the talks you want to come back to. They collect here, ready for your report.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-5">
          {groups.map(([talkId, list]) => (
            <article key={talkId} className="card overflow-hidden">
              <h3 className="border-b border-line bg-paper px-4 py-2.5 text-sm">
                <Link href={`/talk/${talkId}`} className="hover:underline">{talkTitles[talkId] ?? talkId}</Link>
              </h3>
              <ul className="divide-y divide-line">
                {list.map((n) => (
                  <li key={n.id} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      {n.offset_s !== undefined && <span className="font-medium tabular-nums text-ink-2">{formatOffset(n.offset_s)}</span>}
                      <span className="pill">{n.kind === "highlight" ? "Highlight" : n.kind === "favorite" ? "Saved talk" : "Note"}</span>
                      {n.kind !== "favorite" && (
                        <>
                          <label htmlFor={`f-${n.id}`} className="sr-only">Folder</label>
                          <select id={`f-${n.id}`} className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs" value={n.folder_id ?? ""} onChange={(e) => move(n, e.target.value)}>
                            <option value="">Unfiled</option>
                            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </>
                      )}
                      <button type="button" className="btn btn-ghost btn-icon ml-auto -my-1" aria-label="Delete" onClick={() => remove(n)}><IconTrash size={14} /></button>
                    </div>
                    {n.quote && <p className="mt-2 border-l-2 border-line-strong pl-3 text-ink-soft">{n.quote}</p>}
                    {n.text && <p className="mt-2 whitespace-pre-wrap leading-relaxed">{n.text}</p>}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
