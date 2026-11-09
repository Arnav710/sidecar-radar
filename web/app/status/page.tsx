import type { LatencySummary } from "@sidecar/shared";
import { healthSnapshot, SLO } from "@sidecar/shared";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Logo } from "@/components/Logo";
import { SpeedGauge } from "@/components/SpeedGauge";

export const dynamic = "force-dynamic";

// /status: "Is Sidecar keeping up?" Observability as part of the product. The
// same numbers are OpenTelemetry metrics in Dash0 (sidecar.caption.lag,
// sidecar.ask.latency, gen_ai.client.token.usage), where the dashboard and SLOs
// live. This page shows this server's last 15 minutes so organizers and
// attendees can see it without a Dash0 login.

const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`);
const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

function SloCard({ title, what, emoji, tilt, s }: { title: string; what: string; emoji: string; tilt: string; s: LatencySummary }) {
  const tone = s.count === 0 ? "bg-white" : s.healthy ? "bg-lime" : "bg-tangerine text-white";
  // Ids can't contain spaces, so slugify the title for aria-labelledby.
  const headingId = `${title.toLowerCase().replace(/\s+/g, "-")}-h`;
  const verdict = s.count === 0 ? "No data yet" : s.healthy ? "Meeting SLO" : "Missing SLO";
  return (
    <section className={`sticker flex flex-col gap-5 p-6 ${tilt}`} aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="font-display text-2xl font-extrabold">
            <span aria-hidden="true">{emoji} </span>
            {title}
          </h2>
          <p className="text-sm text-ink-soft">{what}</p>
        </div>
        <span className={`chip shrink-0 ${tone}`}>{verdict}</span>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
        <div className="flex w-full flex-col items-center sm:w-auto">
          <SpeedGauge valueMs={s.p95} thresholdMs={s.thresholdMs} label={title} />
          <p className="-mt-2 font-display text-4xl font-extrabold tabular-nums">{seconds(s.p95)}</p>
          <p className="font-mono text-xs uppercase tracking-wider text-ink-soft">p95 · 19 in 20 are faster</p>
        </div>

        <div className="flex w-full flex-1 flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-ink bg-white p-3">
              <dt className="font-mono text-xs uppercase tracking-wider text-ink-soft">Typical (p50)</dt>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{seconds(s.p50)}</dd>
            </div>
            <div className="rounded-xl border-2 border-ink bg-white p-3">
              <dt className="font-mono text-xs uppercase tracking-wider text-ink-soft">Events</dt>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{s.count}</dd>
            </div>
          </dl>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">Within target</span>
              <span className="font-display text-xl font-extrabold tabular-nums">{pct(s.withinSlo)}</span>
            </div>
            {/* The black tick marks the promise (95%); the fill is how we are doing. */}
            <div
              className="relative h-5 overflow-hidden rounded-full border-2 border-ink bg-white"
              role="img"
              aria-label={
                s.withinSlo === null
                  ? "No events yet"
                  : `${pct(s.withinSlo)} of ${s.count} events were under ${seconds(s.thresholdMs)}; the target is ${pct(SLO.target)}`
              }
            >
              <div className={`h-full ${s.withinSlo !== null && s.withinSlo < SLO.target ? "bg-tangerine" : "bg-lime"}`} style={{ width: `${(s.withinSlo ?? 0) * 100}%` }} />
              <div className="absolute inset-y-0 w-[3px] bg-ink" style={{ left: `${SLO.target * 100}%` }} />
            </div>
            <p className="mt-2 font-mono text-xs text-ink-soft">
              SLO: {pct(SLO.target)} under {seconds(s.thresholdMs)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function StatusPage() {
  const h = healthSnapshot();
  const dashboard = process.env.DASH0_DASHBOARD_URL;
  const noData = h.captionLag.count === 0 && h.answerLatency.count === 0;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 pb-24 pt-6 sm:px-6">
      <AutoRefresh seconds={15} />
      <div className="flex items-center justify-between">
        <Logo />
        <span className={`chip ${noData ? "bg-sun" : h.healthy ? "bg-lime" : "bg-tangerine text-white"}`}>
          <span aria-hidden="true">{noData ? "😴 " : h.healthy ? "🚀 " : "🐢 "}</span>
          {noData ? "Waiting for traffic" : h.healthy ? "All systems keeping up" : "Running behind"}
        </span>
      </div>

      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-soft">Status · last {h.windowMinutes} minutes</p>
        <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl">Is Sidecar keeping up with the room?</h1>
        <p className="text-ink-soft">
          Live captions only help if they arrive while the speaker is still on that slide. These are the two promises we
          measure on every caption and every answer.
        </p>
      </header>

      <SloCard title="Caption lag" emoji="💬" tilt="sm:-rotate-[0.4deg]" what="From speech on the room laptop to a caption anyone can read and search" s={h.captionLag} />
      <SloCard title="Answer time" emoji="⚡" tilt="sm:rotate-[0.4deg]" what="From a private question to its answer" s={h.answerLatency} />

      <section className="grid grid-cols-2 gap-3">
        <div className="sticker flex flex-col gap-1 bg-sky p-4">
          <span className="font-mono text-xs uppercase tracking-wider text-ink-soft"><span aria-hidden="true">🧠 </span>AI tokens used</span>
          <span className="font-display text-3xl font-extrabold tabular-nums">{h.llmTokens.toLocaleString("en-US")}</span>
        </div>
        <div className={`sticker flex flex-col gap-1 p-4 ${h.aiFallbacks > 0 ? "bg-sun" : "bg-white"}`}>
          <span className="font-mono text-xs uppercase tracking-wider text-ink-soft"><span aria-hidden="true">🛟 </span>AI calls that failed</span>
          <span className="font-display text-3xl font-extrabold tabular-nums">{h.aiFallbacks}</span>
        </div>
      </section>

      <p className="text-sm text-ink-soft">
        This page shows the server that answered you. The full history across every pod, with traces for each slow caption
        or answer, is in Dash0
        {dashboard ? (
          <>
            {" "}
            (<a className="underline" href={dashboard}>open the dashboard</a>)
          </>
        ) : null}
        .
      </p>
    </main>
  );
}
