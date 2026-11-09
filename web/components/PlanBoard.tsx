"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan, PlanAlternative, PlanBlock, SavedSchedule } from "@sidecar/shared";
import { ROOM_COLORS, roomLabel, timeLabel } from "./format";

const MINUTE = 60_000;
const MIN_GAP_MIN = 15;

const ms = (iso: string) => Date.parse(iso);
const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => ms(a.start) < ms(b.end) && ms(b.start) < ms(a.end);
const sortBlocks = (blocks: PlanBlock[]) => [...blocks].sort((a, b) => ms(a.start) - ms(b.start));

/** Turn an alternative into a block, keeping the block it replaces as an option to swap back. */
function blockFrom(alt: PlanAlternative, alternatives?: PlanAlternative[]): PlanBlock {
  return {
    id: `${alt.kind}:${alt.ref}`, kind: alt.kind, start: alt.start, end: alt.end, title: alt.title, ref: alt.ref,
    room_id: alt.room_id, location: alt.location, url: alt.url, why: alt.why, ...(alternatives?.length ? { alternatives } : {}),
    ...(alt.accessibility ? { accessibility: alt.accessibility } : {}),
  };
}

function altFrom(b: PlanBlock): PlanAlternative {
  return { kind: b.kind === "event" ? "event" : "talk", ref: b.ref ?? "", title: b.title, start: b.start, end: b.end, room_id: b.room_id, location: b.location, url: b.url, why: b.why ?? "", ...(b.accessibility ? { accessibility: b.accessibility } : {}) };
}

type Status = "loading" | "ready" | "no-profile" | "error";

