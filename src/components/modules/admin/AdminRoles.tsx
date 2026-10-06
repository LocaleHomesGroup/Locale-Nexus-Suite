"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import {
  AtSign,
  Briefcase,
  Building2,
  Check,
  Crown,
  Eye,
  Loader2,
  LogOut,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { confirm } from "@/state/launchpad-store";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, SearchInput } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { NoMatches } from "@/components/ui/states";
import { Pill } from "@/components/ui/pill";
import { Dialog } from "@/components/ui/dialog";
import { Reveal } from "@/components/ui/reveal";
import { Ticker, useCascading } from "@/components/ui/list-motion";
import { ORG_DEPARTMENTS, masterList, orgDepartment, type OrgDepartmentId } from "@/components/modules/hr/data";
import { useOrg } from "@/components/modules/hr/org-store";
import {
  ACCESS_LABEL,
  ACCESS_LEVELS,
  ROLES,
  ROLE_BY_KEY,
  ROLE_GROUPS,
  directory,
  offRosterKey,
  plural,
  roleAccent,
  type Access,
  type Principal,
  type RoleKey,
} from "./data";
import {
  addOffRoster,
  changeKey,
  grantRole,
  revokeRole,
  setAllSectionAccess,
  setSectionAccess,
  signOut,
  useAdmin,
  type AdminState,
} from "./admin-store";
import {
  OffRosterTag,
  PaneHeading,
  Pager,
  PersonAvatar,
  RolePills,
  StatChip,
  SwapPane,
  VIEW_SWAP,
  DetailSwap,
  useRevealOnPick,
  type Swap,
} from "./parts";

const PAGE_SIZE = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ViewFilter = "all" | "with";
type RoleFilter = "all" | RoleKey;
type DeptFilter = "all" | OrgDepartmentId | "none";

// The person picked survives a section switch (this screen unmounts), as in HRIS.
let pickedMemory: string | null = null;

/**
 * Admin › Roles & permissions — HRIS's AdminRoles. The People directory on the
 * left (the master list plus off-roster accounts), and on the right the
 * selected person's roles: one per dashboard, grouped as Switch view groups
 * them. A granted role opens its section grid, where each section is Hidden,
 * View or Edit.
 *
 * Motion: a new filter or page swaps the list and replays its cascade; typing
 * a search lets rows drift out instead. Picking someone rises their roles in,
 * and a granted role's grid unfolds beneath it.
 */
