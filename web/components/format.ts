// Display helpers. All times are stored in UTC; the venue is in Mountain Time.
export const VENUE_TZ = "America/Denver";

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: VENUE_TZ });
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: VENUE_TZ });
}

export function roomLabel(roomId: string): string {
  if (roomId === "main") return "Main stage";
  return roomId.replace(/^room-/, "Room ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "12 min", "1 h 05 min": a length of time for countdowns and gaps. */
export function durationLabel(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

/** A far-off start, in the largest sensible unit: "20 min", "5 hours", "45 days". */
export function untilLabel(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${Math.round(hours / 24)} days`;
}

/** Soft tints for room chips. Rooms are told apart by name, not only by color. */
export const ROOM_COLORS: Record<string, string> = {
  main: "var(--color-accent-soft)",
  "room-a": "var(--color-sky)",
  "room-b": "var(--color-good-soft)",
  "room-c": "var(--color-warn-soft)",
  "room-d": "var(--color-bubble)",
};
