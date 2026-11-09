"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApplyResponse, AskResponse, CaptionsResponse, CatchUpResponse, Citation, ExplainResponse, Folder, NextStop, Note, TranscriptLine } from "@sidecar/shared";
import { formatOffset, offsetSince } from "@sidecar/shared";
import { roomLabel, timeLabel } from "./format";
import { IconArrowLeft, IconBookmark, IconCheck, IconMic, IconPencil, IconSend, IconSparkle, IconStar, IconTrash, IconX } from "./Icons";

export interface SessionTalk {
  id: string; title: string; abstract: string; speaker: string; room_id: string; start: string; end: string; level: string; topics: string[];
  accessibility?: { captions: boolean; step_free: boolean; quiet_room_nearby: boolean };
}

type Card = {
  id: string; kind: "catchup" | "apply" | "ask" | "explain"; title: string; at: number;
  pending?: boolean; error?: string; body?: string; citations?: Citation[]; nextStops?: NextStop[];
};

const KIND_LABEL: Record<Card["kind"], string> = { catchup: "Catch up", apply: "For your work", ask: "Your question", explain: "Explained again" };
const TEXT_SIZES = ["text-[0.9375rem]", "text-base", "text-lg"];
const POLL_MS = 1500;

const json = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/**
 * `serverNow` is the server's clock at render time. Starting from it (not from the
 * browser's clock) makes the first render identical on both sides, so the countdown
 * doesn't cause a hydration mismatch; the timer below then takes over.
 */
