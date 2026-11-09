// Live health for the in-app status page (/status). The same numbers go to
// Dash0 as OpenTelemetry metrics, where the real dashboard and SLOs live; this
// module keeps a short rolling window in the server's memory so attendees and
// organizers can see "is Sidecar keeping up?" inside the product itself.
//
// Each pod keeps its own window, so with 2 replicas the page shows the pod
// that served it. Dash0 has the full, all-pod history.

/** The SLOs we promise (PLAN.md §2e and §4). */
export const SLO = {
  /** Speech finalized on the room laptop → caption searchable. */
  captionLagMs: 12_000,
  /** Private question → answer returned. */
  answerLatencyMs: 6_000,
  /** Share of events that must meet the threshold. */
  target: 0.95,
} as const;

export const WINDOW_MS = 15 * 60_000;

interface Sample {
  at: number;
  value: number;
}

/** A time-bounded list of samples; old ones fall off as new ones arrive. */
export class RollingWindow {
  private samples: Sample[] = [];
  private readonly windowMs: number;
  private readonly maxSamples: number;

  constructor(windowMs: number = WINDOW_MS, maxSamples = 5_000) {
    this.windowMs = windowMs;
    this.maxSamples = maxSamples;
  }

  add(value: number, at: number = Date.now()): void {
    this.samples.push({ at, value });
    this.prune(at);
    if (this.samples.length > this.maxSamples) this.samples.splice(0, this.samples.length - this.maxSamples);
  }

  values(now: number = Date.now()): number[] {
    this.prune(now);
    return this.samples.map((s) => s.value);
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    let i = 0;
    while (i < this.samples.length && this.samples[i].at < cutoff) i++;
    if (i) this.samples.splice(0, i);
  }
}

/** Nearest-rank percentile; `p` in 0..100. Returns null for no data. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export interface LatencySummary {
  count: number;
  p50: number | null;
  p95: number | null;
  /** Share of events at or under the threshold (null when there is no data). */
  withinSlo: number | null;
  thresholdMs: number;
  /** True when withinSlo meets SLO.target, or when there is no data yet. */
  healthy: boolean;
}

export function summarize(values: number[], thresholdMs: number, target: number = SLO.target): LatencySummary {
  if (!values.length) return { count: 0, p50: null, p95: null, withinSlo: null, thresholdMs, healthy: true };
  const ok = values.filter((v) => v <= thresholdMs).length / values.length;
  return {
    count: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    withinSlo: ok,
    thresholdMs,
    healthy: ok >= target,
  };
}

// ---- Process-wide windows (one set per server process) ----

// Next.js can bundle each route separately, which would give every route its own
// copy of this module and its own empty windows: /api/talks/.../ask would record
// into one set while /status reads another. Keeping the windows on globalThis
// means every copy in the process shares the same one.
const g = globalThis as unknown as { __sidecarHealth?: Record<"captionLag" | "answerLatency" | "llmTokens" | "aiFallbacks", RollingWindow> };
const windows = (g.__sidecarHealth ??= {
  captionLag: new RollingWindow(),
  answerLatency: new RollingWindow(),
  llmTokens: new RollingWindow(),
  aiFallbacks: new RollingWindow(),
});

export type HealthMetric = keyof typeof windows;

/** Record one event for the status page. Values are timings or counts, never user text. */
export function recordHealth(metric: HealthMetric, value: number): void {
  windows[metric].add(value);
}

export interface HealthSnapshot {
  windowMinutes: number;
  captionLag: LatencySummary;
  answerLatency: LatencySummary;
  llmTokens: number;
  aiFallbacks: number;
  healthy: boolean;
}

export function healthSnapshot(): HealthSnapshot {
  const captionLag = summarize(windows.captionLag.values(), SLO.captionLagMs);
  const answerLatency = summarize(windows.answerLatency.values(), SLO.answerLatencyMs);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    windowMinutes: WINDOW_MS / 60_000,
    captionLag,
    answerLatency,
    llmTokens: sum(windows.llmTokens.values()),
    aiFallbacks: sum(windows.aiFallbacks.values()),
    healthy: captionLag.healthy && answerLatency.healthy,
  };
}
