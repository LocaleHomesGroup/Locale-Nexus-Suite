"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Banknote,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  LayoutGrid,
  Pencil,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, PANEL_VARIANTS, RISE_VARIANTS, rowDelay } from "@/lib/motion";
import { confirm } from "@/state/launchpad-store";
import { PageHeader } from "@/components/ui/page";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { NoMatches } from "@/components/ui/states";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { AutoHeight, Ticker, useCascading } from "@/components/ui/list-motion";
import { toIso } from "@/components/ui/date-picker";
import { useOrg, type OrgState, type PendingKind, type ScheduledTransfer } from "../org-store";
import { usePay, type PayState } from "../pay-store";
import {
  ORG_DEPARTMENTS,
  formatIsoDate,
  masterList,
  orgDepartment,
  orgTone,
  tenure,
  type MasterRow,
  type OrgDepartmentId,
} from "../data";
import { EMAIL_LINK, Email, shortDate, type Mode, type OpenFn } from "../master-list/parts";
import { RecordDialog } from "../master-list/RecordDialog";
import { EditPersonDialog } from "../master-list/EditPersonDialog";
import { PayDialog } from "../master-list/PayDialog";

type ViewMode = "table" | "cards";
type DeptFilter = "all" | OrgDepartmentId;
type Opened = { id: string; mode: Mode } | null;

/** The table pages in 10s, as in HRIS; the cards in 12s, so the grid fills evenly two, three or four up. */
const PAGE_SIZE: Record<ViewMode, number> = { table: 10, cards: 12 };

// The view choice survives a section switch (this tab unmounts) without browser
// storage, so the server always renders the table and hydration matches (HRIS).
let viewMemory: ViewMode = "table";

/**
 * How the list body swaps. Paging slides sideways the way you're going, like a
 * step flow (§ 11.1); a new view, department or search rises in like a section
 * (§ 1.1).
 */
interface Swap {
  kind: "page" | "view";
  dir: number;
}

const VIEW_SWAP: Swap = { kind: "view", dir: 1 };

const PANE_VARIANTS = {
  enter: (s: Swap) => (s.kind === "page" ? PANEL_VARIANTS.enter(s.dir) : RISE_VARIANTS.enter(1)),
  center: { opacity: 1, x: 0, y: 0 },
  exit: (s: Swap) => (s.kind === "page" ? PANEL_VARIANTS.exit(s.dir) : RISE_VARIANTS.exit(1)),
};

