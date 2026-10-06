"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ModuleId } from "@/state/launchpad-store";
import { PROJECT_BY_ID, TICKET_DASHBOARDS, TICKET_PRIORITIES, type TicketPriority } from "./data";

export type DashFilter = "all" | ModuleId;
export type ProjectFilter = "all" | string;
export type PriorityFilter = "all" | TicketPriority;

/**
 * The board's URL state: `?dash=`, `?project=` and `?priority=` filter the
 * board, `?ticket=` is the open ticket (over any section). Read from and
 * written to the URL, so an Overview row, a Projects card or a toast's View
 * lands on exactly that view, and the back button undoes it. An unknown value
 * reads as no filter.
 */
export function useTicketParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawDash = params.get("dash");
  const dash: DashFilter = rawDash && (TICKET_DASHBOARDS as string[]).includes(rawDash) ? (rawDash as ModuleId) : "all";
  const rawProject = params.get("project");
  const project: ProjectFilter = rawProject && PROJECT_BY_ID[rawProject] ? rawProject : "all";
  const rawPriority = params.get("priority");
  const priority: PriorityFilter =
    rawPriority && (TICKET_PRIORITIES as readonly string[]).includes(rawPriority) ? (rawPriority as TicketPriority) : "all";
  const rawTicket = params.get("ticket");
  const ticket = rawTicket && /^\d+$/.test(rawTicket) ? Number(rawTicket) : rawTicket ? NaN : null;

  const patch = React.useCallback(
    (changes: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v == null || v === "all") sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const actions = React.useMemo(
    () => ({
      setDash: (v: DashFilter) => patch({ dash: v }),
      setProject: (v: ProjectFilter) => patch({ project: v }),
      setPriority: (v: PriorityFilter) => patch({ priority: v }),
      clearFilters: () => patch({ dash: null, project: null, priority: null }),
      openTicket: (no: number) => patch({ ticket: String(no) }),
      closeTicket: () => patch({ ticket: null }),
    }),
    [patch],
  );

  return {
    dash,
    project,
    priority,
    /** The open ticket's number; NaN for a `?ticket=` that isn't a number. */
    ticket,
    ...actions,
  };
}
