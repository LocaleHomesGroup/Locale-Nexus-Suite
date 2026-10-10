import type { Catalogue, CatalogueResponse, ImportRecord } from "@/data/homescope";
import { MONTHS, perthClock, perthDay } from "@/lib/perth-time";

/** What HomeScope and Operations › HomeScope pricing show: the catalogue, and why it's that one. */
export interface CatalogueState {
  status: "loading" | "ready";
  catalogue: Catalogue;
  lastImport: ImportRecord | null;
  /** A database is connected, so an import can be run and saved. */
  live: boolean;
  /** Why the snapshot is showing, when it shouldn't be. */
  note: string | null;
}

/** The route's answer (null when there was none) as screen state. Anything short of an import falls back to the snapshot. */
export function stateFrom(response: CatalogueResponse | null, snapshot: Catalogue): CatalogueState {
  const ready = (over: Partial<CatalogueState>): CatalogueState => ({
    status: "ready",
    catalogue: snapshot,
    lastImport: null,
    live: false,
    note: null,
    ...over,
  });
  if (!response) return ready({ note: "Couldn't reach the imported catalogue, so these are the 6 October snapshot prices." });
  if (response.kind === "off") return ready({});
  if (response.kind === "error") return ready({ note: response.message });
  if (!response.catalogue) {
    return ready({
      live: true,
      lastImport: response.lastImport,
      note: "Nothing has been imported from Monday yet, so these are the 6 October snapshot prices.",
    });
  }
  return ready({ live: true, catalogue: response.catalogue, lastImport: response.lastImport });
}

/**
 * What a page shows after a fetch, given what it showed before. Within a page the catalogue
 * never falls from an import back to the snapshot, because an estimate in progress was priced
 * from the import: a failed refresh keeps the cached one and says so.
 */
export function nextState(cached: CatalogueState | null, fetched: CatalogueState): CatalogueState {
  if (cached && cached.catalogue.source === "monday" && fetched.catalogue.source !== "monday") {
    return {
      ...cached,
      status: "ready",
      note: `Couldn't refresh the imported catalogue, so these are the prices loaded at ${catalogueLabel(cached.catalogue)}.`,
    };
  }
  return fetched;
}

/** "10 Oct 2026", the date in Perth, from perth-time's tables so server and browser agree. */
function dateLabel(t: string): string {
  const [y, m, d] = perthDay(t).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Monday · 10 Oct 2026, 3:12pm" for an import (Perth time), "Price snapshot · 6 Oct 2026" for the snapshot. */
export function catalogueLabel(c: Catalogue): string {
  if (c.source === "monday") return `Monday · ${dateLabel(c.asOf)}, ${perthClock(c.asOf)}`;
  return `Price snapshot · ${dateLabel(`${c.asOf}T00:00:00+08:00`)}`;
}

/** Asks the route for the catalogue. Null when it doesn't answer within `timeoutMs`, or answers with something that isn't JSON (a protection page, a crash). */
export async function readCatalogue(fetchImpl: typeof fetch = fetch, timeoutMs = 10_000): Promise<CatalogueResponse | null> {
  try {
    const r = await fetchImpl("/api/homescope/catalogue", { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    return (await r.json()) as CatalogueResponse;
  } catch {
    return null;
  }
}