export function PlanBoard() {
  const [blocks, setBlocks] = useState<PlanBlock[]>([]);
  const [pool, setPool] = useState<PlanAlternative[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notice, setNotice] = useState("");
  const dirty = useRef(false);

  const loadPlan = useCallback(async () => {
    const res = await fetch("/api/schedule/plan");
    if (res.status === 404) return setStatus("no-profile");
    if (!res.ok) return setStatus("error");
    const plan = (await res.json()) as Plan;
    setBlocks(plan.blocks);
    setPool(plan.pool);
    dirty.current = true; // a fresh plan is saved so it survives a reload
    setStatus("ready");
  }, []);

  // Open the saved schedule if there is one, otherwise build a new plan.
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/schedule");
      if (res.ok) {
        const saved = (await res.json()) as SavedSchedule;
        setBlocks(saved.blocks);
        setStatus("ready");
        // The pool of other options comes from a fresh plan, so the "add" list stays current.
        const plan = await fetch("/api/schedule/plan");
        if (plan.ok) setPool(((await plan.json()) as Plan).pool);
      } else if (res.status === 404) {
        await loadPlan(); // no schedule yet: make one
      } else {
        setStatus("error"); // a failure is not "no schedule": never plan over the saved one
      }
    })().catch(() => setStatus("error"));
  }, [loadPlan]);

  // Save after every change.
  useEffect(() => {
    if (status !== "ready" || !dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    fetch("/api/schedule", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ blocks }) })
      .then((r) => setSaveState(r.ok ? "saved" : "error"))
      .catch(() => setSaveState("error"));
  }, [blocks, status]);

  const change = (next: PlanBlock[]) => {
    dirty.current = true;
    setNotice("");
    setBlocks(sortBlocks(next));
  };

  const remove = (id: string) => change(blocks.filter((b) => b.id !== id));

  /**
   * What stops `alt` from taking its time: any talk or event, or a handoff the
   * attendee reserved. Open handoff slots don't block; they give way.
   */
  const clashWith = (alt: PlanAlternative, ignoreId?: string) =>
    blocks.find((b) => b.id !== ignoreId && (b.kind !== "handoff" || b.handoff === "held") && overlaps(b, alt));

  const swap = (block: PlanBlock, alt: PlanAlternative) => {
    const clash = clashWith(alt, block.id);
    if (clash) return setNotice(`That overlaps "${clash.title}". Remove it first.`);
    const others = (block.alternatives ?? []).filter((a) => a.ref !== alt.ref);
    change([...blocks.filter((b) => b.id !== block.id && !(b.kind === "handoff" && overlaps(b, alt))), blockFrom(alt, [altFrom(block), ...others])]);
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

  async function replan() {
    if (!window.confirm("Build a new plan? This replaces your current schedule.")) return;
    setStatus("loading");
    await loadPlan().catch(() => setStatus("error"));
  }

  if (status === "loading") return <p role="status" className="text-ink-soft">Planning your day…</p>;
  if (status === "error") return <p role="alert" className="font-bold text-tangerine">Could not load your schedule. Is Elasticsearch connected?</p>;
  if (status === "no-profile") {
    return (
      <div className="sticker p-6">
        <p className="font-display text-xl font-bold">Sidecar plans your day from your profile.</p>
        <a href="/onboarding" className="btn mt-4 bg-tangerine text-white">Make my profile</a>
      </div>
    );
  }

  const unusedPool = pool.filter((a) => !blocks.some((b) => b.ref === a.ref));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={replan} className="btn bg-white">Plan my day again</button>
        <a href="/onboarding" className="btn bg-white">Edit my profile</a>
        <span role="status" className="font-mono text-xs text-ink-soft">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Could not save" : ""}
        </span>
      </div>
      {notice && <p role="alert" className="mt-3 font-bold text-tangerine">{notice}</p>}

      {blocks.length === 0 && <p className="mt-6 text-ink-soft">Nothing matched yet. Add something from the list below, or sync more events.</p>}

      <ol className="mt-6 space-y-3">
        {blocks.map((b, i) => {
          const next = blocks[i + 1];
          const gapMin = next ? (ms(next.start) - ms(b.end)) / MINUTE : 0;
          return (
            <li key={b.id}>
              <BlockCard block={b} onRemove={() => remove(b.id)} onSwap={(alt) => swap(b, alt)} onHandoff={(h) => setHandoff(b.id, h)} />
              {next && gapMin >= MIN_GAP_MIN && (
                <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-dashed border-ink-soft px-4 py-2 text-sm text-ink-soft">
                  <span className="font-mono">{timeLabel(b.end)} – {timeLabel(next.start)} · free</span>
                  <button type="button" className="font-display font-bold underline" onClick={() => addHandoff(b.end, next.start)}>
                    + Add handoff slot
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {unusedPool.length > 0 && (
        <section className="mt-12" aria-labelledby="more">
          <h2 id="more" className="text-2xl font-extrabold">More to add</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {unusedPool.slice(0, 10).map((a) => (
              <li key={`${a.kind}:${a.ref}`} className="sticker flex flex-col justify-between gap-2 p-4">
                <div>
                  <p className="font-mono text-xs text-ink-soft">{timeLabel(a.start)} · {a.kind === "talk" ? roomLabel(a.room_id ?? "") : a.location ?? "Side event"}</p>
                  <p className="font-display font-bold leading-snug">{a.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">{a.why}</p>
                </div>
                <button type="button" className="btn self-start bg-lime text-sm" onClick={() => addFromPool(a)}>+ Add to my day</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BlockCard({ block, onRemove, onSwap, onHandoff }: {
  block: PlanBlock; onRemove: () => void; onSwap: (alt: PlanAlternative) => void; onHandoff: (h: "open" | "held") => void;
}) {
  const when = `${timeLabel(block.start)} – ${timeLabel(block.end)}`;

  if (block.kind === "handoff") {
    const held = block.handoff === "held";
    return (
      <div className={`rounded-[18px] border-[2.5px] border-dashed border-ink p-4 ${held ? "bg-lilac" : "bg-paper-2"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs">{when}</p>
            <p className="font-display text-lg font-bold">{held ? "Handoff reserved" : "Handoff slot"}</p>
            <p className="text-sm text-ink-soft">
              {held ? "A match will be placed here when you agree to meet someone." : "Kept free so Sidecar can set up a meeting with someone here."}
            </p>
          </div>
          <div className="flex gap-2">
            {held ? (
              <button type="button" className="btn bg-white text-sm" onClick={() => onHandoff("open")}>Release</button>
            ) : (
              <button type="button" className="btn bg-lime text-sm" onClick={() => onHandoff("held")}>Add handoff</button>
            )}
            <button type="button" className="btn bg-white text-sm" onClick={onRemove}>Remove</button>
          </div>
        </div>
      </div>
    );
  }

  const chipColor = block.kind === "talk" ? ROOM_COLORS[block.room_id ?? ""] ?? "white" : "var(--color-bubble)";
  return (
    <article className="sticker p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink-soft">{when}</span>
        <span className="chip" style={{ background: chipColor }}>
          {block.kind === "talk" ? roomLabel(block.room_id ?? "") : block.location ?? "Side event"}
        </span>
        {block.kind === "event" && <span className="chip bg-white">side event</span>}
      </div>
      <h3 className="mt-2 text-xl font-bold leading-snug">
        {block.kind === "talk" ? <a className="hover:underline" href={`/talk/${block.ref}`}>{block.title}</a> : block.url ? <a className="hover:underline" href={block.url} target="_blank" rel="noreferrer">{block.title}</a> : block.title}
      </h3>
      {block.why && <p className="mt-1 text-sm text-ink-soft">{block.why}</p>}
      <AccessibilityChips a={block.accessibility} />

      {block.alternatives && block.alternatives.length > 0 && (
        <div className="mt-3 border-t-2 border-dashed border-ink/20 pt-3">
          <p className="font-display text-sm font-bold">Instead, at this time:</p>
          <ul className="mt-2 space-y-2">
            {block.alternatives.map((alt) => (
              <li key={`${alt.kind}:${alt.ref}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {alt.title} <span className="text-ink-soft">({timeLabel(alt.start)})</span>
                  {alt.catch_up && <span className="chip ml-2 bg-sky">catch it in Sidecar</span>}
                </span>
                <button type="button" className="btn bg-white px-3 py-1 text-xs" onClick={() => onSwap(alt)}>Swap to this</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <button type="button" className="font-display text-sm font-bold text-ink-soft underline" onClick={onRemove}>Remove from my day</button>
      </div>
    </article>
  );
}

/** Accessibility facts that are known to be true (repo rule 3). Unknown ones are left out rather than shown as "no". */
function AccessibilityChips({ a }: { a?: PlanBlock["accessibility"] }) {
  if (!a) return null;
  const items = [a.captions && "Live captions", a.step_free && "Step-free", a.quiet_room_nearby && "Quiet room nearby"].filter(Boolean) as string[];
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Accessibility">
      {items.map((t) => <li key={t} className="chip bg-white">{t}</li>)}
    </ul>
  );
}
