import { createHash, randomUUID } from "node:crypto";
import { FOLDER, formatOffset, type Folder, type Note, type NoteKind } from "@sidecar/shared";
import { es, INDEX } from "./es";
import { listTalks } from "./talks";

// The attendee's notebook: notes, highlighted transcript lines and saved talks,
// kept in folders. Everything is scoped to the browser's anonymous uid, and
// nothing here logs note text (Gitar rule 8).

const DEFAULT_FOLDERS = [FOLDER.ideas, FOLDER.followUps, FOLDER.people, FOLDER.questions, FOLDER.catchUps];
const KINDS: NoteKind[] = ["note", "highlight", "favorite"];

// ---- Folders ----

export async function listFolders(uid: string): Promise<Folder[]> {
  const search = () =>
    es().search<Folder>({ index: INDEX.folders, size: 100, query: { term: { uid } }, sort: [{ created_at: "asc" }] });
  let hits = (await search()).hits.hits;
  if (hits.length === 0) {
    // First visit: start with a few folders people tend to want.
    const now = Date.now();
    await es().bulk({
      refresh: "wait_for",
      operations: DEFAULT_FOLDERS.flatMap((name, i) => {
        const folder: Folder = { id: randomUUID(), uid, name, created_at: new Date(now + i).toISOString() };
        return [{ index: { _index: INDEX.folders, _id: folder.id } }, folder];
      }),
    });
    hits = (await search()).hits.hits;
  }
  return hits.map((h) => h._source!).filter(Boolean);
}

export async function createFolder(uid: string, rawName: unknown): Promise<Folder | { error: string }> {
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 40) : "";
  if (!name) return { error: "Give the folder a name." };
  const existing = await listFolders(uid);
  if (existing.some((f) => f.name.toLowerCase() === name.toLowerCase())) return { error: "You already have a folder with that name." };
  if (existing.length >= 30) return { error: "That is the most folders you can have." };
  // The id comes from the owner and the lowercased name, and op_type "create" fails if it
  // exists, so two saves racing to make the same folder can't create it twice.
  const folder: Folder = { id: folderId(uid, name), uid, name, created_at: new Date().toISOString() };
  try {
    await es().index({ index: INDEX.folders, id: folder.id, document: folder, op_type: "create", refresh: "wait_for" });
  } catch (err) {
    if ((err as { meta?: { statusCode?: number } }).meta?.statusCode !== 409) throw err;
    return { error: "You already have a folder with that name." };
  }
  return folder;
}

/** One id per owner and folder name (case-insensitive). */
function folderId(uid: string, name: string): string {
  return createHash("sha256").update(`${uid}|${name.toLowerCase()}`).digest("hex").slice(0, 24);
}

/** The folder with this name (any capitalisation), made on the spot if it doesn't exist yet. */
export async function ensureFolder(uid: string, rawName: string): Promise<Folder | null> {
  const name = rawName.trim().slice(0, 40);
  if (!name) return null;
  const find = async () => (await listFolders(uid)).find((f) => f.name.toLowerCase() === name.toLowerCase());
  const existing = await find();
  if (existing) return existing;
  const made = await createFolder(uid, name);
  if (!("error" in made)) return made;
  return (await find()) ?? null; // another save made it a moment ago, or the folder limit was hit
}

export async function deleteFolder(uid: string, id: string): Promise<boolean> {
  const folder = await es().get<Folder>({ index: INDEX.folders, id }).catch(() => null);
  if (!folder?._source || folder._source.uid !== uid) return false;
  await es().delete({ index: INDEX.folders, id, refresh: "wait_for" });
  // Notes in the folder are kept, just unfiled.
  await es().updateByQuery({
    index: INDEX.notes,
    refresh: true,
    query: { bool: { filter: [{ term: { uid } }, { term: { folder_id: id } }] } },
    script: { source: "ctx._source.remove('folder_id')" },
  });
  return true;
}

// ---- Notes ----

