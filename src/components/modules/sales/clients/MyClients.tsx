"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Circle, Eye, Flag, HardHat, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, RISE_VARIANTS, rowDelay } from "@/lib/motion";
import { paginate } from "@/lib/paginate";
import type { Job } from "@/data/jobs";
import { hrefForKey } from "@/components/shell/dashboards";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { Pill } from "@/components/ui/pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RateBar } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, NoMatches } from "@/components/ui/states";
import { Ticker, useCascading } from "@/components/ui/list-motion";
import { PagerFooter, SwapPane, usePaging } from "@/components/ui/pager";
import { REPS } from "../data";
import { scopeRep, useSalesScope, useSalesState } from "../sales-state";
import {
  PROGRESS_LABEL,
  UNASSIGNED,
  buildProgress,
  clientsOf,
  filterClients,
  groupByRep,
  repOf,
  type ProgressBand,
} from "./group-by-rep";
import { JobDetailScreen, type JobTabHost } from "../../operations/jobs/detail/JobDetailScreen";
import { OperationsSyncProvider } from "../../operations/sync/OperationsSyncProvider";
import { useJobs, useLiveState, useViewer } from "@/state/live-data";
import { LiveNote } from "@/components/ui/live-note";
import { ViewingAs } from "../ViewingAs";

/**
 * Clients: the jobs from the database when live data shows (Monday's, read only), otherwise the
 * shared store's, so a milestone synced in Operations moves the bar here.
 *
 * In the Sales Representative portal it's one rep's My clients, as cards: their jobs, their to-dos
 * and the tasks their manager set them. A card opens the job in Operations. On the Sales Manager
 * dashboard it's All clients: every rep's jobs as one paged list, a line each, rep by rep, with
 * Representative and Progress filters and a search. A client opens inside the tab.
 */
export function MyClients() {
  const rep = scopeRep(useSalesScope());
  return rep ? <RepClients rep={rep} /> : <TeamClients />;
}

function RepClients({ rep }: { rep: string }) {
  const { openJob } = useLaunchpad();
  const { jobs, live } = useJobs();
  const { viewer } = useViewer();
  // With no database there is no note and no picker, so pass no actions: an empty slot still adds a row gap on a phone.
  const withNote = useLiveState().kind !== "off";
  // Live jobs name real reps, so they follow "Viewing as". The sample rep stays for the sample screens.
  const who = live ? (viewer?.name ?? "") : rep;
  const mine = clientsOf(jobs, who);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My clients"
        description="You only see clients assigned to you."
        actions={
          withNote ? (
            <>
              <LiveNote />
              {live ? <ViewingAs /> : null}
            </>
          ) : undefined
        }
      />
      {mine.length ? (
        <ClientGrid jobs={mine} onOpen={openJob} />
      ) : (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Your won deals become clients here once CRM Dash Sync creates the job."
          className="rounded-xl border border-dashed border-border"
        />
      )}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Reveal index={mine.length} className="min-w-0">
          <TodosCard />
        </Reveal>
        <Reveal index={mine.length + 1} className="min-w-0">
          {/* The manager's tasks are the sample reps' (set on the Sales Manager dashboard): a real rep picked in "Viewing as" has none. The To-dos beside it are no one's, and stay. */}
          <TasksCard rep={who} />
        </Reveal>
      </div>
    </div>
  );
}

/**
 * Clients on a page of All clients. Live data is about a thousand clients and the pager only steps, so a
 * page is 25 lines (40 pages), not HRIS's ten; the filters and the search are the quick way in.
 */
const CLIENTS_PAGE_SIZE = 25;
/** A filter's "every one" value: no rep or band is called it. */
const ALL = "*";
const BANDS: readonly ProgressBand[] = ["awaiting", "building", "complete"];

const CLIENTS_KEY = "sales:clients";
/** The tab a client opens in. Its breadcrumb leads back here. */
const CLIENTS_HOST: JobTabHost = { label: "All clients", href: hrefForKey(CLIENTS_KEY), icon: Users };

/**
 * All clients. View opens a client in this same tab (`&job=` in the URL), under a breadcrumb back to the
 * list, so the Sales Manager dashboard stays put. Only the query changes, so this stays mounted and the
 * list comes back on the page and filters you left it on. The browser's back button closes the client too.
 */
