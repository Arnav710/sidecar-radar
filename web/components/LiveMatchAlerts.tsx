"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BlindCard, ConnectResponse } from "@sidecar/shared";

const POLL_MS = 4000;

type Alert = { kind: "they_want"; card: BlindCard } | { kind: "mutual"; card: BlindCard };

// During a talk:
// - inline (showSuggestions): "people stuck on the same thing" after you ask,
//   each one opens their blind card
// - pop-ups only for real people: someone wants to meet you, and it's mutual
export function LiveMatchAlerts({ showSuggestions = false }: { showSuggestions?: boolean }) {
  const [cards, setCards] = useState<BlindCard[]>([]);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [open, setOpen] = useState<BlindCard | null>(null);
  const [busy, setBusy] = useState(false);
  const seen = useRef<Map<string, string> | null>(null);

  const poll = useCallback(async () => {
    const res = await fetch("/api/connect", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as ConnectResponse;
    setCards(data.cards);
    const real = data.cards.filter((c) => !c.blind.demo);
    const first = seen.current === null;
    const prev = seen.current ?? new Map<string, string>();
    let next: Alert | null = null;
    for (const c of real) {
      const before = prev.get(c.match_id);
      if (c.state === "mutual" && before !== "mutual" && !first) next = { kind: "mutual", card: c };
      else if (c.state === "they_want" && before !== "they_want") next ??= { kind: "they_want", card: c };
    }
    seen.current = new Map(real.map((c) => [c.match_id, c.state]));
    if (next) setAlert(next);
    setOpen((o) => (o ? data.cards.find((c) => c.match_id === o.match_id) ?? o : o));
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  const want = async (card: BlindCard) => {
    setBusy(true);
    const res = await fetch(`/api/matches/${encodeURIComponent(card.match_id)}/want`, { method: "POST" }).catch(() => null);
    if (res?.ok) {
      const updated = (await res.json()) as BlindCard;
      setOpen(updated);
      seen.current?.set(updated.match_id, updated.state);
      if (updated.state === "mutual") setAlert({ kind: "mutual", card: updated });
    }
    setBusy(false);
  };

  const suggestions = cards.filter((c) => c.kind === "same_problem").slice(0, 3);
  return (
    <>
      {showSuggestions && (
        <section className="rounded-xl border-2 border-ink bg-sun/40 p-3" aria-label="People stuck on the same thing">
          <p className="text-sm font-bold">🤝 People here stuck on the same thing</p>
          {suggestions.length === 0 ? (
            <p className="mt-1 text-xs text-ink-soft">Finding people… (matching runs a few seconds after you ask)</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {suggestions.map((c) => (
                <li key={c.match_id}>
                  <button type="button" onClick={() => setOpen(c)} className="flex w-full items-center gap-2 rounded-lg border border-ink bg-white px-2.5 py-2 text-left text-sm hover:bg-lime">
                    <span aria-hidden="true">🔒</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.blind.role || "Attendee"}{c.blind.years ? ` · ${c.blind.years} yrs` : ""}{c.blind.demo ? " · demo" : ""}</span>
                      <span className="block truncate text-xs text-ink-soft">Also stuck on: {c.shared_problem}</span>
                    </span>
                    <span className="chip bg-tangerine text-white">{Math.round(c.score * 100)}%</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {alert && !open && (
        <div role="status" className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md animate-pop rounded-2xl border-2 border-ink bg-sun p-4 shadow-[4px_4px_0_0_var(--color-ink)] sm:bottom-6">
          <p className="font-display text-lg font-extrabold leading-snug">
            {alert.kind === "they_want" && "👋 Someone wants to meet you"}
            {alert.kind === "mutual" && "🎉 It's mutual! Your conversation is ready"}
          </p>
          {alert.card.shared_problem && <p className="mt-1 text-sm">Shared problem: <b>{alert.card.shared_problem}</b></p>}
          <div className="mt-3 flex gap-2">
            {alert.kind === "mutual" ? (
              <Link href="/connect" className="btn btn-sm bg-tangerine text-white">📍 Meet now</Link>
            ) : (
              <button type="button" className="btn btn-sm bg-tangerine text-white" onClick={() => { setOpen(alert.card); setAlert(null); }}>
                See their card
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={() => setAlert(null)}>Later</button>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setOpen(null)}>
          <div role="dialog" aria-label="Recommended connection" className="w-full max-w-md animate-pop rounded-2xl border-2 border-ink bg-white p-5 shadow-[6px_6px_0_0_var(--color-ink)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className={`chip ${open.kind === "same_problem" ? "bg-tangerine text-white" : "bg-sky"}`}>
                {open.kind === "same_problem" ? "🔥 same problem" : "🧭 same interests"}
              </span>
              <span className="font-mono text-xs text-ink-soft">🔒 match {Math.round(open.score * 100)}%</span>
            </div>
            <p className="mt-3 font-display text-xl font-bold">
              {[open.blind.role || "Attendee", open.blind.years ? `${open.blind.years} yrs` : "", open.blind.company_type].filter(Boolean).join(" · ")}
            </p>
            {open.shared_problem && <p className="mt-2">Also stuck on: <b>{open.shared_problem}</b></p>}
            {open.blind.working_on && <p className="mt-1 text-sm text-ink-soft">Working on: {open.blind.working_on}</p>}
            {open.shared_talks.length > 0 && <p className="mt-2 text-sm text-ink-soft">Both at: {open.shared_talks.map((t) => t.title).join(", ")}</p>}
            <p className="mt-3 text-xs text-ink-soft">Names stay hidden until you both say yes.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {open.state === "mutual" ? (
                <Link href="/connect" className="btn bg-lime">🎉 It&apos;s mutual · open</Link>
              ) : open.state === "you_want" ? (
                <p className="font-semibold text-ink-soft">✅ You said yes. Waiting for them…</p>
              ) : (
                <button type="button" disabled={busy} className="btn bg-tangerine text-white" onClick={() => want(open)}>
                  {busy ? "Saving…" : open.state === "they_want" ? "They want to meet you · Say yes" : "Want to meet"}
                </button>
              )}
              <button type="button" className="btn" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
