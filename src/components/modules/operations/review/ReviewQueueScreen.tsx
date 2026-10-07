"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCheck, History, Inbox, LayoutDashboard, ListChecks, Play } from "lucide-react";
import type { ReviewItem } from "@/data/seed";
import { useLaunchpad } from "@/state/launchpad-store";
import { EASE_SWAP } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { EmptyState, NoMatches } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { Ticker } from "@/components/ui/list-motion";
import { useNavReselect } from "@/components/shell/nav-state";
import { ChoiceChips } from "../ui/ChoiceChips";
import { MONEY_MILESTONES, isStale, liveMilestone, reviewHaystack } from "./review";
import { DECIDED, type Decided } from "./parts";
import { ReviewOverview } from "./ReviewOverview";
import { DecidedTable, PAGE_SIZE, PagedBody, Pager, QueueTable } from "./ReviewTables";
import { DismissDialog, ReviewProcessor } from "./ReviewDialogs";

type View = "overview" | "queue" | "decided";
type OutcomeFilter = "all" | Decided;

/** A page change slides the way you're going; anything else resets to the first page. */
interface Paging {
  page: number;
  dir: number;
}
const FIRST: Paging = { page: 0, dir: 0 };

/**
 * The review queue, as a queuing dashboard modelled on HRIS's HR › Offboarding
 * (Overview · Queue · Offboarded). Four milestones move money: Formal Finance
 * Approval, Slab Down, Settlement Confirmation and Plate Height. A reversal or a
 * backdated completion on one of them is filed here instead of applied, and
 * nothing reaches Monday or HubSpot until a person releases it.
 *
 * - Overview: the KPI row and where held changes come from.
 * - Queue: one row per waiting change. Process steps through them one at a
 *   time (all of them, the ticked ones, or one row); Dismiss asks for the
 *   reason. A change whose milestone has moved since it was filed can only be
 *   dismissed, here and in the sync provider.
 * - Decided: everything that has left the queue, filterable by outcome.
 *
 * It opens on Queue rather than Overview, as every link here ("Open review
 * queue", the rail badge) means "show me what's waiting".
 */
