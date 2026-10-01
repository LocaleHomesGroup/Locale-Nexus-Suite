"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarCheck, CalendarX2, Check, Hourglass, Undo2, Users, Wallet, X } from "lucide-react";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { UNDO_WINDOW_MS } from "@/lib/undoable";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardRow, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import {
  LEAVE_BALANCES,
  balanceAfter,
  bookedLeave,
  formatDays,
  othersOff,
  personTone,
  type LeaveRequest,
  type LeaveStatus,
} from "../data";
import { decideLeave, undoLeave, useLeave, type LeaveDecision } from "../leave-store";

const STATUS_TONE: Record<LeaveStatus, PillTone> = {
  Pending: "pending",
  Approved: "ok",
  Declined: "problem",
};

/**
 * HR › Leave — the approval queue Home's My day and "Leave request" shortcut
 * land on. Each pending request carries the evidence an approver needs: the
 * requester's balance now and after, and who else is away on those days.
 * Approve / Decline wait out a 6s undo window (the row shows it) before
 * Horilla and Xero hear about it. The approver's own balances sit below the
 * queue, labelled as theirs.
 */
export function HrLeaveTab() {
  const reduce = useReducedMotion();
  const { requests, deciding } = useLeave();
  const [filter, setFilter] = React.useState<LeaveStatus | null>(null);

  const count = (s: LeaveStatus) => requests.filter((r) => r.status === s).length;
  const pending = count("Pending");
  const shown = filter ? requests.filter((r) => r.status === filter) : requests;
  const toggle = (s: LeaveStatus) => setFilter((f) => (f === s ? null : s));
  const booked = bookedLeave(requests);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
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

      <Reveal index={1} className="min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Leave requests</CardTitle>
            <CardMeta>
              {filter ? (
                <Button variant="link" size="xs" className="text-xs" onClick={() => setFilter(null)}>
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
                    <LeaveRow
                      key={r.id}
                      req={r}
                      queue={requests}
                      deciding={deciding[r.id]}
                      index={i}
                      reduce={reduce}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </CardContent>
        </Card>
      </Reveal>

      <div className="grid items-start gap-5 md:grid-cols-2">
        <Reveal index={2}>
          <Card>
            <CardHeader>
              <CardTitle>Team leave booked</CardTitle>
              <CardMeta>{booked.length} booked</CardMeta>
            </CardHeader>
            <CardContent>
              {booked.map((a) => (
                <CardRow key={a.name + a.start} className="flex items-center gap-2.5 py-2">
                  <Avatar name={a.name} tone={personTone(a.name)} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {a.type} · {a.when}
                  </span>
                </CardRow>
              ))}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={3}>
          <Card>
            <CardHeader>
              <CardTitle>Your balances</CardTitle>
              <CardMeta>Shannan Hart</CardMeta>
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

function LeaveRow({
  req: r,
  queue,
  deciding,
  index,
  reduce,
}: {
  req: LeaveRequest;
  queue: LeaveRequest[];
  deciding: LeaveDecision | undefined;
  index: number;
  reduce: boolean | null;
}) {
  const isPending = r.status === "Pending";
  const label = `${r.name}, ${r.type.toLowerCase()} ${r.when}`;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(index, reduce) },
      }}
      exit={{ opacity: 0, x: reduce ? 0 : -14, transition: { duration: reduce ? 0 : 0.14 } }}
      className={cn(
        "relative overflow-hidden border-t border-hairline px-5 py-3.5 transition-colors duration-200 first:border-t-0",
        deciding && "bg-muted/60 dark:bg-white/[0.03]",
      )}
    >
      {isPending ? (
        <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-amber-400 dark:bg-amber-400/80" aria-hidden />
      ) : null}

      <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
        <Avatar name={r.name} tone={personTone(r.name)} size="sm" className="mt-0.5" />
        <div className="min-w-[200px] flex-1">
          <p className="text-[13px] font-semibold">{r.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {r.type} · {r.when} · {r.length}
          </p>
          {isPending ? <Evidence req={r} queue={queue} /> : null}
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2 self-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={deciding ?? r.status}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.9, transition: { duration: reduce ? 0 : 0.12 } }}
              transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
              className="inline-flex"
            >
              {deciding ? (
                <Pill tone={deciding === "Approved" ? "ok" : "problem"} variant="caps">
                  {deciding === "Approved" ? "Approving" : "Declining"}
                </Pill>
              ) : (
                <Pill tone={STATUS_TONE[r.status]} variant="caps">
                  {r.status}
                </Pill>
              )}
            </motion.span>
          </AnimatePresence>

          {isPending && deciding ? (
            <Button size="sm" variant="outline" onClick={() => undoLeave(r.id)} aria-label={`Undo: keep ${label} pending`}>
              <Undo2 aria-hidden /> Undo
            </Button>
          ) : isPending ? (
            <span className="flex gap-1.5">
              <Button size="sm" onClick={() => decideLeave(r, "Approved")} aria-label={`Approve ${label}`}>
                <Check aria-hidden /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => decideLeave(r, "Declined")} aria-label={`Decline ${label}`}>
                <X aria-hidden /> Decline
              </Button>
            </span>
          ) : null}
        </div>
      </div>

      {/* The undo window, running down. Nothing is sent until it empties. */}
      {deciding && !reduce ? (
        <motion.span
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 h-0.5 origin-left",
            deciding === "Approved" ? "bg-emerald-500 dark:bg-emerald-400" : "bg-rose-500 dark:bg-rose-400",
          )}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: UNDO_WINDOW_MS / 1000, ease: "linear" }}
        />
      ) : null}
      {deciding ? (
        <span className="sr-only" role="status">
          {deciding === "Approved" ? "Approving" : "Declining"} {label}. Sends in {UNDO_WINDOW_MS / 1000} seconds unless
          you undo.
        </span>
      ) : null}
    </motion.li>
  );
}

/** The requester's evidence: their own balance after this request, and who else is off. */
function Evidence({ req, queue }: { req: LeaveRequest; queue: LeaveRequest[] }) {
  const after = balanceAfter(req);
  const off = othersOff(req, queue);
  const short = after < 0;

  return (
    <div className="mt-2.5 grid gap-x-6 gap-y-1.5 rounded-lg border border-hairline bg-canvas/70 px-3 py-2 text-xs sm:grid-cols-2 dark:bg-white/[0.02]">
      <div className="flex min-w-0 items-start gap-2">
        <Wallet className="mt-px size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
        <div className="min-w-0">
          <p>
            <span className="text-muted-foreground">Balance after: </span>
            <span className={cn("font-semibold tabular-nums", short ? "text-rose-700 dark:text-rose-300" : "text-foreground")}>
              {formatDays(after)}
            </span>
          </p>
          <p className="text-subtle-foreground tabular-nums">
            {formatDays(req.balance)} {req.type.toLowerCase()} now
            {short ? ` · ${formatDays(-after)} over` : ""}
          </p>
        </div>
      </div>
      <div className="flex min-w-0 items-start gap-2">
        <Users className="mt-px size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
        {off.length === 0 ? (
          <p className="min-w-0 text-muted-foreground">No one else off {req.when}</p>
        ) : (
          <div className="min-w-0">
            <p>
              <span className="font-semibold text-foreground tabular-nums">
                {off.length} {off.length === 1 ? "other" : "others"} off
              </span>{" "}
              <span className="text-muted-foreground">{req.when}</span>
            </p>
            <p className="text-subtle-foreground">{off.map((a) => `${a.name} (${a.when})`).join(", ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
