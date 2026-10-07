"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarCheck, CalendarDays, CalendarPlus, CalendarX2, Hourglass, Plus, XCircle } from "lucide-react";
import { EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { paginate } from "@/lib/paginate";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { hrefForKey } from "@/components/shell/dashboards";
import { leaveNotice, leaveOrder, type LeaveRequest, type LeaveStatus } from "@/components/modules/hr/data";
import { cancelLeave, markLeaveSeen, useLeave } from "@/components/modules/hr/leave-store";
import { LEAVE_TYPE_META, LeaveStatusPill, shortDate } from "@/components/modules/hr/LeaveQueue";
import { PageHeader } from "@/components/ui/page";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { Ticker, useCascading } from "@/components/ui/list-motion";
import { PagerFooter, SwapPane, usePaging } from "@/components/ui/pager";
import { EMPLOYEE } from "./data";
import { useLeaveNews } from "./leave-route";

const PAGE_SIZE = 10;

/**
 * Employee › Leave › My requests — HRIS's My requests: everything you've
 * filed and where it stands, ten a page. The tiles filter the table; a
 * request still inside its undo window shows as Sending…, and a pending one
 * can be cancelled, which tells your manager.
 */
export function LeaveHistory() {
  const { notify, resolveNotification } = useLaunchpad();
  const { requests, filing } = useLeave();
  const [filter, setFilter] = React.useState<LeaveStatus | null>(null);
  const [cancelling, setCancelling] = React.useState<LeaveRequest | null>(null);
  const { page, swap, goPage, resetPage } = usePaging();

  // Decisions you hadn't seen: marked New for this visit, and the rail badge clears.
  const news = useLeaveNews();
  const [fresh, setFresh] = React.useState<ReadonlySet<string>>(() => new Set());
  React.useEffect(() => {
    if (!news.length) return;
    setFresh((f) => new Set([...f, ...news]));
    markLeaveSeen(news);
  }, [news]);

  const sending = React.useMemo(() => new Set(filing.map((r) => r.id)), [filing]);
  // Your requests: any still sending first, then pending soonest first, then the rest newest first.
  const all = React.useMemo(
    () => [
      ...filing.filter((r) => r.name === EMPLOYEE.name),
      ...requests.filter((r) => r.name === EMPLOYEE.name).sort(leaveOrder),
    ],
    [filing, requests],
  );
  const count = (s: LeaveStatus) => all.filter((r) => r.status === s && !sending.has(r.id)).length;
  const rows = filter ? all.filter((r) => r.status === filter && !sending.has(r.id)) : all;
  const slice = paginate(rows, page, PAGE_SIZE);
  const toggle = (s: LeaveStatus) => {
    setFilter((f) => (f === s ? null : s));
    resetPage();
  };

  const doCancel = () => {
    const req = cancelling;
    setCancelling(null);
    if (!req) return;
    const done = cancelLeave(req.id);
    if (!done) {
      confirm("Already decided", `${req.approver ?? "Your manager"} got to it first: it can't be cancelled now.`);
      return;
    }
    resolveNotification(leaveNotice(req));
    notify(`${req.name} cancelled their ${req.type.toLowerCase()} leave, ${req.when} (Employee portal)`);
    confirm("Leave request cancelled", `${req.type} · ${req.when} · ${req.approver ?? "your manager"} has been told`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My requests"
        description="Every leave request you've filed and where it stands. Cancel one while it's still pending."
        actions={
          <Link href={hrefForKey("employee:leave:new")} className={buttonVariants({ variant: "brand" })}>
            <Plus aria-hidden /> File leave
          </Link>
        }
      />

      <Reveal index={0}>
        <KpiGrid cols={4}>
          <KpiCard size="sm" label="Pending" value={count("Pending")} icon={Hourglass} tone="pending" onClick={() => toggle("Pending")} active={filter === "Pending"} hint="Tap to filter" />
          <KpiCard size="sm" label="Approved" value={count("Approved")} icon={CalendarCheck} tone="ok" onClick={() => toggle("Approved")} active={filter === "Approved"} hint="Tap to filter" />
          <KpiCard size="sm" label="Declined" value={count("Declined")} icon={CalendarX2} tone="charcoal" onClick={() => toggle("Declined")} active={filter === "Declined"} hint="Tap to filter" />
          <KpiCard size="sm" label="Cancelled" value={count("Cancelled")} icon={XCircle} tone="charcoal" onClick={() => toggle("Cancelled")} active={filter === "Cancelled"} hint="Tap to filter" />
        </KpiGrid>
      </Reveal>

      <Reveal index={1}>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-hairline pb-3">
            <CardTitle>Your leave</CardTitle>
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
                  <Ticker value={all.length} /> filed
                </span>
              )}
            </CardMeta>
          </CardHeader>
          <SwapPane swapKey={rows.length ? `${filter}:${slice.page}` : `none:${filter}`} swap={swap}>
            {rows.length ? (
              <HistoryTable rows={slice.rows} sending={sending} fresh={fresh} onCancel={setCancelling} />
            ) : (
              <EmptyState
                icon={CalendarDays}
                title={all.length ? "Nothing here" : "No leave requests yet"}
                description={all.length ? `No ${filter?.toLowerCase()} requests.` : "File your first request and it shows here, with where it stands."}
                action={
                  all.length ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilter(null);
                        resetPage();
                      }}
                    >
                      Show all requests
                    </Button>
                  ) : (
                    <Link href={hrefForKey("employee:leave:new")} className={buttonVariants({ variant: "brand", size: "sm" })}>
                      <CalendarPlus aria-hidden /> File leave
                    </Link>
                  )
                }
              />
            )}
          </SwapPane>
          <PagerFooter slice={slice} noun="requests" onPage={goPage} />
        </Card>
      </Reveal>

      <Dialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        icon={XCircle}
        iconTone="problem"
        title={cancelling ? `Cancel your ${cancelling.type.toLowerCase()} leave?` : "Cancel leave?"}
        description={
          cancelling
            ? `${cancelling.when} (${cancelling.length}) comes off ${cancelling.approver ?? "your manager"}'s Approvals, and they're told you've cancelled. File it again if plans change back.`
            : null
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={doCancel}>
              <XCircle /> Cancel request
            </Button>
          </>
        }
      />
    </div>
  );
}

