"use client";

import * as React from "react";

/**
 * The current time, re-read every `everyMs`. Null until mounted, so the server
 * and the browser render the same first frame; render time-based content only
 * once it is a number.
 */
export function useNow(everyMs = 30_000): number | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}
