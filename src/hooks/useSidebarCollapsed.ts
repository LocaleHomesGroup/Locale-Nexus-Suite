"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Collapsed/expanded state for the desktop rail, persisted to localStorage and
 * kept in sync between mounts and browser tabs. Ported from Simple HRIS.
 * Collapse is desktop-only — every consumer scopes collapsed styling to `md:`.
 */
const STORAGE_KEY = "launchpad:sidebar:collapsed";
const CHANGE_EVENT = "launchpad:sidebar:collapsed-change";

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function useSidebarCollapsed() {
  // Start expanded so server and first client render agree.
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    setCollapsedState(readStored());
    const sync = () => setCollapsedState(readStored());
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      /* storage unavailable — state still flips for this session */
    }
  }, []);

  const toggle = useCallback(() => setCollapsed(!readStored()), [setCollapsed]);

  return { collapsed, setCollapsed, toggle };
}
