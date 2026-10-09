import type { RepOption } from "./types";

/**
 * Until sign-in exists: the rep named in ?as=, else the rep picked last (kept
 * across sections, see LiveDataProvider), else the first Sales rep, else nobody.
 */
export function pickViewer(reps: RepOption[], asked: string | null, remembered: string | null = null): RepOption | null {
  return reps.find((r) => r.id === asked) ?? reps.find((r) => r.id === remembered) ?? reps[0] ?? null;
}

/**
 * The ?as= value when it names a rep on the list, else null. Only that is an
 * explicit pick worth remembering; an unknown id is ignored, as pickViewer does.
 */
export function askedRep(reps: RepOption[], asked: string | null): string | null {
  return reps.find((r) => r.id === asked)?.id ?? null;
}

/** Where the last pick is kept: this tab's sessionStorage, so a fresh session starts clean. */
export const VIEWER_KEY = "launchpad:viewing-as";

/**
 * The rep picked last, or null. Reading storage can throw (site data blocked, a
 * private window), and then nothing is remembered. The store arrives as a
 * function so that even reaching `window.sessionStorage`, which is what throws
 * in Chrome, happens inside the try.
 */
export function readRememberedViewer(store: () => Pick<Storage, "getItem">): string | null {
  try {
    return store().getItem(VIEWER_KEY) || null;
  } catch {
    return null;
  }
}

/** Keeps the pick for the next section or a reload. A blocked or full store is fine: the pick still holds in memory. */
export function writeRememberedViewer(store: () => Pick<Storage, "setItem">, id: string): void {
  try {
    store().setItem(VIEWER_KEY, id);
  } catch {
    // Not kept beyond this page; nothing to do.
  }
}
