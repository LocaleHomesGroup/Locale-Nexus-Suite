"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Briefcase,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Crown,
  Eye,
  Hourglass,
  IdCard,
  Mail,
  Network,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, PANEL_VARIANTS, RISE_VARIANTS, rowDelay } from "@/lib/motion";
import { useOrg, type PendingKind } from "@/components/modules/hr/org-store";
import {
  formatIsoDate,
  masterList,
  orgDepartment,
  orgDepartmentOf,
  orgReports,
  orgTone,
  tenure,
  type MasterRow,
  type OrgPerson,
} from "@/components/modules/hr/data";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/input";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { NoMatches } from "@/components/ui/states";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { AutoHeight, Ticker, useCascading } from "@/components/ui/list-motion";
import { EMPLOYEE_ID, EMPLOYEE_TODAY } from "./data";
import { Detail } from "./parts";

/** Twelve a page, so the grid fills evenly two, three or four up (HRIS's Directory). */
const PAGE_SIZE = 12;

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

const haystack = (r: MasterRow) => [r.name, r.note, r.role, r.record?.employeeId, r.record?.workEmail].filter(Boolean).join(" ").toLowerCase();

/**
 * Employee › Department — HRIS's team tab, which takes your department's name
 * (here, "AI & Growth"). Who's in it and who leads it, a directory you can
 * search, and the reporting line from the top of the department to you. It
 * reads HR's live org chart, so someone HR adds to your department shows here
 * at once. No pay or KPI rankings: those stay private.
 */
export function EmployeeDepartment() {
  const reduce = useReducedMotion();
  const { people, pending } = useOrg();
  const today = React.useMemo(() => new Date(`${EMPLOYEE_TODAY}T12:00:00`), []);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [swap, setSwap] = React.useState<Swap>(VIEW_SWAP);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const deptId = orgDepartmentOf(people, EMPLOYEE_ID);
  const dept = orgDepartment(deptId);
  const seats = React.useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const head = seats.get(dept.headId);

  // HRIS orders its directory managers first, then A–Z. Here: the head, then
  // anyone with people under them, then everyone else by name.
  const members = React.useMemo(() => {
    const rank = (r: MasterRow) => (r.id === dept.headId ? 0 : orgReports(people, r.id).length ? 1 : 2);
    return masterList(people)
      .filter((r) => r.department === deptId)
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [people, deptId, dept.headId]);

  const newest = React.useMemo(
    () =>
      members
        .filter((m) => m.record)
        .reduce<MasterRow | null>((best, m) => (!best || m.record!.commenced > best.record!.commenced ? m : best), null),
    [members],
  );
  const joinedThisYear = members.filter((m) => m.record?.commenced.startsWith(EMPLOYEE_TODAY.slice(0, 4))).length;

  const q = query.trim().toLowerCase();
  const rows = q ? members.filter((m) => haystack(m).includes(q)) : members;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const open = members.find((m) => m.id === openId) ?? null;

  const onQuery = (v: string) => {
    setQuery(v);
    setSwap(VIEW_SWAP);
    setPage(0);
  };
  const goPage = (n: number) => {
    setSwap({ kind: "page", dir: n > current ? 1 : -1 });
    setPage(n);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={dept.name}
        description={
          head?.name
            ? `Your department: everyone in it, from the org chart. ${head.name} leads it as ${head.role}.`
            : "Your department: everyone in it, from the org chart."
        }
      />

      <Reveal index={0}>
        <KpiGrid cols={3}>
          <KpiCard
            size="sm"
            label="People"
            value={members.length}
            sub={joinedThisYear ? `${joinedThisYear} joined in ${EMPLOYEE_TODAY.slice(0, 4)}` : "Nobody new this year"}
            icon={Users}
          />
          <KpiCard size="sm" label="Head of department" value={head?.name ?? "Vacant"} sub={head?.role ?? dept.name} icon={Crown} />
          <KpiCard
            size="sm"
            label="Newest"
            value={newest?.name ?? "—"}
            sub={
              newest?.record
                ? `${newest.id === EMPLOYEE_ID ? "You · " : ""}joined ${formatIsoDate(newest.record.commenced)}`
                : undefined
            }
            icon={Sparkles}
          />
        </KpiGrid>
      </Reveal>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Reveal index={1} className="min-w-0">
          <Card className="min-w-0">
            <CardHeader className="gap-y-3 border-b border-hairline pb-3">
              <div className="min-w-0">
                <CardTitle>Directory</CardTitle>
                <p className="text-xs text-muted-foreground tabular-nums">
                  <Ticker value={rows.length} /> of {members.length} shown
                </p>
              </div>
              <SearchInput
                value={query}
                onChange={onQuery}
                count={q ? rows.length : undefined}
                placeholder="Search people…"
                aria-label={`Search ${dept.name}`}
                className="w-full sm:ml-auto sm:w-64"
              />
            </CardHeader>

            <AutoHeight>
              <AnimatePresence mode="wait" initial={false} custom={swap}>
                <motion.div
                  key={rows.length ? `page:${current}` : "none"}
                  custom={swap}
                  variants={PANE_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: reduce ? 0 : swap.kind === "page" ? 0.22 : DURATION.swap, ease: EASE_SWAP }}
                >
                  {rows.length ? (
                    <MemberCards rows={shown} headId={dept.headId} pending={pending} today={today} onOpen={setOpenId} />
                  ) : (
                    <NoMatches query={query.trim()} onClear={() => onQuery("")} />
                  )}
                </motion.div>
              </AnimatePresence>
            </AutoHeight>

            {pages > 1 ? (
              <CardFooter className="justify-between text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, rows.length)} of {rows.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={current === 0} onClick={() => goPage(current - 1)}>
                    <ChevronLeft />
                  </Button>
                  <span className="min-w-14 text-center tabular-nums">
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
                </div>
              </CardFooter>
            ) : null}
          </Card>
        </Reveal>

        <Reveal index={2} className="min-w-0">
          <ReportingLine people={people} headId={dept.headId} onOpen={setOpenId} members={new Set(members.map((m) => m.id))} />
        </Reveal>
      </div>

      <MemberDialog row={open} seats={seats} headId={dept.headId} today={today} onClose={() => setOpenId(null)} />
    </div>
  );
}

