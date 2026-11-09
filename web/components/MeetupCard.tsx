"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeetupView, VenueSpot } from "@/lib/meetup";
import { roomLabel, timeLabel } from "./format";

const POLL_MS = 3000;

// The booked meeting for a mutual match: when (first shared free slot), where
// (nearest uncrowded spot to both next rooms, picked by Elasticsearch geo), on a
// map of the venue. Both accept -> it goes onto both schedules.
export function MeetupCard({ matchId, otherName }: { matchId: string; otherName: string }) {
  const [v, setV] = useState<MeetupView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/meetup`, { cache: "no-store" }).catch(() => null);
    if (!res) return;
    if (res.ok) {
      setV((await res.json()) as MeetupView);
      setError("");
    } else setError((await res.json().catch(() => ({}))).error ?? "Couldn't find a time.");
  }, [matchId]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const accept = async () => {
    setBusy(true);
    const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/meetup`, { method: "POST" }).catch(() => null);
    if (res?.ok) setV((await res.json()) as MeetupView);
    else setError("Couldn't save that. Try again.");
    setBusy(false);
  };

  if (error) return <p className="mt-4 font-semibold text-tangerine">{error}</p>;
  if (!v) return <p className="mt-4 font-mono text-xs text-ink-soft">📍 Finding a time and a spot for you both…</p>;

  const confirmed = v.meetup.state === "confirmed";
  return (
    <div className="mt-5 rounded-2xl border-2 border-ink bg-white p-4">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">📍 Your meetup</p>
      <p className="mt-1 font-display text-2xl font-extrabold">
        {timeLabel(v.meetup.start)} · {v.spot.name}
      </p>
      <p className="text-ink-soft">
        {v.you.minutes} min from your next room ({roomLabel(v.you.room_id)}), {v.them.minutes} min from theirs ({roomLabel(v.them.room_id)}).
        {" "}Only {v.spot.live_count} of {v.spot.capacity} spots taken right now.
      </p>

      <VenueMap venue={v.venue} spotId={v.spot.id} yourRoom={v.you.room_id} theirRoom={v.them.room_id} />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {confirmed ? (
          <p className="font-display text-lg font-bold">✅ It&apos;s on both your schedules. See you there!</p>
        ) : v.you.accepted ? (
          <p className="font-semibold text-ink-soft">✅ You accepted. Waiting for {otherName}…</p>
        ) : (
          <button onClick={accept} disabled={busy} className="btn bg-tangerine text-white">
            {busy ? "Saving…" : v.them.accepted ? `${otherName} accepted · Accept` : "Accept meetup"}
          </button>
        )}
      </div>
    </div>
  );
}

const FILL: Record<VenueSpot["kind"], string> = { room: "#fff6e6", coffee: "#ffd23f", lounge: "#b9a6ff", quiet: "#7cd4ff" };

function VenueMap({ venue, spotId, yourRoom, theirRoom }: { venue: VenueSpot[]; spotId: string; yourRoom: string; theirRoom: string }) {
  const by = new Map(venue.map((s) => [s.id, s]));
  const spot = by.get(spotId);
  const you = by.get(yourRoom);
  const them = by.get(theirRoom);
  return (
    <svg viewBox="0 0 132 80" className="mt-3 w-full rounded-xl border-2 border-ink bg-paper" role="img" aria-label={`Venue map with the meetup at ${spot?.name}`}>
      {/* walking paths */}
      {spot && you && <line x1={you.x} y1={you.y} x2={spot.x} y2={spot.y} stroke="#8fb81a" strokeWidth="1.4" strokeDasharray="2.5 1.8" />}
      {spot && them && <line x1={them.x} y1={them.y} x2={spot.x} y2={spot.y} stroke="#7d6ad6" strokeWidth="1.4" strokeDasharray="2.5 1.8" />}
      {venue.map((s) => {
        const hot = s.id === spotId;
        const isYou = s.id === yourRoom;
        const isThem = s.id === theirRoom;
        return (
          <g key={s.id}>
            <rect
              x={s.x - s.w / 2} y={s.y - s.h / 2} width={s.w} height={s.h} rx="2"
              fill={hot ? "#ff6b35" : FILL[s.kind]} stroke="#17131f"
              strokeWidth={hot || isYou || isThem ? 1 : 0.5}
            />
            <text x={s.x} y={s.y + 1} textAnchor="middle" fontSize={s.kind === "room" ? 3.2 : 2.4} fontWeight="700" fill={hot ? "#fff" : "#17131f"}>
              {s.kind === "room" ? s.name.replace(" (upstairs)", "") : s.name.replace("Coffee bar, ", "☕ ")}
            </text>
            {(isYou || isThem) && (
              <text x={s.x} y={s.y - s.h / 2 - 1.2} textAnchor="middle" fontSize="2.6" fontWeight="700" fill={isYou ? "#5a7a10" : "#5b49b8"}>
                {isYou && isThem ? "you both" : isYou ? "you" : "them"}
              </text>
            )}
          </g>
        );
      })}
      {spot && (
        <g>
          <circle cx={spot.x} cy={spot.y - spot.h / 2 - 3} r="2.6" fill="#ff6b35" stroke="#17131f" strokeWidth="0.6">
            <animate attributeName="r" values="2.2;3.2;2.2" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <text x={spot.x} y={spot.y - spot.h / 2 - 2.1} textAnchor="middle" fontSize="2.6">📍</text>
        </g>
      )}
    </svg>
  );
}
