/** Format seconds into a talk as "m:ss" (or "h:mm:ss"), for timestamp chips. */
export function formatOffset(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Seconds between the talk start and `at` (never negative). */
export function offsetSince(startIso: string, at: Date = new Date()): number {
  return Math.max(0, Math.round((at.getTime() - new Date(startIso).getTime()) / 1000));
}
