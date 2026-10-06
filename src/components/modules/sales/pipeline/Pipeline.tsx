"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, Plus, SquareKanban } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, RISE_VARIANTS, rowDelay } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { EmptyState, NoMatches } from "@/components/ui/states";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { SyncBadge } from "@/components/ui/sync-badge";
import { Ticker, useCascading } from "@/components/ui/list-motion";
import type { Job } from "@/data/jobs";
import {
  CURRENT_REP,
  DEAL_PRIORITIES,
  PIPELINE_STAGES,
  REPS,
  dealValueK,
  millionsFromK,
  openPipelineK,
  type DealPriority,
  type PipelineDeal,
  type PipelineStage,
} from "../data";
import { useSalesState } from "../sales-state";
import { Footnote } from "../parts";
import { DealCardBody, PRIORITY_STYLES, PriorityChip, STAGE_DOT, dealCardClass, dealNo, relativeTime } from "./DealCard";
import { DealDialog } from "./DealDialog";
import { useDealWrites } from "./deal-writes";
import { useBoardDrag, type BoardDrag } from "./use-board-drag";

type View = "board" | "lost";
type OwnerFilter = "all" | string;
type PriorityFilter = "all" | DealPriority;

const haystack = (d: PipelineDeal) =>
  [dealNo(d), d.client, d.suburb, d.rep, d.pkg, d.notes, d.nextStep, d.value].join(" ").toLowerCase();

/** A column's total: "$585k", "$1.25m". */
const totalLabel = (k: number) => (k >= 1000 ? millionsFromK(k) : `$${Math.round(k)}k`);

/**
 * Sales › Pipeline — the deal board, modelled on HRIS's Tickets board
 * (TicketsBoard, TicketCard, TicketDialog) in Sales' own tone. Four stage
 * columns of deal cards, each made and owned by a consultant. Drag a card to
 * change its stage; open it to update the deal: its fields on one side, its
 * Updates thread and edit history on the other. "Mark as lost" parks a deal
 * under Lost, where it keeps its history and can be reopened. Every write goes
 * to HubSpot behind the undo window, and a deal reaching Sale won is what CRM
 * Dash Sync picks up to create the job in Operations.
 *
 * Motion (HRIS § 14): the board and Lost swap like sections, cards cascade in
 * on arrival, a moved card glides to its new column while the rest close the
 * gap, filtered-out cards drift away, and column counts tick.
 */
