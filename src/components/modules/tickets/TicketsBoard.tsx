"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FolderKanban, LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { STAFF, dashboardById } from "@/components/shell/dashboards";
import { useBoardDrag, type BoardDrag } from "@/hooks/use-board-drag";
import { useTickets } from "@/state/tickets-store";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { NoMatches } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { Ticker, useCascading } from "@/components/ui/list-motion";
import {
  PRIORITY_STYLES,
  PROJECTS,
  PROJECT_BY_ID,
  STATUS_FILL,
  STATUS_LABEL,
  TICKET_DASHBOARDS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  dashboardName,
  type Ticket,
  type TicketStatus,
} from "./data";
import { boardColumns, matchesTicket } from "./logic";
import { TicketCardBody, ticketCardClass } from "./TicketCard";
import { useTicketParams, type DashFilter, type PriorityFilter, type ProjectFilter } from "./use-ticket-params";

const EMPTY_COLUMN: Record<TicketStatus, string> = {
  todo: "New tickets land here",
  in_progress: "Nothing being worked on",
  testing: "Nothing waiting on a check",
  done: "Finished tickets land here",
};

/**
 * Tickets › Board — HRIS's TicketsBoard in the Launchpad shell. Four columns;
 * inside each, urgent first, then oldest first (no hand-ordering). Drag a card
 * across columns with the Sales pipeline's feel, or Alt+←/→ on a focused card;
 * on a phone, open it and change its column. The dashboard, project and
 * priority filters live in the URL, so an Overview row or a Projects card
 * opens the board already filtered.
 */
