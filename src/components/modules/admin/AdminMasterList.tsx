"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import {
  AtSign,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  IdCard,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MonitorPlay,
  Phone,
  Radio,
  RotateCw,
  Send,
  Sheet,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { STAFF } from "@/components/shell/dashboards";
import { confirm } from "@/state/launchpad-store";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, SearchInput } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { NoMatches } from "@/components/ui/states";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { Ticker, useCascading } from "@/components/ui/list-motion";
import {
  ORG_DEPARTMENTS,
  formatIsoDate,
  masterList,
  orgDepartment,
  tenure,
  type OrgDepartmentId,
  type OrgPerson,
} from "@/components/modules/hr/data";
import { useOrg } from "@/components/modules/hr/org-store";
import { Detail, DetailGroup, EMAIL_LINK, Email, reportsTo } from "@/components/modules/hr/master-list/parts";
import {
  ROLE_BY_KEY,
  lastSeenText,
  offRosterKey,
  offRosterPrincipal,
  pageOf,
  rolePillTone,
  rosterPrincipal,
  type LiveState,
  type Principal,
  type RoleKey,
} from "./data";
import { liveOf, signOut, useAdmin, type Live } from "./admin-store";
import {
  LIVE_DOT,
  LIVE_LABEL,
  OffRosterTag,
  PaneHeading,
  Pager,
  PersonAvatar,
  StatChip,
  SwapPane,
  VIEW_SWAP,
  DetailSwap,
  useRevealOnPick,
  type Swap,
} from "./parts";

const PAGE_SIZE = 10;
/** How often relative times ("Last seen 2m ago") refresh, as HRIS's telemetry tick. Paused while the tab is hidden. */
const TICK_MS = 30_000;

type ViewFilter = "all" | "online";
type DeptFilter = "all" | OrgDepartmentId | "none";

const SELF = offRosterKey(STAFF.email);

let pickedMemory: string | null = null;

/** "Sales dashboard · Pipeline", or the last-seen line while offline. */
function statusLine(live: Live): string {
  if (live.at) {
    const { dashboard, section } = pageOf(live.at);
    return `${dashboard.title} · ${section}`;
  }
  return live.lastSeen == null ? "Hasn't signed in yet" : `Last seen ${lastSeenText(live.lastSeen)}`;
}

/**
 * Admin › Global Master List — HRIS's AdminGlobalMasterList. The roster from
 * HR's org chart, with who's online and which page they have open, and on the
 * right the selected person's record and the tools to reach them: ping, watch
 * their screen, sign them out. An account that's online but not on the master
 * list (the signed-in admin) shows at the top as off-roster, as in HRIS.
 *
 * Who's online is sample data: the Launchpad has no sessions yet.
 */