export function AdminRoles() {
  const { people } = useOrg();
  const admin = useAdmin();
  const params = useSearchParams();

  const rows = React.useMemo(() => masterList(people), [people]);
  const dir = React.useMemo(
    () => directory(rows, admin.offRoster).sort((a, b) => a.name.localeCompare(b.name)),
    [rows, admin.offRoster],
  );
  const rolesOf = React.useCallback((p: Principal) => admin.grants[p.key] ?? [], [admin.grants]);

  const [view, setView] = React.useState<ViewFilter>("all");
  const [role, setRole] = React.useState<RoleFilter>(() => {
    const r = params.get("role");
    return r && r in ROLE_BY_KEY ? (r as RoleKey) : "all";
  });
  const [dept, setDept] = React.useState<DeptFilter>("all");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [swap, setSwap] = React.useState<Swap>(VIEW_SWAP);
  const [picked, setPicked] = React.useState<string | null>(() => params.get("person") ?? pickedMemory);
  const [adding, setAdding] = React.useState(false);
  const [address, setAddress] = React.useState("");
  const [guard, setGuard] = React.useState<Principal | null>(null);
  const [detailRef, reveal] = useRevealOnPick();

  const pick = (key: string, scroll = true) => {
    pickedMemory = key;
    setPicked(key);
    if (scroll) reveal();
  };

  const stats = React.useMemo(() => {
    const holding = dir.filter((p) => rolesOf(p).length > 0);
    return {
      people: dir.length,
      withRoles: holding.length,
      grants: holding.reduce((n, p) => n + rolesOf(p).length, 0),
      offRoster: dir.filter((p) => !p.row).length,
    };
  }, [dir, rolesOf]);

  const holders = React.useMemo(() => {
    const c = Object.fromEntries(ROLES.map((r) => [r.key, 0])) as Record<RoleKey, number>;
    for (const p of dir) for (const r of rolesOf(p)) c[r] += 1;
    return c;
  }, [dir, rolesOf]);

  const deptCounts = React.useMemo(() => {
    const c = Object.fromEntries(ORG_DEPARTMENTS.map((d) => [d.id, 0])) as Record<OrgDepartmentId, number>;
    for (const p of dir) if (p.row) c[p.row.department] += 1;
    return c;
  }, [dir]);

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      dir.filter((p) => {
        const held = rolesOf(p);
        if (view === "with" && held.length === 0) return false;
        if (role !== "all" && !held.includes(role)) return false;
        if (dept === "none" ? p.row !== null : dept !== "all" && p.row?.department !== dept) return false;
        if (!q) return true;
        return [p.name, p.email, p.row?.record?.personalEmail, p.row?.record?.employeeId, p.row?.role, p.row && orgDepartment(p.row.department).name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      }),
    [dir, rolesOf, view, role, dept, q],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const selected = picked ? (dir.find((p) => p.key === picked) ?? null) : null;
  const narrowed = Boolean(q) || view !== "all" || role !== "all" || dept !== "all";

  const restart = () => {
    setSwap(VIEW_SWAP);
    setPage(0);
  };
  const goPage = (n: number) => {
    setSwap({ kind: "page", dir: n > current ? 1 : -1 });
    setPage(n);
  };
  const clearFilters = () => {
    setQuery("");
    setView("all");
    setRole("all");
    setDept("all");
    restart();
  };

  /** HRIS's "Add by email": select them if we know the address, otherwise add them as an off-roster account. */
  const addByEmail = () => {
    const raw = address.trim().toLowerCase();
    if (!EMAIL_RE.test(raw)) {
      toast.error("Enter a valid email address.");
      return;
    }
    const known = dir.find(
      (p) => p.email === raw || p.row?.record?.workEmail.toLowerCase() === raw || p.row?.record?.personalEmail.toLowerCase() === raw,
    );
    setAddress("");
    setAdding(false);
    clearFilters();
    if (known) {
      pick(known.key);
      toast.info(`${raw} is already in the directory`, { description: `Selected ${known.name}.` });
      return;
    }
    addOffRoster(raw);
    pick(offRosterKey(raw));
    confirm(`Added ${raw}`, "Off-roster · grant their roles on the right");
  };

  const assign = (p: Principal, r: RoleKey) => (r === "admin" ? setGuard(p) : grantRole(p, r));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roles & permissions"
        description="Grant access by role. Each role unlocks one dashboard in Switch view, and its section grid sets what they can do there. Home is everyone's."
        actions={
          <>
            <StatChip icon={Users} label="Directory" value={stats.people} />
            <StatChip icon={Eye} label="With roles" value={stats.withRoles} />
            <StatChip icon={Briefcase} label="Active grants" value={stats.grants} />
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* LEFT — the directory */}
        <Reveal index={0} className="min-w-0 lg:sticky lg:top-6">
          <Card className="flex min-w-0 flex-col lg:max-h-[calc(100dvh-3rem)]">
            <CardHeader className="shrink-0 flex-col items-stretch gap-3 border-b border-hairline pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>People</CardTitle>
                <Pill tone="neutral" className="px-2 py-0 font-mono tabular-nums">
                  <Ticker value={filtered.length} /> shown
                </Pill>
                {stats.offRoster > 0 ? (
                  <Pill tone="neutral" icon={AtSign} className="px-2 py-0 font-mono tabular-nums">
                    {stats.offRoster} off-roster
                  </Pill>
                ) : null}
                <Button
                  variant={adding ? "secondary" : "outline"}
                  size="sm"
                  className="ml-auto"
                  aria-expanded={adding}
                  onClick={() => {
                    setAdding((v) => !v);
                    setAddress("");
                  }}
                  title="Grant roles to an address that isn't on the master list: a client, a developer contact, a service account"
                >
                  {adding ? <X /> : <AtSign />}
                  {adding ? "Cancel" : "Add by email"}
                </Button>
              </div>

              <AddByEmail open={adding} value={address} onChange={setAddress} onSubmit={addByEmail} />

              <SlidingTabs
                value={view}
                onChange={(v) => {
                  setView(v);
                  restart();
                }}
                ariaLabel="People view"
                className="self-start"
                items={[
                  { value: "all" as ViewFilter, label: "All", count: stats.people },
                  { value: "with" as ViewFilter, label: "With roles", count: stats.withRoles },
                ]}
              />
              <SearchInput
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(0);
                }}
                count={q ? filtered.length : undefined}
                placeholder="Search name, email, department…"
                aria-label="Search people"
                className="max-w-none"
              />
              <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
                <SmoothSelect
                  value={role}
                  onChange={(v) => {
                    setRole(v);
                    restart();
                  }}
                  ariaLabel="Filter by role"
                  leading={<ShieldCheck className="size-3.5" aria-hidden />}
                  className="min-w-0 sm:w-40"
                  options={[
                    { value: "all" as RoleFilter, label: "All roles" },
                    ...ROLES.map((r) => ({ value: r.key as RoleFilter, label: r.label, hint: holders[r.key] })),
                  ]}
                />
                <SmoothSelect
                  value={dept}
                  onChange={(v) => {
                    setDept(v);
                    restart();
                  }}
                  ariaLabel="Filter by department"
                  leading={<Building2 className="size-3.5" aria-hidden />}
                  className="min-w-0 sm:w-44"
                  options={[
                    { value: "all" as DeptFilter, label: "All departments" },
                    ...ORG_DEPARTMENTS.map((d) => ({ value: d.id as DeptFilter, label: d.name, hint: deptCounts[d.id] })),
                    { value: "none" as DeptFilter, label: "Off-roster", hint: stats.offRoster },
                  ]}
                />
                <div className="col-span-2 justify-self-end sm:ml-auto">
                  <Pager current={current} pages={pages} onPage={goPage} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                Showing{" "}
                <span className="font-mono font-medium text-foreground">
                  {filtered.length ? current * PAGE_SIZE + 1 : 0}–{Math.min((current + 1) * PAGE_SIZE, filtered.length)}
                </span>{" "}
                of <span className="font-mono font-medium text-foreground">{filtered.length}</span>
                {narrowed && filtered.length !== dir.length ? (
                  <span className="text-subtle-foreground"> · filtered from {dir.length}</span>
                ) : null}
              </p>
            </CardHeader>

            <div className="min-h-0 overflow-y-auto">
              <SwapPane swapKey={filtered.length ? `${view}:${role}:${dept}:${current}` : "none"} swap={swap}>
                {!filtered.length ? (
                  q ? (
                    <NoMatches query={query.trim()} onClear={() => setQuery("")} />
                  ) : (
                    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                      <p className="text-sm text-muted-foreground">Nobody matches these filters.</p>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    </div>
                  )
                ) : (
                  <PeopleList rows={shown} selected={picked} rolesOf={rolesOf} onPick={pick} />
                )}
              </SwapPane>
            </div>
          </Card>
        </Reveal>

        {/* RIGHT — the selected person's roles */}
        <Reveal index={1} className="min-w-0 scroll-mt-6">
          <div ref={detailRef} className="scroll-mt-6">
            <RoleAssignments
              person={selected}
              admin={admin}
              onAssign={assign}
              onRevoke={revokeRole}
              onAddByEmail={() => setAdding(true)}
            />
          </div>
        </Reveal>
      </div>

      <Dialog
        open={guard !== null}
        onClose={() => setGuard(null)}
        title={`Make ${guard?.name ?? "them"} an admin?`}
        icon={ShieldAlert}
        iconTone="pending"
        description="Admin unlocks every dashboard, this one included, and every section in each. They'll be able to grant and revoke roles for anyone."
        footer={
          <>
            <Button variant="outline" onClick={() => setGuard(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (guard) grantRole(guard, "admin");
                setGuard(null);
              }}
            >
              <Crown /> Grant Admin
            </Button>
          </>
        }
      >
        {guard ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {rolesOf(guard).length
              ? `${guard.name.split(" ")[0]} already holds ${plural(rolesOf(guard).length, "role")}. Admin covers all of them, so their section limits stop applying.`
              : `${guard.name.split(" ")[0]} holds no roles yet. Most people need one or two dashboards, not all of them.`}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}