export function TicketsBoard() {
  const { tickets, moveTicket, openNewTicket } = useTickets();
  const params = useTicketParams();
  const reduce = useReducedMotion();
  const hintId = React.useId();
  const [query, setQuery] = React.useState("");

  // While a card is carried, the column it hovers holds it, so the board
  // reflows under the pointer. Nothing is written until the drop.
  const [carry, setCarry] = React.useState<{ no: number; status: TicketStatus } | null>(null);
  const columnRefs = React.useRef(new Map<TicketStatus, HTMLElement>());
  const slot = (no: number | string) => document.querySelector<HTMLElement>(`[data-ticket-card="${no}"]`);

  const drag = useBoardDrag<TicketStatus>({
    columnAt: (x, y) => {
      for (const [status, el] of columnRefs.current) {
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top - 48 && y <= r.bottom + 160) return status;
      }
      return null;
    },
    slotOf: (id) => slot(id),
    onHover: (id, status) => setCarry({ no: Number(id), status }),
    onDrop: (id, from, to) => {
      setCarry(null);
      if (to && to !== from) moveTicket(Number(id), to);
    },
  });

  const onBoard = React.useMemo(() => tickets.filter((t) => !t.archived), [tickets]);
  const q = query.trim();
  const filtersActive = params.dash !== "all" || params.project !== "all" || params.priority !== "all" || q !== "";
  const shown = React.useMemo(
    () =>
      onBoard.filter(
        (t) =>
          (params.dash === "all" || t.dashboard === params.dash) &&
          (params.project === "all" || t.project === params.project) &&
          (params.priority === "all" || t.priority === params.priority) &&
          matchesTicket(t, q),
      ),
    [onBoard, params.dash, params.project, params.priority, q],
  );

  const columns = React.useMemo(() => {
    const cols = boardColumns(shown);
    if (!carry) return cols;
    const t = shown.find((x) => x.no === carry.no);
    if (!t || t.status === carry.status) return cols;
    return { ...cols, [t.status]: cols[t.status].filter((x) => x.no !== t.no), [carry.status]: [t, ...cols[carry.status]] };
  }, [shown, carry]);

  const clear = () => {
    setQuery("");
    params.clearFilters();
  };

  /** Alt+← / Alt+→ on a focused card: one column along, focus following the card. */
  const step = (t: Ticket, by: 1 | -1) => {
    const to = TICKET_STATUSES[TICKET_STATUSES.indexOf(t.status) + by];
    if (!to) return;
    moveTicket(t.no, to);
    window.setTimeout(() => slot(t.no)?.focus(), 60);
  };

  const carried = drag.active ? tickets.find((t) => String(t.no) === drag.active?.id) : undefined;
  const filterLabel = [
    q ? `“${q}”` : null,
    params.dash !== "all" ? dashboardName(params.dash) : null,
    params.project !== "all" ? PROJECT_BY_ID[params.project]?.name : null,
    params.priority !== "all" ? `${PRIORITY_STYLES[params.priority].label} priority` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ticket board"
        description="Improvements asked for on every dashboard, and the projects' work. Drag a card to move it along, or open it to reply and edit."
        actions={
          <Button
            onClick={() =>
              openNewTicket({
                dashboard: params.dash === "all" ? null : params.dash,
                project: params.project === "all" ? null : params.project,
                raisedBy: STAFF.name,
              })
            }
          >
            <Plus aria-hidden /> New ticket
          </Button>
        }
      />

      <Reveal index={0} className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
          <Ticker value={shown.length} /> of {onBoard.length} on the board
        </p>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center xl:ml-auto xl:w-auto">
          <SearchInput
            value={query}
            onChange={setQuery}
            count={q ? shown.length : undefined}
            placeholder="Search tickets…"
            aria-label="Search tickets"
            className="max-w-none sm:col-span-2 lg:w-56"
          />
          <SmoothSelect
            value={params.dash}
            onChange={params.setDash}
            ariaLabel="Filter by dashboard"
            leading={<LayoutGrid className="size-3.5" aria-hidden />}
            className="min-w-0 lg:w-48"
            options={[
              { value: "all" as DashFilter, label: "All dashboards" },
              ...TICKET_DASHBOARDS.map((id) => {
                const Icon = dashboardById(id).icon;
                return {
                  value: id as DashFilter,
                  label: (
                    <span className="inline-flex items-center gap-2">
                      <Icon className="size-3.5 text-subtle-foreground" aria-hidden />
                      {dashboardName(id)}
                    </span>
                  ),
                  hint: onBoard.filter((t) => t.dashboard === id).length || undefined,
                };
              }),
            ]}
          />
          <SmoothSelect
            value={params.project}
            onChange={params.setProject}
            ariaLabel="Filter by project"
            leading={<FolderKanban className="size-3.5" aria-hidden />}
            className="min-w-0 lg:w-56"
            options={[
              { value: "all" as ProjectFilter, label: "All projects" },
              ...PROJECTS.map((p) => ({
                value: p.id as ProjectFilter,
                label: p.name,
                hint: onBoard.filter((t) => t.project === p.id).length,
              })),
            ]}
          />
          <SmoothSelect
            value={params.priority}
            onChange={params.setPriority}
            ariaLabel="Filter by priority"
            className="min-w-0 lg:w-40"
            options={[
              { value: "all" as PriorityFilter, label: "All priorities" },
              ...[...TICKET_PRIORITIES].reverse().map((p) => ({
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
        </div>
      </Reveal>

      <Reveal index={1} className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          {shown.length === 0 && filtersActive ? (
            <motion.div
              key="none"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP }}
            >
              <NoMatches query={filterLabel} onClear={clear} className="rounded-xl border border-dashed border-border" />
            </motion.div>
          ) : (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP }}
            >
              {/* On a phone the columns keep a readable width and snap as the board scrolls sideways. */}
              <div className="-mx-1 snap-x snap-proximity overflow-x-auto scroll-px-1 px-1 pt-1 pb-2 [scrollbar-width:thin]">
                <div className="grid min-w-[68rem] grid-cols-4 gap-3 sm:min-w-[56rem]">
                  {TICKET_STATUSES.map((status) => (
                    <Column
                      key={status}
                      status={status}
                      tickets={columns[status]}
                      visible={shown}
                      filtersActive={filtersActive}
                      highlighted={drag.active !== null && drag.over === status}
                      drag={drag}
                      hintId={hintId}
                      onOpen={params.openTicket}
                      onStep={step}
                      refCallback={(el) => {
                        if (el) columnRefs.current.set(status, el);
                        else columnRefs.current.delete(status);
                      }}
                    />
                  ))}
                </div>
              </div>
              <p id={hintId} className="sr-only">
                Press Enter to open the ticket. Alt with the left or right arrow moves it one column.
              </p>
              <p className="mt-2 text-xs text-subtle-foreground">
                Drag a card to another column, or open it to change its column, reply or archive it. Inside a column, urgent
                comes first, then the oldest.
              </p>
            </motion.div>
          )}
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
              // Under reduced motion the card is carried flat: no tilt, no lift.
              animate={drag.dropping || reduce ? { rotate: 0, scale: 1 } : { rotate: 2, scale: 1.03 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
            >
              <div className={ticketCardClass({ overlay: true })}>
                <TicketCardBody ticket={carried} />
              </div>
            </motion.div>,
            document.body,
          )
        : null}
    </div>
  );
}

