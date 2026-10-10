"use client";

import * as React from "react";
import type { Catalogue } from "@/data/homescope";
import { CATALOGUE } from "./catalogue";
import { nextState, readCatalogue, stateFrom, type CatalogueState } from "./catalogue-state";

/** catalogue.json, the 6 October snapshot: what every screen shows without an import. */
export const SNAPSHOT: Catalogue = { builders: CATALOGUE.builders, source: "snapshot", asOf: CATALOGUE.snapshot };

const Ctx = React.createContext<Catalogue>(SNAPSHOT);

/** Sets the catalogue HomeScope prices from, for everything inside it. */
export const CatalogueProvider = Ctx.Provider;

/** The catalogue HomeScope prices from: the last import from Monday, or the snapshot. */
export const useCatalogue = (): Catalogue => React.useContext(Ctx);

/** The last catalogue state this page loaded, kept across mounts like the estimate in store.ts. A full page load clears it. */
let cached: CatalogueState | null = null;

/** Reads /api/homescope/catalogue the first time a page needs it, then reuses that. `reload` reads it again, after an import. */
export function useLiveCatalogue(): CatalogueState & { reload: () => void } {
  const [state, setState] = React.useState<CatalogueState>(
    () => cached ?? { status: "loading", catalogue: SNAPSHOT, lastImport: null, live: false, note: null },
  );
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    // Mounted with a cached state and no reload asked for: nothing to fetch.
    if (tick === 0 && cached) return;
    let alive = true;
    readCatalogue().then((res) => {
      const next = nextState(cached, stateFrom(res, SNAPSHOT));
      cached = next;
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, [tick]);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