export function TalkSession({ talk, conference, serverNow }: { talk: SessionTalk; conference?: string; serverNow: number }) {
  const [now, setNow] = useState(serverNow);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [connected, setConnected] = useState(true);
  const [tab, setTab] = useState<"assistant" | "notes">("assistant");
  const [cards, setCards] = useState<Card[]>([]);
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [saved, setSaved] = useState(false);
  const [size, setSize] = useState(1);
  const [flash, setFlash] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteFolder, setNoteFolder] = useState("");
  const [pinMoment, setPinMoment] = useState(true);
  const [about, setAbout] = useState<{ text: string; offset: number } | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const since = useRef<string | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const start = Date.parse(talk.start);
  const end = Date.parse(talk.end);
  const phase = now < start ? "waiting" : now < end ? "live" : "ended";
  const elapsed = offsetSince(talk.start, new Date(now));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const say = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  // Load this talk's notes, the folders, and whether the talk is saved.
  const loadNotes = useCallback(async () => {
    const [n, f] = await Promise.all([
      fetch(`/api/notes?talk=${encodeURIComponent(talk.id)}`).then((r) => r.json() as Promise<{ notes: Note[] }>),
      fetch("/api/folders").then((r) => r.json() as Promise<{ folders: Folder[] }>),
    ]);
    setNotes(n.notes);
    setFolders(f.folders);
    setSaved(n.notes.some((x) => x.kind === "favorite"));
  }, [talk.id]);
  useEffect(() => { loadNotes().catch(() => {}); }, [loadNotes]);

  // Captions: poll while the talk is live, and read the full transcript once when it has ended.
  useEffect(() => {
    if (phase === "waiting") return;
    let stop = false;
    const tick = async () => {
      try {
        const url = `/api/talks/${talk.id}/captions${since.current ? `?since=${encodeURIComponent(since.current)}` : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as CaptionsResponse;
        since.current = data.now;
        setConnected(true);
        if (data.lines.length) {
          setLines((prev) => {
            const seen = new Set(prev.map((l) => l.id)); // the server overlaps polls on purpose
            return [...prev, ...data.lines.filter((l) => !seen.has(l.id))].sort((a, b) => a.offset_s - b.offset_s || a.ts.localeCompare(b.ts));
          });
        }
      } catch {
        setConnected(false);
      }
      if (!stop && phase === "live") setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { stop = true; };
  }, [talk.id, phase]);

  // Keep the newest line in view unless the reader scrolled up.
  useEffect(() => {
    const el = box.current;
    if (el && autoScroll.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const highlighted = useMemo(() => new Set(notes.filter((n) => n.kind === "highlight").map((n) => `${n.offset_s}|${n.quote}`)), [notes]);

  async function toggleHighlight(line: TranscriptLine) {
    const key = `${line.offset_s}|${line.text}`;
    const existing = notes.find((n) => n.kind === "highlight" && `${n.offset_s}|${n.quote}` === key);
    if (existing) {
      setNotes((all) => all.filter((n) => n.id !== existing.id));
      await fetch(`/api/notes/${existing.id}`, { method: "DELETE" });
      return;
    }
    const res = await fetch("/api/notes", json({ kind: "highlight", talk_id: talk.id, conference_id: conference, quote: line.text, offset_s: line.offset_s }));
    if (res.ok) {
      await loadNotes();
      say("Highlighted. It's in your notebook.");
    }
  }

  async function toggleSaved() {
    const on = saved;
    setSaved(!on);
    if (on) await fetch(`/api/notes?favorite=${encodeURIComponent(talk.id)}`, { method: "DELETE" });
    else await fetch("/api/notes", json({ kind: "favorite", talk_id: talk.id, conference_id: conference }));
    say(on ? "Removed from saved talks." : "Talk saved.");
  }

  async function saveNote(e?: React.FormEvent, override?: { text: string; offset?: number; quote?: string }) {
    e?.preventDefault();
    const text = override?.text ?? noteText.trim();
    if (!text && !about) return;
    const body = {
      kind: "note", talk_id: talk.id, conference_id: conference, text, folder_id: noteFolder || undefined,
      quote: override?.quote ?? about?.text,
      offset_s: override?.offset ?? (about ? about.offset : pinMoment && phase !== "waiting" ? elapsed : undefined),
    };
    const res = await fetch("/api/notes", json(body));
    if (!res.ok) return say(((await res.json()) as { error?: string }).error ?? "Could not save the note.");
    if (!override) { setNoteText(""); setAbout(null); }
    await loadNotes();
    say(`Saved to ${folders.find((f) => f.id === noteFolder)?.name ?? "your notebook"}.`);
  }

  async function removeNote(id: string) {
    setNotes((all) => all.filter((n) => n.id !== id));
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
  }

  // ---- Assistant ----
  const addCard = (c: Omit<Card, "at">) => setCards((all) => [{ ...c, at: elapsed }, ...all]);
  const finish = (id: string, patch: Partial<Card>) => setCards((all) => all.map((c) => (c.id === id ? { ...c, pending: false, ...patch } : c)));

  async function run(kind: "catchup" | "apply" | "explain") {
    const id = crypto.randomUUID();
    const titles = { catchup: "Catching you up…", apply: "Connecting this to your work…", explain: "Explaining the last 30 seconds…" };
    addCard({ id, kind, title: titles[kind], pending: true });
    try {
      if (kind === "catchup") {
        const d = (await (await fetch(`/api/talks/${talk.id}/catchup`, { method: "POST" })).json()) as CatchUpResponse;
        finish(id, { title: `So far, ${formatOffset(d.covered_s)} in`, body: d.summary });
      } else if (kind === "apply") {
        const d = (await (await fetch(`/api/talks/${talk.id}/apply`, { method: "POST" })).json()) as ApplyResponse;
        finish(id, { title: "How this applies to you", body: d.text });
      } else {
        const d = (await (await fetch(`/api/talks/${talk.id}/signal`, json({ type: "lost", level: "curious beginner" }))).json()) as ExplainResponse;
        finish(id, { title: "The last 30 seconds, again", body: d.explanation });
      }
    } catch {
      finish(id, { title: "Something went wrong", error: "Couldn't reach Sidecar. Try again." });
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    const id = crypto.randomUUID();
    addCard({ id, kind: "ask", title: q, pending: true });
    try {
      const res = await fetch(`/api/talks/${talk.id}/ask`, json({ question: q }));
      const data = (await res.json()) as AskResponse & { error?: string };
      if (!res.ok) throw new Error(data.error);
      finish(id, { body: data.answer, citations: data.citations, nextStops: data.next_stops });
    } catch (err) {
      finish(id, { error: (err as Error).message || "Something went wrong." });
    }
  }

  async function gotIt() {
    await fetch(`/api/talks/${talk.id}/signal`, json({ type: "got_it" }));
    say("Thanks. The speaker sees this anonymously.");
  }

  const jumpTo = (c: Citation) => {
    if (!c.same_talk) return;
    autoScroll.current = false;
    const el = box.current?.querySelector<HTMLElement>(`[data-offset="${c.offset_s}"]`);
    if (box.current && el) box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight / 2, behavior: "smooth" });
    setFlash(c.offset_s);
    setTimeout(() => setFlash(null), 1800);
  };

  const ready = phase !== "waiting";
  const talkNotes = notes.filter((n) => n.kind !== "favorite");

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-8 sm:pt-8">
      <Link href={conference ? `/c/${conference}/schedule` : "/"} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <IconArrowLeft size={16} /> Schedule
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PhasePill phase={phase} elapsed={elapsed} />
            <span className="pill">{roomLabel(talk.room_id)}</span>
            <span className="pill">{timeLabel(talk.start)} – {timeLabel(talk.end)}</span>
            <span className="pill capitalize">{talk.level}</span>
          </div>
          <h1 className="mt-3 text-2xl leading-tight sm:text-3xl">{talk.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {talk.speaker}
            {talk.accessibility?.step_free && <span> · Step-free access</span>}
            {talk.accessibility?.quiet_room_nearby && <span> · Quiet room nearby</span>}
          </p>
        </div>
        <button type="button" className="btn" aria-pressed={saved} onClick={toggleSaved}>
          <IconBookmark size={16} filled={saved} /> {saved ? "Saved" : "Save talk"}
        </button>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* Transcript */}
        <section className="card flex min-h-[26rem] flex-col overflow-hidden lg:h-[calc(100dvh-14rem)]" aria-label="Transcript">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <h2 className="text-sm">Transcript</h2>
            {phase === "live" && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-good">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-good" /> Currently transcribing
              </span>
            )}
            {!connected && <span className="text-xs text-warn">Reconnecting…</span>}
            <div className="ml-auto flex items-center gap-1" role="group" aria-label="Text size">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSize((s) => Math.max(0, s - 1))} aria-label="Smaller text">A−</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSize((s) => Math.min(2, s + 1))} aria-label="Larger text">A+</button>
            </div>
          </div>

          {phase === "waiting" ? (
            <Waiting talk={talk} msLeft={start - now} onNote={() => setTab("notes")} />
          ) : (
            <div className="relative min-h-0 flex-1">
              <div
                ref={box}
                className="h-full overflow-y-auto px-2 py-3"
                aria-live={phase === "live" ? "polite" : undefined}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                  autoScroll.current = near;
                  setAtBottom(near);
                }}
              >
                {lines.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-ink-soft">
                    <IconMic size={26} />
                    <p className="font-medium text-ink-2">{phase === "live" ? "Listening…" : "No transcript was captured"}</p>
                    {phase === "live" && <p className="text-sm">Lines appear here a moment after they&apos;re spoken.</p>}
                  </div>
                )}
                <ol>
                  {lines.map((l) => {
                    const on = highlighted.has(`${l.offset_s}|${l.text}`);
                    return (
                      <li key={l.id} data-offset={l.offset_s} className={`group grid grid-cols-[3.25rem_1fr_auto] items-start gap-2 rounded-lg px-3 py-1.5 transition-colors hover:bg-paper ${flash === l.offset_s ? "bg-warn-soft" : on ? "bg-accent-soft/60" : ""}`}>
                        <span className="pt-0.5 text-xs tabular-nums text-ink-soft">{formatOffset(l.offset_s)}</span>
                        <p className={`${TEXT_SIZES[size]} leading-relaxed`}>{l.text}</p>
                        <span className="flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                          <button type="button" className={`btn btn-ghost btn-icon ${on ? "text-accent" : ""}`} aria-label={on ? "Remove highlight" : "Highlight this line"} aria-pressed={on} onClick={() => toggleHighlight(l)}>
                            <IconStar size={15} filled={on} />
                          </button>
                          <button type="button" className="btn btn-ghost btn-icon" aria-label="Write a note about this line" onClick={() => { setAbout({ text: l.text, offset: l.offset_s }); setTab("notes"); }}>
                            <IconPencil size={15} />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
              {phase === "live" && !atBottom && (
                <button type="button" className="btn btn-primary btn-sm absolute bottom-3 left-1/2 -translate-x-1/2 shadow-[var(--shadow-pop)]" onClick={() => { autoScroll.current = true; box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }}>
                  Jump to live
                </button>
              )}
            </div>
          )}
        </section>

        {/* Side panel */}
        <section className="card flex min-h-[26rem] flex-col overflow-hidden lg:h-[calc(100dvh-14rem)]" aria-label="Assistant and notes">
          <div className="flex border-b border-line p-1.5" role="tablist" aria-label="Side panel">
            {([["assistant", "Assistant"], ["notes", `Notes${talkNotes.length ? ` (${talkNotes.length})` : ""}`]] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === id ? "bg-paper-2 text-ink" : "text-ink-soft hover:text-ink"}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === "assistant" ? (
            <>
              <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2.5">
                <button type="button" className="btn btn-sm" disabled={!ready} onClick={() => run("catchup")}><IconSparkle size={14} /> Catch me up</button>
                <button type="button" className="btn btn-sm" disabled={!ready} onClick={() => run("apply")}>Apply to my work</button>
                <button type="button" className="btn btn-sm" disabled={phase !== "live"} onClick={() => run("explain")}>Explain the last 30s</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={phase !== "live"} onClick={gotIt}><IconCheck size={14} /> Got it</button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                {cards.length === 0 && (
                  <p className="px-1 py-6 text-center text-sm text-ink-soft">
                    {ready ? "Ask a question or catch up on what you missed. Answers come from what the speaker actually said." : "Catch-up, questions and answers unlock when the session starts."}
                  </p>
                )}
                {cards.map((c) => <AnswerCard key={c.id} card={c} onJump={jumpTo} onSave={() => saveNote(undefined, { text: [c.kind === "ask" ? `Q: ${c.title}` : c.title, c.body].filter(Boolean).join("\n"), offset: c.at })} />)}
              </div>

              <form onSubmit={ask} className="flex items-end gap-2 border-t border-line p-3">
                <label htmlFor="ask" className="sr-only">Ask about this talk</label>
                <textarea id="ask" rows={1} className="input max-h-28 min-h-[2.5rem] resize-none" placeholder={ready ? "Ask about this talk…" : "Questions open when the session starts"} disabled={!ready}
                  value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
                <button type="submit" className="btn btn-primary btn-icon h-10 w-10" disabled={!ready || !question.trim()} aria-label="Send question"><IconSend size={16} /></button>
              </form>
            </>
          ) : (
            <>
              <form onSubmit={saveNote} className="space-y-2.5 border-b border-line p-3">
                {about && (
                  <div className="flex items-start gap-2 rounded-lg bg-paper px-3 py-2 text-sm">
                    <p className="min-w-0 flex-1 text-ink-soft"><span className="font-medium text-ink-2">{formatOffset(about.offset)}</span> “{about.text}”</p>
                    <button type="button" className="btn btn-ghost btn-icon -my-1" aria-label="Remove quote" onClick={() => setAbout(null)}><IconX size={14} /></button>
                  </div>
                )}
                <label htmlFor="note" className="sr-only">Write a note</label>
                <textarea id="note" rows={3} className="input" placeholder={phase === "waiting" ? "What do you hope to get from this talk?" : "Write a note…"} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="folder" className="sr-only">Folder</label>
                  <select id="folder" className="input w-auto py-1.5 text-sm" value={noteFolder} onChange={(e) => setNoteFolder(e.target.value)}>
                    <option value="">No folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  {ready && !about && (
                    <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <input type="checkbox" className="accent-accent" checked={pinMoment} onChange={(e) => setPinMoment(e.target.checked)} /> Pin to {formatOffset(elapsed)}
                    </label>
                  )}
                  <button type="submit" className="btn btn-primary btn-sm ml-auto" disabled={!noteText.trim() && !about}>Save note</button>
                </div>
              </form>

              <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
                {talkNotes.length === 0 && <li className="px-1 py-6 text-center text-sm text-ink-soft">Notes and highlights from this talk show up here, and in your notebook.</li>}
                {talkNotes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-line p-3 text-sm">
                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                      {n.offset_s !== undefined && <span className="tabular-nums font-medium text-ink-2">{formatOffset(n.offset_s)}</span>}
                      <span className="pill">{n.kind === "highlight" ? "Highlight" : "Note"}</span>
                      {n.folder_id && <span className="pill">{folders.find((f) => f.id === n.folder_id)?.name ?? "Folder"}</span>}
                      <button type="button" className="btn btn-ghost btn-icon ml-auto -my-1" aria-label="Delete note" onClick={() => removeNote(n.id)}><IconTrash size={14} /></button>
                    </div>
                    {n.quote && <p className="mt-1.5 border-l-2 border-line-strong pl-2.5 text-ink-soft">{n.quote}</p>}
                    {n.text && <p className="mt-1.5 whitespace-pre-wrap">{n.text}</p>}
                  </li>
                ))}
              </ul>
              {conference && <div className="border-t border-line px-3 py-2.5 text-sm"><Link href={`/c/${conference}/notebook`} className="font-medium text-accent-ink hover:underline">Open my notebook</Link></div>}
            </>
          )}
        </section>
      </div>

      {toast && <p role="status" className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 animate-rise rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-pop)] lg:bottom-8">{toast}</p>}
    </div>
  );
}

function PhasePill({ phase, elapsed }: { phase: "waiting" | "live" | "ended"; elapsed: number }) {
  if (phase === "live") return <span className="pill bg-good-soft text-good"><span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-good" /> Live · {formatOffset(elapsed)}</span>;
  if (phase === "ended") return <span className="pill">Session ended</span>;
  return <span className="pill bg-warn-soft text-warn"><span className="h-1.5 w-1.5 rounded-full bg-warn" /> Waiting for session</span>;
}

function Waiting({ talk, msLeft, onNote }: { talk: SessionTalk; msLeft: number; onNote: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center">
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/15" />
        <IconMic size={24} />
      </span>
      <h2 className="mt-5 text-xl">Waiting for the session to start</h2>
      <p className="mt-1 text-sm text-ink-soft">Starts at {timeLabel(talk.start)} in {roomLabel(talk.room_id)}</p>
      <p className="mt-5 text-4xl font-semibold tabular-nums tracking-tight">{formatOffset(msLeft / 1000)}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-ink-soft">until it begins</p>

      <div className="mt-8 w-full max-w-md rounded-xl bg-paper p-4 text-left">
        <p className="eyebrow">About this talk</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{talk.abstract}</p>
        {talk.topics.length > 0 && <p className="mt-3 flex flex-wrap gap-1.5">{talk.topics.map((t) => <span key={t} className="pill bg-surface">{t}</span>)}</p>}
        <button type="button" className="btn btn-sm mt-4" onClick={onNote}><IconPencil size={14} /> Jot down what you hope to learn</button>
      </div>
    </div>
  );
}

function AnswerCard({ card: c, onJump, onSave }: { card: Card; onJump: (c: Citation) => void; onSave: () => void }) {
  const items = (c.body ?? "").split("\n").filter(Boolean);
  const bullets = items.length > 1 && items.every((l) => l.startsWith("- "));
  return (
    <article className="animate-rise rounded-xl border border-line p-3.5">
      <p className="text-xs font-medium text-ink-soft">{KIND_LABEL[c.kind]}</p>
      <p className="mt-0.5 text-sm font-semibold leading-snug">{c.title}</p>
      {c.pending && <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" /> Thinking…</p>}
      {c.error && <p role="alert" className="mt-2 text-sm text-bad">{c.error}</p>}
      {c.body && (bullets ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">{items.map((l) => <li key={l}>{l.slice(2)}</li>)}</ul>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
      ))}
      {c.citations && c.citations.length > 0 && (
        <p className="mt-2.5 flex flex-wrap gap-1.5">
          {c.citations.slice(0, 4).map((cit, i) => (
            <button key={i} type="button" className="pill hover:bg-accent-soft" disabled={!cit.same_talk} onClick={() => onJump(cit)} title={cit.same_talk ? "Jump to this moment" : cit.talk_title}>
              {cit.same_talk ? formatOffset(cit.offset_s) : cit.talk_title.slice(0, 22)}
            </button>
          ))}
        </p>
      )}
      {c.nextStops && c.nextStops.length > 0 && (
        <div className="mt-3 rounded-lg bg-paper p-2.5 text-sm">
          <p className="eyebrow">Where to go next</p>
          <ul className="mt-1 space-y-1">{c.nextStops.map((s) => <li key={s.talk_id}><Link className="font-medium hover:underline" href={`/talk/${s.talk_id}`}>{s.title}</Link> <span className="text-ink-soft">· {timeLabel(s.start)}</span></li>)}</ul>
        </div>
      )}
      {c.body && !c.pending && <button type="button" className="btn btn-ghost btn-sm mt-2 -ml-2" onClick={onSave}><IconPencil size={14} /> Save to notes</button>}
    </article>
  );
}