function HistoryTable({
  rows,
  sending,
  fresh,
  onCancel,
}: {
  rows: LeaveRequest[];
  sending: Set<string>;
  /** Decided since you last looked. */
  fresh: ReadonlySet<string>;
  onCancel: (req: LeaveRequest) => void;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  return (
    <Table className="min-w-[720px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
          <TableHead className="pl-5">Leave</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Filed</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Decision</TableHead>
          <TableHead className="pr-5 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence initial={false}>
          {rows.map((r, i) => {
            const isSending = sending.has(r.id);
            const Icon = LEAVE_TYPE_META[r.type].icon;
            return (
              <motion.tr
                key={r.id}
                layout="position"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -14, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } }}
                transition={{
                  duration: reduce ? 0 : 0.18,
                  ease: EASE_OUT,
                  delay: cascading ? rowDelay(i, reduce, 0.03) : 0,
                  layout: { duration: reduce ? 0 : 0.22, ease: EASE_SWAP, delay: 0 },
                }}
                className={cn(
                  "border-b border-hairline transition-colors hover:bg-tone-soft/70",
                  fresh.has(r.id) && "bg-tone-soft/60",
                )}
              >
                <TableCell className="pl-5">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icon className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
                    {r.type}
                  </span>
                  {r.reason ? <span className="block max-w-56 truncate text-xs text-muted-foreground italic">&ldquo;{r.reason}&rdquo;</span> : null}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {r.when}
                  <span className="block text-xs text-subtle-foreground">{r.length}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{r.filed ? shortDate(r.filed) : "—"}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <LeaveStatusPill status={r.status} sending={isSending} />
                    {fresh.has(r.id) ? (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: reduce ? 0 : 0.25 }}
                        className="inline-flex"
                      >
                        <Pill tone="tone" variant="caps">
                          New
                        </Pill>
                      </motion.span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {isSending ? (
                    `Sending to ${r.approver ?? "your manager"}`
                  ) : r.status === "Pending" ? (
                    `With ${r.approver ?? "your manager"}`
                  ) : r.status === "Cancelled" ? (
                    "You cancelled it"
                  ) : (
                    <>
                      {r.decidedBy ? `By ${r.decidedBy}` : r.status}
                      {r.decidedOn ? <span className="block text-subtle-foreground tabular-nums">{shortDate(r.decidedOn)}</span> : null}
                    </>
                  )}
                </TableCell>
                <TableCell className="pr-5 text-right">
                  {r.status === "Pending" && !isSending ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
                      onClick={() => onCancel(r)}
                      aria-label={`Cancel your ${r.type.toLowerCase()} leave, ${r.when}`}
                    >
                      <XCircle /> Cancel
                    </Button>
                  ) : null}
                </TableCell>
              </motion.tr>
            );
          })}
        </AnimatePresence>
      </TableBody>
    </Table>
  );
}
