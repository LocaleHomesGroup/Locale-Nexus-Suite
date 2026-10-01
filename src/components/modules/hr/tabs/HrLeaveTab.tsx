"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarCheck, CalendarX2, Check, Hourglass, X } from "lucide-react";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardRow, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { LEAVE_BALANCES, personTone, type LeaveRequest, type LeaveStatus } from "../data";

const STATUS_TONE: Record<LeaveStatus, PillTone> = {
  Pending: "pending",
  Approved: "ok",
  Declined: "problem",
};

/**
 * HR › Leave — the approval queue Home's "Approve leave — A. Mercer, 17–21 Aug"
 * and "Leave request" shortcuts land on. The three counts are filter tiles and
 * move the moment a request is approved or declined.
 */
export function HrLeaveTab({
  requests,
  onDecide,
}: {
  requests: LeaveRequest[];
  onDecide: (req: LeaveRequest, status: Exclude<LeaveStatus, "Pending">) => void;
}) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = React.useState<LeaveStatus | null>(null);

  const count = (s: LeaveStatus) => requests.filter((r) => r.status === s).length;
  const pending = count("Pending");
  const shown = filter ? requests.filter((r) => r.status === filter) : requests;
  const toggle = (s: LeaveStatus) => setFilter((f) => (f === s ? null : s));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="HR"
        title="Leave"
        description="Approvals here update Horilla and Xero automatically via the live leave workflow."
      />

      <Reveal index={0}>
        <KpiGrid cols={3}>
          <KpiCard
            label="Awaiting approval"
            value={pending}
            icon={Hourglass}
            tone="pending"
            onClick={() => toggle("Pending")}
            active={filter === "Pending"}
          />
          <KpiCard
            label="Approved"
            value={count("Approved")}
            icon={CalendarCheck}
            tone="ok"
            onClick={() => toggle("Approved")}
            active={filter === "Approved"}
          />
          <KpiCard
            label="Declined"
            value={count("Declined")}
            icon={CalendarX2}
            tone="charcoal"
            onClick={() => toggle("Declined")}
            active={filter === "Declined"}
          />
        </KpiGrid>
      </Reveal>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Reveal index={1} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Leave requests</CardTitle>
              <CardMeta>
                {filter ? (
                  <Button variant="link" size="xs" className="text-[11px]" onClick={() => setFilter(null)}>
                    {filter} only · show all
                  </Button>
                ) : (
                  <span>{pending} awaiting approval</span>
                )}
              </CardMeta>
            </CardHeader>
            <CardContent className="px-0 pb-1">
              {shown.length === 0 ? (
                filter === "Pending" ? (
                  <EmptyState
                    icon={CalendarCheck}
                    title="All caught up"
                    description="No leave requests are waiting on you."
                    className="py-10"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                    <p className="text-xs text-muted-foreground">No {filter?.toLowerCase()} requests yet.</p>
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => setFilter(null)}>
                      Show all requests
                    </Button>
                  </div>
                )
              ) : (
                <ul>
                  <AnimatePresence initial={false}>
                    {shown.map((r, i) => (
                      <motion.li
                        key={r.id}
                        layout="position"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          transition: { duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(i, reduce) },
                        }}
                        exit={{ opacity: 0, x: reduce ? 0 : -14, transition: { duration: reduce ? 0 : 0.14 } }}
                        className="relative flex flex-wrap items-center gap-x-3 gap-y-2.5 border-t border-hairline px-5 py-3 first:border-t-0"
                      >
                        {r.status === "Pending" ? (
                          <span className="absolute inset-y-2.5 left-0 w-0.5 rounded-full bg-amber-400 dark:bg-amber-400/80" aria-hidden />
                        ) : null}
                        <Avatar name={r.name} tone={personTone(r.name)} size="sm" />
                        <div className="min-w-[150px] flex-1">
                          <p className="text-[13px] font-semibold">{r.name}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {r.type} · {r.when} · {r.length}
                          </p>
                        </div>
                        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                              key={r.status}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: reduce ? 1 : 0.9, transition: { duration: reduce ? 0 : 0.12 } }}
                              transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
                              className="inline-flex"
                            >
                              <Pill tone={STATUS_TONE[r.status]} variant="caps">
                                {r.status}
                              </Pill>
                            </motion.span>
                          </AnimatePresence>
                          {r.status === "Pending" ? (
                            <span className="flex gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => onDecide(r, "Approved")}
                                aria-label={`Approve ${r.name}, ${r.type.toLowerCase()} ${r.when}`}
                              >
                                <Check aria-hidden /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onDecide(r, "Declined")}
                                aria-label={`Decline ${r.name}, ${r.type.toLowerCase()} ${r.when}`}
                              >
                                <X aria-hidden /> Decline
                              </Button>
                            </span>
                          ) : null}
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={2}>
          <Card>
            <CardHeader>
              <CardTitle>My balances</CardTitle>
            </CardHeader>
            <CardContent>
              {LEAVE_BALANCES.map((b) => (
                <CardRow key={b.label} className="flex items-baseline py-2 text-xs">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span
                    className={cn(
                      "ml-auto font-semibold tabular-nums",
                      b.value === "accruing" && "font-medium text-subtle-foreground",
                    )}
                  >
                    {b.value}
                  </span>
                </CardRow>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
