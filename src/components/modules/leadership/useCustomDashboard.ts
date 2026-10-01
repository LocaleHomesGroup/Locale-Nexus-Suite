"use client";

import * as React from "react";
import {
  DEFAULT_SELECTION,
  JARVIS_ANSWERS,
  JARVIS_DELAY_MS,
  JARVIS_FALLBACK,
  type MetricId,
  type Period,
} from "./data";

export interface JarvisMessage {
  id: number;
  role: "you" | "ai";
  text: string;
  /** The metric Jarvis put on the dashboard with this answer. */
  added?: MetricId | null;
}

/**
 * Custom dashboard state (the mockup's `km`). It lives in LeadershipScreen, not
 * in the tab body, so the view you built — and a Jarvis answer still being
 * "read" — survive a hop to the Business dashboard tab and back. Timers are
 * cleared when Leadership unmounts, so none fires into a dead tree.
 */
export function useCustomDashboard() {
  const [selected, setSelected] = React.useState<MetricId[]>(DEFAULT_SELECTION);
  const [period, setPeriod] = React.useState<Period>("This month");
  const [reportOpen, setReportOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [messages, setMessages] = React.useState<JarvisMessage[]>([]);
  /** Questions Jarvis is still "reading" — the indicator shows while > 0. */
  const [pending, setPending] = React.useState(0);
  /** A widget Jarvis just added; its tile rings once so the eye finds it. */
  const [flash, setFlash] = React.useState<MetricId | null>(null);

  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextId = React.useRef(0);

  React.useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  const later = React.useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const toggle = React.useCallback((id: MetricId) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const ask = React.useCallback(
    (question?: string) => {
      const q = (question ?? draft).trim();
      if (!q) return;
      const askId = nextId.current++;
      setMessages((prev) => [...prev, { id: askId, role: "you", text: q }]);
      setDraft("");
      setPending((n) => n + 1);

      later(() => {
        const lower = q.toLowerCase();
        const hit = JARVIS_ANSWERS.find((a) => a.keys.some((k) => lower.includes(k)));
        const answerId = nextId.current++;
        setMessages((prev) => [
          ...prev,
          { id: answerId, role: "ai", text: hit ? hit.answer : JARVIS_FALLBACK, added: hit ? hit.add : null },
        ]);
        if (hit) {
          setSelected((prev) => (prev.includes(hit.add) ? prev : [...prev, hit.add]));
          setFlash(hit.add);
          later(() => setFlash((f) => (f === hit.add ? null : f)), 2400);
        }
        setPending((n) => Math.max(0, n - 1));
      }, JARVIS_DELAY_MS);
    },
    [draft, later],
  );

  return {
    selected,
    toggle,
    period,
    setPeriod,
    reportOpen,
    setReportOpen,
    draft,
    setDraft,
    messages,
    pending,
    ask,
    flash,
  };
}

export type CustomDashboardState = ReturnType<typeof useCustomDashboard>;
