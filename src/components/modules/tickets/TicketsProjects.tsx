"use client";

import Link from "next/link";
import { CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { hrefForKey } from "@/components/shell/dashboards";
import { useTickets } from "@/state/tickets-store";
import { PageHeader } from "@/components/ui/page";
import { Pill } from "@/components/ui/pill";
import { RateBar } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { PROJECTS, PROJECT_STATE_TONE, STATUS_FILL, STATUS_LABEL, TICKET_STATUSES, formatTicketNo, seatName } from "./data";
import { projectProgress } from "./logic";

/**
 * Tickets › Projects — what was the Projects dashboard's board. One card per
 * project: its owner and state, and its progress, which is now counted from
 * its tickets (done over all, archived left out) rather than typed in. Each
 * card opens the board filtered to that project.
 */
export function TicketsProjects() {
  const { tickets } = useTickets();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Every internal build, its owner and its state. Progress is the project's done tickets over all of them, so it moves as the board does."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PROJECTS.map((p, i) => {
          const progress = projectProgress(p, tickets);
          const owner = seatName(p.owner) ?? p.owner;
          return (
            <Reveal key={p.id} index={i}>
              <Link
                href={hrefForKey("tickets:board", { project: p.id })}
                className={cn(
                  "group flex h-full flex-col rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm outline-none",
                  "transition-[translate,box-shadow,border-color] duration-200 ease-out motion-reduce:transition-none",
                  "hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 motion-reduce:hover:translate-y-0",
                )}
                aria-label={`${p.name}: ${progress.total ? `${progress.done} of ${progress.total} tickets done` : "no tickets yet"}. Open its tickets.`}
              >
                <h2 className="min-h-8 text-[13px] leading-snug font-semibold">{p.name}</h2>
                <div className="mt-1 mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Avatar name={owner} size="xs" />
                  <span className="truncate">{owner}</span>
                  <Pill tone={PROJECT_STATE_TONE[p.state]} variant="caps" className="ml-auto">
                    {p.state}
                  </Pill>
                </div>

                <div className="mt-auto">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-muted-foreground tabular-nums">
                      {progress.total ? `${progress.done} of ${progress.total} done` : "No tickets yet"}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {progress.pct != null ? <CountUp value={`${progress.pct}%`} /> : "—"}
                    </span>
                  </div>
                  <RateBar
                    value={progress.pct != null ? progress.pct / 100 : null}
                    tone="tone"
                    height="h-[7px]"
                    delay={Math.min(i * 0.06, 0.3)}
                    label={progress.pct != null ? `${p.name}: ${progress.pct}% done` : `${p.name}: no tickets yet`}
                  />
                  {progress.total ? (
                    <p className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-subtle-foreground tabular-nums">
                      {TICKET_STATUSES.filter((s) => s !== "done").map((s) => (
                        <span key={s} className="inline-flex items-center gap-1">
                          <span className={cn("size-1.5 rounded-full", STATUS_FILL[s])} aria-hidden />
                          {progress.split[s]} {STATUS_LABEL[s].toLowerCase()}
                        </span>
                      ))}
                    </p>
                  ) : null}

                  <div className="mt-3 border-t border-hairline pt-2.5 text-xs">
                    {progress.next ? (
                      <p className="flex items-start gap-1.5">
                        <CornerDownRight className="mt-0.5 size-3 shrink-0 text-tone-ink" aria-hidden />
                        <span className="min-w-0">
                          <span className="text-subtle-foreground">Next up </span>
                          <span className="font-mono text-muted-foreground">{formatTicketNo(progress.next.no)}</span>{" "}
                          <span className="font-medium text-foreground">{progress.next.title}</span>
                        </span>
                      </p>
                    ) : (
                      <p className="text-subtle-foreground">{progress.total ? "Every ticket is done." : "Raise a ticket against it to start tracking."}</p>
                    )}
                  </div>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
