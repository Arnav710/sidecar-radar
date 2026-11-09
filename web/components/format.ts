// Display helpers. All times are stored in UTC; the venue is in Mountain Time.
export const VENUE_TZ = "America/Denver";

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: VENUE_TZ });
}

export function roomLabel(roomId: string): string {
  if (roomId === "main") return "Main stage";
  return roomId.replace(/^room-/, "Room ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ROOM_COLORS: Record<string, string> = {
  main: "var(--color-lime)",
  "room-a": "var(--color-sky)",
  "room-b": "var(--color-lilac)",
  "room-c": "var(--color-sun)",
  "room-d": "var(--color-bubble)",
};