const haystack = (r: MasterRow) =>
  [
    r.name,
    r.note,
    r.role,
    orgDepartment(r.department).name,
    r.record?.employeeId,
    r.record?.workEmail,
    r.record?.personalEmail,
    r.record?.preferredName,
    r.record?.mobile,
    r.record?.location,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

/** Download the rows in view (search and department applied) as a CSV, pay rates included. */
function exportCsv(rows: MasterRow[], rates: PayState["rates"], today: Date) {
  const head = [
    "Employee ID",
    "Name",
    "Department",
    "Position",
    "Work email",
    "Personal email",
    "Commencement date",
    "Tenure",
    "Hourly rate (AUD)",
    "Overtime rate (AUD)",
  ];
  const body = rows.map((r) => [
    r.record?.employeeId ?? "",
    r.name,
    orgDepartment(r.department).name,
    r.role,
    r.record?.workEmail ?? "",
    r.record?.personalEmail ?? "",
    r.record?.commenced ?? "",
    r.record ? tenure(r.record.commenced, today) : "",
    rates[r.id] ? rates[r.id].hourly.toFixed(2) : "",
    rates[r.id] ? rates[r.id].overtime.toFixed(2) : "",
  ]);
  const csv = [head, ...body].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const file = `locale-global-master-list-${toIso(today)}.csv`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  confirm("Master list exported", `${rows.length} ${rows.length === 1 ? "person" : "people"} · ${file}`);
}

/**
 * HR › Global Master List — everyone employed across the group, modelled on
 * HRIS's Global Master List and People tab: department filter, search, export,
 * a table or cards view, paged, and per person Pay (a one-off payment), View
 * (the full record) and Edit (profile, pay rates, department). It reads the
 * live org chart, so someone added, renamed or moved there shows here at once;
 * their employee ID and emails follow from Horilla.
 *
 * Motion (HRIS § 14): a new view, department or page swaps the body and
 * replays the row cascade, and the card glides to its new height. Typing a
 * search never replays it: rows that drop out drift away, the rest close the
 * gap, and rows the search brings back fade straight in.
 */
export function HrMasterListTab() {
  const { people, pending, scheduled, saving } = useOrg();
  const pay = usePay();
  const reduce = useReducedMotion();
  const [view, setView] = React.useState<ViewMode>(viewMemory);
  const [dept, setDept] = React.useState<DeptFilter>("all");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [swap, setSwap] = React.useState<Swap>(VIEW_SWAP);
  const [opened, setOpened] = React.useState<Opened>(null);
  const today = React.useMemo(() => new Date(), []);

  const all = React.useMemo(() => masterList(people), [people]);
  const seats = React.useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const org = { pending, scheduled, saving };

  const counts = React.useMemo(() => {
    const c = Object.fromEntries(ORG_DEPARTMENTS.map((d) => [d.id, 0])) as Record<OrgDepartmentId, number>;
    for (const r of all) c[r.department] += 1;
    return c;
  }, [all]);

  const q = query.trim().toLowerCase();
  const rows = React.useMemo(
    () => all.filter((r) => (dept === "all" || r.department === dept) && (!q || haystack(r).includes(q))),
    [all, dept, q],
  );

  const size = PAGE_SIZE[view];
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * size, (current + 1) * size);
  const openRow = opened ? (all.find((r) => r.id === opened.id) ?? null) : null;

  const restart = () => {
    setSwap(VIEW_SWAP);
    setPage(0);
  };
  const goPage = (n: number) => {
    setSwap({ kind: "page", dir: n > current ? 1 : -1 });
    setPage(n);
  };
  const onQuery = (v: string) => {
    setQuery(v);
    restart();
  };
  const onDept = (v: DeptFilter) => {
    setDept(v);
    restart();
  };
  const onView = (v: ViewMode) => {
    viewMemory = v;
    setView(v);
    restart();
  };
  const onOpen: OpenFn = (id, mode) => setOpened({ id, mode });
  const close = () => setOpened(null);

  const viewProps: ViewProps = { rows: shown, pending, scheduled, saving, payPending: pay.pending, today, onOpen };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Global Master List"
        description="Everyone employed across Locale Property Group, from the org chart · records mirrored from Horilla."
      />

      <Reveal index={0}>
        {/* Not overflow-hidden: the department menu drops below short results. The body clips itself. */}
        <Card className="min-w-0">
          <CardHeader className="gap-y-3 border-b border-hairline pb-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              <Ticker value={rows.length} /> of {all.length} shown
            </p>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
              <SmoothSelect
                value={dept}
                onChange={onDept}
                ariaLabel="Filter by department"
                className="sm:w-48"
                options={[
                  { value: "all" as DeptFilter, label: "All departments", hint: all.length },
                  ...ORG_DEPARTMENTS.map((d) => ({ value: d.id as DeptFilter, label: d.name, hint: counts[d.id] })),
                ]}
              />
              <SearchInput
                value={query}
                onChange={onQuery}
                count={q ? rows.length : undefined}
                placeholder="Search name, email, ID…"
                aria-label="Search the master list"
                className="sm:w-64"
              />
              <Button variant="outline" onClick={() => exportCsv(rows, pay.rates, today)} disabled={!rows.length}>
                <Download /> Export CSV
              </Button>
              <SlidingTabs
                value={view}
                onChange={onView}
                ariaLabel="View as"
                className="self-start sm:self-auto"
                items={[
                  { value: "table" as ViewMode, label: "Table", icon: Table2 },
                  { value: "cards" as ViewMode, label: "Cards", icon: LayoutGrid },
                ]}
              />
            </div>
          </CardHeader>

          <AutoHeight>
            <AnimatePresence mode="wait" initial={false} custom={swap}>
              <motion.div
                key={rows.length ? `${view}:${current}:${dept}` : "none"}
                custom={swap}
                variants={PANE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: reduce ? 0 : swap.kind === "page" ? 0.22 : DURATION.swap, ease: EASE_SWAP }}
              >
                {!rows.length ? (
                  <NoMatches query={query.trim()} onClear={() => onQuery("")} />
                ) : view === "table" ? (
                  <MasterTable {...viewProps} />
                ) : (
                  <MasterCards {...viewProps} />
                )}
              </motion.div>
            </AnimatePresence>
          </AutoHeight>

          <CardFooter className="justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              {rows.length
                ? `${current * size + 1}–${Math.min((current + 1) * size, rows.length)} of ${rows.length}`
                : "No matches"}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" aria-label="First page" disabled={current === 0} onClick={() => goPage(0)}>
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={current === 0}
                onClick={() => goPage(current - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="sr-only" aria-live="polite">
                Page {current + 1} of {pages}
              </span>
              <span className="min-w-14 text-center tabular-nums" aria-hidden>
                <Ticker value={current + 1} /> / {pages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={current >= pages - 1}
                onClick={() => goPage(current + 1)}
              >
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Last page"
                disabled={current >= pages - 1}
                onClick={() => goPage(pages - 1)}
              >
                <ChevronsRight />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </Reveal>

      <RecordDialog
        row={opened?.mode === "view" ? openRow : null}
        people={people}
        seats={seats}
        org={org}
        today={today}
        onClose={close}
        onOpen={onOpen}
      />
      <EditPersonDialog
        row={opened?.mode === "edit" ? openRow : null}
        all={all}
        people={people}
        seats={seats}
        org={org}
        counts={counts}
        today={today}
        onClose={close}
        onView={(id) => onOpen(id, "view")}
      />
      <PayDialog row={opened?.mode === "pay" ? openRow : null} today={today} onClose={close} />
    </div>
  );
}

interface ViewProps {
  rows: MasterRow[];
  pending: OrgState["pending"];
  scheduled: OrgState["scheduled"];
  saving: OrgState["saving"];
  payPending: PayState["pending"];
  today: Date;
  onOpen: OpenFn;
}

/** What follows a name: the chart's bracket note, the name they go by, a transition, then a state. */
function NameTags({ row, pending, saving }: { row: MasterRow; pending?: PendingKind; saving?: boolean }) {
  const goesBy = row.record?.preferredName;
  return (
    <>
      {row.note ? <span className="text-xs whitespace-nowrap text-subtle-foreground">({row.note})</span> : null}
      {goesBy && goesBy !== row.note ? (
        <span className="text-xs whitespace-nowrap text-subtle-foreground">({goesBy})</span>
      ) : null}
      {row.takingOverFrom ? (
        <span className="text-xs whitespace-nowrap text-amber-700 dark:text-amber-300">(transition)</span>
      ) : null}
      {pending || saving ? (
        <Pill tone="neutral" className="px-2 py-0">
          {saving ? "Saving…" : pending === "moving" ? "Moving…" : "Adding…"}
        </Pill>
      ) : row.isNew ? (
        <Pill tone="tone" className="px-2 py-0">
          New
        </Pill>
      ) : null}
    </>
  );
}

/** A booked move, under the department it's leaving. */
function BookedLine({ booked, today, className }: { booked: ScheduledTransfer; today: Date; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1 text-xs text-tone-ink", className)}>
      <CalendarClock className="size-3 shrink-0" aria-hidden />
      <span>
        <span className="sr-only">Moving </span>→ {orgDepartment(booked.to).name} · {shortDate(booked.effective, today)}
      </span>
    </span>
  );
}

/**
 * The pinned Actions column. It stays in view while a narrow screen scrolls the
 * table, and casts a shadow only while there's something under it. `--card` is
 * see-through (the glass card over the page), so the cell paints the same card
 * layer over the page background: it looks identical but hides what slides
 * beneath. The row's hover tint comes through an overlay.
 */
const STICKY_GROUND = "bg-background bg-[linear-gradient(var(--card),var(--card))]";
const STICKY_CELL = cn(
  "sticky right-0 z-10",
  STICKY_GROUND,
  "before:pointer-events-none before:absolute before:inset-0 before:bg-tone-soft/70 before:opacity-0 before:transition-opacity group-hover:before:opacity-100",
);
const STICKY_SHADOW = "shadow-[-14px_0_14px_-14px_rgb(0_0_0/0.28)] dark:shadow-[-14px_0_14px_-14px_rgb(0_0_0/0.9)]";

/** True while the table runs on past the right edge of its scroller. */
function useClippedRight(probe: React.RefObject<HTMLDivElement | null>) {
  const [clipped, setClipped] = React.useState(false);
  React.useEffect(() => {
    const scroller = probe.current?.firstElementChild as HTMLElement | null;
    if (!scroller) return;
    const check = () => setClipped(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
    check();
    scroller.addEventListener("scroll", check, { passive: true });
    const observer = new ResizeObserver(check);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    return () => {
      scroller.removeEventListener("scroll", check);
      observer.disconnect();
    };
  }, [probe]);
  return clipped;
}

/**
 * Pay, View and Edit, as in HRIS's People roster. Icons only on a phone; the
 * names are in the labels. `compact` trims the padding so all three fit the
 * table at 1440 without dropping a label.
 */
function RowActions({ row, onOpen, compact }: { row: MasterRow; onOpen: OpenFn; compact?: boolean }) {
  const open = (mode: Mode) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen(row.id, mode);
  };
  return (
    <span className={cn("relative flex items-center justify-end", compact ? "gap-1 [&>button]:px-1.5" : "gap-1.5")}>
      <Button variant="outline" size="xs" onClick={open("pay")} aria-label={`Pay ${row.name}`}>
        <Banknote /> <span className="hidden sm:inline">Pay</span>
      </Button>
      <Button variant="outline" size="xs" onClick={open("view")} aria-label={`View ${row.name}`}>
        <Eye /> <span className="hidden sm:inline">View</span>
      </Button>
      <Button variant="outline" size="xs" onClick={open("edit")} aria-label={`Edit ${row.name}`}>
        <Pencil /> <span className="hidden sm:inline">Edit</span>
      </Button>
    </span>
  );
}

function MasterTable({ rows, pending, scheduled, saving, payPending, today, onOpen }: ViewProps) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const probe = React.useRef<HTMLDivElement>(null);
  const clipped = useClippedRight(probe);

  return (
    <div ref={probe}>
      <Table className="min-w-[1040px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
            <TableHead className="pl-5">Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Work email</TableHead>
            <TableHead>Personal email</TableHead>
            <TableHead className="whitespace-normal">Commencement date</TableHead>
            <TableHead>Tenure</TableHead>
            <TableHead className={cn("sticky right-0 z-10 pr-4 pl-2 text-right", STICKY_GROUND, clipped && STICKY_SHADOW)}>
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence>
            {rows.map((r, i) => {
              const booked = scheduled[r.id];
              return (
                <motion.tr
                  key={r.id}
                  layout="position"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -14, transition: { duration: reduce ? 0 : 0.12, ease: EASE_OUT } }}
                  transition={{
                    duration: reduce ? 0 : 0.18,
                    ease: EASE_OUT,
                    delay: cascading ? rowDelay(i, reduce, 0.03) : 0,
                    layout: { duration: reduce ? 0 : 0.22, ease: EASE_SWAP, delay: 0 },
                  }}
                  onClick={() => onOpen(r.id, "view")}
                  className="group cursor-pointer border-b border-hairline transition-colors hover:bg-tone-soft/70"
                >
                  <TableCell className="pl-5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.name} tone={orgTone(r.brands)} size="sm" />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpen(r.id, "view");
                            }}
                            className="rounded-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
                          >
                            {r.name}
                          </button>
                          <NameTags row={r} pending={pending[r.id]} saving={Boolean(saving[r.id] || payPending[r.id])} />
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {r.record?.employeeId ?? "No ID yet"}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-foreground/80">
                    <span className="block leading-snug">{orgDepartment(r.department).name}</span>
                    {booked ? <BookedLine booked={booked} today={today} className="mt-0.5" /> : null}
                  </TableCell>
                  {/* Positions and emails wrap (emails only after the @) so the table fits a laptop. */}
                  <TableCell className="text-foreground/80">
                    <span className="block min-w-28 leading-snug">{r.role}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs leading-snug">
                    {r.record ? (
                      <a href={`mailto:${r.record.workEmail}`} onClick={(e) => e.stopPropagation()} className={EMAIL_LINK}>
                        <Email value={r.record.workEmail} />
                      </a>
                    ) : (
                      <Dash />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs leading-snug text-muted-foreground">
                    {r.record?.personalEmail ? <Email value={r.record.personalEmail} /> : <Dash />}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {r.record ? formatIsoDate(r.record.commenced) : <Dash />}
                  </TableCell>
                  {/* Counted on the viewer's clock, which can be a day off the server's. */}
                  <TableCell className="whitespace-nowrap tabular-nums" suppressHydrationWarning>
                    {r.record ? tenure(r.record.commenced, today) : <Dash />}
                  </TableCell>
                  <TableCell className={cn(STICKY_CELL, "pr-4 pl-2", clipped && STICKY_SHADOW)}>
                    <RowActions row={r} onOpen={onOpen} compact />
                  </TableCell>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
}

function MasterCards({ rows, pending, scheduled, saving, payPending, today, onOpen }: ViewProps) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  return (
    <ul className="grid gap-3 bg-canvas/60 p-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] sm:p-4">
      <AnimatePresence>
        {rows.map((r, i) => {
          const booked = scheduled[r.id];
          return (
            <motion.li
              key={r.id}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } }}
              transition={{
                duration: reduce ? 0 : 0.22,
                ease: EASE_OUT,
                delay: cascading ? rowDelay(i, reduce, 0.03, 0.24) : 0,
                layout: { duration: reduce ? 0 : 0.24, ease: EASE_SWAP, delay: 0 },
              }}
              className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-3.5 shadow-xs transition-[translate,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="flex items-start gap-3">
                <Avatar name={r.name} tone={orgTone(r.brands)} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="truncate text-[13px] font-semibold">{r.name}</span>
                    <NameTags row={r} pending={pending[r.id]} saving={Boolean(saving[r.id] || payPending[r.id])} />
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{r.record?.employeeId ?? "No ID yet"}</p>
                </div>
                <Pill tone="neutral" className="max-w-[45%] truncate">
                  {orgDepartment(r.department).name}
                </Pill>
              </div>

              <dl className="mt-3 mb-3 space-y-1.5 border-t border-hairline pt-3">
                <CardLine label="Position">{r.role}</CardLine>
                <CardLine label="Work" mono>
                  {r.record?.workEmail}
                </CardLine>
                <CardLine label="Personal" mono>
                  {r.record?.personalEmail || null}
                </CardLine>
                <CardLine label="Started">
                  {r.record ? (
                    <span suppressHydrationWarning>
                      {formatIsoDate(r.record.commenced)} <span className="text-subtle-foreground">·</span>{" "}
                      {tenure(r.record.commenced, today)}
                    </span>
                  ) : null}
                </CardLine>
                {booked ? (
                  <CardLine label="Moving">
                    <BookedLine booked={booked} today={today} className="justify-end" />
                  </CardLine>
                ) : null}
              </dl>

              <div className="mt-auto flex items-center justify-end gap-1.5 border-t border-hairline pt-3">
                <RowActions row={r} onOpen={onOpen} />
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

function CardLine({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{label}</dt>
      <dd className={cn("min-w-0 truncate text-right text-xs tabular-nums", mono && "font-mono")}>{children ?? <Dash />}</dd>
    </div>
  );
}