export interface NoteInput {
  talk_id: string;
  conference_id?: string;
  kind: NoteKind;
  text: string;
  quote?: string;
  offset_s?: number;
  folder_id?: string;
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseNoteInput(body: unknown): { ok: true; value: NoteInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const talk_id = clip(b.talk_id, 120);
  const kind = KINDS.find((k) => k === b.kind) ?? "note";
  const text = clip(b.text, 2000);
  const quote = clip(b.quote, 600);
  if (!talk_id) return { ok: false, error: "talk_id is required." };
  if (kind === "note" && !text) return { ok: false, error: "Write something first." };
  if (kind === "highlight" && !quote) return { ok: false, error: "Nothing to highlight." };
  const offset = Number(b.offset_s);
  return {
    ok: true,
    value: {
      talk_id, kind, text, quote: quote || undefined,
      conference_id: clip(b.conference_id, 60) || undefined,
      folder_id: clip(b.folder_id, 60) || undefined,
      offset_s: Number.isFinite(offset) && offset >= 0 ? Math.round(offset) : undefined,
    },
  };
}

export async function createNote(uid: string, input: NoteInput): Promise<Note> {
  // A talk can only be saved once, so saving it again is harmless.
  const id = input.kind === "favorite" ? `fav:${uid}:${input.talk_id}` : randomUUID();
  const note: Note = { ...input, id, uid, created_at: new Date().toISOString() };
  await es().index({ index: INDEX.notes, id, document: note, refresh: "wait_for" });
  return note;
}

export async function listNotes(uid: string, filter: { talk_id?: string; kind?: NoteKind; conference_id?: string } = {}): Promise<Note[]> {
  const must: object[] = [{ term: { uid } }];
  if (filter.conference_id) must.push({ term: { conference_id: filter.conference_id } });
  if (filter.talk_id) must.push({ term: { talk_id: filter.talk_id } });
  if (filter.kind) must.push({ term: { kind: filter.kind } });
  const res = await es().search<Note>({ index: INDEX.notes, size: 500, query: { bool: { filter: must } }, sort: [{ created_at: "desc" }] });
  return res.hits.hits.map((h) => h._source!).filter(Boolean);
}

async function ownedNote(uid: string, id: string): Promise<Note | null> {
  const res = await es().get<Note>({ index: INDEX.notes, id }).catch(() => null);
  return res?._source && res._source.uid === uid ? res._source : null;
}

export async function deleteNote(uid: string, id: string): Promise<boolean> {
  if (!(await ownedNote(uid, id))) return false;
  await es().delete({ index: INDEX.notes, id, refresh: "wait_for" });
  return true;
}

/** Edit a note's text or move it to another folder (an empty folder_id means unfiled). */
export async function updateNote(uid: string, id: string, patch: { text?: unknown; folder_id?: unknown }): Promise<Note | null> {
  const note = await ownedNote(uid, id);
  if (!note) return null;
  if (typeof patch.text === "string") note.text = patch.text.trim().slice(0, 2000);
  if (typeof patch.folder_id === "string") {
    if (patch.folder_id) note.folder_id = patch.folder_id.slice(0, 60);
    else delete note.folder_id;
  }
  await es().index({ index: INDEX.notes, id, document: note, refresh: "wait_for" });
  return note;
}

// ---- Export ----

/** The whole notebook as Markdown, so it can become a report later. */
export async function exportMarkdown(uid: string, conference_id?: string): Promise<string> {
  const [folders, notes, { talks }] = await Promise.all([listFolders(uid), listNotes(uid, { conference_id }), listTalks()]);
  const title = new Map(talks.map((t) => [t.id, t.title]));
  const talkName = (id: string) => title.get(id) ?? id;

  const lines = ["# My Sidecar notebook", "", `_Exported ${new Date().toISOString().slice(0, 10)}_`, ""];

  const saved = notes.filter((n) => n.kind === "favorite");
  if (saved.length) {
    lines.push("## Saved talks", "", ...saved.map((n) => `- ${talkName(n.talk_id)}`), "");
  }

  const groups: Array<{ name: string; notes: Note[] }> = [
    ...folders.map((f) => ({ name: f.name, notes: notes.filter((n) => n.kind !== "favorite" && n.folder_id === f.id) })),
    { name: "Unfiled", notes: notes.filter((n) => n.kind !== "favorite" && !folders.some((f) => f.id === n.folder_id)) },
  ];
  for (const g of groups.filter((x) => x.notes.length)) {
    lines.push(`## ${g.name}`, "");
    for (const talkId of [...new Set(g.notes.map((n) => n.talk_id))]) {
      lines.push(`### ${talkName(talkId)}`, "");
      for (const n of g.notes.filter((x) => x.talk_id === talkId).reverse()) {
        const at = n.offset_s !== undefined ? `[${formatOffset(n.offset_s)}] ` : "";
        lines.push(n.kind === "highlight" ? `- ${at}Highlight` : `- ${at}${n.text}`);
        if (n.quote) lines.push(`  > ${n.quote.replace(/\n/g, " ")}`);
        if (n.kind === "highlight" && n.text) lines.push(`  ${n.text}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}