function Column({
  status,
  tickets,
  visible,
  filtersActive,
  highlighted,
  drag,
  hintId,
  onOpen,
  onStep,
  refCallback,
}: {
  status: TicketStatus;
  tickets: Ticket[];
  /** Every card on the board after filters, so a card leaving this column for another isn't animated away. */
  visible: Ticket[];
  filtersActive: boolean;
  highlighted: boolean;
  drag: BoardDrag<TicketStatus>;
  hintId: string;
  onOpen: (no: number) => void;
  onStep: (t: Ticket, by: 1 | -1) => void;
  refCallback: (el: HTMLElement | null) => void;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const headingId = React.useId();
  const stillShown = React.useMemo(() => new Set(visible.map((t) => t.no)), [visible]);

  // Cards that were on the board last render move here without fading in;
  // cards a filter brings back fade in.
  const seen = React.useRef<Set<number> | null>(null);
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
        <span className={cn("size-2 shrink-0 rounded-full", STATUS_FILL[status])} aria-hidden />
        <h2 id={headingId} className="truncate text-[13px] font-semibold">
          {STATUS_LABEL[status]}
          <span className="sr-only">, {tickets.length} tickets</span>
        </h2>
        <span
          className="rounded-full bg-card px-1.5 py-px font-mono text-xs text-muted-foreground tabular-nums shadow-xs dark:bg-muted"
          aria-hidden
        >
          <Ticker value={tickets.length} />
        </span>
      </header>

      <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
        <AnimatePresence initial={false} custom={stillShown}>
          {tickets.map((t, i) => {
            const arriving = before !== null && !before.has(t.no);
            return (
              <motion.li
                key={t.no}
                layout={reduce ? false : "position"}
                layoutId={reduce ? undefined : `ticket-${t.no}`}
                custom={stillShown}
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  shown: { opacity: 1, y: 0 },
                  // Moving to another column is the layout glide, not an exit.
                  gone: (shown: Set<number>) =>
                    shown.has(t.no)
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
                  data-ticket-card={t.no}
                  aria-describedby={hintId}
                  className={ticketCardClass({ ghosted: drag.active?.id === String(t.no) })}
                  onPointerDown={(e) => drag.start(e, String(t.no), t.status)}
                  onClick={() => {
                    if (!drag.wasJustDropped()) onOpen(t.no);
                  }}
                  onKeyDown={(e) => {
                    if (!e.altKey || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
                    e.preventDefault();
                    onStep(t, e.key === "ArrowRight" ? 1 : -1);
                  }}
                >
                  <TicketCardBody ticket={t} />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {tickets.length === 0 ? (
          <li
            className={cn(
              "mx-1 mt-1 flex h-20 items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs text-subtle-foreground",
              highlighted ? "border-tone-line text-tone-ink" : "border-border",
            )}
          >
            {highlighted ? "Drop to move here" : filtersActive ? "No tickets match" : EMPTY_COLUMN[status]}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
