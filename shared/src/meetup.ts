// Picking a meetup time: the first gap where BOTH people are free.
// Pure functions (no I/O) so they're easy to test. Times are ISO 8601 UTC.

export interface Busy { start: string; end: string }
export interface Slot { start: string; end: string }

const MIN = 60_000;

/** Round up to the next 5-minute mark, so meetups start at friendly times. */
function roundUp5(t: number): number {
  return Math.ceil(t / (5 * MIN)) * 5 * MIN;
}

/**
 * First window of at least `minutes` where neither schedule has anything,
 * starting at least `leadMinutes` from now and before `latest` (end of day).
 */
export function firstSharedFreeSlot(
  a: Busy[],
  b: Busy[],
  { now = new Date(), minutes = 15, leadMinutes = 5, latest }: { now?: Date; minutes?: number; leadMinutes?: number; latest?: Date } = {},
): Slot | null {
  const busy = [...a, ...b]
    .map((x) => ({ s: new Date(x.start).getTime(), e: new Date(x.end).getTime() }))
    .filter((x) => x.e > now.getTime())
    .sort((x, y) => x.s - y.s);
  const end = (latest ?? new Date(now.getTime() + 12 * 60 * MIN)).getTime();
  let cursor = roundUp5(now.getTime() + leadMinutes * MIN);
  for (const x of busy) {
    if (x.s - cursor >= minutes * MIN) break; // gap before this block is big enough
    if (x.e > cursor) cursor = roundUp5(x.e);
  }
  if (cursor + minutes * MIN > end) return null;
  return { start: new Date(cursor).toISOString(), end: new Date(cursor + minutes * MIN).toISOString() };
}

/** Walking time across a conference venue (about 80 m per minute, at least 1 minute). */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80));
}
