"use client";

import * as React from "react";

const noSubscribe = () => () => {};

/**
 * "Good afternoon" on the viewer's clock (HRIS's greeting). The server can't
 * know the viewer's time, so it renders "Welcome back" and the first client
 * render swaps in the real one.
 */
export function useGreeting(): string {
  return React.useSyncExternalStore(
    noSubscribe,
    () => {
      const hour = new Date().getHours();
      return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    },
    () => "Welcome back",
  );
}
