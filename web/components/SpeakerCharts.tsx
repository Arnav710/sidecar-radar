import type { MinuteBucket, QuestionCluster } from "@sidecar/shared";

// Charts for the speaker report, drawn as plain SVG on the server: no chart
// library, no client JavaScript. Each chart has an aria-label that states what
// it shows, and the page keeps the minute-by-minute table for screen readers
// (review rule 13). Withheld minutes (under the privacy floor) are drawn with a
// hatch so the speaker can tell "withheld" from "quiet".

const COLORS = {
  lost: "var(--color-tangerine)",
  questions: "var(--color-sky)",
  got_it: "var(--color-lime)",
  ink: "var(--color-ink)",
  soft: "var(--color-ink-soft)",
  grid: "color-mix(in srgb, var(--color-ink) 12%, transparent)",
};

type Metric = "lost" | "questions" | "got_it";
const METRICS: { key: Metric; label: string }[] = [
  { key: "lost", label: "I'm lost" },
  { key: "questions", label: "Asked" },
  { key: "got_it", label: "Got it" },
];

/** One entry per minute from 0 to the end of the talk, so quiet minutes show as gaps. */
export function fillMinutes(timeline: MinuteBucket[], durationMin: number): MinuteBucket[] {
  const last = Math.max(durationMin - 1, ...timeline.map((b) => b.minute), 0);
  const byMinute = new Map(timeline.map((b) => [b.minute, b]));
  return Array.from({ length: last + 1 }, (_, minute) =>
    byMinute.get(minute) ?? { minute, lost: 0, got_it: 0, questions: 0, withheld: false },
  );
}

function Hatch({ id }: { id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="color-mix(in srgb, var(--color-ink) 6%, transparent)" />
      <line x1="0" y1="0" x2="0" y2="6" stroke="color-mix(in srgb, var(--color-ink) 30%, transparent)" strokeWidth="2" />
    </pattern>
  );
}

