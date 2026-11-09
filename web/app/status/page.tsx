import type { LatencySummary } from "@sidecar/shared";
import { healthSnapshot, SLO } from "@sidecar/shared";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

// /status: "Is Sidecar keeping up?" Observability as part of the product. The
// same numbers are OpenTelemetry metrics in Dash0 (sidecar.caption.lag,
// sidecar.ask.latency, gen_ai.client.token.usage), where the dashboard and SLOs
// live. This page shows this server's last 15 minutes so organizers and
// attendees can see it without a Dash0 login.

const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`);
const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

function SloCard({ title, what, s }: { title: string; what: string; s: LatencySummary }) {
  const tone = s.count === 0 ? "bg-white" : s.healthy ? "bg-lime" : "bg-tangerine text-white";
  const verdict = s.count === 0 ? "No data yet" : s.healthy ? "Meeting SLO" : "Missing SLO";
  return (
    <section className="sticker flex flex-col gap-4 p-6" aria-labelledby={`${title}-h`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`${title}-h`} className="font-display text-2xl font-extrabold">
            {title}
          </h2>
          <p className="text-sm text-ink-soft">{what}</p>
        </div>
        <span className={`chip ${tone}`}>{verdict}</span>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="font-mono text-xs uppercase tracking-wider text-ink-soft">p95</dt>
          <dd className="font-display text-3xl font-extrabold tabular-nums">{seconds(s.p95)}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-wider text-ink-soft">p50</dt>
          <dd className="font-display text-3xl font-extrabold tabular-nums">{seconds(s.p50)}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-wider text-ink-soft">Within target</dt>
          <dd className="font-display text-3xl font-extrabold tabular-nums">{pct(s.withinSlo)}</dd>
        </div>
      </dl>
      <div>
        <div
          className="h-4 overflow-hidden rounded-full border-2 border-ink bg-white"
          role="img"
          aria-label={
            s.withinSlo === null
              ? "No events yet"
              : `${pct(s.withinSlo)} of ${s.count} events were under ${seconds(s.thresholdMs)}; the target is ${pct(SLO.target)}`
          }
        >
          <div className="h-full bg-lime" style={{ width: `${(s.withinSlo ?? 0) * 100}%` }} />
        </div>
        <p className="mt-2 font-mono text-xs text-ink-soft">
          SLO: {pct(SLO.target)} under {seconds(s.thresholdMs)} · {s.count} events
        </p>
      </div>
    </section>
  );
}

export default function StatusPage() {
  const h = healthSnapshot();
  const dashboard = process.env.DASH0_DASHBOARD_URL;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 pb-24 pt-6 sm:px-6">
      <AutoRefresh seconds={15} />
      <div className="flex items-center justify-between">
        <Logo />
        <span className={`chip ${h.healthy ? "bg-lime" : "bg-tangerine text-white"}`}>
          {h.healthy ? "All systems keeping up" : "Running behind"}
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

      <SloCard title="Caption lag" what="From speech on the room laptop to a caption anyone can read and search" s={h.captionLag} />
      <SloCard title="Answer time" what="From a private question to its answer" s={h.answerLatency} />

      <section className="grid grid-cols-2 gap-3">
        <div className="sticker flex flex-col gap-1 p-4">
          <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">AI tokens used</span>
          <span className="font-display text-3xl font-extrabold tabular-nums">{h.llmTokens.toLocaleString("en-US")}</span>
        </div>
        <div className="sticker flex flex-col gap-1 p-4">
          <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">Answers that fell back to quotes</span>
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
