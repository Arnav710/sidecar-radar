"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Note, Plan, PlanAlternative, PlanBlock, SavedSchedule } from "@sidecar/shared";
import { durationLabel, roomLabel, timeLabel } from "./format";
import { IconBookmark, IconClock, IconPlus, IconQr, IconRefresh, IconSparkle, IconSwap, IconX } from "./Icons";
import { QrScanner } from "./QrScanner";

const MINUTE = 60_000;
const MIN_GAP_MIN = 15;

const ms = (iso: string) => Date.parse(iso);
const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => ms(a.start) < ms(b.end) && ms(b.start) < ms(a.end);
const sortBlocks = (blocks: PlanBlock[]) => [...blocks].sort((a, b) => ms(a.start) - ms(b.start));

function blockFrom(alt: PlanAlternative, alternatives?: PlanAlternative[]): PlanBlock {
  return {
    id: `${alt.kind}:${alt.ref}`, kind: alt.kind, start: alt.start, end: alt.end, title: alt.title, ref: alt.ref,
    room_id: alt.room_id, location: alt.location, url: alt.url, why: alt.why, ...(alternatives?.length ? { alternatives } : {}),
  };
}

function altFrom(b: PlanBlock): PlanAlternative {
  return { kind: b.kind === "event" ? "event" : "talk", ref: b.ref ?? "", title: b.title, start: b.start, end: b.end, room_id: b.room_id, location: b.location, url: b.url, why: b.why ?? "" };
}

type Status = "loading" | "ready" | "no-profile" | "error";
type SourceInfo = { source: "luma" | "slack" | "x"; configured: boolean };
const SOURCE_NAME = { luma: "Luma", slack: "Slack", x: "X" } as const;