/** Stacked columns per minute: lost, asked, got it. Spike minutes get a marker. */
export function ReactionTimeline({ minutes, spikeMinutes }: { minutes: MinuteBucket[]; spikeMinutes: number[] }) {
  const W = 720, H = 220, left = 32, right = 8, top = 18, bottom = 26;
  const plotW = W - left - right, plotH = H - top - bottom;
  const peak = Math.max(1, ...minutes.map((b) => b.lost + b.questions + b.got_it));
  const step = plotW / Math.max(1, minutes.length);
  const barW = Math.max(2, step * 0.72);
  const y = (v: number) => (v / peak) * plotH;
  const ticks = [0, Math.ceil(peak / 2), peak];
  const labelEvery = Math.max(1, Math.ceil(minutes.length / 12));
  const busiest = [...minutes].sort((a, b) => b.lost - a.lost)[0];
  const summary =
    `Reactions per minute over ${minutes.length} minutes. ` +
    (busiest && busiest.lost > 0 ? `Most "I'm lost" taps at minute ${busiest.minute} (${busiest.lost}).` : "No confusion taps yet.");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary}>
      <defs>
        <Hatch id="hatch-timeline" />
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - right} y1={top + plotH - y(t)} y2={top + plotH - y(t)} stroke={COLORS.grid} />
          <text x={left - 6} y={top + plotH - y(t) + 4} textAnchor="end" fontSize="10" fill={COLORS.soft}>
            {t}
          </text>
        </g>
      ))}
      {minutes.map((b, i) => {
        const x = left + i * step + (step - barW) / 2;
        if (b.withheld) {
          return <rect key={b.minute} x={x} y={top} width={barW} height={plotH} fill="url(#hatch-timeline)" rx="2" />;
        }
        let base = top + plotH;
        return (
          <g key={b.minute}>
            {METRICS.map(({ key }) => {
              const h = y(b[key]);
              base -= h;
              return h > 0 ? <rect key={key} x={x} y={base} width={barW} height={h} fill={COLORS[key]} /> : null;
            })}
            {spikeMinutes.includes(b.minute) && (
              <path
                d={`M${x + barW / 2 - 5} ${base - 10} h10 l-5 7 z`}
                fill={COLORS.ink}
              />
            )}
          </g>
        );
      })}
      <line x1={left} x2={W - right} y1={top + plotH} y2={top + plotH} stroke={COLORS.ink} strokeWidth="1.5" />
      {minutes.map((b, i) =>
        i % labelEvery === 0 ? (
          <text key={b.minute} x={left + i * step + step / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={COLORS.soft}>
            {b.minute}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** A grid of minutes × reaction type; darker means more of that reaction in that minute. */
export function ConfusionHeatmap({ minutes }: { minutes: MinuteBucket[] }) {
  const left = 64, top = 6, cellH = 26, gap = 2;
  const W = 720;
  const cellW = Math.max(4, (W - left - 8) / Math.max(1, minutes.length) - gap);
  const H = top + METRICS.length * (cellH + gap) + 22;
  const rowMax = Object.fromEntries(METRICS.map(({ key }) => [key, Math.max(1, ...minutes.map((b) => b[key]))])) as Record<Metric, number>;
  const labelEvery = Math.max(1, Math.ceil(minutes.length / 12));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Heatmap of reactions by minute: one row each for I'm lost, asked and got it. Darker cells mean more reactions.`}
    >
      <defs>
        <Hatch id="hatch-heatmap" />
      </defs>
      {METRICS.map(({ key, label }, r) => (
        <g key={key}>
          <text x={left - 8} y={top + r * (cellH + gap) + cellH / 2 + 4} textAnchor="end" fontSize="11" fill={COLORS.ink}>
            {label}
          </text>
          {minutes.map((b, i) => {
            const x = left + i * (cellW + gap);
            const yy = top + r * (cellH + gap);
            if (b.withheld) return <rect key={b.minute} x={x} y={yy} width={cellW} height={cellH} rx="3" fill="url(#hatch-heatmap)" />;
            const v = b[key];
            return (
              <rect
                key={b.minute}
                x={x}
                y={yy}
                width={cellW}
                height={cellH}
                rx="3"
                fill={v === 0 ? COLORS.grid : COLORS[key]}
                fillOpacity={v === 0 ? 1 : 0.25 + 0.75 * (v / rowMax[key])}
              />
            );
          })}
        </g>
      ))}
      {minutes.map((b, i) =>
        i % labelEvery === 0 ? (
          <text key={b.minute} x={left + i * (cellW + gap) + cellW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill={COLORS.soft}>
            {b.minute}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** How the room felt overall: got it vs lost, as one split bar. */
export function ClarityBar({ lost, gotIt }: { lost: number; gotIt: number }) {
  const total = lost + gotIt;
  const clear = total ? Math.round((gotIt / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-display text-4xl font-extrabold tabular-nums">{total ? `${clear}%` : "—"}</span>
        <span className="text-sm text-ink-soft">of taps were “Got it”</span>
      </div>
      <div
        className="flex h-6 overflow-hidden rounded-full border-2 border-ink"
        role="img"
        aria-label={total ? `${gotIt} got it and ${lost} I'm lost taps, ${clear}% got it` : "No taps yet"}
      >
        {total ? (
          <>
            <span style={{ width: `${clear}%`, background: COLORS.got_it }} />
            <span style={{ width: `${100 - clear}%`, background: COLORS.lost }} />
          </>
        ) : (
          <span className="w-full" style={{ background: COLORS.grid }} />
        )}
      </div>
      <div className="flex justify-between font-mono text-xs text-ink-soft">
        <span>{gotIt} got it</span>
        <span>{lost} lost</span>
      </div>
    </div>
  );
}

/** Horizontal bars: questions per theme, with how many people asked. */
export function ThemeBars({ clusters }: { clusters: QuestionCluster[] }) {
  const peak = Math.max(1, ...clusters.map((c) => c.questions));
  return (
    <ul className="flex flex-col gap-3" aria-label="Questions per theme">
      {clusters.map((c) => (
        <li key={c.topic} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-display font-bold">{c.topic}</span>
            <span className="font-mono text-xs tabular-nums text-ink-soft">
              {c.questions} questions · {c.people} people
            </span>
          </div>
          <div className="h-4 overflow-hidden rounded-full border-2 border-ink bg-white" aria-hidden="true">
            <div className="h-full" style={{ width: `${(c.questions / peak) * 100}%`, background: COLORS.questions }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
