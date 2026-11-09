"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders a server component page on an interval. The speaker hub is read
 * during a live talk, so it should fill in as questions arrive without anyone
 * reaching for the reload button.
 */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
