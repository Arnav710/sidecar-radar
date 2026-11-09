"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

// First thing a new visitor sees. One promise, one button.
const TICKER = [
  { q: "How do I keep error traces when we sample?", n: 4, where: "Coffee bar, Hall B · 3:45" },
  { q: "How do I stop the collector getting OOM killed?", n: 3, where: "West lounge · 4:10" },
  { q: "How do I autoscale GPU pods without cold starts?", n: 2, where: "Quiet room · 4:30" },
  { q: "How do I get devs to actually use our platform?", n: 3, where: "Coffee bar, Hall C · 5:00" },
];

export function Landing() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % TICKER.length), 2800);
    return () => clearInterval(t);
  }, []);
  const item = TICKER[i];

  return (
    <main className="page-dark min-h-dvh overflow-hidden bg-ink text-paper [background-image:radial-gradient(rgba(255,246,230,0.07)_1px,transparent_1px)] [background-size:22px_22px]">
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-6">
        <header className="flex items-center justify-between">
          <Logo dark />
          <span className="chip border-paper bg-tangerine text-white">
            <span className="inline-block h-2 w-2 animate-pulse-dot rounded-full bg-white" /> Live at KubeCon NA 2026
          </span>
        </header>

        <section className="mt-14 grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] sm:text-7xl">
              Your questions
              <br />
              <span className="text-lime">find your people.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-paper/75 sm:text-xl">
              Ask the talk anything, live. Sidecar answers from what the speaker <em>just</em> said, finds the people in the building stuck on the same
              problem, and books where to meet. The conversation is already started.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/onboarding" className="btn bg-lime px-7 py-4 text-lg text-ink shadow-[4px_4px_0_0_var(--color-paper)]">
                Get started →
              </Link>
              <Link href="/talk/sidecar-live-pitch" className="btn border-paper bg-transparent px-6 py-4 text-lg text-paper shadow-[4px_4px_0_0_var(--color-paper)]">
                Join the live talk
              </Link>
            </div>
            <p className="mt-4 text-sm text-paper/50">No account. Names stay hidden until both people say yes.</p>
          </div>

          {/* Live ticker: a question turning into people and a place */}
          <div className="relative">
            <div key={i} className="animate-pop rounded-3xl border-2 border-paper bg-paper p-6 text-ink shadow-[8px_8px_0_0_var(--color-lime)]">
              <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">Someone just asked</p>
              <p className="mt-2 font-display text-2xl font-bold leading-snug">&ldquo;{item.q}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-ink bg-sun px-4 py-3">
                <span className="text-2xl" aria-hidden="true">🤝</span>
                <p className="font-semibold">
                  {item.n} people here are stuck on the same thing
                </p>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-ink bg-lilac px-4 py-3">
                <span className="text-2xl" aria-hidden="true">📍</span>
                <p className="font-semibold">Meet at {item.where}</p>
              </div>
            </div>
            <div className="absolute -right-3 -top-4 rotate-6 rounded-full border-2 border-paper bg-tangerine px-3 py-1 font-display text-sm font-bold text-white">
              live
            </div>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            { n: "1", t: "Ask", d: "Live captions of every talk. Ask privately, mid-talk. Lost? One tap re-explains the last 30 seconds.", c: "bg-lime" },
            { n: "2", t: "Match", d: "Your question, not your job title, finds the people stuck on the same problem. Blind until you both say yes.", c: "bg-sky" },
            { n: "3", t: "Meet", d: "An opener, follow-ups, and a time and place that fits both your schedules. Booked.", c: "bg-bubble" },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border-2 border-paper/80 bg-ink-2 p-5">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-paper font-display text-lg font-extrabold text-ink ${s.c}`}>{s.n}</span>
              <h3 className="mt-3 font-display text-2xl font-extrabold">{s.t}</h3>
              <p className="mt-1 text-paper/70">{s.d}</p>
            </div>
          ))}
        </section>

        <p className="mt-14 max-w-3xl font-display text-2xl leading-snug text-paper/85 sm:text-3xl">
          52% of attendees say meeting people who face <span className="text-lime">similar challenges</span> is what makes a conference worth it. Sidecar
          finds them for you.
        </p>
      </div>
    </main>
  );
}
