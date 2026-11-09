/** The conference venue's time zone (Salt Lake City). Chat and calendar times without a zone are read in this one. */
export const VENUE_TZ_NAME = "America/Denver";

/** Format seconds into a talk as "m:ss" (or "h:mm:ss"), for timestamp chips. */
export function formatOffset(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/**
 * Turn a wall-clock time in an IANA time zone (like "America/Denver") into a UTC
 * Date. We store every time in UTC, but chat messages and calendar feeds often
 * give local times ("6pm"), so we need this to convert them correctly.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const shownAsLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (shownAsLocal - guess));
}

/** Seconds between the talk start and `at` (never negative). */
export function offsetSince(startIso: string, at: Date = new Date()): number {
  return Math.max(0, Math.round((at.getTime() - new Date(startIso).getTime()) / 1000));
}
