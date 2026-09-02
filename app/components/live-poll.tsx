"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Phase 5 real-time: re-runs the current route's server components against
// fresh database rows every few seconds via router.refresh(), reconciling
// the result into the existing DOM (no full reload, no client data store).
// Pauses while the tab is hidden and catches up the moment it's focused.
export default function LivePoll({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(() => router.refresh(), intervalMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        router.refresh();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