export function ReviewQueueScreen() {
  const { jobs, reviewItems } = useLaunchpad();
  const reduce = useReducedMotion();

  const [view, setView] = React.useState<View>("queue");
  const [queueQuery, setQueueQuery] = React.useState("");
  const [queuePaging, setQueuePaging] = React.useState<Paging>(FIRST);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [decidedQuery, setDecidedQuery] = React.useState("");
  const [milestone, setMilestone] = React.useState<string>("all");
  const [outcome, setOutcome] = React.useState<OutcomeFilter>("all");
  const [decidedPaging, setDecidedPaging] = React.useState<Paging>(FIRST);
  const [processing, setProcessing] = React.useState<string[] | null>(null);
  const [dismissing, setDismissing] = React.useState<ReviewItem | null>(null);

  // Re-clicking Review queue in the rail goes back to the waiting list, unfiltered.
  useNavReselect("operations:review", () => {
    setView("queue");
    setQueueQuery("");
    setQueuePaging(FIRST);
  });

  const jobFor = React.useCallback((id: number) => jobs.find((j) => j.id === id), [jobs]);
  const pending = React.useMemo(() => reviewItems.filter((i) => i.status === "pending"), [reviewItems]);
  const decided = React.useMemo(() => reviewItems.filter((i) => i.status !== "pending"), [reviewItems]);
  const staleIds = React.useMemo(
    () => new Set(pending.filter((i) => isStale(i, liveMilestone(jobFor(i.jobId), i))).map((i) => i.id)),
    [pending, jobFor],
  );

  // A ticked row that has since been released or dismissed stops counting.
  const selectedWaiting = pending.filter((i) => selected.has(i.id));

  const qq = queueQuery.trim().toLowerCase();
  const queueRows = React.useMemo(
    () => pending.filter((i) => !qq || reviewHaystack(i, jobFor(i.jobId)).includes(qq)),
    [pending, qq, jobFor],
  );
  const dq = decidedQuery.trim().toLowerCase();
  const decidedRows = React.useMemo(
    () =>
      decided.filter(
        (i) =>
          (outcome === "all" || i.status === outcome) &&
          (milestone === "all" || i.milestone === milestone) &&
          (!dq || reviewHaystack(i, jobFor(i.jobId)).includes(dq)),
      ),
    [decided, outcome, milestone, dq, jobFor],
  );
  // Outcome counts are of the whole list, so a chip keeps its figure while another is selected.
  const outcomeCount = (o: OutcomeFilter) => (o === "all" ? decided.length : decided.filter((i) => i.status === o).length);

  const pageOf = (paging: Paging, total: number) => Math.min(paging.page, Math.max(0, Math.ceil(total / PAGE_SIZE) - 1));
  const queuePage = pageOf(queuePaging, queueRows.length);
  const decidedPage = pageOf(decidedPaging, decidedRows.length);
  const queueShown = queueRows.slice(queuePage * PAGE_SIZE, (queuePage + 1) * PAGE_SIZE);
  const decidedShown = decidedRows.slice(decidedPage * PAGE_SIZE, (decidedPage + 1) * PAGE_SIZE);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      const all = queueShown.every((i) => next.has(i.id));
      queueShown.forEach((i) => (all ? next.delete(i.id) : next.add(i.id)));
      return next;
    });

  const process = (items: ReviewItem[]) => {
    if (!items.length) return;
    setProcessing(items.map((i) => i.id));
  };
  const processSelected = () => {
    process(selectedWaiting);
    setSelected(new Set());
  };

  const toolbar =
    view === "queue" ? (
      <>
        <SearchInput
          value={queueQuery}
          onChange={(v) => {
            setQueueQuery(v);
            setQueuePaging(FIRST);
          }}
          count={qq ? queueRows.length : undefined}
          placeholder="Search jobs, milestones…"
          aria-label="Search the review queue"
          className="sm:w-64"
        />
        {selectedWaiting.length ? (
          <Button onClick={processSelected} title="Step through just the ticked changes">
            <ListChecks /> Process selected ({selectedWaiting.length})
          </Button>
        ) : null}
        {pending.length ? (
          <Button
            variant={selectedWaiting.length ? "outline" : "brand"}
            onClick={() => process(pending)}
            title="Step through every waiting change, one at a time"
          >
            <Play /> Process waiting ({pending.length})
          </Button>
        ) : null}
      </>
    ) : view === "decided" ? (
      <>
        <SmoothSelect
          value={milestone}
          onChange={(v) => {
            setMilestone(v);
            setDecidedPaging(FIRST);
          }}
          ariaLabel="Filter by milestone"
          className="sm:w-56"
          options={[
            { value: "all", label: "All milestones", hint: decided.length },
            ...[...MONEY_MILESTONES].map((m) => ({
              value: m,
              label: m,
              hint: decided.filter((i) => i.milestone === m).length,
            })),
          ]}
        />
        <SearchInput
          value={decidedQuery}
          onChange={(v) => {
            setDecidedQuery(v);
            setDecidedPaging(FIRST);
          }}
          count={dq ? decidedRows.length : undefined}
          placeholder="Search jobs, reasons…"
          aria-label="Search decided changes"
          className="sm:w-64"
        />
      </>
    ) : pending.length ? (
      <Button variant="brand" onClick={() => process(pending)} title="Step through every waiting change, one at a time">
        <Play /> Process waiting ({pending.length})
      </Button>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Review queue"
        description="Reversals and backdated completions on the four milestones that move money wait here until a person releases them. Nothing on this page has been sent to Monday or HubSpot."
      />

      <Reveal>
        {/* Not overflow-hidden: the milestone menu drops below a short list. The bodies clip themselves. */}
        <Card className="min-w-0">
          {/* flex-nowrap: a wrapping column would size each row to its widest content and spill on a phone. */}
          <CardHeader className="flex-col flex-nowrap items-stretch gap-y-3 border-b border-hairline pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SlidingTabs
                value={view}
                onChange={setView}
                ariaLabel="Review queue views"
                className="self-start"
                items={[
                  { value: "overview" as View, label: "Overview", icon: LayoutDashboard },
                  {
                    value: "queue" as View,
                    label: "Queue",
                    icon: Inbox,
                    count: pending.length || undefined,
                    danger: pending.length > 0,
                  },
                  { value: "decided" as View, label: "Decided", icon: History, count: decided.length },
                ]}
              />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={view}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: reduce ? 0 : 0.18, ease: EASE_SWAP }}
                  className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end"
                >
                  {toolbar}
                </motion.div>
              </AnimatePresence>
            </div>

            {view === "queue" ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                <Ticker value={pending.length} /> waiting on a person
                {staleIds.size ? ` · ${staleIds.size} can only be dismissed` : ""}
              </p>
            ) : view === "decided" ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-xs text-muted-foreground tabular-nums">
                  <Ticker value={decidedRows.length} /> of {decided.length} decided
                </p>
                <ChoiceChips
                  size="sm"
                  label="Filter by outcome"
                  value={outcome}
                  onChange={(v) => {
                    setOutcome(v);
                    setDecidedPaging(FIRST);
                  }}
                  options={(["all", "accepted", "dismissed", "superseded"] as const).map((o) => ({
                    value: o,
                    label: (
                      <>
                        {o === "all" ? "All" : DECIDED[o].word}{" "}
                        <span className="tabular-nums opacity-70">{outcomeCount(o)}</span>
                      </>
                    ),
                  }))}
                />
              </div>
            ) : null}
          </CardHeader>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: reduce ? 0 : 0.22, ease: EASE_SWAP }}
            >
              {view === "overview" ? (
                <div className="p-4 sm:p-5">
                  <ReviewOverview items={reviewItems} staleCount={staleIds.size} />
                </div>
              ) : view === "queue" ? (
                !pending.length ? (
                  <EmptyState
                    icon={CheckCheck}
                    title="Nothing is waiting"
                    description="Formal Finance Approval, Slab Down, Settlement Confirmation and Plate Height file a reversal or a backdated completion here instead of applying it. Every other milestone applies straight away, with an audit entry."
                  />
                ) : !queueRows.length ? (
                  <NoMatches query={queueQuery.trim()} onClear={() => setQueueQuery("")} />
                ) : (
                  <>
                    <PagedBody page={queuePage} dir={queuePaging.dir}>
                      <QueueTable
                        rows={queueShown}
                        jobFor={jobFor}
                        staleIds={staleIds}
                        selected={selected}
                        onToggle={toggle}
                        onTogglePage={togglePage}
                        onProcess={(i) => process([i])}
                        onDismiss={setDismissing}
                      />
                    </PagedBody>
                    <Pager
                      page={queuePage}
                      total={queueRows.length}
                      noun="waiting"
                      onPage={(n) => setQueuePaging({ page: n, dir: n > queuePage ? 1 : -1 })}
                    />
                  </>
                )
              ) : !decided.length ? (
                <EmptyState
                  icon={History}
                  title="Nothing decided yet"
                  description="Released, dismissed and superseded changes land here, with who decided and the reason they gave."
                />
              ) : !decidedRows.length ? (
                <NoMatches
                  query={[
                    outcome !== "all" ? DECIDED[outcome].word : "",
                    milestone !== "all" ? milestone : "",
                    decidedQuery.trim(),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  onClear={() => {
                    setDecidedQuery("");
                    setMilestone("all");
                    setOutcome("all");
                  }}
                />
              ) : (
                <>
                  <PagedBody page={decidedPage} dir={decidedPaging.dir}>
                    <DecidedTable rows={decidedShown} jobFor={jobFor} />
                  </PagedBody>
                  <Pager
                    page={decidedPage}
                    total={decidedRows.length}
                    noun="decided"
                    onPage={(n) => setDecidedPaging({ page: n, dir: n > decidedPage ? 1 : -1 })}
                  />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </Card>
      </Reveal>

      <ReviewProcessor ids={processing} onClose={() => setProcessing(null)} />
      <DismissDialog item={dismissing} onClose={() => setDismissing(null)} />
    </div>
  );
}
