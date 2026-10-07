"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, ArchiveRestore } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { useTickets } from "@/state/tickets-store";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { EmptyState, NoMatches } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { useCascading } from "@/components/ui/list-motion";
import { formatTicketNo } from "./data";
import { matchesTicket, relativeTime } from "./logic";
import { DashboardChip, PriorityChip } from "./TicketCard";
import { useTicketParams } from "./use-ticket-params";

/**
 * Tickets › Archived — HRIS's Archived view. Archiving is a soft delete: the
 * ticket leaves the board with its replies and history, and Restore puts it
 * back in its column. A row opens the ticket, read-only.
 */
export function TicketsArchived() {
  const { tickets, restoreTicket } = useTickets();
  const { openTicket } = useTicketParams();
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const [query, setQuery] = React.useState("");

  const archived = React.useMemo(
    () => tickets.filter((t) => t.archived).sort((a, b) => (b.archived?.at ?? 0) - (a.archived?.at ?? 0)),
    [tickets],
  );
  const shown = archived.filter((t) => matchesTicket(t, query));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Archived"
        description="Tickets taken off the board, newest first. They keep their replies and history, and Restore puts them back in their column."
      />

      {archived.length ? (
        <Reveal index={0}>
          <SearchInput
            value={query}
            onChange={setQuery}
            count={query.trim() ? shown.length : undefined}
            placeholder="Search archived tickets…"
            aria-label="Search archived tickets"
          />
        </Reveal>
      ) : null}

      <Reveal index={1}>
        {archived.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Nothing archived"
            description="Archiving a ticket takes it off the board but keeps it here, replies and history included, until it's restored."
            className="rounded-xl border border-dashed border-border"
          />
        ) : shown.length === 0 ? (
          <NoMatches query={query.trim()} onClear={() => setQuery("")} className="rounded-xl border border-dashed border-border" />
        ) : (
          <ul className="grid gap-2">
            <AnimatePresence initial={false}>
              {shown.map((t, i) => (
                <motion.li
                  key={t.no}
                  layout={reduce ? false : "position"}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -14, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } }}
                  transition={{
                    duration: reduce ? 0 : 0.22,
                    ease: EASE_OUT,
                    delay: cascading ? rowDelay(i, reduce, 0.04) : 0,
                    layout: { duration: reduce ? 0 : 0.24, ease: EASE_SWAP, delay: 0 },
                  }}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs sm:flex-row sm:items-center",
                    "transition-[border-color,box-shadow] duration-150 hover:border-tone-line hover:shadow-md motion-reduce:transition-none",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openTicket(t.no)}
                    className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs font-medium text-muted-foreground">{formatTicketNo(t.no)}</span>
                      <span className="truncate text-sm font-medium">{t.title}</span>
                      <PriorityChip priority={t.priority} />
                      <DashboardChip id={t.dashboard} />
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground" suppressHydrationWarning>
                      Archived {t.archived ? relativeTime(t.archived.at) : ""} by {t.archived?.by} · raised by {t.raisedBy}
                    </span>
                  </button>
                  <Button variant="outline" size="sm" className="self-start sm:self-auto" onClick={() => restoreTicket(t.no)}>
                    <ArchiveRestore aria-hidden /> Restore
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Reveal>
    </div>
  );
}