/** What follows a name: You, Head, Adding… or Moving… (HR is changing their seat) or New. */
function NameTags({ row, headId, pending }: { row: MasterRow; headId: string; pending?: PendingKind }) {
  return (
    <>
      {row.id === EMPLOYEE_ID ? (
        <Pill tone="tone" className="px-2 py-0">
          You
        </Pill>
      ) : null}
      {row.id === headId ? (
        <Pill tone="charcoal" icon={Crown} className="px-2 py-0">
          Head
        </Pill>
      ) : null}
      {pending ? (
        <Pill tone="neutral" className="px-2 py-0">
          {pending === "moving" ? "Moving…" : "Adding…"}
        </Pill>
      ) : row.isNew && row.id !== EMPLOYEE_ID ? (
        <Pill tone="tone" className="px-2 py-0">
          New
        </Pill>
      ) : null}
    </>
  );
}

function MemberCards({
  rows,
  headId,
  pending,
  today,
  onOpen,
}: {
  rows: MasterRow[];
  headId: string;
  pending: Record<string, PendingKind>;
  today: Date;
  onOpen: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  return (
    <ul className="grid gap-3 bg-canvas/60 p-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] sm:p-4">
      <AnimatePresence>
        {rows.map((r, i) => (
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
            className={cn(
              "flex flex-col rounded-xl border bg-card p-3.5 shadow-xs transition-[translate,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
              r.id === EMPLOYEE_ID ? "border-tone-line" : "border-border",
            )}
          >
            <div className="flex items-start gap-3">
              <Avatar name={r.name} tone={orgTone(r.brands)} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="truncate text-[13px] font-semibold">{r.name}</span>
                  <NameTags row={r} headId={headId} pending={pending[r.id]} />
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{r.role}</p>
              </div>
            </div>

            <dl className="mt-3 mb-3 space-y-1.5 border-t border-hairline pt-3">
              <CardLine label="Email" mono>
                {r.record ? (
                  <a
                    href={`mailto:${r.record.workEmail}`}
                    className="rounded-sm text-tone-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45"
                  >
                    {r.record.workEmail}
                  </a>
                ) : null}
              </CardLine>
              <CardLine label="Joined">
                {r.record ? (
                  <>
                    {formatIsoDate(r.record.commenced)} <span className="text-subtle-foreground">·</span> {tenure(r.record.commenced, today)}
                  </>
                ) : null}
              </CardLine>
            </dl>

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-hairline pt-3">
              <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">{r.record?.employeeId ?? "No ID yet"}</p>
              <Button variant="outline" size="xs" onClick={() => onOpen(r.id)} aria-label={`View ${r.name}`}>
                <Eye /> View
              </Button>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function CardLine({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{label}</dt>
      <dd className={cn("min-w-0 truncate text-xs tabular-nums", mono && "font-mono")}>{children ?? "—"}</dd>
    </div>
  );
}

/**
 * The reporting line: who the department answers to, its head, and the seats
 * beneath, as a small tree. Your own seat is marked; any seat opens its record.
 */
function ReportingLine({
  people,
  headId,
  members,
  onOpen,
}: {
  people: OrgPerson[];
  headId: string;
  members: Set<string>;
  onOpen: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const byId = new Map(people.map((p) => [p.id, p]));
  const head = byId.get(headId);
  const above = head?.managerId ? byId.get(head.managerId) : undefined;
  let order = 0;

  const node = (p: OrgPerson, depth: number): React.ReactNode => {
    const kids = orgReports(people, p.id);
    const me = p.id === EMPLOYEE_ID;
    const index = order++;
    const label = p.name ?? `${p.role} (vacant)`;
    return (
      <li key={p.id} className="relative">
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: rowDelay(index, reduce, 0.05, 0.3) }}
        >
          <button
            type="button"
            disabled={!p.name || !members.has(p.id)}
            onClick={() => onOpen(p.id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none enabled:hover:bg-tone-soft/70 disabled:cursor-default",
              me && "bg-tone-soft",
            )}
          >
            <Avatar name={p.name ?? "TBA"} tone={p.name ? orgTone(p.brands) : "charcoal"} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className={cn("truncate text-[13px] font-medium", !p.name && "text-muted-foreground italic")}>{label}</span>
                {me ? (
                  <Pill tone="tone" className="px-1.5 py-0">
                    You
                  </Pill>
                ) : null}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{p.role}</span>
            </span>
          </button>
        </motion.div>
        {kids.length && depth < 3 ? (
          <ul className="relative ml-[22px] border-l border-border pl-3">{kids.map((k) => node(k, depth + 1))}</ul>
        ) : null}
      </li>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="size-4 text-tone-ink" aria-hidden /> Reporting line
        </CardTitle>
        <CardDescription>From the top of the department to you.</CardDescription>
      </CardHeader>
      <CardContent>
        {above ? (
          <div className="mb-1 flex items-center gap-2.5 px-2 py-1 text-xs text-muted-foreground">
            <Building2 className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              Answers to {above.name ?? above.role} · {above.role}
            </span>
          </div>
        ) : null}
        {head ? <ul className={cn(above && "ml-[22px] border-l border-dashed border-border pl-3")}>{node(head, 0)}</ul> : null}
      </CardContent>
    </Card>
  );
}

/** Who a seat answers to: their manager, the seat's title while it's vacant, or the board. */
function reportsTo(row: MasterRow, seats: Map<string, OrgPerson>): string | null {
  if (row.link === "peer") return "The board";
  const manager = row.managerId ? seats.get(row.managerId) : undefined;
  if (!manager) return null;
  return manager.name ? `${manager.name} · ${manager.role}` : `${manager.role} (vacant)`;
}

function MemberDialog({
  row,
  seats,
  headId,
  today,
  onClose,
}: {
  row: MasterRow | null;
  seats: Map<string, OrgPerson>;
  headId: string;
  today: Date;
  onClose: () => void;
}) {
  const record = row?.record;
  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      icon={IdCard}
      title={row ? (row.id === EMPLOYEE_ID ? `${row.name} (you)` : row.name) : ""}
      description={row ? `${row.role}${row.id === headId ? " · Head of department" : ""}` : null}
    >
      {row ? (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Detail index={0} icon={IdCard} label="Employee ID" mono>
            {record?.employeeId}
          </Detail>
          <Detail index={1} icon={Building2} label="Department">
            {orgDepartment(row.department).name}
          </Detail>
          <Detail index={2} icon={Briefcase} label="Position">
            {row.role}
          </Detail>
          <Detail index={3} icon={Network} label="Reports to">
            {reportsTo(row, seats)}
          </Detail>
          <Detail index={4} icon={Mail} label="Work email" mono>
            {record ? (
              <a href={`mailto:${record.workEmail}`} className="rounded-sm text-tone-ink underline-offset-2 hover:underline">
                {record.workEmail}
              </a>
            ) : null}
          </Detail>
          <Detail index={5} icon={CalendarDays} label="Joined">
            {record ? formatIsoDate(record.commenced) : null}
          </Detail>
          <Detail index={6} icon={Hourglass} label="Tenure">
            {record ? tenure(record.commenced, today) : null}
          </Detail>
          <Detail index={7} icon={Users} label="Direct reports">
            {orgReports([...seats.values()], row.id).length || "None"}
            {row.id === headId ? <span className="text-muted-foreground"> · leads the department</span> : null}
          </Detail>
        </dl>
      ) : null}
    </Dialog>
  );
}
