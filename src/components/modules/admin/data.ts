import { DASHBOARDS, DASHBOARD_GROUPS, STAFF, dashboardById, hrefForKey, spaceOf, type Dashboard } from "@/components/shell/dashboards";
import type { DashboardTone } from "@/components/shell/dashboard-tones";
import type { ModuleId } from "@/state/launchpad-store";
import type { PillTone } from "@/components/ui/pill";
import { ORG_SEED, masterList, type MasterRow, type OrgDepartmentId } from "@/components/modules/hr/data";
import { PAYEE_IDS, PAY_RUN } from "@/components/modules/accounting/data";

/**
 * Admin — Simple HRIS's Admin view, static. Roles & permissions grants
 * dashboards; the Global Master List is HR's roster with who's online.
 *
 * As in HRIS, a role is strictly dashboard access: one role unlocks one
 * dashboard in Switch view, and Admin unlocks them all. Granting a role
 * provisions Edit on every section of that dashboard (HRIS's grant route);
 * the admin then narrows any section to View or Hidden. Home is everyone's,
 * so it has no role.
 *
 * Nothing here gates anything yet: this is the shape of RBAC before RBAC. The
 * grants, section limits and who's online are sample data, not Locale's.
 */

export const ADMIN_TABS = ["overview", "roles", "people"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

/* ── Roles ─────────────────────────────────────────────────────────────── */

export type RoleKey = Exclude<ModuleId, "home">;

export interface Section {
  /** The rail item's key: "sales:pipeline". */
  key: string;
  label: string;
}

export interface Role {
  key: RoleKey;
  /** "Sales", or a portal's title: "Sales portal". */
  label: string;
  dashboard: Dashboard;
  blurb: string;
  /** The sections a grant provisions, one access level each. Admin has none: every section is theirs. */
  sections: Section[];
}

const BLURBS: Record<RoleKey, string> = {
  admin: "Full system access. Unlocks every dashboard, this one included.",
  operations: "Unlocks the Operations dashboard: jobs synced between HubSpot and Monday, and the review queue.",
  sales: "Unlocks the Sales dashboard, the team's view: every rep's pipeline and clients, costing, land and Team.",
  marketing: "Unlocks the Marketing dashboard: performance, channels and attribution.",
  finance: "Unlocks the Finance dashboard and its health check.",
  accounts: "Unlocks the Accounts dashboard: builder invoicing, reports and expenses.",
  accounting: `Unlocks the Accounting dashboard: the ${PAY_RUN} and Pay history for the offshore team.`,
  wealth: "Unlocks the Wealth dashboard and its package generator.",
  hr: "Unlocks the HR dashboard: the master list, attendance, leave, recruitment and assets.",
  projects: "Unlocks the Projects dashboard and its board.",
  knowledge: "Unlocks the Knowledge base.",
  leadership: "Unlocks the Leadership dashboard: the business dashboard and custom dashboards.",
  it: "Unlocks the IT dashboard and its help desk.",
  client: "Unlocks the Client portal, where a buyer follows their home from enquiry to keys.",
  developer: "Unlocks the Developer portal, for a building company Locale sells for.",
  employee: "Unlocks the Employee portal: pay week, invoices, profile and department.",
  consultant: "Unlocks the Sales portal: your own pipeline, clients, week, progress and deal submissions.",
};

/** Every dashboard but Home, in rail order. Derived, so a new dashboard is a new role. */
export const ROLES: Role[] = DASHBOARDS.filter((d) => d.id !== "home").map((d) => {
  const key = d.id as RoleKey;
  return {
    key,
    // A portal's role is named for the portal, so "Sales portal" and "Sales" never read the same.
    label: spaceOf(d) === "portal" ? d.title : d.label,
    dashboard: d,
    blurb: BLURBS[key],
    sections: key === "admin" ? [] : d.items.map((i) => ({ key: i.key, label: i.label })),
  };
});

export const ROLE_BY_KEY = Object.fromEntries(ROLES.map((r) => [r.key, r])) as Record<RoleKey, Role>;
const ROLE_ORDER = new Map(ROLES.map((r, i) => [r.key, i]));

/** Roles in rail order, so pills and lists always read the same way. */
export const byRailOrder = (keys: Iterable<RoleKey>) => [...keys].sort((a, b) => ROLE_ORDER.get(a)! - ROLE_ORDER.get(b)!);

export interface RoleGroup {
  title: string;
  caption?: string;
  keys: RoleKey[];
}

/** Admin on its own, then each sub-brand's dashboards and the portals, as Switch view groups them. */
export const ROLE_GROUPS: RoleGroup[] = [
  {
    title: "System",
    caption: "Admin skips the section grid: every section of every dashboard is theirs.",
    keys: ["admin"],
  },
  ...DASHBOARD_GROUPS.map((g) => ({
    title: g.label,
    caption:
      g.space === "portal"
        ? "A portal is one person's view. Give a client or a developer contact theirs with Add by email."
        : undefined,
    keys: g.dashboards.filter((d) => d.id !== "home" && d.id !== "admin").map((d) => d.id as RoleKey),
  })).filter((g) => g.keys.length > 0),
];

/**
 * A role's colour is its dashboard's sub-brand: identity, never a verdict.
 * The company dashboards are quiet; Admin is the charcoal inverse.
 */
const PILL_BY_TONE: Record<DashboardTone, PillTone> = { haven: "haven", nectar: "nectar", skyblue: "skyblue", charcoal: "neutral" };
export const rolePillTone = (key: RoleKey): PillTone => (key === "admin" ? "charcoal" : PILL_BY_TONE[ROLE_BY_KEY[key].dashboard.tone]);

/** The role row's left rule, by sub-brand. Complete literals for Tailwind. */
export const ROLE_ACCENT: Record<DashboardTone | "admin", string> = {
  haven: "border-l-haven-400 dark:border-l-haven-500",
  nectar: "border-l-nectar-400 dark:border-l-nectar-500",
  skyblue: "border-l-skyblue-400 dark:border-l-skyblue-500",
  charcoal: "border-l-zinc-400 dark:border-l-zinc-500",
  admin: "border-l-charcoal dark:border-l-silver",
};
export const roleAccent = (key: RoleKey) => ROLE_ACCENT[key === "admin" ? "admin" : ROLE_BY_KEY[key].dashboard.tone];

/* ── Section access ────────────────────────────────────────────────────── */

export type Access = "hidden" | "view" | "edit";
export const ACCESS_LEVELS: readonly Access[] = ["hidden", "view", "edit"];
export const ACCESS_LABEL: Record<Access, string> = { hidden: "Hidden", view: "View", edit: "Edit" };

/** What a grant writes: Edit on every section of the role's dashboard. */
export function provisioned(role: RoleKey): Record<string, Access> {
  return Object.fromEntries(ROLE_BY_KEY[role].sections.map((s) => [s.key, "edit" as Access]));
}

/* ── Who a grant belongs to ────────────────────────────────────────────── */

/** A roster row's id, or `@address` for an account that isn't on the master list. */
export const offRosterKey = (email: string) => `@${email.trim().toLowerCase()}`;
export const isOffRosterKey = (key: string) => key.startsWith("@");

/** Off-roster accounts we can put a name to. Anyone else shows as their address. */
const KNOWN_OFF_ROSTER: Record<string, string> = { [STAFF.email]: STAFF.name };

/** One entry in the directory: a person on the master list, or an off-roster account. */
export interface Principal {
  key: string;
  name: string;
  /** Work email, else personal. Null: no record yet, so nothing can be granted. */
  email: string | null;
  /** Their master-list row. Null for an off-roster account. */
  row: MasterRow | null;
}

export const identityEmail = (row: MasterRow) => row.record?.workEmail || row.record?.personalEmail || null;

export function rosterPrincipal(row: MasterRow): Principal {
  return { key: row.id, name: row.name, email: identityEmail(row), row };
}

export function offRosterPrincipal(email: string): Principal {
  const address = email.trim().toLowerCase();
  return { key: offRosterKey(address), name: KNOWN_OFF_ROSTER[address] ?? address, email: address, row: null };
}

/**
 * The directory: the master list, then any off-roster address holding a grant
 * or added by email. An address someone on the roster already uses is theirs,
 * not a second entry.
 */
export function directory(rows: MasterRow[], offRoster: readonly string[]): Principal[] {
  const onRoster = new Set(
    rows.flatMap((r) => [r.record?.workEmail, r.record?.personalEmail]).filter((e): e is string => !!e).map((e) => e.toLowerCase()),
  );
  return [...rows.map(rosterPrincipal), ...offRoster.filter((e) => !onRoster.has(e)).map(offRosterPrincipal)];
}

/* ── Sample grants ─────────────────────────────────────────────────────── */

/** Each department's own dashboards. Wealth's partners sit in Sales on the chart but work in Wealth. */
const DEPARTMENT_ROLES: Record<OrgDepartmentId, RoleKey[]> = {
  leadership: ["leadership"],
  finance: ["finance"],
  sales: ["sales", "consultant"],
  marketing: ["marketing"],
  accounts: ["accounts", "accounting"],
  ai: ["it"],
};

/** On top of their department's. */
const EXTRA_ROLES: Record<string, RoleKey[]> = {
  "adam-schaal": ["sales", "finance", "accounts", "hr", "knowledge"],
  "maria-soriano": ["hr", "knowledge"],
  "brad-linford": ["accounts", "leadership"],
  "sean-oneill": ["operations", "projects", "leadership"],
  "larnie-clark": ["operations", "projects", "knowledge"],
  "alison-carter": ["operations", "projects"],
  "shannan-murray": ["operations", "knowledge"],
  "steph-stritch": ["wealth"],
  "kellie-boyer": ["leadership"],
  "aled-smith": ["finance"],
  "jerry-delos-santos": ["admin", "leadership"],
  "pablo-lopez": ["projects"],
  "andre-mikhail-serra": ["sales", "marketing"],
  "jan-kane-reroma": ["admin"],
};

function seedRoles(row: MasterRow): RoleKey[] {
  // A new starter waits for their grants, as in HRIS: Nam Su Byun (joined 7 Sep) has none yet.
  if (row.isNew && !EXTRA_ROLES[row.id] && !PAYEE_IDS.includes(row.id)) return [];
  const wealthOnly = row.department === "sales" && row.brands?.length === 1 && row.brands[0] === "wealth";
  const roles = new Set<RoleKey>(wealthOnly ? ["wealth"] : DEPARTMENT_ROLES[row.department]);
  for (const r of EXTRA_ROLES[row.id] ?? []) roles.add(r);
  // The Employee portal is for the offshore team: the people Accounting pays by invoice.
  if (PAYEE_IDS.includes(row.id)) roles.add("employee");
  return byRailOrder(roles);
}

/** Sections a sample grant narrows from Edit, to show the grid in use. */
const SECTION_LIMITS: { who: (row: MasterRow) => boolean; section: string; access: Access }[] = [
  // New Home Advocates work from the Sales portal. On the dashboard they keep the shared tools:
  // Under construction, Rapid costing and Exclusive land.
  { who: (r) => r.role === "New Home Advocate", section: "sales:pipeline", access: "hidden" },
  { who: (r) => r.role === "New Home Advocate", section: "sales:clients", access: "hidden" },
  { who: (r) => r.role === "New Home Advocate", section: "sales:team", access: "hidden" },
  { who: (r) => r.role === "Finance Broker", section: "finance:overview", access: "view" },
  { who: (r) => r.id === "maria-soriano", section: "hr:people", access: "view" },
  { who: (r) => r.id === "maria-soriano", section: "hr:recruitment", access: "hidden" },
];

export type GrantMap = Record<string, RoleKey[]>;
export type AccessMap = Record<string, Partial<Record<RoleKey, Record<string, Access>>>>;

const SEED_ROWS = masterList(ORG_SEED);

export const SEED_GRANTS: GrantMap = {
  ...Object.fromEntries(SEED_ROWS.map((r) => [r.id, seedRoles(r)])),
  [offRosterKey(STAFF.email)]: ["admin"],
};

export const SEED_ACCESS: AccessMap = Object.fromEntries(
  Object.entries(SEED_GRANTS).map(([who, roles]) => {
    const row = SEED_ROWS.find((r) => r.id === who);
    const perRole: Partial<Record<RoleKey, Record<string, Access>>> = {};
    for (const role of roles) {
      if (role === "admin") continue;
      const sections = provisioned(role);
      for (const limit of SECTION_LIMITS) {
        if (row && limit.who(row) && limit.section in sections) sections[limit.section] = limit.access;
      }
      perRole[role] = sections;
    }
    return [who, perRole];
  }),
);

/** Off-roster accounts on file at the start: the signed-in admin. */
export const SEED_OFF_ROSTER: string[] = [STAFF.email];

/* ── Who's online (sample) ─────────────────────────────────────────────── */

/**
 * Three states, as in HRIS: online (looking at the Launchpad), inactive (the
 * tab is in the background) and offline. `at` is the rail item they have
 * open. Everyone not listed is offline.
 */
export type LiveState = "online" | "inactive" | "offline";

export interface PresenceSeed {
  /** A rail key: "sales:pipeline". */
  at: string;
  inactive?: boolean;
}

export const PRESENCE_SEED: Record<string, PresenceSeed> = {
  [offRosterKey(STAFF.email)]: { at: "admin:people" },
  "jan-kane-reroma": { at: "admin:roles" },
  "sean-oneill": { at: "sales:pipeline" },
  "jasmin-bainbridge": { at: "sales:costing" },
  "michael-fox": { at: "consultant:submissions" },
  "kate-grierson": { at: "consultant:pipeline", inactive: true },
  "larnie-clark": { at: "operations:jobs" },
  "shannan-murray": { at: "operations:review" },
  "aled-smith": { at: "accounting:payrun" },
  "brad-linford": { at: "finance:health" },
  "kellie-boyer": { at: "marketing:performance" },
  "keira-whitbread": { at: "marketing:channels", inactive: true },
  "conor-lloyd-fox": { at: "wealth:generator" },
  "maria-soriano": { at: "hr:leave" },
  "adam-schaal": { at: "leadership:business", inactive: true },
  "pablo-lopez": { at: "it:helpdesk" },
};

// Every seat above must point at a real section (hrefForKey throws otherwise).
for (const p of Object.values(PRESENCE_SEED)) hrefForKey(p.at);

/** The page behind a rail key: "Sales dashboard" and "Pipeline". */
export function pageOf(at: string): { dashboard: Dashboard; section: string } {
  const dashboard = dashboardById(at.split(":")[0]);
  const item = dashboard.items.flatMap((i) => [i, ...(i.children ?? [])]).find((i) => i.key === at);
  return { dashboard, section: item?.label ?? dashboard.label };
}

const LAST_SEEN_STEPS = [6, 14, 38, 55, 95, 160, 240, 420, 1300, 1500, 2900, 4400, 8700];

/** How long ago someone offline was last in, in minutes. Fixed per person, so server and client agree. */
export function seededLastSeen(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LAST_SEEN_STEPS[h % LAST_SEEN_STEPS.length];
}

/** 0 → "just now", 38 → "38m ago", 1500 → "1d ago". */
export function lastSeenText(mins: number): string {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
