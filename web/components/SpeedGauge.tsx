// A speedometer for one latency number, drawn as plain SVG on the server (no
// chart library, no client JavaScript). The dial runs from 0 to twice the SLO
// threshold: the lime zone is "inside the promise", yellow is "close", orange is
// "too slow". The needle points at the p95. The only motion is a short needle
// sweep (SVG animation), and the numbers are always printed next to the dial and
// in the aria-label, so the gauge is never the only way to read them
// (review rule 13).

const CX = 120;
const CY = 120;
const R = 88;
const BAND = 24;

/** A point on the dial. f is 0 (far left) to 1 (far right). */
function point(f: number, r: number = R): [number, number] {
  const angle = Math.PI * (1 - f);
  return [CX + r * Math.cos(angle), CY - r * Math.sin(angle)];
}

/** An arc along the dial from f0 to f1. */
function arc(f0: number, f1: number): string {
  const [x0, y0] = point(f0);
  const [x1, y1] = point(f1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const sec = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} s`;

export function SpeedGauge({ valueMs, thresholdMs, label }: { valueMs: number | null; thresholdMs: number; label: string }) {
  const max = thresholdMs * 2;
  const f = valueMs === null ? 0 : Math.min(1, Math.max(0, valueMs / max));
  // The needle is drawn pointing straight up; rotating -90 turns it to the far left.
  const rest = -90;
  const angle = -90 + 180 * f;
  const [tx, ty] = point(0.5, R + BAND / 2 + 9);

  return (
    <svg
      viewBox="0 0 240 150"
      className="h-auto w-full max-w-[17rem]"
      role="img"
      aria-label={
        valueMs === null
          ? `${label}: no data yet. The dial runs from 0 to ${sec(max)}; the target is ${sec(thresholdMs)}.`
          : `${label}: p95 is ${(valueMs / 1000).toFixed(1)} seconds. The target is ${sec(thresholdMs)}.`
      }
    >
      {/* Sticker outline, then the three zones on top of it. */}
      <path d={arc(0, 1)} fill="none" stroke="var(--color-ink)" strokeWidth={BAND + 7} strokeLinecap="round" />
      <path d={arc(0, 0.5)} fill="none" stroke="var(--color-lime)" strokeWidth={BAND} />
      <path d={arc(0.5, 0.75)} fill="none" stroke="var(--color-sun)" strokeWidth={BAND} />
      <path d={arc(0.75, 1)} fill="none" stroke="var(--color-tangerine)" strokeWidth={BAND} />

      {/* Tick marks between zones. */}
      {[0.25, 0.5, 0.75].map((t) => {
        const [x0, y0] = point(t, R - BAND / 2);
        const [x1, y1] = point(t, R + BAND / 2);
        return <line key={t} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--color-ink)" strokeWidth={t === 0.5 ? 3 : 1.5} />;
      })}

      {/* Scale labels. */}
      <text x={CX - R} y={CY + 22} textAnchor="middle" fontSize="11" fill="var(--color-ink-soft)" fontFamily="var(--font-mono)">
        0
      </text>
      <text x={CX + R} y={CY + 22} textAnchor="middle" fontSize="11" fill="var(--color-ink-soft)" fontFamily="var(--font-mono)">
        {sec(max)}
      </text>
      <text x={tx} y={ty} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-ink)" fontFamily="var(--font-mono)">
        target {sec(thresholdMs)}
      </text>

      {/* The needle sweeps from 0 to its reading. */}
      <g transform={`rotate(${angle} ${CX} ${CY})`} opacity={valueMs === null ? 0.35 : 1}>
        {valueMs !== null && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`${rest} ${CX} ${CY}`}
            to={`${angle} ${CX} ${CY}`}
            dur="0.9s"
            fill="freeze"
            calcMode="spline"
            keyTimes="0;1"
            keySplines="0.22 0.61 0.36 1"
          />
        )}
        <polygon points={`${CX - 5},${CY} ${CX + 5},${CY} ${CX},${CY - 74}`} fill="var(--color-ink)" />
      </g>
      <circle cx={CX} cy={CY} r="10" fill="var(--color-ink)" />
      <circle cx={CX} cy={CY} r="4" fill="var(--color-sun)" />
    </svg>
  );
}
