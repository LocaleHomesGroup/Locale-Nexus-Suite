"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Job } from "@/data/jobs";
import type { LiveData, LiveLot, RepOption } from "@/data/live/types";
import { askedRep, pickViewer, readRememberedViewer, writeRememberedViewer } from "@/data/live/viewer";
import { useLaunchpad } from "./launchpad-store";

/**
 * Live data for the four screens wired to the database (Exclusive Land, My
 * clients, All clients, the Operations job list). It sits in the dashboard
 * layout beside the sample stores; every other module keeps reading those.
 */
interface LiveValue {
  /** The time up to which the mirror holds every change Monday logged (ISO; see LiveData). For "as of" text, not for judging holds. */
  asOf: string;
  /** When the loader read the database (ISO). Holds are judged against it until the browser's clock takes over. */
  readAt: string;
  jobs: Job[];
  lots: LiveLot[];
  setLots: (lots: LiveLot[]) => void;
  reps: RepOption[];
  /** The rep picked last in "Viewing as", so the pick survives moving between sections. Null until one is made. */
  lastViewer: string | null;
  /** Remembers a pick: in memory, and in this tab's sessionStorage where the browser allows it. Stable. */
  rememberViewer: (id: string) => void;
}

type LiveState = { kind: "off" } | { kind: "error"; message: string } | { kind: "live"; value: LiveValue };

const Ctx = React.createContext<LiveState>({ kind: "off" });

export function LiveDataProvider({ data, children }: { data: LiveData | null; children: React.ReactNode }) {
  const seed = data?.status === "ok" ? data.lots : [];
  const [lots, setLots] = React.useState<LiveLot[]>(seed);
  // A fresh server render (a refresh) brings new lots; the hold actions bring them in between.
  // Adjusting during render keeps the lots in step with the rest of `data`, with no in-between render.
  const [seededFrom, setSeededFrom] = React.useState(data);
  if (data !== seededFrom) {
    setSeededFrom(data);
    setLots(seed);
  }

  // The rep picked last. It starts null so the first client render matches the server's, which has no
  // storage; the stored pick is read once, after mount.
  const [lastViewer, setLastViewer] = React.useState<string | null>(null);
  React.useEffect(() => {
    const stored = readRememberedViewer(() => window.sessionStorage);
    // `current ??` keeps a pick made before this ran (a ?as= that a child's effect remembered) over the stored one.
    if (stored) setLastViewer((current) => current ?? stored);
  }, []);
  const rememberViewer = React.useCallback((id: string) => {
    setLastViewer(id);
    writeRememberedViewer(() => window.sessionStorage, id);
  }, []);

  const state = React.useMemo<LiveState>(() => {
    if (!data) return { kind: "off" };
    if (data.status === "error") return { kind: "error", message: data.message };
    return {
      kind: "live",
      value: {
        asOf: data.asOf,
        readAt: data.readAt,
        jobs: data.jobs,
        reps: data.reps,
        lots,
        setLots,
        lastViewer,
        rememberViewer,
      },
    };
  }, [data, lots, lastViewer, rememberViewer]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useLiveState = (): LiveState => React.useContext(Ctx);

export function useLiveData(): LiveValue | null {
  const state = useLiveState();
  return state.kind === "live" ? state.value : null;
}

/** The live jobs when a database is connected, otherwise the store's sample jobs. */
export function useJobs(): { jobs: Job[]; live: boolean } {
  const live = useLiveData();
  const { jobs } = useLaunchpad();
  return live ? { jobs: live.jobs, live: true } : { jobs, live: false };
}

/**
 * Who the live screens act for until sign-in exists: the ?as=<staff id> in the
 * URL, else the last pick (the layout stays mounted, so it holds across
 * sections), else the first rep.
 */
export function useViewer(): { viewer: RepOption | null; reps: RepOption[]; setViewer: (id: string) => void } {
  const live = useLiveData();
  const params = useSearchParams();
  const pathname = usePathname();
  const reps = live?.reps ?? [];
  const rememberViewer = live?.rememberViewer;
  const asked = params.get("as");
  const viewer = pickViewer(reps, asked, live?.lastViewer ?? null);

  // A ?as= that names a rep is a choice, so remember it: the rail's links to other sections don't carry it.
  // Only that is remembered, never the first-rep fallback. Effects run children first, so a remembered
  // fallback would overwrite the stored pick before the provider has read it. It can't loop: `rememberViewer`
  // is stable, and the effect depends on the URL's rep, not on the state it sets.
  const askedId = askedRep(reps, asked);
  React.useEffect(() => {
    if (askedId) rememberViewer?.(askedId);
  }, [askedId, rememberViewer]);

  const setViewer = React.useCallback(
    (id: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("as", id);
      // Nothing on the server reads ?as=, so this skips the router and its server round trip: Next syncs
      // useSearchParams with the native history API, and applies the new URL in a transition. The pick joins
      // that same transition so both land in one render. Apart, the remembered pick would paint a frame
      // before the URL's, and the select would show the old name for that frame.
      React.startTransition(() => {
        rememberViewer?.(id);
        window.history.replaceState(null, "", `${pathname}?${next.toString()}`);
      });
    },
    [params, pathname, rememberViewer],
  );
  return { viewer, reps, setViewer };
}
