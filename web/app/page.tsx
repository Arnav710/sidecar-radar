import Link from "next/link";
import { Logo } from "@/components/Logo";
import { isLive, listTalks } from "@/lib/talks";

export const dynamic = "force-dynamic";

const ROOM_COLORS: Record<string, string> = {
  "room-a": "var(--color-sky)",
  "room-b": "var(--color-lilac)",
  "room-c": "var(--color-sun)",
  "room-d": "var(--color-bubble)",
  main: "var(--color-lime)",
};

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });
}

export default async function Home() {
  const { talks, connected } = await listTalks();
  const live = talks.filter((t) => isLive(t));
  const rest = talks.filter((t) => !isLive(t));

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
      <header className="flex items-center justify-between">
        <Logo />
        <nav className="flex gap-2 text-sm font-semibold">
          <span className="chip bg-white">Plan</span>
          <span className="chip bg-white">Connect</span>
          <span className="chip bg-white">Recap</span>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mt-10 grid gap-8 sm:mt-14 sm:grid-cols-[1.4fr_1fr] sm:items-center">
        <div>
          <p className="chip mb-5 bg-sun" style={{ ["--tilt" as string]: "-2deg" }}>
            <span className="inline-block h-2 w-2 animate-pulse-dot rounded-full bg-tangerine" /> live at the conference
          </p>
          <h1 className="text-5xl font-extrabold leading-[0.95] sm:text-7xl">
            Ask the talk <span className="marker">anything.</span>
            <br />
            Meet the people <span className="text-tangerine">stuck on the same thing.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            Live captions, private questions answered from what the speaker <em>just</em> said, and introductions
            that come with the conversation already started.
          </p>
        </div>

        {/* Floating stickers */}
        <div className="relative hidden h-72 sm:block" aria-hidden="true">
          <div className="sticker absolute left-2 top-2 w-56 rotate-[-5deg] animate-pop p-4" style={{ ["--tilt" as string]: "-5deg" }}>
            <p className="font-mono text-xs text-ink-soft">14:02 · OTel at Scale</p>
            <p className="mt-1 font-display text-lg font-bold">“How do I sample without losing errors?”</p>
          </div>
          <div className="sticker absolute right-0 top-28 w-52 rotate-[4deg] animate-pop bg-lime p-4 [animation-delay:150ms]" style={{ ["--tilt" as string]: "4deg" }}>
            <p className="font-display text-lg font-bold leading-tight">3 people here asked the same thing</p>
          </div>
          <div className="sticker absolute bottom-0 left-10 w-44 rotate-[-2deg] animate-pop bg-lilac p-3 [animation-delay:300ms]" style={{ ["--tilt" as string]: "-2deg" }}>
            <p className="font-mono text-xs">☕ Coffee bar · Hall B · 11:35</p>
          </div>
        </div>
      </section>

      {/* Talks */}
      <section className="mt-16">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-3xl font-extrabold">Happening now</h2>
          {!connected && <span className="chip bg-bubble">not connected to Elasticsearch yet</span>}
        </div>

        {connected && talks.length === 0 && <p className="text-ink-soft">No talks yet. Run <code>npm run seed</code>.</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          {[...live, ...rest].map((t, i) => (
            <Link
              key={t.id}
              href={`/talk/${t.id}`}
              className="sticker group block animate-rise p-5 transition-transform hover:-translate-y-1 hover:rotate-[-0.6deg]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="chip" style={{ background: ROOM_COLORS[t.room_id] ?? "white" }}>
                  {t.room_id.replace("room-", "Room ").toUpperCase()}
                </span>
                {isLive(t) ? (
                  <span className="chip bg-tangerine text-white">
                    <span className="inline-block h-2 w-2 animate-pulse-dot rounded-full bg-white" /> LIVE
                  </span>
                ) : (
                  <span className="font-mono text-xs text-ink-soft">{timeLabel(t.start)}</span>
                )}
              </div>
              <h3 className="mt-3 text-xl font-bold leading-snug group-hover:underline group-hover:decoration-tangerine group-hover:decoration-4 group-hover:underline-offset-4">
                {t.title}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                {t.speaker} · {t.level}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
