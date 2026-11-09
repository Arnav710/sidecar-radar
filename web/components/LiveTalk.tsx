"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskResponse, CaptionsResponse, Citation, ExplainResponse, TranscriptLine } from "@sidecar/shared";
import { formatOffset, offsetSince } from "@sidecar/shared";
import { Logo } from "./Logo";
import { roomLabel, timeLabel } from "./format";

type PublicTalk = { id: string; title: string; speaker: string; room_id: string; start: string; end: string; level: string };

type Card =
  | { kind: "answer"; id: string; question: string; data: AskResponse }
  | { kind: "explain"; id: string; data: ExplainResponse }
  | { kind: "pending"; id: string; label: string }
  | { kind: "error"; id: string; message: string };

type Burst = { id: number; emoji: string; x: number };

const POLL_MS = 1500;

export function LiveTalk({ talk }: { talk: PublicTalk }) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [question, setQuestion] = useState("");
  const [askError, setAskError] = useState("");
  const [size, setSize] = useState(1); // caption size step: 0 small, 1 normal, 2 large
  const [elapsed, setElapsed] = useState(() => offsetSince(talk.start));
  const [flash, setFlash] = useState<number | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [connected, setConnected] = useState(true);
  const since = useRef<string | undefined>(undefined);
  const captionsBox = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  // Poll for new caption lines.
  useEffect(() => {
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
            const seen = new Set(prev.map((l) => l.offset_s));
            return [...prev, ...data.lines.filter((l) => !seen.has(l.offset_s))].sort((a, b) => a.offset_s - b.offset_s);
          });
        }
      } catch {
        setConnected(false);
      }
      if (!stop) setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [talk.id]);

  // Talk clock.
  useEffect(() => {
    const t = setInterval(() => setElapsed(offsetSince(talk.start)), 1000);
    return () => clearInterval(t);
  }, [talk.start]);

  // Keep the newest caption in view unless the reader scrolled up. Scroll only
  // the caption panel, never the page.
  useEffect(() => {
    const box = captionsBox.current;
    if (box && autoScroll.current) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const burst = (emoji: string) => {
    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, emoji, x: 20 + Math.random() * 60 }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1400);
  };

  const signal = useCallback(
    async (type: "lost" | "got_it" | "star") => {
      burst(type === "lost" ? "😵‍💫" : type === "got_it" ? "💡" : "⭐");
      if (type !== "lost") {
        fetch(`/api/talks/${talk.id}/signal`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type }) });
        return;
      }
      const id = crypto.randomUUID();
      setCards((c) => [{ kind: "pending", id, label: "Re-explaining the last 30 seconds…" }, ...c]);
      try {
        const res = await fetch(`/api/talks/${talk.id}/signal`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, level: "curious beginner" }) });
        const data = (await res.json()) as ExplainResponse;
        setCards((c) => c.map((x) => (x.id === id ? { kind: "explain", id, data } : x)));
      } catch {
        setCards((c) => c.map((x) => (x.id === id ? { kind: "error", id, message: "Couldn't reach Sidecar. Try again." } : x)));
      }
    },
    [talk.id],
  );

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return setAskError("Type a question first.");
    setAskError("");
    setQuestion("");
    const id = crypto.randomUUID();
    setCards((c) => [{ kind: "pending", id, label: `“${q}”` }, ...c]);
    try {
      const res = await fetch(`/api/talks/${talk.id}/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q }) });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = (await res.json()) as AskResponse;
      setCards((c) => c.map((x) => (x.id === id ? { kind: "answer", id, question: q, data } : x)));
    } catch (err) {
      setCards((c) => c.map((x) => (x.id === id ? { kind: "error", id, message: String((err as Error).message || "Something went wrong.") } : x)));
    }
  };

  const jumpTo = (c: Citation) => {
    if (!c.same_talk) return;
    autoScroll.current = false;
    const box = captionsBox.current;
    const line = document.getElementById(`line-${c.offset_s}`);
    if (box && line) box.scrollTo({ top: line.offsetTop - box.clientHeight / 2, behavior: "smooth" });
    setFlash(c.offset_s);
    setTimeout(() => setFlash(null), 1800);
  };

  const sizes = ["text-xl sm:text-2xl", "text-2xl sm:text-[2rem]", "text-3xl sm:text-[2.6rem]"];
  const latest = lines.at(-1)?.offset_s;

  return (
    <div className="min-h-dvh bg-ink text-paper [background-image:radial-gradient(rgba(255,246,230,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
      {/* Floating reactions */}
      <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 h-0" aria-hidden="true">
        {bursts.map((b) => (
          <span key={b.id} className="absolute text-5xl [animation:float-up_1.4s_ease-out_forwards]" style={{ left: `${b.x}%` }}>
            {b.emoji}
          </span>
        ))}
      </div>

      <header className="sticky top-0 z-40 border-b-2 border-ink-2 bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Logo dark />
          <div className="ml-2 hidden min-w-0 flex-1 sm:block">
            <p className="truncate font-display text-lg font-bold">{talk.title}</p>
            <p className="text-sm text-paper/60">{talk.speaker}</p>
          </div>
          <span className="chip ml-auto border-paper bg-lilac text-ink">{roomLabel(talk.room_id)}</span>
          <span className="chip border-paper bg-tangerine text-white">
            <span className="inline-block h-2 w-2 animate-pulse-dot rounded-full bg-white" /> LIVE {formatOffset(elapsed)}
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-40 pt-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Captions */}
        <section aria-label="Live captions" className="min-w-0">
          <div className="mb-3 flex items-center justify-between sm:hidden">
            <p className="font-display text-lg font-bold leading-tight">{talk.title}</p>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-mono text-xs uppercase tracking-widest text-paper/50">Live captions</h2>
            {!connected && <span className="chip border-paper/40 text-paper/70">reconnecting…</span>}
            <div className="ml-auto flex gap-1" role="group" aria-label="Caption size">
              <button className="chip border-paper/50 text-paper hover:bg-paper/10" onClick={() => setSize((s) => Math.max(0, s - 1))} aria-label="Smaller captions">A−</button>
              <button className="chip border-paper/50 text-paper hover:bg-paper/10" onClick={() => setSize((s) => Math.min(2, s + 1))} aria-label="Larger captions">A+</button>
            </div>
          </div>

          <div
            ref={captionsBox}
            className="relative h-[58dvh] overflow-y-auto rounded-[22px] border-2 border-paper/15 bg-ink-2/60 p-5 sm:h-[68dvh] sm:p-7"
            onScroll={(e) => {
              const el = e.currentTarget;
              autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            aria-live="polite"
          >
            {lines.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-paper/50">
                <span className="text-5xl animate-wiggle" aria-hidden="true">🎙️</span>
                <p className="font-display text-xl">Waiting for the speaker to start…</p>
                <p className="text-sm">Captions appear here a moment after they&apos;re spoken.</p>
              </div>
            )}
            <ol className="space-y-4">
              {lines.map((l) => {
                const isLatest = l.offset_s === latest;
                return (
                  <li
                    key={l.offset_s}
                    id={`line-${l.offset_s}`}
                    className={`grid animate-rise grid-cols-[3.5rem_1fr] gap-3 rounded-xl transition-colors ${flash === l.offset_s ? "bg-sun/25" : ""}`}
                  >
                    <span className="pt-2 font-mono text-xs text-paper/40">{formatOffset(l.offset_s)}</span>
                    <p className={`${sizes[size]} font-display font-medium leading-snug ${isLatest ? "text-paper" : "text-paper/55"}`}>
                      {isLatest ? <span className="[background:linear-gradient(transparent_62%,rgba(198,244,50,0.45)_62%)]">{l.text}</span> : l.text}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Ask + answers */}
        <aside className="min-w-0">
          <form onSubmit={ask} className="sticker border-paper bg-paper p-3 text-ink shadow-[4px_4px_0_0_var(--color-lime)]">
            <label htmlFor="ask" className="mb-2 block font-display text-lg font-extrabold">
              Ask privately <span className="text-sm font-medium text-ink-soft">· only you see this</span>
            </label>
            <div className="flex gap-2">
              <input
                id="ask"
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  if (askError) setAskError("");
                }}
                placeholder="What did she mean by tail sampling?"
                className="min-w-0 flex-1 rounded-full border-2 border-ink bg-white px-4 py-2 outline-none placeholder:text-ink-soft/70 focus:border-tangerine"
                maxLength={500}
              />
              <button className="btn bg-tangerine px-4 text-white" aria-label="Ask">Ask</button>
            </div>
            {askError && <p className="mt-2 text-sm font-semibold text-tangerine">{askError}</p>}
          </form>

          <div className="mt-5 space-y-4">
            {cards.length === 0 && (
              <div className="rounded-[18px] border-2 border-dashed border-paper/25 p-5 text-paper/60">
                <p className="font-display text-lg font-bold text-paper">Lost for a second? Don&apos;t raise your hand.</p>
                <p className="mt-1 text-sm">Tap <b>I&apos;m lost</b> and Sidecar re-explains the last 30 seconds, or ask anything above. Your answer quotes the exact moment it was said.</p>
              </div>
            )}
            {cards.map((c) => (
              <CardView key={c.id} card={c} onJump={jumpTo} />
            ))}
          </div>
        </aside>
      </main>

      {/* Signal dock */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink-2 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button onClick={() => signal("lost")} className="btn flex-1 border-paper bg-tangerine py-4 text-lg text-white shadow-[4px_4px_0_0_var(--color-paper)] sm:text-xl">
            <span aria-hidden="true">😵‍💫</span> I&apos;m lost
          </button>
          <button onClick={() => signal("got_it")} className="btn flex-1 border-paper bg-lime py-4 text-lg text-ink shadow-[4px_4px_0_0_var(--color-paper)] sm:text-xl">
            <span aria-hidden="true">💡</span> Got it
          </button>
          <button onClick={() => signal("star")} className="btn border-paper bg-sun px-5 py-4 text-lg text-ink shadow-[4px_4px_0_0_var(--color-paper)]" aria-label="Save this moment">
            <span aria-hidden="true">⭐</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CardView({ card, onJump }: { card: Card; onJump: (c: Citation) => void }) {
  if (card.kind === "pending") {
    return (
      <div className="sticker animate-pop border-paper bg-paper/95 p-4 text-ink">
        <p className="truncate text-sm text-ink-soft">{card.label}</p>
        <div className="mt-3 flex gap-1.5" aria-label="Thinking">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-tangerine" style={{ animationDelay: `${i * 160}ms` }} />
          ))}
        </div>
      </div>
    );
  }
  if (card.kind === "error") {
    return <div className="sticker animate-pop border-paper bg-bubble p-4 font-semibold text-ink">{card.message}</div>;
  }
  if (card.kind === "explain") {
    return (
      <div className="sticker animate-pop border-paper bg-sun p-4 text-ink" style={{ ["--tilt" as string]: "-0.8deg" }}>
        <p className="chip mb-2 bg-white">
          😵‍💫 → 💡 last 30 sec · {formatOffset(card.data.window.from_s)}–{formatOffset(card.data.window.to_s)}
        </p>
        <p className="text-[1.05rem] leading-relaxed">{card.data.explanation}</p>
      </div>
    );
  }
  const { data } = card;
  return (
    <div className="sticker animate-pop border-paper bg-paper p-4 text-ink">
      <p className="text-sm font-semibold text-ink-soft">You asked: “{card.question}”</p>
      <p className="mt-2 text-[1.05rem] leading-relaxed">{data.answer}</p>
      {data.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.citations.slice(0, 4).map((c, i) => (
            <button
              key={i}
              onClick={() => onJump(c)}
              className={`chip ${c.same_talk ? "bg-lime hover:bg-sun" : "bg-lilac"} transition-colors`}
              title={c.text}
            >
              {c.same_talk ? "▶ this talk" : `↗ ${roomLabel(c.room_id)}`} · {formatOffset(c.offset_s)}
            </button>
          ))}
        </div>
      )}
      {data.next_stops.length > 0 && (
        <div className="mt-4 border-t-2 border-dashed border-ink/20 pt-3">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">Where to go next</p>
          {data.next_stops.map((n) => (
            <a key={n.talk_id} href={`/talk/${n.talk_id}`} className="mt-2 block rounded-xl border-2 border-ink bg-sky/60 p-3 transition-transform hover:-translate-y-0.5">
              <p className="font-display font-bold leading-snug">{n.title}</p>
              <p className="text-sm text-ink-soft">
                {timeLabel(n.start)} · {roomLabel(n.room_id)} · {n.why}
              </p>
            </a>
          ))}
        </div>
      )}
      {data.mode === "extract" && <p className="mt-3 font-mono text-[11px] text-ink-soft">quoted from the transcript · add an OpenAI key for written answers</p>}
    </div>
  );
}