/** The inline "Add by email" row, unfolding under the People header. */
function AddByEmail({
  open,
  value,
  onChange,
  onSubmit,
}: {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP }}
          className="overflow-hidden"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="flex flex-col gap-2 rounded-xl border border-tone-line bg-tone-soft/60 p-2.5 sm:flex-row sm:items-center"
          >
            <Input
              autoFocus
              type="email"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="buyer@example.com, contact@builder.com.au"
              aria-label="Email address to add"
              className="flex-1"
            />
            <Button type="submit" disabled={!value.trim()}>
              <Plus /> Add to list
            </Button>
          </form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PeopleList({
  rows,
  selected,
  rolesOf,
  onPick,
}: {
  rows: Principal[];
  selected: string | null;
  rolesOf: (p: Principal) => RoleKey[];
  onPick: (key: string) => void;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  return (
    <ul className="flex flex-col gap-1.5 p-3" role="list">
      <AnimatePresence initial={false}>
        {rows.map((p, i) => {
          const isSel = p.key === selected;
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
                <PersonAvatar person={p} selected={isSel} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold">{p.name}</span>
                    {!p.row ? <OffRosterTag /> : null}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{p.email ?? "No email yet"}</span>
                  {p.row ? (
                    <span className="block truncate text-xs text-subtle-foreground">{orgDepartment(p.row.department).name}</span>
                  ) : null}
                </span>
                <RolePills roles={rolesOf(p)} className="max-w-[42%] shrink-0" />
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

/** The right pane: who's selected, then every role grouped as Switch view groups dashboards. */
function RoleAssignments({
  person,
  admin,
  onAssign,
  onRevoke,
  onAddByEmail,
}: {
  person: Principal | null;
  admin: AdminState;
  onAssign: (p: Principal, r: RoleKey) => void;
  onRevoke: (p: Principal, r: RoleKey) => void;
  onAddByEmail: () => void;
}) {
  const held = person ? (admin.grants[person.key] ?? []) : [];
  const isAdmin = held.includes("admin");
  const signingOut = person ? Boolean(admin.signingOut[person.key]) : false;

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-col items-stretch gap-3 border-b border-hairline pb-4">
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <ShieldCheck className="size-4 text-tone-ink" aria-hidden />
          </span>
          {person ? "Role assignments" : "Choose someone"}
        </CardTitle>
        {person ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-canvas/70 px-3 py-2">
              <PersonAvatar person={person} size="sm" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold">{person.name}</span>
                  {!person.row ? <OffRosterTag /> : null}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">{person.email ?? "No email on file"}</p>
              </div>
            </div>
            {isAdmin ? (
              <Pill variant="caps" tone="charcoal" icon={Crown}>
                Admin
              </Pill>
            ) : null}
            {person.email ? (
              <Button
                variant="outline"
                size="sm"
                disabled={signingOut}
                onClick={() => signOut(person)}
                title="End their session, so their next sign-in picks up the roles you just changed"
              >
                {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                Reset session
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="pt-4">
        <DetailSwap id={person?.key ?? "none"}>
          {!person ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-canvas/50 px-6 py-10 text-center">
              <UserCog className="size-10 text-subtle-foreground/60" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium">Select a person</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Pick someone from the list to grant or revoke their dashboards, or{" "}
                  <button type="button" onClick={onAddByEmail} className="font-semibold text-tone-ink underline-offset-2 hover:underline">
                    add an address by email
                  </button>{" "}
                  for a client, a developer contact or a service account.
                </p>
              </div>
            </div>
          ) : !person.email ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {person.name} has no work or personal email yet, so no role can be granted. Horilla issues one with their
              record; add it in HR › Global Master List.
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {ROLE_GROUPS.map((group) => (
                <section key={group.title} className="flex flex-col gap-2">
                  <PaneHeading title={group.title} caption={group.caption} />
                  <ul className="flex flex-col gap-2" role="list">
                    {group.keys.map((key) => (
                      <RoleRow
                        key={key}
                        role={key}
                        person={person}
                        active={held.includes(key)}
                        change={admin.changing[changeKey(person.key, key)]}
                        sections={admin.access[person.key]?.[key]}
                        onAssign={() => onAssign(person, key)}
                        onRevoke={() => onRevoke(person, key)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </DetailSwap>
      </CardContent>
    </Card>
  );
}

function RoleRow({
  role,
  person,
  active,
  change,
  sections,
  onAssign,
  onRevoke,
}: {
  role: RoleKey;
  person: Principal;
  active: boolean;
  change?: "assigning" | "revoking";
  sections?: Record<string, Access>;
  onAssign: () => void;
  onRevoke: () => void;
}) {
  const reduce = useReducedMotion();
  const r = ROLE_BY_KEY[role];
  const Icon = r.dashboard.icon;
  const showGrid = active && r.sections.length > 0 && sections;

  return (
    <li className={cn("rounded-xl border border-l-4 border-border bg-card p-3 shadow-xs", roleAccent(role))}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
              active
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-subtle-foreground",
            )}
          >
            {active ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold">{r.label}</span>
              {change ? (
                <Pill variant="caps" tone="pending">
                  {change === "assigning" ? "Assigning…" : "Revoking…"}
                </Pill>
              ) : active ? (
                <Pill variant="caps" tone="ok">
                  Active
                </Pill>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{r.blurb}</p>
            <p className="mt-1 font-mono text-[10px] text-subtle-foreground">{r.dashboard.href}</p>
          </div>
        </div>
        {active ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={Boolean(change)}
            onClick={onRevoke}
            aria-label={`Revoke ${r.label} from ${person.name}`}
            className="self-start sm:self-auto"
          >
            {change === "revoking" ? <Loader2 className="animate-spin" /> : <X />}
            {change === "revoking" ? "Revoking…" : "Revoke"}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={Boolean(change)}
            onClick={onAssign}
            aria-label={`Assign ${r.label} to ${person.name}`}
            className="self-start sm:self-auto"
          >
            <Plus /> Assign
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {showGrid ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP }}
            className="overflow-hidden"
          >
            <SectionGrid role={role} person={person} sections={sections!} locked={change === "revoking"} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

const BULK: { level: Access; label: string }[] = [
  { level: "edit", label: "All: Edit" },
  { level: "view", label: "All: View" },
  { level: "hidden", label: "Hide all" },
];

/**
 * HRIS's per-tab access grid: one row per section of the role's dashboard,
 * each Hidden, View or Edit, with bulk actions above. A grant starts every
 * section on Edit.
 */
function SectionGrid({
  role,
  person,
  sections,
  locked,
}: {
  role: RoleKey;
  person: Principal;
  sections: Record<string, Access>;
  locked: boolean;
}) {
  const r = ROLE_BY_KEY[role];
  const levels = r.sections.map((s) => sections[s.key] ?? "hidden");
  const count = (a: Access) => levels.filter((l) => l === a).length;

  return (
    <div className="mt-3 rounded-lg border border-hairline bg-canvas/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Section access</p>
        <div className="flex items-center gap-1">
          {BULK.map((b) => (
            <Button
              key={b.level}
              variant="outline"
              size="xs"
              disabled={locked || count(b.level) === levels.length}
              onClick={() => setAllSectionAccess(person, role, b.level)}
              title={b.level === "hidden" ? `Hide every ${r.label} section` : `Set every ${r.label} section to ${ACCESS_LABEL[b.level]}`}
            >
              {b.label}
            </Button>
          ))}
        </div>
      </div>
      <p className="mt-1 mb-2 text-xs text-subtle-foreground tabular-nums">
        {count("edit")} Edit · {count("view")} View · {count("hidden")} Hidden. A grant starts every section on Edit.
      </p>
      <ul className="flex flex-col gap-0.5">
        {r.sections.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 transition-colors hover:bg-muted/60">
            <span className="min-w-0 flex-1 truncate text-[13px]">{s.label}</span>
            <AccessSwitch
              label={`${s.label} access`}
              value={sections[s.key] ?? "hidden"}
              disabled={locked}
              onChange={(a) => setSectionAccess(person, role, s.key, a)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

const LEVEL_ACTIVE: Record<Access, string> = {
  hidden: "bg-zinc-200 dark:bg-zinc-700",
  view: "bg-amber-100 dark:bg-amber-500/25",
  edit: "bg-emerald-100 dark:bg-emerald-500/25",
};
const LEVEL_INK: Record<Access, string> = {
  hidden: "text-zinc-900 dark:text-zinc-100",
  view: "text-amber-800 dark:text-amber-200",
  edit: "text-emerald-800 dark:text-emerald-200",
};

/** Hidden · View · Edit, one indicator gliding between them (the SlidingTabs mechanism). Arrow keys move it. */
function AccessSwitch({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: Access;
  disabled?: boolean;
  onChange: (a: Access) => void;
}) {
  const reduce = useReducedMotion();
  const id = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = ACCESS_LEVELS[(ACCESS_LEVELS.indexOf(value) + step + ACCESS_LEVELS.length) % ACCESS_LEVELS.length];
    onChange(next);
    refs.current[ACCESS_LEVELS.indexOf(next)]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("inline-flex shrink-0 items-center rounded-md border border-border bg-card p-0.5", disabled && "opacity-60")}
    >
      {ACCESS_LEVELS.map((level, i) => {
        const on = value === level;
        return (
          <button
            key={level}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(level)}
            className={cn(
              "relative rounded px-2 py-0.5 text-xs font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-not-allowed",
              on ? LEVEL_INK[level] : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on ? (
              <motion.span
                layoutId={`${id}-level`}
                className={cn("absolute inset-0 rounded", LEVEL_ACTIVE[level])}
                transition={{ duration: reduce ? 0 : DURATION.indicator, ease: EASE_SWAP }}
                aria-hidden
              />
            ) : null}
            <span className="relative">{ACCESS_LABEL[level]}</span>
          </button>
        );
      })}
    </div>
  );
}
