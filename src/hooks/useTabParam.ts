"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A dashboard section kept in the URL (`?tab=` by default). The rail links set
 * it; Home's shortcuts ("Approve leave" → `/hr?tab=leave`) and the back button
 * land on it. Pass `key` for a second level (`?view=` inside Doc formatter).
 *
 * Returns the active value, a setter (for in-page jumps, e.g. a KPI tile that
 * opens another section), and the direction of the last change — +1 moved to
 * a later section, −1 to an earlier one — worked out from the URL, so it is
 * right whether the change came from the rail, a link or the setter.
 *
 * `useSearchParams` makes the calling tree client-rendered up to the nearest
 * Suspense boundary — module pages wrap their client root in <Suspense>.
 */
export function useTabParam<T extends string>(tabs: readonly T[], fallback: T, key = "tab") {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get(key);
  const tab = (tabs as readonly string[]).includes(raw ?? "") ? (raw as T) : fallback;

  const prev = useRef(tab);
  const dir = useRef(0);
  if (prev.current !== tab) {
    dir.current = tabs.indexOf(tab) >= tabs.indexOf(prev.current) ? 1 : -1;
    prev.current = tab;
  }

  const setTab = useCallback(
    (next: T) => {
      if (next === tab) return;
      const sp = new URLSearchParams(params.toString());
      if (next === fallback) sp.delete(key);
      else sp.set(key, next);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [tab, fallback, key, params, pathname, router],
  );

  return [tab, setTab, dir.current] as const;
}