export function AdminMasterList() {
  const { people } = useOrg();
  const admin = useAdmin();
  const params = useSearchParams();
  const reduce = useReducedMotion();

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setNow(Date.now());
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const rows = React.useMemo(() => masterList(people), [people]);
  const seats = React.useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  // Off-roster accounts that are online: HRIS surfaces them, because "who's online" must include people the roster doesn't track.
  const all = React.useMemo(() => {
    const roster = rows.map(rosterPrincipal);
    const onRoster = new Set(roster.map((p) => p.email?.toLowerCase()).filter(Boolean));
    const extra = admin.offRoster
      .filter((e) => !onRoster.has(e))
      .map(offRosterPrincipal)
      .filter((p) => liveOf(p, admin, now).state !== "offline");
    return [...extra, ...roster];
  }, [rows, admin, now]);

  const live = React.useMemo(() => new Map(all.map((p) => [p.key, liveOf(p, admin, now)])), [all, admin, now]);

  const counts = React.useMemo(() => {
    const online = all.filter((p) => live.get(p.key)?.state !== "offline");
    const dept = Object.fromEntries(ORG_DEPARTMENTS.map((d) => [d.id, 0])) as Record<OrgDepartmentId, number>;
    for (const p of all) if (p.row) dept[p.row.department] += 1;
    return {
      online: online.length,
      inactive: online.filter((p) => live.get(p.key)?.state === "inactive").length,
      offRoster: all.filter((p) => !p.row).length,
      dept,
    };
  }, [all, live]);

  const [view, setView] = React.useState<ViewFilter>(() => (params.get("view") === "online" ? "online" : "all"));
  const [dept, setDept] = React.useState<DeptFilter>("all");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [swap, setSwap] = React.useState<Swap>(VIEW_SWAP);
  const [picked, setPicked] = React.useState<string | null>(() => params.get("person") ?? pickedMemory);
  const [refreshing, setRefreshing] = React.useState(false);
  const [detailRef, reveal] = useRevealOnPick();

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      all.filter((p) => {
        if (view === "online" && live.get(p.key)?.state === "offline") return false;
        if (dept === "none" ? p.row !== null : dept !== "all" && p.row?.department !== dept) return false;
        if (!q) return true;
        return [p.name, p.email, p.row?.record?.personalEmail, p.row?.record?.employeeId, p.row && orgDepartment(p.row.department).name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      }),
    [all, live, view, dept, q],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const selected = picked ? (all.find((p) => p.key === picked) ?? null) : null;

  // Open on someone, as HRIS does, so the record pane is never empty on arrival.
  React.useEffect(() => {
    if (!picked && filtered.length) setPicked(filtered[0].key);
  }, [picked, filtered]);

  const pick = (key: string) => {
    pickedMemory = key;
    setPicked(key);
    reveal();
  };
  const restart = () => {
    setSwap(VIEW_SWAP);
    setPage(0);
  };
  const goPage = (n: number) => {
    setSwap({ kind: "page", dir: n > current ? 1 : -1 });
    setPage(n);
  };

  // Re-reads who's online. Static: the sample doesn't move, but last-seen times catch up.
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const refresh = () => {
    setRefreshing(true);
    timer.current = setTimeout(() => {
      setNow(Date.now());
      setRefreshing(false);
      confirm("Live status updated", `${counts.online} online · ${counts.inactive} inactive`);
    }, reduce ? 0 : 700);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Global Master List"
        description="The roster from HR, with who's online, which page they have open, and the tools to reach them or sign them out."
        actions={
          <>
            <StatChip icon={Users} label="Roster" value={rows.length} />
            <StatChip icon={Radio} label="Online now" value={counts.online} live />
            <StatChip icon={Building2} label="Departments" value={ORG_DEPARTMENTS.length} />
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* LEFT — the roster */}
        <Reveal index={0} className="min-w-0 lg:sticky lg:top-6">
          <Card className="flex min-w-0 flex-col lg:max-h-[calc(100dvh-3rem)]">
            <CardHeader className="shrink-0 flex-col items-stretch gap-3 border-b border-hairline pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Roster</CardTitle>
                <Pill tone="neutral" className="px-2 py-0 font-mono tabular-nums">
                  <Ticker value={filtered.length} /> shown
                </Pill>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  disabled={refreshing}
                  onClick={refresh}
                  title="Refresh live status: who's online and where they are right now"
                >
                  <RotateCw className={cn(refreshing && "animate-spin")} />
                  Refresh
                </Button>
              </div>
              <SlidingTabs
                value={view}
                onChange={(v) => {
                  setView(v);
                  restart();
                }}
                ariaLabel="Roster view"
                className="self-start"
                items={[
                  { value: "all" as ViewFilter, label: "All", count: all.length },
                  { value: "online" as ViewFilter, label: "Online", count: counts.online },
                ]}
              />
              <SearchInput
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(0);
                }}
                count={q ? filtered.length : undefined}
                placeholder="Search name, email, ID…"
                aria-label="Search the roster"
                className="max-w-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                <SmoothSelect
                  value={dept}
                  onChange={(v) => {
                    setDept(v);
                    restart();
                  }}
                  ariaLabel="Filter by department"
                  leading={<Building2 className="size-3.5" aria-hidden />}
                  className="min-w-0 flex-1 sm:w-48 sm:flex-none"
                  options={[
                    { value: "all" as DeptFilter, label: "All departments", hint: all.length },
                    ...ORG_DEPARTMENTS.map((d) => ({ value: d.id as DeptFilter, label: d.name, hint: counts.dept[d.id] })),
                    ...(counts.offRoster ? [{ value: "none" as DeptFilter, label: "Off-roster", hint: counts.offRoster }] : []),
                  ]}
                />
                <div className="ml-auto">
                  <Pager current={current} pages={pages} onPage={goPage} />
                </div>
              </div>
            </CardHeader>

            <div className="min-h-0 overflow-y-auto">
              <SwapPane swapKey={filtered.length ? `${view}:${dept}:${current}` : "none"} swap={swap}>
                {!filtered.length ? (
                  q ? (
                    <NoMatches query={query.trim()} onClear={() => setQuery("")} />
                  ) : (
                    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                      {view === "online" ? "Nobody in this department is online right now." : "Nobody in this department yet."}
                    </p>
                  )
                ) : (
                  <RosterList rows={shown} live={live} selected={picked} onPick={pick} />
                )}
              </SwapPane>
            </div>
          </Card>
        </Reveal>

        {/* RIGHT — the selected person's record and the admin functions */}
        <Reveal index={1} className="min-w-0">
          <div ref={detailRef} className="scroll-mt-6">
            <RecordPane
              person={selected}
              live={selected ? (live.get(selected.key) ?? null) : null}
              roles={selected ? (admin.grants[selected.key] ?? []) : []}
              signingOut={selected ? Boolean(admin.signingOut[selected.key]) : false}
              seats={seats}
              now={now}
            />
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function RosterList({
  rows,
  live,
  selected,
  onPick,
}: {
  rows: Principal[];
  live: Map<string, Live>;
  selected: string | null;
  onPick: (key: string) => void;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  return (
    <ul className="flex flex-col gap-1.5 p-3" role="list">
      <AnimatePresence initial={false}>
        {rows.map((p, i) => {
          const isSel = p.key === selected;
          const l = live.get(p.key) ?? { state: "offline" as const, at: null, lastSeen: null };
          return (
            <motion.li
              key={p.key}
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
            >
              <button
                type="button"
                onClick={() => onPick(p.key)}
                aria-pressed={isSel}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left outline-none transition-[background-color,border-color,box-shadow] duration-150 focus-visible:ring-3 focus-visible:ring-ring/45",
                  isSel
                    ? "border-tone-line bg-tone-soft shadow-sm ring-1 ring-tone-line/60"
                    : "border-border bg-card hover:border-tone-line/70 hover:bg-tone-soft/50",
                )}
              >
                <PersonAvatar person={p} live={l.state} selected={isSel} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold">{p.name}</span>
                    {!p.row ? <OffRosterTag /> : null}
                    {p.key === SELF ? (
                      <Pill tone="neutral" className="px-2 py-0">
                        You
                      </Pill>
                    ) : null}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{p.email ?? "No email yet"}</span>
                  {l.state !== "offline" ? (
                    <span
                      className={cn(
                        "mt-0.5 flex items-center gap-1.5 truncate text-xs font-medium",
                        l.state === "inactive" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300",
                      )}
                    >
                      <span className={cn("size-1.5 shrink-0 rounded-full", LIVE_DOT[l.state])} aria-hidden />
                      <span className="truncate">
                        {l.state === "inactive" ? "Inactive · " : ""}
                        {statusLine(l)}
                      </span>
                    </span>
                  ) : p.row ? (
                    <span className="block truncate text-xs text-subtle-foreground">{orgDepartment(p.row.department).name}</span>
                  ) : null}
                </span>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

const STATUS_BOX: Record<LiveState, string> = {
  online: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-500/10",
  inactive: "border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10",
  offline: "border-border bg-canvas/70",
};
const STATUS_PILL: Record<LiveState, "ok" | "pending" | "neutral"> = { online: "ok", inactive: "pending", offline: "neutral" };

function RecordPane({
  person,
  live,
  roles,
  signingOut,
  seats,
  now,
}: {
  person: Principal | null;
  live: Live | null;
  roles: RoleKey[];
  signingOut: boolean;
  seats: Map<string, OrgPerson>;
  now: number;
}) {
  const isSelf = person?.key === SELF;
  const state = live?.state ?? "offline";
  const today = React.useMemo(() => new Date(now), [now]);

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-col items-stretch gap-3 border-b border-hairline pb-4">
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <IdCard className="size-4 text-tone-ink" aria-hidden />
          </span>
          {person ? "Master list record" : "Choose someone"}
        </CardTitle>
        {person ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-canvas/70 px-3 py-2">
              <PersonAvatar person={person} live={state} size="sm" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold">{person.name}</span>
                  {!person.row ? <OffRosterTag /> : null}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">{person.email ?? "No email on file"}</p>
              </div>
            </div>
            {isSelf ? (
              <Pill tone="neutral" className="shrink-0">
                You
              </Pill>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="pt-4">
        <DetailSwap id={person?.key ?? "none"}>
          {!person || !live ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-canvas/50 px-6 py-10 text-center">
              <Sheet className="size-10 text-subtle-foreground/60" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium">Select a person</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Pick someone from the roster to see their record, whether they&apos;re online and which page they have
                  open, and to ping them or sign them out.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <LiveStatus live={live} />
              <AdminFunctions person={person} online={live.state !== "offline"} isSelf={isSelf} signingOut={signingOut} />

              <section className="flex flex-col gap-2">
                <PaneHeading
                  title="Dashboard access"
                  icon={ShieldCheck}
                  right={
                    person.email ? (
                      <Link
                        href={`/admin?tab=roles&person=${encodeURIComponent(person.key)}`}
                        className={buttonVariants({ variant: "link", size: "xs" })}
                      >
                        Manage access
                      </Link>
                    ) : null
                  }
                />
                {roles.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {roles.map((r) => (
                      <Pill key={r} tone={rolePillTone(r)}>
                        {ROLE_BY_KEY[r].label}
                      </Pill>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No dashboards yet. Home is the only one they can open.</p>
                )}
              </section>

              {person.row ? (
                <DetailGroup title="Master list information">
                  <Detail index={0} icon={IdCard} label="Employee ID" mono>
                    {person.row.record?.employeeId}
                  </Detail>
                  <Detail index={1} icon={Building2} label="Department">
                    {orgDepartment(person.row.department).name}
                  </Detail>
                  <Detail index={2} icon={Briefcase} label="Position">
                    {person.row.role}
                  </Detail>
                  <Detail index={3} icon={UserRound} label="Reports to">
                    {reportsTo(person.row, seats)}
                  </Detail>
                  <Detail index={4} icon={Mail} label="Work email" mono>
                    {person.row.record ? (
                      <a href={`mailto:${person.row.record.workEmail}`} className={EMAIL_LINK}>
                        <Email value={person.row.record.workEmail} />
                      </a>
                    ) : null}
                  </Detail>
                  <Detail index={5} icon={Mail} label="Personal email" mono>
                    {person.row.record?.personalEmail ? <Email value={person.row.record.personalEmail} /> : null}
                  </Detail>
                  <Detail index={6} icon={Calendar} label="Start date">
                    {person.row.record ? formatIsoDate(person.row.record.commenced) : null}
                  </Detail>
                  <Detail index={7} icon={Clock} label="Tenure">
                    {/* Counted on the viewer's clock, which can be a day off the server's. */}
                    <span suppressHydrationWarning>{person.row.record ? tenure(person.row.record.commenced, today) : null}</span>
                  </Detail>
                  {person.row.record?.location ? (
                    <Detail index={8} icon={MapPin} label="Location">
                      {person.row.record.location}
                    </Detail>
                  ) : null}
                  {person.row.record?.mobile ? (
                    <Detail index={9} icon={Phone} label="Mobile" mono>
                      {person.row.record.mobile}
                    </Detail>
                  ) : null}
                </DetailGroup>
              ) : (
                <DetailGroup title="Account">
                  <Detail index={0} icon={AtSign} label="Address" mono wide>
                    {person.email}
                  </Detail>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Not on the master list: an admin or service account, or someone outside Locale given a portal. It has no
                    employee record, so there&apos;s nothing else to show.
                  </p>
                </DetailGroup>
              )}
            </div>
          )}
        </DetailSwap>
      </CardContent>
    </Card>
  );
}

function LiveStatus({ live }: { live: Live }) {
  const page = live.at ? pageOf(live.at) : null;
  return (
    <section className={cn("rounded-xl border px-3.5 py-3 transition-colors duration-200", STATUS_BOX[live.state])}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          <Radio className="size-3" aria-hidden />
          Live status
        </p>
        <Pill variant="caps" tone={STATUS_PILL[live.state]}>
          <span className={cn("size-1.5 rounded-full", LIVE_DOT[live.state])} aria-hidden />
          {LIVE_LABEL[live.state]}
        </Pill>
      </div>
      {page ? (
        <>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
            <p className="min-w-0 truncate text-[15px] font-semibold">{page.dashboard.title}</p>
            <span className="rounded-md bg-card px-1.5 py-0.5 font-mono text-xs font-medium ring-1 ring-border">{page.section}</span>
          </div>
          {live.state === "inactive" ? (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">Switched away: the Launchpad tab isn&apos;t focused right now.</p>
          ) : null}
        </>
      ) : (
        <p className="mt-1.5 text-[13px] text-muted-foreground">{statusLine(live)}</p>
      )}
    </section>
  );
}

function AdminFunctions({
  person,
  online,
  isSelf,
  signingOut,
}: {
  person: Principal;
  online: boolean;
  isSelf: boolean;
  signingOut: boolean;
}) {
  const [text, setText] = React.useState("");

  const ping = () => {
    const message = text.trim() || "👋 Hi";
    setText("");
    toast.success(online ? "Pinged. It just landed on their screen." : "Pinged, but they're offline, so it may not reach them.", {
      description: `“${message}” · ${person.name}`,
    });
  };

  return (
    <section className="flex flex-col gap-2">
      <PaneHeading title="Admin functions" />
      {isSelf ? (
        <p className="rounded-lg border border-border bg-canvas/70 px-3 py-2.5 text-xs text-muted-foreground">
          This is your own account, so ping and sign-out are off for it.
        </p>
      ) : !person.email ? (
        <p className="rounded-lg border border-border bg-canvas/70 px-3 py-2.5 text-xs text-muted-foreground">
          No email on file yet, so there&apos;s no account to reach.
        </p>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ping();
            }}
            className="flex items-center gap-2 rounded-xl border border-tone-line bg-tone-soft/60 p-2"
          >
            <MessageCircle className="ml-1 size-4 shrink-0 text-tone-ink" aria-hidden />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Message ${person.name.split(" ")[0]}…`}
              aria-label={`Message to ${person.name}`}
              className="flex-1"
            />
            <Button type="submit" size="sm">
              <Send /> Ping
            </Button>
          </form>
          <p className="px-1 text-xs text-subtle-foreground">
            A ping pops up on their screen wherever they are, but only while they&apos;re online. Nothing is saved.
          </p>

          <Button
            variant="outline"
            disabled
            className="w-full"
            title="Screen mirroring needs a live session, and the static Launchpad has none yet"
          >
            <MonitorPlay /> {online ? "Watch screen" : "Watch screen (offline)"}
          </Button>
          <p className="px-1 text-xs text-subtle-foreground">
            A live, view-only mirror of their screen with a chat to talk them through it. It arrives with sign-in.
          </p>

          <Button
            variant="outline"
            className="w-full hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
            disabled={signingOut}
            onClick={() => signOut(person)}
            title="End their session: they're signed out and sign in again with their current access"
          >
            {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
            Force logout / reset session
          </Button>
        </>
      )}
    </section>
  );
}