export function ScheduleView({ conference }: { conference: string }) {
  const [blocks, setBlocks] = useState<PlanBlock[]>([]);
  const [pool, setPool] = useState<PlanAlternative[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const dirty = useRef(false);
  const q = `conf=${encodeURIComponent(conference)}`;

  // Keep "starts in 12 min" and "Live now" current.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const loadPlan = useCallback(async () => {
    const res = await fetch(`/api/schedule/plan?${q}`);
    if (res.status === 404) return setStatus("no-profile");
    if (!res.ok) return setStatus("error");
    const plan = (await res.json()) as Plan;
    setBlocks(plan.blocks);
    setPool(plan.pool);
    dirty.current = true;
    setStatus("ready");
  }, [q]);

  // Open the saved schedule if there is one, otherwise build a new plan.
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/schedule?${q}`);
      if (res.ok) {
        setBlocks(((await res.json()) as SavedSchedule).blocks);
        setStatus("ready");
        const plan = await fetch(`/api/schedule/plan?${q}`);
        if (plan.ok) setPool(((await plan.json()) as Plan).pool);
      } else if (res.status === 404) {
        await loadPlan(); // no schedule yet: make one
      } else {
        setStatus("error"); // a failure is not "no schedule": never plan over the saved one
      }
    })().catch(() => setStatus("error"));

    fetch("/api/sources").then((r) => r.json()).then((d: { sources: SourceInfo[] }) => setSources(d.sources)).catch(() => {});
    fetch(`/api/notes?kind=favorite&${q}`).then((r) => r.json()).then((d: { notes: Note[] }) => setSaved(new Set(d.notes.map((n) => n.talk_id)))).catch(() => {});
  }, [q, loadPlan]);

  // Save after every change.
  useEffect(() => {
    if (status !== "ready" || !dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    fetch(`/api/schedule?${q}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ blocks }) })
      .then((r) => setSaveState(r.ok ? "saved" : "error"))
      .catch(() => setSaveState("error"));
  }, [blocks, status, q]);

  const change = (next: PlanBlock[]) => {
    dirty.current = true;
    setNotice("");
    setBlocks(sortBlocks(next));
  };

  const remove = (id: string) => change(blocks.filter((b) => b.id !== id));

  /** What stops `alt` taking its time: any talk or event, or a handoff the attendee reserved. */
  const clashWith = (alt: PlanAlternative, ignoreId?: string) =>
    blocks.find((b) => b.id !== ignoreId && (b.kind !== "handoff" || b.handoff === "held") && overlaps(b, alt));

  const swap = (block: PlanBlock, alt: PlanAlternative) => {
    const clash = clashWith(alt, block.id);
    if (clash) return setNotice(`That overlaps "${clash.title}". Remove it first.`);
    const others = (block.alternatives ?? []).filter((a) => a.ref !== alt.ref);
    change([...blocks.filter((b) => b.id !== block.id && !(b.kind === "handoff" && overlaps(b, alt))), blockFrom(alt, [altFrom(block), ...others])]);
    setSwapping(null);
  };

  const addFromPool = (alt: PlanAlternative) => {
    const clash = clashWith(alt);
    if (clash) return setNotice(`That overlaps "${clash.title}". Remove or swap it first.`);
    change([...blocks.filter((b) => !(b.kind === "handoff" && overlaps(b, alt))), blockFrom(alt)]);
    setPool((p) => p.filter((x) => x.ref !== alt.ref));
  };

  const addHandoff = (start: string, end: string) =>
    change([...blocks, { id: `handoff:${start}`, kind: "handoff", start, end, title: "Handoff slot", handoff: "open" }]);
  const setHandoff = (id: string, handoff: "open" | "held") => change(blocks.map((b) => (b.id === id ? { ...b, handoff } : b)));

  async function toggleSaved(talkId: string) {
    const on = saved.has(talkId);
    setSaved((s) => { const n = new Set(s); if (on) n.delete(talkId); else n.add(talkId); return n; });
    if (on) await fetch(`/api/notes?favorite=${encodeURIComponent(talkId)}`, { method: "DELETE" }).catch(() => {});
    else await fetch("/api/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "favorite", talk_id: talkId, conference_id: conference }) }).catch(() => {});
  }

  async function rebuild() {
    if (!window.confirm("Build a new schedule? This replaces your current one.")) return;
    setStatus("loading");
    await loadPlan().catch(() => setStatus("error"));
  }

  async function refreshSources() {
    setRefreshing(true);
    setNotice("");
    try {
      const res = await fetch("/api/sources", { method: "POST" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) setNotice(body.error ?? "Could not refresh events.");
      else {
        const plan = await fetch(`/api/schedule/plan?${q}`);
        if (plan.ok) setPool(((await plan.json()) as Plan).pool);
        setNotice("Events refreshed. New ones are under More to add.");
        setEditing(true);
      }
    } finally {
      setRefreshing(false);
    }
  }

  if (status === "loading") return <p role="status" className="text-ink-soft">Planning your day…</p>;
  if (status === "error") return <p role="alert" className="font-medium text-bad">Could not load your schedule. Is Elasticsearch connected?</p>;
  if (status === "no-profile") {
    return (
      <div className="card p-6">
        <p className="text-lg font-semibold">Sidecar plans your day from your profile.</p>
        <Link href="/onboarding" className="btn btn-primary mt-4">Make my profile</Link>
      </div>
    );
  }

  const nextId = blocks.find((b) => b.kind !== "handoff" && ms(b.end) > now)?.id;
  const unusedPool = pool.filter((a) => !blocks.some((b) => b.ref === a.ref));
  const counts = blocks.filter((b) => b.kind !== "handoff").length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => setScanning(true)}><IconQr size={16} /> Scan QR</button>
        <button type="button" className={`btn ${editing ? "border-accent bg-accent-soft text-accent-ink" : ""}`} aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
          <IconPlus size={16} /> {editing ? "Done editing" : "Edit schedule"}
        </button>
        <button type="button" className="btn" onClick={rebuild}><IconRefresh size={16} /> Rebuild</button>
        <span role="status" className="ml-auto text-xs text-ink-soft">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Could not save" : `${counts} planned`}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span>Events from</span>
        {sources.map((s) => (
          <span key={s.source} className={`pill ${s.configured ? "bg-good-soft text-good" : ""}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${s.configured ? "bg-good" : "bg-line-strong"}`} />
            {SOURCE_NAME[s.source]}{s.configured ? "" : " (not connected)"}
          </span>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={refreshSources} disabled={refreshing}>
          <IconRefresh size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {notice && <p role="status" className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{notice}</p>}
      {blocks.length === 0 && <p className="mt-8 text-ink-soft">Nothing matched yet. Use Edit schedule to add sessions, or refresh events.</p>}

      <ol className="mt-6">
        {blocks.map((b, i) => {
          const next = blocks[i + 1];
          const gapMin = next ? (ms(next.start) - ms(b.end)) / MINUTE : 0;
          return (
            <li key={b.id}>
              <Row block={b} now={now} isNext={b.id === nextId} editing={editing} swapOpen={swapping === b.id}
                saved={b.ref ? saved.has(b.ref) : false}
                onToggleSwap={() => setSwapping(swapping === b.id ? null : b.id)} onSwap={(alt) => swap(b, alt)}
                onRemove={() => remove(b.id)} onHandoff={(h) => setHandoff(b.id, h)} onSave={() => b.ref && toggleSaved(b.ref)} />
              {next && gapMin >= MIN_GAP_MIN && (
                <div className="grid grid-cols-[4.5rem_1fr] gap-3 sm:grid-cols-[6rem_1fr] sm:gap-5">
                  <span />
                  <div className="my-2 flex items-center justify-between rounded-lg border border-dashed border-line-strong px-3 py-1.5 text-xs text-ink-soft">
                    <span className="flex items-center gap-1.5"><IconClock size={13} /> {durationLabel(gapMin * MINUTE)} free · {timeLabel(b.end)} – {timeLabel(next.start)}</span>
                    <button type="button" className="font-semibold text-accent-ink hover:underline" onClick={() => addHandoff(b.end, next.start)}>Add handoff slot</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {editing && (
        <section className="mt-10" aria-labelledby="more">
          <h2 id="more" className="text-lg">More to add</h2>
          {unusedPool.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Nothing else is on yet.</p>
          ) : (
            <ul className="card mt-3 divide-y divide-line">
              {unusedPool.slice(0, 12).map((a) => (
                <li key={`${a.kind}:${a.ref}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="truncate text-xs text-ink-soft">{timeLabel(a.start)} · {a.kind === "talk" ? roomLabel(a.room_id ?? "") : a.location ?? "Side event"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {a.kind === "talk" && (
                      <button type="button" className="btn btn-ghost btn-icon" aria-label={saved.has(a.ref) ? `Unsave ${a.title}` : `Save ${a.title}`} aria-pressed={saved.has(a.ref)} onClick={() => toggleSaved(a.ref)}>
                        <IconBookmark size={16} filled={saved.has(a.ref)} />
                      </button>
                    )}
                    <button type="button" className="btn btn-sm" onClick={() => addFromPool(a)}><IconPlus size={14} /> Add</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {scanning && <QrScanner onClose={() => setScanning(false)} />}
    </div>
  );
}

function Row(props: {
  block: PlanBlock; now: number; isNext: boolean; editing: boolean; swapOpen: boolean; saved: boolean;
  onToggleSwap: () => void; onSwap: (alt: PlanAlternative) => void; onRemove: () => void; onHandoff: (h: "open" | "held") => void; onSave: () => void;
}) {
  const { block: b, now } = props;
  const minutes = (ms(b.end) - ms(b.start)) / MINUTE;
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-3 py-2 sm:grid-cols-[6rem_1fr] sm:gap-5">
      <div className="pt-4 text-right">
        <p className="text-sm font-semibold tabular-nums">{timeLabel(b.start)}</p>
        <p className="text-xs text-ink-soft">{durationLabel(minutes * MINUTE)}</p>
      </div>
      {b.kind === "handoff" ? <HandoffCard {...props} /> : <SessionCard {...props} now={now} />}
    </div>
  );
}

function StatusPill({ block, now }: { block: PlanBlock; now: number }) {
  if (now >= ms(block.end)) return <span className="pill">Ended</span>;
  if (now >= ms(block.start)) return <span className="pill bg-good-soft text-good"><span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-good" /> Live now</span>;
  return <span className="pill bg-paper-2">Starts in {durationLabel(ms(block.start) - now)}</span>;
}

function SessionCard({ block: b, now, isNext, editing, swapOpen, saved, onToggleSwap, onSwap, onRemove, onSave }: Parameters<typeof Row>[0] & { now: number }) {
  const ended = now >= ms(b.end);
  const isTalk = b.kind === "talk";
  const title = isTalk ? (
    <Link href={`/talk/${b.ref}`} className="after:absolute after:inset-0 hover:underline">{b.title}</Link>
  ) : b.url ? (
    <a href={b.url} target="_blank" rel="noreferrer" className="after:absolute after:inset-0 hover:underline">{b.title}</a>
  ) : (
    b.title
  );

  return (
    <article className={`card relative p-4 sm:p-5 ${ended ? "opacity-70" : ""} ${isNext ? "ring-2 ring-accent/30" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {isNext && <span className="pill bg-accent-soft text-accent-ink">Up next</span>}
        <StatusPill block={b} now={now} />
        <span className="pill">{isTalk ? roomLabel(b.room_id ?? "") : b.location ?? "Side event"}</span>
        {!isTalk && <span className="pill">Side event</span>}
      </div>
      <h3 className="mt-2 text-base leading-snug sm:text-lg">{title}</h3>
      {b.why && <p className="mt-1.5 flex gap-1.5 text-sm text-ink-soft"><IconSparkle size={14} className="mt-0.5 shrink-0 text-accent" />{b.why}</p>}
      <AccessibilityChips a={b.accessibility} />

      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-1.5">
        {isTalk && (
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={saved} onClick={onSave}>
            <IconBookmark size={15} filled={saved} /> {saved ? "Saved" : "Save"}
          </button>
        )}
        {b.alternatives && b.alternatives.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={swapOpen} onClick={onToggleSwap}>
            <IconSwap size={15} /> Swap
          </button>
        )}
        {editing && <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}><IconX size={14} /> Remove</button>}
      </div>

      {swapOpen && b.alternatives && (
        <ul className="relative z-10 mt-3 space-y-2 border-t border-line pt-3">
          {b.alternatives.map((alt) => (
            <li key={`${alt.kind}:${alt.ref}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{alt.title}</span>
                <span className="text-ink-soft"> · {timeLabel(alt.start)}</span>
                {alt.catch_up && <span className="pill ml-2 bg-sky">Catch up in Sidecar</span>}
              </span>
              <button type="button" className="btn btn-sm" onClick={() => onSwap(alt)}>Use this</button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function HandoffCard({ block: b, editing, onHandoff, onRemove }: Parameters<typeof Row>[0]) {
  const held = b.handoff === "held";
  return (
    <div className={`rounded-[14px] border border-dashed p-4 ${held ? "border-accent bg-accent-soft" : "border-line-strong bg-paper-2/60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{held ? "Handoff reserved" : "Open slot for a handoff"}</p>
          <p className="text-sm text-ink-soft">
            {held ? "A meeting with someone will be placed here when you both agree to meet." : "Kept free so Sidecar can set up a meeting with someone here."}
          </p>
        </div>
        <div className="flex gap-1.5">
          {held ? (
            <button type="button" className="btn btn-sm" onClick={() => onHandoff("open")}>Release</button>
          ) : (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => onHandoff("held")}>Add handoff</button>
          )}
          {editing && <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}><IconX size={14} /> Remove</button>}
        </div>
      </div>
    </div>
  );
}

/** Accessibility facts known to be true (repo rule 3). Unknown ones are left out rather than shown as "no". */
function AccessibilityChips({ a }: { a?: PlanBlock["accessibility"] }) {
  if (!a) return null;
  const items = [a.captions && "Live captions", a.step_free && "Step-free", a.quiet_room_nearby && "Quiet room nearby"].filter(Boolean) as string[];
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Accessibility">
      {items.map((t) => <li key={t} className="pill">{t}</li>)}
    </ul>
  );
}