export function Pipeline() {
  const { deals } = useSalesState();
  const { jobs, openJob } = useLaunchpad();
  const writes = useDealWrites();
  const reduce = useReducedMotion();
  const hintId = React.useId();

  const [view, setView] = React.useState<View>("board");
  const [owner, setOwner] = React.useState<OwnerFilter>("all");
  const [priority, setPriority] = React.useState<PriorityFilter>("all");
  const [query, setQuery] = React.useState("");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  // null opens "New deal". Kept after close so the dialog keeps its content while it animates out.
  const [dialogId, setDialogId] = React.useState<string | null>(null);

  // While a card is carried, the column it hovers holds it, so the board
  // reflows under the pointer (HRIS's onDragOver). Nothing is written until the drop.
  const [carry, setCarry] = React.useState<{ id: string; stage: PipelineStage } | null>(null);
  const columnRefs = React.useRef(new Map<PipelineStage, HTMLElement>());

  const drag = useBoardDrag<PipelineStage>({
    columnAt: (x, y) => {
      for (const [stage, el] of columnRefs.current) {
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top - 48 && y <= r.bottom + 160) return stage;
      }
      return null;
    },
    onHover: (id, stage) => setCarry({ id, stage }),
    onDrop: (id, from, to) => {
      setCarry(null);
      if (to && to !== from) writes.moveDeal(id, to);
    },
  });

  const jobFor = React.useCallback(
    (d: PipelineDeal): Job | undefined => (d.stage === "Sale won" ? jobs.find((j) => j.client === d.client) : undefined),
    [jobs],
  );

  const q = query.trim().toLowerCase();
  const filtersActive = owner !== "all" || priority !== "all" || q !== "";
  const matches = React.useCallback(
    (d: PipelineDeal) =>
      (owner === "all" || d.rep === owner) && (priority === "all" || d.priority === priority) && (!q || haystack(d).includes(q)),
    [owner, priority, q],
  );

  const onBoard = React.useMemo(() => deals.filter((d) => !d.lost), [deals]);
  const lost = React.useMemo(
    () => deals.filter((d) => d.lost).sort((a, b) => (b.lost?.at ?? 0) - (a.lost?.at ?? 0)),
    [deals],
  );
  const shownBoard = React.useMemo(() => onBoard.filter(matches), [onBoard, matches]);
  const shownLost = React.useMemo(() => lost.filter(matches), [lost, matches]);

  const columns = React.useMemo(() => {
    const map = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, [] as PipelineDeal[]])) as Record<PipelineStage, PipelineDeal[]>;
    for (const d of shownBoard) {
      if (carry?.id === d.id && carry.stage !== d.stage) map[carry.stage].unshift(d);
      else map[d.stage].push(d);
    }
    return map;
  }, [shownBoard, carry]);

  const openDeal = (id: string) => {
    setDialogId(id);
    setDialogOpen(true);
  };
  const newDeal = () => {
    setDialogId(null);
    setDialogOpen(true);
  };

  const dialogDeal = dialogId ? (deals.find((d) => d.id === dialogId) ?? null) : null;
  // A deal undone out of existence closes its dialog rather than turning it into "New deal".
  React.useEffect(() => {
    if (dialogOpen && dialogId && !dialogDeal) setDialogOpen(false);
  }, [dialogOpen, dialogId, dialogDeal]);

  const clearFilters = () => {
    setOwner("all");
    setPriority("all");
    setQuery("");
  };

  /** Alt+← / Alt+→ on a focused card: one stage along, focus following the card. */
  const step = (d: PipelineDeal, by: 1 | -1) => {
    const to = PIPELINE_STAGES[PIPELINE_STAGES.indexOf(d.stage) + by];
    if (!to) return;
    writes.stepDeal(d.id, by);
    window.setTimeout(() => {
      columnRefs.current.get(to)?.querySelector<HTMLElement>(`[data-deal-card="${CSS.escape(d.id)}"]`)?.focus();
    }, 60);
  };

  const carried = drag.active ? deals.find((d) => d.id === drag.active?.id) : undefined;
  const filterLabel = q
    ? query.trim()
    : [owner !== "all" ? owner : null, priority !== "all" ? `${PRIORITY_STYLES[priority].label} priority` : null]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Deal pipeline"
        description="Every deal by stage, owned by the consultant who made it. Open a deal to update it. Won deals flow straight into Operations."
        actions={
          <Button onClick={newDeal}>
            <Plus aria-hidden /> New deal
          </Button>
        }
      />

      <Reveal index={0} className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SlidingTabs
            value={view}
            onChange={setView}
            ariaLabel="Show"
            items={[
              { value: "board" as View, label: "Board", icon: SquareKanban, count: onBoard.length },
              { value: "lost" as View, label: "Lost", icon: Archive, count: lost.length },
            ]}
          />
          <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {view === "board" ? (
              <>
                <Ticker value={shownBoard.length} /> of {onBoard.length} deals ·{" "}
                <span className="font-medium text-foreground">{millionsFromK(openPipelineK(shownBoard))}</span> open
              </>
            ) : (
              <>
                <Ticker value={shownLost.length} /> of {lost.length} lost
              </>
            )}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
          <SmoothSelect
            value={owner}
            onChange={setOwner}
            ariaLabel="Filter by owner"
            className="sm:w-48"
            options={[
              { value: "all", label: "All owners" },
              ...REPS.map((r) => ({
                value: r,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={r} size="xs" />
                    {r}
                  </span>
                ),
                hint: r === CURRENT_REP ? "you" : undefined,
              })),
            ]}
          />
          <SmoothSelect
            value={priority}
            onChange={setPriority}
            ariaLabel="Filter by priority"
            className="sm:w-40"
            options={[
              { value: "all" as PriorityFilter, label: "All priorities" },
              ...DEAL_PRIORITIES.map((p) => ({
                value: p as PriorityFilter,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", PRIORITY_STYLES[p].dot)} aria-hidden />
                    {PRIORITY_STYLES[p].label}
                  </span>
                ),
              })),
            ]}
          />
          <SearchInput
            value={query}
            onChange={setQuery}
            count={q ? (view === "board" ? shownBoard.length : shownLost.length) : undefined}
            placeholder="Search deals…"
            aria-label="Search deals"
            className="sm:w-60"
          />
        </div>
      </Reveal>

      <Reveal index={1} className="min-w-0">
        <AnimatePresence mode="wait" initial={false} custom={view === "board" ? -1 : 1}>
          <motion.div
            key={view}
            custom={view === "board" ? -1 : 1}
            variants={RISE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP }}
          >
            {view === "board" ? (
              <>
                {/* On a phone the columns keep a readable width and snap as the board scrolls sideways. */}
                <div className="-mx-1 snap-x snap-proximity overflow-x-auto scroll-px-1 px-1 pt-1 pb-2 [scrollbar-width:thin]">
                  <div className="grid min-w-[68rem] grid-cols-4 gap-3 sm:min-w-[56rem]">
                    {PIPELINE_STAGES.map((stage) => (
                      <BoardColumn
                        key={stage}
                        stage={stage}
                        deals={columns[stage]}
                        visible={shownBoard}
                        filtersActive={filtersActive}
                        highlighted={drag.active !== null && drag.over === stage}
                        drag={drag}
                        hintId={hintId}
                        jobFor={jobFor}
                        onOpen={openDeal}
                        onStep={step}
                        refCallback={(el) => {
                          if (el) columnRefs.current.set(stage, el);
                          else columnRefs.current.delete(stage);
                        }}
                      />
                    ))}
                  </div>
                </div>
                <p id={hintId} className="sr-only">
                  Press Enter to open the deal. Alt with the left or right arrow moves it one stage.
                </p>
                <Footnote className="mt-2">
                  Drag a card to another column to change its stage, or open it to update the deal. Sale won creates the
                  job in CRM Dash Sync automatically.
                </Footnote>
              </>
            ) : (
              <LostList
                deals={shownLost}
                total={lost.length}
                filterLabel={filterLabel}
                onClear={clearFilters}
                onOpen={openDeal}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </Reveal>

      {/* The carried card, lifted and tilted under the pointer (HRIS's DragOverlay). */}
      {drag.active && carried
        ? createPortal(
            <motion.div
              aria-hidden
              className="pointer-events-none fixed top-0 left-0 z-[90]"
              style={{ x: drag.x, y: drag.y, width: drag.active.width }}
              initial={{ rotate: 0, scale: 1 }}
              animate={drag.dropping ? { rotate: 0, scale: 1 } : { rotate: 2, scale: 1.03 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
            >
              <div className={dealCardClass({ overlay: true, won: carried.stage === "Sale won" })}>
                <DealCardBody deal={carried} job={jobFor(carried)} />
              </div>
            </motion.div>,
            document.body,
          )
        : null}

      <DealDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        deal={dialogDeal}
        job={dialogDeal ? jobFor(dialogDeal) : undefined}
        onCreate={(draft) => {
          writes.createDeal(draft);
          setView("board");
        }}
        onSave={writes.saveDeal}
        onLost={writes.markLost}
        onReopen={(id) => {
          writes.reopenDeal(id);
          setView("board");
        }}
        onPost={writes.postUpdate}
        onOpenJob={() => {
          const job = dialogDeal ? jobFor(dialogDeal) : undefined;
          setDialogOpen(false);
          if (job) openJob(job.id);
        }}
      />
    </div>
  );
}

function BoardColumn({
  stage,
  deals,
  visible,
  filtersActive,
  highlighted,
  drag,
  hintId,
  jobFor,
  onOpen,
  onStep,
  refCallback,
}: {
  stage: PipelineStage;
  deals: PipelineDeal[];
  /** Every card on the board after filters, so a card leaving this column for another isn't animated away. */
  visible: PipelineDeal[];
  filtersActive: boolean;
  highlighted: boolean;
  drag: BoardDrag<PipelineStage>;
  hintId: string;
  jobFor: (d: PipelineDeal) => Job | undefined;
  onOpen: (id: string) => void;
  onStep: (d: PipelineDeal, by: 1 | -1) => void;
  refCallback: (el: HTMLElement | null) => void;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const headingId = React.useId();
  const won = stage === "Sale won";
  const total = deals.reduce((s, d) => s + dealValueK(d), 0);
  const stillShown = React.useMemo(() => new Set(visible.map((d) => d.id)), [visible]);

  // Cards that were on the board last render move here without fading in;
  // cards a filter brings back fade in.
  const seen = React.useRef<Set<string> | null>(null);
  const before = seen.current;
  React.useEffect(() => {
    seen.current = stillShown;
  }, [stillShown]);

  return (
    <section
      ref={refCallback}
      aria-labelledby={headingId}
      className={cn(
        "flex min-h-72 min-w-0 snap-start flex-col rounded-xl border border-transparent bg-canvas",
        "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
        highlighted && "border-tone-line bg-tone-soft/70 ring-1 ring-tone-line",
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={cn("size-2 shrink-0 rounded-full", STAGE_DOT[stage])} aria-hidden />
        <h2 id={headingId} className="truncate text-[13px] font-semibold">
          {stage}
          <span className="sr-only">, {deals.length} deals</span>
        </h2>
        <span
          className="rounded-full bg-card px-1.5 py-px font-mono text-xs text-muted-foreground tabular-nums shadow-xs dark:bg-muted"
          aria-hidden
        >
          <Ticker value={deals.length} />
        </span>
        {deals.length ? (
          <span className="ml-auto shrink-0 text-xs text-subtle-foreground tabular-nums" title={`${stage}: ${totalLabel(total)} in total`}>
            {totalLabel(total)}
          </span>
        ) : null}
      </header>

      <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
        <AnimatePresence initial={false} custom={stillShown}>
          {deals.map((d, i) => {
            const arriving = before !== null && !before.has(d.id);
            return (
              <motion.li
                key={d.id}
                layout={reduce ? false : "position"}
                layoutId={reduce ? undefined : `deal-${d.id}`}
                custom={stillShown}
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  shown: { opacity: 1, y: 0 },
                  // Moving to another column is the layout glide, not an exit.
                  gone: (shown: Set<string>) =>
                    shown.has(d.id)
                      ? { opacity: 0, transition: { duration: 0 } }
                      : { opacity: 0, scale: 0.96, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } },
                }}
                initial={before === null || arriving ? "hidden" : false}
                animate="shown"
                exit="gone"
                transition={{
                  duration: reduce ? 0 : 0.22,
                  ease: EASE_OUT,
                  delay: cascading ? rowDelay(i, reduce, 0.04, 0.24) : 0,
                  layout: { duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP, delay: 0 },
                }}
              >
                <button
                  type="button"
                  data-deal-card={d.id}
                  aria-describedby={hintId}
                  className={dealCardClass({ ghosted: drag.active?.id === d.id, won })}
                  onPointerDown={(e) => drag.start(e, d.id, d.stage)}
                  onClick={() => {
                    if (!drag.wasJustDropped()) onOpen(d.id);
                  }}
                  onKeyDown={(e) => {
                    if (!e.altKey || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
                    e.preventDefault();
                    onStep(d, e.key === "ArrowRight" ? 1 : -1);
                  }}
                >
                  <DealCardBody deal={d} job={jobFor(d)} />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {deals.length === 0 ? (
          <li
            className={cn(
              "mx-1 mt-1 flex h-20 items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs text-subtle-foreground",
              highlighted ? "border-tone-line text-tone-ink" : "border-border",
            )}
          >
            {highlighted
              ? "Drop to move here"
              : filtersActive
                ? "No deals match"
                : stage === PIPELINE_STAGES[0]
                  ? "New deals land here"
                  : won
                    ? "Won deals land here"
                    : "No deals in this stage"}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/** Lost deals, newest first. A row opens the deal frozen, where it can be reopened (HRIS's Archived view). */
function LostList({
  deals,
  total,
  filterLabel,
  onClear,
  onOpen,
}: {
  deals: PipelineDeal[];
  total: number;
  filterLabel: string;
  onClear: () => void;
  onOpen: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();

  if (total === 0) {
    return (
      <EmptyState
        icon={Archive}
        title="No lost deals"
        description="Marking a deal lost parks it here with its updates and history, instead of deleting it."
        className="rounded-xl border border-dashed border-border"
      />
    );
  }
  if (deals.length === 0) {
    return <NoMatches query={filterLabel} onClear={onClear} className="rounded-xl border border-dashed border-border" />;
  }

  return (
    <ul className="grid gap-2">
      <AnimatePresence initial={false}>
        {deals.map((d, i) => (
          <motion.li
            key={d.id}
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
          >
            <button
              type="button"
              onClick={() => onOpen(d.id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-xs outline-none",
                "transition-[translate,box-shadow,border-color] duration-150 ease-out motion-reduce:transition-none",
                "hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 motion-reduce:hover:translate-y-0",
              )}
            >
              <Avatar name={d.rep} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-xs font-medium text-muted-foreground">{dealNo(d)}</span>
                  <span className="truncate text-sm font-medium">{d.client}</span>
                  <PriorityChip priority={d.priority} />
                  {d.syncing ? <SyncBadge sync="pending" /> : null}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground" suppressHydrationWarning>
                  Lost {d.lost ? relativeTime(d.lost.at) : ""} by {d.lost?.by} · was in {d.stage} · {d.suburb} ·{" "}
                  <span className="text-foreground tabular-nums">{d.value}</span>
                </span>
              </span>
              <span className="hidden shrink-0 text-xs text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline">
                View &amp; reopen
              </span>
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
