"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CalendarCheck,
  CalendarX2,
  Check,
  HeartCrack,
  Hourglass,
  MoreHorizontal,
  Plane,
  Thermometer,
  Undo2,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { UNDO_WINDOW_MS } from "@/lib/undoable";
import { paginate } from "@/lib/paginate";
import { cn } from "@/lib/utils";
import { useLaunchpad } from "@/state/launchpad-store";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { Ticker } from "@/components/ui/list-motion";
import { PagerFooter, SwapPane, usePaging } from "@/components/ui/pager";
import {
  balanceAfter,
  formatDays,
  leaveNotice,
  leaveOrder,
  leaveWhen,
  orgDepartment,
  othersOff,
  personTone,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from "./data";
import { decideLeave, undoLeave, useLeave, type LeaveDecision } from "./leave-store";

/**
 * The leave approval queue, shared by HR › Leave and a department manager's
 * Employee › Leave › Approvals. Each pending request carries the evidence an
 * approver needs: the requester's note, their balance now and after, and who
 * else is away on those days. Approve / Decline wait out a 6s undo window
 * (the row shows it) before Horilla and Xero hear about it. Ten a page.
 */

const PAGE_SIZE = 10;

/** HRIS's leave types as pickable reasons: an icon and a one-line hint each. */
export const LEAVE_TYPE_META: Record<LeaveType, { icon: LucideIcon; hint: string }> = {
  Vacation: { icon: Plane, hint: "Planned time off" },
  Sick: { icon: Thermometer, hint: "Not feeling well" },
  Personal: { icon: UserRound, hint: "Personal matters" },
  Bereavement: { icon: HeartCrack, hint: "Loss of a loved one" },
  Other: { icon: MoreHorizontal, hint: "Something else" },
};

const STATUS_TONE: Record<LeaveStatus, PillTone> = {
  Pending: "pending",
  Approved: "ok",
  Declined: "problem",
  Cancelled: "neutral",
};

/** Where a request stands, or Sending… while its undo window is open. */
export function LeaveStatusPill({ status, sending }: { status: LeaveStatus; sending?: boolean }) {
  return (
    <Pill tone={sending ? "neutral" : STATUS_TONE[status]} variant="caps">
      {sending ? "Sending…" : status}
    </Pill>
  );
}

/** "16 Oct". */
export const shortDate = (iso: string) => leaveWhen(iso, iso);

type Filter = Exclude<LeaveStatus, "Cancelled"> | null;

export function LeaveQueue({
  requests,
  by,
  on,
  onDecided,
  pendingLabel = "Awaiting approval",
  showApprover = false,
  revealFrom = 0,
}: {
  /** The requests this queue covers: everyone's for HR, one department's for its manager. */
  requests: LeaveRequest[];
  /** Who decides here, as the requester will see it: "Jerry Delos Santos", "HR". */
  by: string;
  /** ISO date a decision is recorded on. */
  on?: string;
  /** Hear about a decision once it has gone, to tell the requester. */
  onDecided?: (req: LeaveRequest, decision: LeaveDecision) => void;
  pendingLabel?: string;
  /** Name each request's own approver (HR sees every department's requests). */
  showApprover?: boolean;
  /** The Reveal index the tiles start at, so the queue cascades in after a page's header. */
  revealFrom?: number;
}) {
  const reduce = useReducedMotion();
  const { resolveNotification } = useLaunchpad();
  const { requests: everyone, deciding } = useLeave();
  const [filter, setFilter] = React.useState<Filter>(null);
  const { page, swap, goPage, resetPage } = usePaging();

  const sorted = React.useMemo(() => [...requests].sort(leaveOrder), [requests]);
  const count = (s: LeaveStatus) => requests.filter((r) => r.status === s).length;
  const pending = count("Pending");
  const shown = filter ? sorted.filter((r) => r.status === filter) : sorted;
  const slice = paginate(shown, page, PAGE_SIZE);
  const toggle = (s: Exclude<Filter, null>) => {
    setFilter((f) => (f === s ? null : s));
    resetPage();
  };

  return (
    <>
      <Reveal index={revealFrom}>
        <KpiGrid cols={3}>
          <KpiCard
            label={pendingLabel}
            value={pending}
            icon={Hourglass}
            tone="pending"
            onClick={() => toggle("Pending")}
            active={filter === "Pending"}
            hint="Tap to filter"
          />
          <KpiCard
            label="Approved"
            value={count("Approved")}
            icon={CalendarCheck}
            tone="ok"
            onClick={() => toggle("Approved")}
            active={filter === "Approved"}
            hint="Tap to filter"
          />
          <KpiCard
            label="Declined"
            value={count("Declined")}
            icon={CalendarX2}
            tone="charcoal"
            onClick={() => toggle("Declined")}
            active={filter === "Declined"}
            hint="Tap to filter"
          />
        </KpiGrid>
      </Reveal>

      <Reveal index={revealFrom + 1} className="min-w-0">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-hairline pb-3">
            <CardTitle>Leave requests</CardTitle>
            <CardMeta>
              {filter ? (
                <Button
                  variant="link"
                  size="xs"
                  className="text-xs"
                  onClick={() => {
                    setFilter(null);
                    resetPage();
                  }}
                >
                  {filter} only · show all
                </Button>
              ) : (
                <span>
                  <Ticker value={pending} /> awaiting a decision
                </span>
              )}
            </CardMeta>
          </CardHeader>
          <SwapPane swapKey={shown.length ? `${filter}:${slice.page}` : `none:${filter}`} swap={swap}>
            {shown.length === 0 ? (
              filter === "Pending" || !filter ? (
                <EmptyState
                  icon={CalendarCheck}
                  title="All caught up"
                  description="No leave requests are waiting on you."
                  className="py-10"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                  <p className="text-xs text-muted-foreground">No {filter.toLowerCase()} requests yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setFilter(null);
                      resetPage();
                    }}
                  >
                    Show all requests
                  </Button>
                </div>
              )
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {slice.rows.map((r, i) => (
                    <LeaveRow
                      key={r.id}
                      req={r}
                      queue={everyone}
                      deciding={deciding[r.id]}
                      index={i}
                      reduce={reduce}
                      showApprover={showApprover}
                      onDecide={(decision) =>
                        decideLeave(r, decision, {
                          by,
                          on,
                          onDecided: () => {
                            // Decided here or in HR, the inbox's "Leave to approve" is done.
                            resolveNotification(leaveNotice(r));
                            onDecided?.(r, decision);
                          },
                        })
                      }
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </SwapPane>
          <PagerFooter slice={slice} noun="requests" onPage={goPage} />
        </Card>
      </Reveal>
    </>
  );
}

function LeaveRow({
  req: r,
  queue,
  deciding,
  index,
  reduce,
  showApprover,
  onDecide,
}: {
  req: LeaveRequest;
  queue: LeaveRequest[];
  deciding: LeaveDecision | undefined;
  index: number;
  reduce: boolean | null;
  showApprover: boolean;
  onDecide: (decision: LeaveDecision) => void;
}) {
  const isPending = r.status === "Pending";
  const label = `${r.name}, ${r.type.toLowerCase()} ${r.when}`;
  const TypeIcon = LEAVE_TYPE_META[r.type].icon;

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
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <TypeIcon className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
            {r.type} · {r.when} · {r.length}
          </p>
          {r.reason ? <p className="mt-1 text-xs text-foreground/80 italic">&ldquo;{r.reason}&rdquo;</p> : null}
          <Trail req={r} showApprover={showApprover} />
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
                <LeaveStatusPill status={r.status} />
              )}
            </motion.span>
          </AnimatePresence>

          {isPending && deciding ? (
            <Button size="sm" variant="outline" onClick={() => undoLeave(r.id)} aria-label={`Undo: keep ${label} pending`}>
              <Undo2 aria-hidden /> Undo
            </Button>
          ) : isPending ? (
            <span className="flex gap-1.5">
              <Button size="sm" onClick={() => onDecide("Approved")} aria-label={`Approve ${label}`}>
                <Check aria-hidden /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDecide("Declined")} aria-label={`Decline ${label}`}>
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

/** When it was filed, who it waits on (for HR), and who decided it. */
function Trail({ req: r, showApprover }: { req: LeaveRequest; showApprover: boolean }) {
  const parts = [
    r.filed ? `Filed ${shortDate(r.filed)}` : null,
    r.status === "Pending" && showApprover && r.approver
      ? `with ${r.approver}${r.department ? ` (${orgDepartment(r.department).name})` : ""}`
      : null,
    (r.status === "Approved" || r.status === "Declined") && r.decidedBy
      ? `${r.status} by ${r.decidedBy}${r.decidedOn ? ` on ${shortDate(r.decidedOn)}` : ""}`
      : null,
    r.status === "Cancelled" ? `Cancelled by ${r.name.split(" ")[0]}` : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <p className="mt-1 text-[11px] text-subtle-foreground tabular-nums">{parts.join(" · ")}</p>;
}

/** The requester's evidence: their own balance after this request, and who else is off. */
function Evidence({ req, queue }: { req: LeaveRequest; queue: LeaveRequest[] }) {
  const after = balanceAfter(req);
  const off = othersOff(req, queue);
  const short = after !== null && after < 0;

  return (
    <div className="mt-2.5 grid gap-x-6 gap-y-1.5 rounded-lg border border-hairline bg-canvas/70 px-3 py-2 text-xs sm:grid-cols-2 dark:bg-white/[0.02]">
      <div className="flex min-w-0 items-start gap-2">
        <Wallet className="mt-px size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
        {after === null || req.balance === null ? (
          <div className="min-w-0">
            <p className="text-foreground">No balance to draw on</p>
            <p className="text-subtle-foreground">{req.type} leave is granted case by case</p>
          </div>
        ) : (
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
        )}
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