function TeamClients() {
  const router = useRouter();
  const openId = useSearchParams().get("job");
  const reduce = useReducedMotion();
  const list = useClientList();
  const openClient = (id: number) => router.push(hrefForKey(CLIENTS_KEY, { job: String(id) }));
  // Into a client rises from below; back to the list drops in from above.
  const dir = openId ? 1 : -1;

  return (
    <AnimatePresence mode="wait" initial={false} custom={dir}>
      <motion.div
        key={openId ? `job:${openId}` : "list"}
        custom={dir}
        variants={RISE_VARIANTS}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP }}
      >
        {openId ? (
          // The job page with its own sync engine and its live, read-only gating, as on Operations' route.
          <OperationsSyncProvider>
            <JobDetailScreen key={openId} id={openId} host={CLIENTS_HOST} />
          </OperationsSyncProvider>
        ) : (
          <ClientList list={list} onOpen={openClient} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** All clients' list state, held by TeamClients so it outlives a client being open. */
function useClientList() {
  const { jobs, live } = useJobs();
  const [rep, setRep] = React.useState(ALL);
  const [progress, setProgress] = React.useState(ALL);
  const [query, setQuery] = React.useState("");
  const paging = usePaging();

  // The sample reps lead the sample list; live reps go A to Z. Flattened, each rep's clients stay together.
  const groups = React.useMemo(() => groupByRep(jobs, live ? [] : REPS), [jobs, live]);
  const all = React.useMemo(() => groups.flatMap((g) => g.jobs), [groups]);
  const repOpt = rep === ALL ? null : rep;
  const bandOpt = progress === ALL ? null : (progress as ProgressBand);
  const rows = React.useMemo(
    () => filterClients(all, { rep: repOpt, progress: bandOpt, query }),
    [all, repOpt, bandOpt, query],
  );
  // Each filter counts inside the other: a rep's count is in the chosen band, a band's is the chosen rep's.
  // The select hides a falsy hint, so the list passes counts as text and a real 0 still shows.
  const repHints = React.useMemo(() => {
    const inBand = filterClients(all, { rep: null, progress: bandOpt, query: "" });
    const by = new Map<string, number>();
    for (const j of inBand) by.set(repOf(j), (by.get(repOf(j)) ?? 0) + 1);
    return { total: inBand.length, by };
  }, [all, bandOpt]);
  const bandHints = React.useMemo(() => {
    const ofRep = filterClients(all, { rep: repOpt, progress: null, query: "" });
    const by = new Map<ProgressBand, number>();
    for (const j of ofRep) {
      const band = buildProgress(j).band;
      by.set(band, (by.get(band) ?? 0) + 1);
    }
    return { total: ofRep.length, by };
  }, [all, repOpt]);

  return { groups, all, rows, rep, setRep, progress, setProgress, query, setQuery, paging, repHints, bandHints };
}

function ClientList({ list, onOpen }: { list: ReturnType<typeof useClientList>; onOpen: (id: number) => void }) {
  const { groups, all, rows, rep, setRep, progress, setProgress, query, setQuery, repHints, bandHints } = list;
  const { page, swap, goPage, resetPage } = list.paging;
  // With no database there is no note, so pass no actions: an empty slot still adds a row gap on a phone.
  const withNote = useLiveState().kind !== "off";
  const slice = paginate(rows, page, CLIENTS_PAGE_SIZE);
  const searching = query.trim().length > 0;
  const filtered = rep !== ALL || progress !== ALL;
  const clearFilters = () => {
    setRep(ALL);
    setProgress(ALL);
    resetPage();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="All clients"
        description="Every rep's clients in preconstruction and construction."
        actions={withNote ? <LiveNote /> : undefined}
      />
      {all.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Won deals become clients here once CRM Dash Sync creates the job."
          className="rounded-xl border border-dashed border-border"
        />
      ) : (
        <Reveal index={0}>
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex-col items-stretch gap-3 border-b border-hairline pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Clients</CardTitle>
                <Pill tone="neutral" className="px-2 py-0 font-mono tabular-nums">
                  <Ticker value={rows.length} /> {rows.length < all.length ? `of ${all.length}` : all.length === 1 ? "client" : "clients"}
                </Pill>
                {filtered ? (
                  <Button variant="link" size="xs" className="ml-auto text-xs" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                  value={query}
                  onChange={(v) => {
                    setQuery(v);
                    resetPage();
                  }}
                  count={searching ? rows.length : undefined}
                  placeholder="Search client, job no, builder…"
                  aria-label="Search all clients"
                  className="min-w-0 flex-1 sm:max-w-sm"
                />
                <SmoothSelect
                  value={rep}
                  onChange={(v) => {
                    setRep(v);
                    resetPage();
                  }}
                  ariaLabel="Filter by representative"
                  leading={<Users className="size-3.5" aria-hidden />}
                  align="end"
                  className="w-full sm:w-56"
                  options={[
                    { value: ALL, label: "All representatives", hint: String(repHints.total) },
                    ...groups.map((g) => ({ value: g.rep, label: g.rep, hint: String(repHints.by.get(g.rep) ?? 0) })),
                  ]}
                />
                <SmoothSelect
                  value={progress}
                  onChange={(v) => {
                    setProgress(v);
                    resetPage();
                  }}
                  ariaLabel="Filter by progress"
                  leading={<HardHat className="size-3.5" aria-hidden />}
                  align="end"
                  className="w-full sm:w-56"
                  options={[
                    { value: ALL, label: "All progress", hint: String(bandHints.total) },
                    ...BANDS.map((b) => ({ value: b, label: PROGRESS_LABEL[b], hint: String(bandHints.by.get(b) ?? 0) })),
                  ]}
                />
              </div>
            </CardHeader>
            <SwapPane swapKey={rows.length ? `${rep}:${progress}:${slice.page}` : "none"} swap={swap}>
              {rows.length ? (
                <ClientTable rows={slice.rows} onOpen={onOpen} />
              ) : searching ? (
                <NoMatches query={query.trim()} onClear={() => setQuery("")} />
              ) : (
                <EmptyState
                  icon={Users}
                  title="Nothing here"
                  description="No clients match these filters."
                  action={
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              )}
            </SwapPane>
            <PagerFooter slice={slice} noun="clients" onPage={goPage} />
          </Card>
        </Reveal>
      )}
    </div>
  );
}

/** A client's progress as the list draws it: the bar's fill and tone, and the words beside it. */
function progressView(j: Job) {
  const b = buildProgress(j);
  return {
    building: j.board === "construction",
    pct: b.total ? b.done / b.total : 0,
    tone: b.band === "complete" ? ("ok" as const) : ("tone" as const),
    label: b.band === "awaiting" ? PROGRESS_LABEL.awaiting : `${b.done} of ${b.total} milestones`,
  };
}

/** The rep a client is filed under, with their avatar; Unassigned has none. */
function RepName({ job }: { job: Job }) {
  const rep = repOf(job);
  if (rep === UNASSIGNED) return <span className="text-subtle-foreground italic">{UNASSIGNED}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={rep} size="xs" />
      <span className="truncate">{rep}</span>
    </span>
  );
}

function StagePill({ building }: { building: boolean }) {
  return building ? <Pill tone="tone">Under construction</Pill> : <Pill tone="neutral">Preconstruction</Pill>;
}

/** HRIS's View row action. It opens the client in All clients' own tab. */
function OpenJob({ job, onOpen }: { job: Job; onOpen: (id: number) => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={`View ${job.jobNo ? `job ${job.jobNo}` : "new job"} · ${job.client}`}
      onClick={() => onOpen(job.id)}
    >
      <Eye /> View
    </Button>
  );
}

/**
 * One page of All clients, a line each: a table from `md` up, a stacked list below it. A row is not a
 * link: View opens the job, so reading across a row never navigates by accident (as Operations' job
 * list). Rows cascade in as a page arrives; ones a search brings in or takes out fade and drift
 * while the rest close the gap.
 */
function ClientTable({ rows, onOpen }: { rows: Job[]; onOpen: (id: number) => void }) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const rowMotion = (i: number) => ({
    layout: "position" as const,
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, x: -14, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } },
    transition: {
      duration: reduce ? 0 : 0.18,
      ease: EASE_OUT,
      delay: cascading ? rowDelay(i, reduce, 0.03) : 0,
      layout: { duration: reduce ? 0 : 0.22, ease: EASE_SWAP, delay: 0 },
    },
  });
  const barDelay = (i: number) => (cascading ? Math.min(i * 0.05, 0.3) : 0);

  return (
    <>
      <div className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
              <TableHead className="pl-5">Client</TableHead>
              <TableHead>Job number</TableHead>
              <TableHead>Representative</TableHead>
              <TableHead>Builder</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="pr-5 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence initial={false}>
              {rows.map((j, i) => {
                const p = progressView(j);
                return (
                  <motion.tr
                    key={j.id}
                    {...rowMotion(i)}
                    className="border-b border-hairline transition-colors hover:bg-tone-soft/60 dark:hover:bg-tone-soft/40"
                  >
                    <TableCell className="py-3 pl-5 font-medium">{j.client}</TableCell>
                    <TableCell className="py-3 whitespace-nowrap">
                      <span className={j.jobNo ? "font-mono text-xs font-semibold" : "text-subtle-foreground italic"}>
                        {j.jobNo || "Awaiting"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-44 py-3">
                      <RepName job={j} />
                    </TableCell>
                    <TableCell className="py-3 whitespace-nowrap text-foreground/80">{j.builder}</TableCell>
                    <TableCell className="py-3">
                      <StagePill building={p.building} />
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="flex items-center gap-2.5">
                        <RateBar value={p.pct} tone={p.tone} delay={barDelay(i)} className="w-20 shrink-0" />
                        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{p.label}</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3 pr-5 text-right">
                      <OpenJob job={j} onOpen={onOpen} />
                    </TableCell>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      <ul className="md:hidden">
        <AnimatePresence initial={false}>
          {rows.map((j, i) => {
            const p = progressView(j);
            return (
              <motion.li key={j.id} {...rowMotion(i)} className="border-t border-hairline first:border-t-0">
                <div className="flex flex-col gap-1.5 px-4 py-3">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[13px] font-medium">{j.client}</span>
                    <span className={cn("shrink-0 text-xs", j.jobNo ? "font-mono font-semibold" : "text-subtle-foreground italic")}>
                      {j.jobNo || "Awaiting"}
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <RepName job={j} />
                    <span aria-hidden>·</span>
                    <span className="truncate">{j.builder}</span>
                  </span>
                  <span className="flex items-center gap-2.5">
                    <RateBar value={p.pct} tone={p.tone} delay={barDelay(i)} className="w-16 shrink-0" />
                    <span className="min-w-0 truncate text-xs text-muted-foreground tabular-nums">{p.label}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <StagePill building={p.building} />
                    <OpenJob job={j} onOpen={onOpen} />
                  </span>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </>
  );
}

function ClientGrid({ jobs, onOpen }: { jobs: Job[]; onOpen: (id: number) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((j, i) => {
        const { done: complete, total } = buildProgress(j);
        const building = j.board === "construction";
        const pct = building ? Math.round((complete / total) * 100) : 0;
        return (
          <Reveal as="li" key={j.id} index={i}>
            <button
              type="button"
              onClick={() => onOpen(j.id)}
              className="group flex h-full w-full flex-col rounded-xl border border-border bg-card px-4 py-3.5 text-left shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold">{j.client}</span>
                <span className={cn("shrink-0 text-xs text-muted-foreground", j.jobNo ? "font-mono tabular-nums" : "italic")}>
                  {j.jobNo || "Awaiting job no"}
                </span>
              </span>
              <span className="mt-0.5 mb-2.5 text-xs text-muted-foreground">
                {j.builder} · {building ? "Under construction" : "Preconstruction"}
              </span>
              <RateBar
                value={pct / 100}
                height="h-2"
                delay={Math.min(i * 0.05, 0.3)}
                label={building ? `${complete} of ${total} milestones` : "Awaiting site start"}
                className="mt-auto"
              />
              <span className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                {building ? `${complete} of ${total} milestones` : "Awaiting site start"}
              </span>
            </button>
          </Reveal>
        );
      })}
    </ul>
  );
}

function TodosCard() {
  const { todos, setTodos } = useSalesState();
  const done = todos.filter((t) => t.done).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>To-dos</CardTitle>
        <CardMeta>
          {done} of {todos.length} done
        </CardMeta>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {todos.map((t, i) => (
            <li key={t.t}>
              <button
                type="button"
                role="checkbox"
                aria-checked={t.done}
                onClick={() => setTodos((prev) => prev.map((x, xi) => (xi === i ? { ...x, done: !x.done } : x)))}
                className="group flex w-full items-center gap-2.5 rounded-md py-1.5 text-left focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
              >
                <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden>
                  <AnimatePresence initial={false} mode="popLayout">
                    {t.done ? (
                      <motion.span
                        key="done"
                        className="flex"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1, transition: { duration: 0.24, ease: EASE_OUT } }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      >
                        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="open"
                        className="flex"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: 0.18 } }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      >
                        <Circle className="size-3.5 text-subtle-foreground group-hover:text-tone-ink" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span
                  className={cn(
                    "text-[13px] transition-colors",
                    t.done ? "text-subtle-foreground line-through" : "text-foreground",
                  )}
                >
                  {t.t}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** The tasks a manager set this rep on Team. Read-only here: managers set and reassign them. */
function TasksCard({ rep }: { rep: string }) {
  const { tasks } = useSalesState();
  const reduce = useReducedMotion();
  const mine = tasks.filter((t) => t.rep === rep);
  const isOverdue = (due: string) => /overdue/i.test(due);
  const overdue = mine.filter((t) => isOverdue(t.due)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        <CardMeta>{mine.length ? (overdue ? `${overdue} overdue` : "none overdue") : "from your manager"}</CardMeta>
      </CardHeader>
      <CardContent>
        {mine.length === 0 ? (
          <p className="py-1.5 text-[13px] text-muted-foreground">No tasks from your manager.</p>
        ) : (
          <ul className="flex flex-col">
            {mine.map((t, i) => (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
                className="flex items-start gap-2.5 py-1.5"
              >
                <Flag
                  className={cn("mt-0.5 size-3.5 shrink-0", t.flag ? "text-rose-600 dark:text-rose-400" : "text-subtle-foreground")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-[13px]">{t.task}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    isOverdue(t.due) ? "font-medium text-rose-700 dark:text-rose-300" : "text-muted-foreground",
                  )}
                >
                  {t.due}
                </span>
              </motion.li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-subtle-foreground">
          Set by your manager on the Sales Manager dashboard&apos;s Team page.
        </p>
      </CardContent>
    </Card>
  );
}
