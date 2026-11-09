"use client";

import { useEffect, useState } from "react";

// Polls every 5 s. Shows a banner only while 3+ people are lost right now.
export function LostNowBanner({ token }: { token: string }) {
  const [now, setNow] = useState<{ lost: number; said: string[] }>({ lost: 0, said: [] });

  useEffect(() => {
    const poll = async () => {
      const res = await fetch(`/api/speaker/${encodeURIComponent(token)}/now`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) setNow(await res.json());
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [token]);

  if (now.lost === 0) {
    return (
      <p role="status" className="mb-6 rounded-2xl border-2 border-ink bg-lime/50 px-4 py-3 font-semibold">
        ✅ Right now: the room is following along
      </p>
    );
  }
  return (
    <div role="alert" className="mb-6 animate-pop rounded-2xl border-2 border-ink bg-tangerine p-4 text-white shadow-[4px_4px_0_0_var(--color-ink)]">
      <p className="font-display text-2xl font-extrabold">🚨 {now.lost} people are lost right now</p>
      {now.said.length > 0 && <p className="mt-1 text-white/90">You were saying: “{now.said.join(" ")}”</p>}
      <p className="mt-1 text-sm text-white/80">Slow down, or give an example.</p>
    </div>
  );
}
