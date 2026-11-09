"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BlindCard, ConnectResponse } from "@sidecar/shared";
import { AppShell } from "./AppShell";
import { MeetupCard } from "./MeetupCard";

const POLL_MS = 3000;

export function ConnectBoard() {
  const [data, setData] = useState<ConnectResponse | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const lastStates = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/connect", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as ConnectResponse;
      // In-app notifications when someone wants to meet you, or it becomes mutual.
      for (const c of next.cards) {
        const before = lastStates.current.get(c.match_id);
        if (before && before !== c.state) {
          if (c.state === "they_want") setToast("👋 Someone wants to meet you");
          if (c.state === "mutual") setToast("🎉 It's mutual! Your conversation is ready");
        }
        lastStates.current.set(c.match_id, c.state);
      }
      setData(next);
    } catch {
      /* keep showing the last cards */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const want = async (card: BlindCard) => {
    setBusy(card.match_id);
    setError("");
    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(card.match_id)}/want`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Couldn't save that.");
      const updated = (await res.json()) as BlindCard;
      lastStates.current.set(updated.match_id, updated.state);
      if (updated.state === "mutual") setToast("🎉 It's mutual! Your conversation is ready");
      setData((d) => (d ? { ...d, cards: d.cards.map((c) => (c.match_id === updated.match_id ? updated : c)) } : d));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell active="connect">
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-2 sm:px-6">

      {toast && (
        <div role="status" className="sticker fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-pop bg-sun px-5 py-3 font-display text-lg font-bold">
          {toast}
        </div>
      )}

      <section className="mt-6">
        <p className="chip bg-lilac">your hallway track</p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">
          People stuck on <span className="marker">the same thing</span> as you
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          Matched on the questions you asked and the rare talks you share, not job titles. Names stay hidden until you both say yes.
        </p>
      </section>

      {error && <p className="mt-4 font-semibold text-tangerine">{error}</p>}

      {data && !data.me.ready && (
        <div className="sticker mt-8 bg-sun p-6">
          <p className="font-display text-2xl font-bold">Ask a question in a talk to get matched</p>
          <p className="mt-2 text-ink-soft">Or tell us what you&apos;re working on so we can match you before the talk starts.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/" className="btn bg-white">Find a live talk</Link>
            <Link href="/onboarding" className="btn bg-tangerine text-white">Create my profile</Link>
          </div>
        </div>
      )}

      {data?.me.ready && data.cards.length === 0 && (
        <p className="mt-8 rounded-[18px] border-2 border-dashed border-ink/30 p-6 text-ink-soft">
          No matches yet. Ask an applied question in a talk (&ldquo;how do I…&rdquo;), and the people stuck on the same thing will show up here.
        </p>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {data?.cards.map((c, i) => (
          <MatchCard key={c.match_id} card={c} index={i} busy={busy === c.match_id} onWant={() => want(c)} />
        ))}
      </div>
    </main>
    </AppShell>
  );
}

function MatchCard({ card, index, busy, onWant }: { card: BlindCard; index: number; busy: boolean; onWant: () => void }) {
  const tilt = index % 2 ? "0.6deg" : "-0.6deg";
  if (card.state === "mutual" && card.reveal) return <RevealCard card={card} />;
  const b = card.blind;
  const who = [b.role || "Attendee", b.years ? `${b.years} yrs` : "", b.company_type].filter(Boolean).join(" · ");
  return (
    <article
      className={`sticker animate-pop p-5 ${card.state === "they_want" ? "bg-sun" : "bg-white"}`}
      style={{ ["--tilt" as string]: tilt, animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`chip ${card.kind === "same_problem" ? "bg-tangerine text-white" : "bg-sky"}`}>
          {card.kind === "same_problem" ? "🔥 same problem" : "🧭 same interests"}
        </span>
        <span className="font-mono text-xs text-ink-soft">🔒 match {Math.round(card.score * 100)}%</span>
      </div>
      <p className="mt-3 font-display text-lg font-bold leading-snug">{who}</p>
      {b.demo && <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">demo attendee</p>}
      {card.shared_problem && (
        <p className="mt-3 text-[1.05rem]">
          Also stuck on: <span className="font-semibold">{card.shared_problem}</span>
        </p>
      )}
      {b.working_on && <p className="mt-1 text-sm text-ink-soft">Working on: {b.working_on}</p>}
      {card.shared_talks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.shared_talks.slice(0, 3).map((t) => (
            <span key={t.id} className="chip bg-paper text-[11px]">🎟 {t.title.length > 34 ? `${t.title.slice(0, 32)}…` : t.title}</span>
          ))}
        </div>
      )}
      <div className="mt-4">
        {card.state === "mutual" ? (
          <p className="font-semibold">🎉 It&apos;s mutual! Writing your conversation kit…</p>
        ) : card.state === "you_want" ? (
          <p className="font-semibold text-ink-soft">✅ You said yes. Waiting for them…</p>
        ) : (
          <button onClick={onWant} disabled={busy} className={`btn ${card.state === "they_want" ? "bg-tangerine text-white" : "bg-lime"}`}>
            {busy ? "Saving…" : card.state === "they_want" ? "They want to meet you · Say yes" : "Want to meet"}
          </button>
        )}
      </div>
    </article>
  );
}

function RevealCard({ card }: { card: BlindCard }) {
  const { display_name, kit } = card.reveal!;
  return (
    <article className="sticker animate-pop bg-lime p-5 sm:col-span-2" style={{ ["--tilt" as string]: "0deg" }}>
      <p className="chip bg-white">🎉 it&apos;s mutual</p>
      <h2 className="mt-3 text-3xl font-extrabold">Meet {display_name}</h2>
      <p className="mt-2 text-lg">{kit.why}</p>
      <div className="mt-4 rounded-2xl border-2 border-ink bg-white p-4">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">Your opener</p>
        <p className="mt-1 font-display text-xl font-bold">&ldquo;{kit.opener}&rdquo;</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-ink bg-paper p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">Then ask</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {kit.follow_ups.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
        <div className="rounded-2xl border-2 border-ink bg-paper p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">What you each bring</p>
          <p className="mt-1"><b>You:</b> {kit.you_bring}</p>
          <p className="mt-1"><b>{display_name}:</b> {kit.they_bring}</p>
        </div>
      </div>
      <MeetupCard matchId={card.match_id} otherName={display_name} />
    </article>
  );
}
