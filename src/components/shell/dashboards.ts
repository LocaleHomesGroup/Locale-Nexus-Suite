import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  BriefcaseBusiness,
  Building,
  Building2,
  Calculator,
  CircleUser,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Columns3,
  DollarSign,
  FileInput,
  FilePlus2,
  FileSpreadsheet,
  FileCheck2,
  FileText,
  HardHat,
  HeartPulse,
  IdCard,
  History,
  Home,
  Hourglass,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  LifeBuoy,
  Laptop,
  ListChecks,
  MapPinned,
  Megaphone,
  MessagesSquare,
  Package,
  Radio,
  Receipt,
  RefreshCcw,
  Scale,
  ScrollText,
  Send,
  Settings,
  Sheet,
  ShieldCheck,
  Sparkles,
  Tags,
  Target,
  TrendingUp,
  Trophy,
  UserCog,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ModuleId } from "@/state/launchpad-store";
import { CATEGORIES, CATEGORY_SLUGS } from "@/components/modules/knowledge/data";
import { HOUSE_IMAGE_BASE } from "@/data/jobs";
import { PAY_RUN } from "@/components/modules/accounting/data";
import { CURRENT_REP } from "@/components/modules/sales/data";
import type { DashboardTone } from "./dashboard-tones";

/**
 * The Launchpad's dashboards, HRIS-style: each module is its own dashboard with
 * its own sidebar, and the rail's "Switch view" card and the command palette
 * (Ctrl+K) move between them.
 *
 * A dashboard's sections are nav items in the rail (never a tab strip in the
 * page). Each item is a URL — `/sales?tab=team` — so Home's shortcuts, the back
 * button and a shared link all land on the right section. `params` are the
 * query values an item sets; `defaults` fill in whatever the URL omits, which
 * is how `/sales` highlights Overview.
 *
 * Every dashboard but Home opens on its Overview: KPI cards drawn from its own
 * sections, each card a link to the section its figure comes from.
 *
 * Dashboards live in one of two spaces. The Launchpad is Locale's own staff
 * dashboards. The portals are the views for one person rather than a team.
 * Two are outward-facing, from the client-journey meeting (docs/Meeting1.md):
 * the Client portal, where a buyer follows their home from enquiry to keys,
 * and the Developer portal, where a building company Locale sells for sees its
 * Locale clients, how it ranks and what Locale needs from it. The third is the
 * Employee portal, Simple HRIS's employee dashboard for Locale's own people:
 * their pay week, their rates, the invoices that pay them and their
 * department. The fourth is the Sales Representative portal: one consultant's own pipeline,
 * clients, week, progress and deal submissions, where the Sales Manager dashboard is
 * the team's. A portal's rail has its own Switch view listing only the portals
 * (a client never sees a staff dashboard); the Launchpad's lists the portals
 * under its own dashboards, so staff can preview them.
 */
export type DashboardSpace = "launchpad" | "portal";

export interface NavItem {
  /** Stable id, also the badge key: "sales:pipeline". */
  key: string;
  label: string;
  icon: LucideIcon;
  params: Record<string, string>;
  /** Nested views, shown under the item while it is active. */
  children?: NavItem[];
  /**
   * A word beside the label, e.g. "Preview" for a screen that shows the shape
   * of something not built yet. Never pulsing, never green: it is waiting on
   * nothing and owns nothing.
   */
  tag?: string;
}

export interface Dashboard {
  id: ModuleId;
  /** Rail caption and switcher label: "Sales Manager". */
  label: string;
  /** Switch-loader heading: "Sales Manager dashboard". */
  title: string;
  href: string;
  icon: LucideIcon;
  tone: DashboardTone;
  defaults: Record<string, string>;
  items: NavItem[];
  /**
   * Pages below the dashboard's own path, and the params of the rail item each
   * belongs to. A job page carries no `?tab=`, so without this it would fall
   * back to the default tab and light Overview instead of CRM dash sync.
   */
  subpages?: { prefix: string; params: Record<string, string> }[];
  /** External shortcuts listed under the nav ("Open HomeScope ↗"). */
  links?: { label: string; href: string; icon: LucideIcon }[];
  /** Which Switch view lists it. Omitted = "launchpad". */
  space?: DashboardSpace;
  /**
   * Who the rail's user card shows. Portals name the client or developer being
   * previewed; the Launchpad shows the signed-in staff member.
   */
  persona?: { name: string; role: string };
}

const tab = (dash: string, id: string, label: string, icon: LucideIcon, children?: NavItem[]): NavItem => ({
  key: `${dash}:${id}`,
  label,
  icon,
  params: { tab: id },
  children,
});

/** The first item on every dashboard after Home, and the page it opens on. */
const overview = (dash: string): NavItem => tab(dash, "overview", "Overview", LayoutDashboard);

/** A dashboard with a single screen gets one item that is always active (Home). */
const only = (dash: string, label: string, icon: LucideIcon): NavItem => ({
  key: `${dash}:main`,
  label,
  icon,
  params: {},
});

export const DASHBOARDS: Dashboard[] = [
  {
    id: "home",
    label: "Home",
    title: "Launchpad home",
    href: "/",
    icon: Home,
    tone: "haven",
    defaults: {},
    items: [only("home", "Overview", LayoutDashboard)],
  },
  {
    id: "operations",
    label: "Operations",
    title: "Operations dashboard",
    href: "/operations",
    icon: RefreshCcw,
    tone: "haven",
    defaults: { tab: "overview", view: "upload" },
    subpages: [{ prefix: "/operations/jobs/", params: { tab: "jobs" } }],
    items: [
      overview("operations"),
      // CRM dash sync, then the three pages that are about it: Inbound capture
      // (a preview, nested because it is that screen's future), the review
      // queue and the audit log.
      tab("operations", "jobs", "CRM dash sync", RefreshCcw, [
        {
          key: "operations:inbound",
          label: "Inbound capture",
          icon: FileInput,
          params: { tab: "jobs", view: "inbound" },
          tag: "Preview",
        },
      ]),
      tab("operations", "review", "Review queue", Hourglass),
      tab("operations", "audit", "Audit log", History),
      tab("operations", "submissions", "Submission review", ClipboardCheck),
      tab("operations", "pricing", "Pricing", Tags),
      tab("operations", "formatter", "Doc formatter", FileSpreadsheet, [
        { key: "operations:formatter:upload", label: "New job", icon: FilePlus2, params: { tab: "formatter", view: "upload" } },
        { key: "operations:formatter:changes", label: "Price changes", icon: ArrowLeftRight, params: { tab: "formatter", view: "changes" } },
        { key: "operations:formatter:jobs", label: "Jobs", icon: ListChecks, params: { tab: "formatter", view: "jobs" } },
        { key: "operations:formatter:templates", label: "Templates", icon: LayoutTemplate, params: { tab: "formatter", view: "templates" } },
      ]),
    ],
  },
  {
    id: "sales",
    label: "Sales Manager",
    title: "Sales Manager dashboard",
    href: "/sales",
    icon: TrendingUp,
    tone: "haven",
    defaults: { tab: "overview" },
    items: [
      overview("sales"),
      tab("sales", "pipeline", "Pipeline", Columns3),
      tab("sales", "clients", "Clients", Users),
      tab("sales", "build", "Under construction", HardHat),
      tab("sales", "costing", "Rapid costing", Calculator),
      tab("sales", "land", "Exclusive land", MapPinned),
      tab("sales", "team", "Team", Trophy),
    ],
    links: [{ label: "Open HomeScope", href: HOUSE_IMAGE_BASE, icon: Home }],
  },
  {
    id: "marketing",
    label: "Marketing",
    title: "Marketing dashboard",
    href: "/marketing",
    icon: Megaphone,
    tone: "charcoal",
    defaults: { tab: "overview" },
    items: [
      overview("marketing"),
      tab("marketing", "performance", "Performance", TrendingUp),
      tab("marketing", "channels", "Channels", Radio),
      tab("marketing", "attribution", "Attribution", Target),
    ],
  },
  {
    id: "finance",
    label: "Finance",
    title: "Finance dashboard",
    href: "/finance",
    icon: Briefcase,
    tone: "nectar",
    defaults: { tab: "overview" },
    items: [overview("finance"), tab("finance", "health", "Health check", HeartPulse)],
  },
  {
    id: "accounts",
    label: "Accounts",
    title: "Accounts dashboard",
    href: "/accounts",
    icon: DollarSign,
    tone: "nectar",
    defaults: { tab: "overview" },
    items: [
      overview("accounts"),
      tab("accounts", "invoicing", "Builder invoicing", Receipt),
      tab("accounts", "reports", "Reports", BarChart3),
      tab("accounts", "expenses", "Expenses", Wallet),
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    title: "Accounting dashboard",
    href: "/accounting",
    icon: Banknote,
    tone: "nectar",
    defaults: { tab: "overview" },
    // The company accountant paying the offshore team's invoices: HRIS's
    // Accounting view, its Payroll Wizard cut to the Pay run.
    items: [
      overview("accounting"),
      tab("accounting", "payrun", PAY_RUN, Send),
      tab("accounting", "history", "Pay history", History),
    ],
  },
  {
    id: "wealth",
    label: "Wealth",
    title: "Wealth dashboard",
    href: "/wealth",
    icon: Building2,
    tone: "skyblue",
    defaults: { tab: "overview" },
    items: [overview("wealth"), tab("wealth", "generator", "Package generator", Package)],
  },
  {
    id: "hr",
    label: "HR",
    title: "HR dashboard",
    href: "/hr",
    icon: Users,
    tone: "charcoal",
    defaults: { tab: "overview" },
    items: [
      overview("hr"),
      tab("hr", "people", "Global Master List", Users),
      tab("hr", "attendance", "Attendance", Clock),
      tab("hr", "leave", "Leave", CalendarDays),
      tab("hr", "recruitment", "Recruitment", UserPlus),
      tab("hr", "performance", "Performance", Target),
      tab("hr", "assets", "Assets", Laptop),
    ],
  },
  {
    id: "projects",
    label: "Projects",
    title: "Projects dashboard",
    href: "/projects",
    icon: ClipboardList,
    tone: "charcoal",
    defaults: { tab: "overview" },
    items: [overview("projects"), tab("projects", "board", "Project board", ClipboardList)],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    title: "Knowledge base",
    href: "/knowledge",
    icon: BookOpen,
    tone: "charcoal",
    // Knowledge's sections are its categories (`?cat=`), so its Overview is the
    // category-less page: `/knowledge`.
    defaults: { cat: "overview" },
    items: [
      { key: "knowledge:overview", label: "Overview", icon: LayoutDashboard, params: { cat: "overview" } },
      ...CATEGORIES.map((c) => ({
        key: `knowledge:${CATEGORY_SLUGS[c.name]}`,
        label: c.name,
        icon: c.icon,
        params: { cat: CATEGORY_SLUGS[c.name] },
      })),
    ],
  },
  {
    id: "leadership",
    label: "Leadership",
    title: "Leadership dashboard",
    href: "/leadership",
    icon: BarChart3,
    tone: "charcoal",
    defaults: { tab: "overview" },
    items: [
      overview("leadership"),
      tab("leadership", "business", "Business dashboard", BarChart3),
      tab("leadership", "custom", "Custom dashboard", LayoutGrid),
    ],
  },
  {
    id: "it",
    label: "IT",
    title: "IT dashboard",
    href: "/it",
    icon: Settings,
    tone: "charcoal",
    defaults: { tab: "overview" },
    items: [overview("it"), tab("it", "helpdesk", "Help desk", LifeBuoy)],
  },
  {
    id: "admin",
    label: "Admin",
    title: "Admin dashboard",
    href: "/admin",
    icon: ShieldCheck,
    tone: "charcoal",
    defaults: { tab: "overview" },
    // HRIS's Admin view cut to the two screens the Launchpad needs before RBAC:
    // who holds which dashboard (Roles & permissions) and the roster with who's
    // online (Global Master List). HRIS's rail order.
    items: [
      overview("admin"),
      tab("admin", "roles", "Roles & permissions", UserCog),
      tab("admin", "people", "Global Master List", Sheet),
    ],
  },

  /* ── Portals ─────────────────────────────────────────────────────────── */
  {
    id: "client",
    label: "Client",
    title: "Client portal",
    href: "/client",
    icon: UserRound,
    // Locale Homes is the brand a buyer deals with.
    tone: "haven",
    space: "portal",
    persona: { name: "R. de Thierry and J. Kumar", role: "Client · staff preview" },
    defaults: { tab: "overview" },
    // In journey order: what you can borrow, the builders matched to you, the
    // build itself, then the paperwork and the one thread for everyone.
    items: [
      overview("client"),
      tab("client", "finance", "Finance", Wallet),
      tab("client", "options", "My options", Scale),
      tab("client", "build", "My build", HardHat),
      tab("client", "documents", "Documents", FileText),
      tab("client", "messages", "Messages", MessagesSquare),
    ],
  },
  {
    id: "developer",
    label: "Developer",
    title: "Developer portal",
    href: "/developer",
    icon: Building,
    // The master brand: Locale as the distribution channel for builders.
    tone: "charcoal",
    space: "portal",
    persona: { name: "Forma", role: "Developer · staff preview" },
    defaults: { tab: "overview" },
    items: [
      overview("developer"),
      tab("developer", "clients", "Locale clients", Users),
      tab("developer", "updates", "Client updates", Send),
      tab("developer", "insights", "Match insights", Sparkles),
      tab("developer", "products", "Designs and pricing", LayoutTemplate),
      tab("developer", "terms", "Terms and requirements", ScrollText),
    ],
  },
  {
    id: "employee",
    label: "Employee",
    title: "Employee portal",
    href: "/employee",
    icon: IdCard,
    // The master brand: Locale as the employer.
    tone: "charcoal",
    space: "portal",
    // HRIS's rail footer: department · employee ID.
    persona: { name: "Jan Kane Reroma", role: "AI & Growth · LPG-0147" },
    defaults: { tab: "overview", view: "new" },
    // HRIS's employee rail without KPI Results and MESA; its contractor
    // Invoices (New Invoice and History) nested, as Doc formatter's views are.
    items: [
      overview("employee"),
      tab("employee", "invoices", "Invoices", FileText, [
        { key: "employee:invoices:new", label: "New invoice", icon: FilePlus2, params: { tab: "invoices", view: "new" } },
        { key: "employee:invoices:history", label: "History", icon: History, params: { tab: "invoices", view: "history" } },
      ]),
      tab("employee", "profile", "Profile", CircleUser),
      tab("employee", "department", "Department", Users),
    ],
  },
  {
    id: "consultant",
    label: "Sales Representative",
    title: "Sales Representative",
    href: "/consultant",
    icon: BriefcaseBusiness,
    // Locale Homes is the brand a consultant sells for.
    tone: "haven",
    space: "portal",
    persona: { name: CURRENT_REP, role: "Sales rep · staff preview" },
    defaults: { tab: "overview" },
    // The sections that said "My" on the Sales Manager dashboard, which is now the
    // team's view, plus the consultant's progress.
    items: [
      overview("consultant"),
      tab("consultant", "pipeline", "My pipeline", Columns3),
      tab("consultant", "clients", "My clients", Users),
      tab("consultant", "week", "My week", CalendarDays),
      tab("consultant", "progress", "My progress", Target),
      tab("consultant", "submissions", "My Deal Submissions", FileCheck2),
    ],
  },
];

export const spaceOf = (d: Dashboard): DashboardSpace => d.space ?? "launchpad";

/** The dashboards one space's Switch view lists, in rail order. */
export function dashboardsIn(space: DashboardSpace): Dashboard[] {
  return DASHBOARDS.filter((d) => spaceOf(d) === space);
}

/**
 * Each Locale sub-brand with its Launchpad dashboards, then the portals (the
 * command palette lists dashboards in this order). Derived from each
 * dashboard's `tone`, so a group can never disagree with the accent its
 * dashboards wear.
 */
export const DASHBOARD_GROUPS: { label: string; space: DashboardSpace; dashboards: Dashboard[] }[] = [
  ...(
    [
      ["haven", "Locale Homes"],
      ["nectar", "Locale Financial"],
      ["skyblue", "Locale Wealth"],
      ["charcoal", "Company"],
    ] as const
  ).map(([tone, label]: readonly [DashboardTone, string]) => ({
    label,
    space: "launchpad" as const,
    dashboards: dashboardsIn("launchpad").filter((d) => d.tone === tone),
  })),
  { label: "Portals", space: "portal", dashboards: dashboardsIn("portal") },
];

/**
 * The signed-in staff member, shown on every Launchpad rail. Not on the master
 * list: the Admin dashboard shows them as an off-roster account, as HRIS does
 * for an admin who isn't on payroll. The email is a placeholder.
 */
export const STAFF = { name: "Shannan Hart", role: "Manager · all dashboards", email: "shannanh@localegroup.au" };

/** The inbox is shared by every dashboard — it sits under each rail's nav. */
export const NOTIFICATIONS_HREF = "/notifications";
export const NOTIFICATIONS_ICON = Bell;

export function dashboardById(id: string | null | undefined): Dashboard {
  return DASHBOARDS.find((d) => d.id === id) ?? DASHBOARDS[0];
}

/** The dashboard a path belongs to, or null for shared pages (/notifications). */
export function dashboardForPath(pathname: string): Dashboard | null {
  if (pathname === "/") return DASHBOARDS[0];
  return DASHBOARDS.find((d) => d.href !== "/" && (pathname === d.href || pathname.startsWith(d.href + "/"))) ?? null;
}

/**
 * The URL of a rail item named by its key — `"sales:pipeline"`, or a nested one
 * like `"operations:formatter:jobs"` — plus any extra query (a tile filter).
 * Overview cards link this way, so a card can never point at a section the rail
 * doesn't have. An unknown key is a programming error and throws.
 */
export function hrefForKey(key: string, extra?: Record<string, string>): string {
  const dash = dashboardById(key.split(":")[0]);
  const item = dash.items.flatMap((i) => [i, ...(i.children ?? [])]).find((i) => i.key === key);
  if (!item || dash.id !== key.split(":")[0]) throw new Error(`No rail item "${key}"`);
  const href = hrefFor(dash, item);
  if (!extra) return href;
  const qs = new URLSearchParams(href.split("?")[1] ?? "");
  for (const [k, v] of Object.entries(extra)) qs.set(k, v);
  return `${dash.href}?${qs.toString()}`;
}

/** An item's URL: the dashboard path plus the params that differ from the defaults. */
export function hrefFor(dash: Dashboard, item: NavItem): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(item.params)) {
    if (dash.defaults[k] !== v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `${dash.href}?${s}` : dash.href;
}

/**
 * Is `item` the one showing? Compares its params with the URL (defaults filled
 * in). On a sub-page (a job page) the sub-page's own params stand in for the
 * URL's, so the rail still marks the section the page belongs to.
 */
export function isItemActive(dash: Dashboard, item: NavItem, pathname: string, params: URLSearchParams): boolean {
  if (!(pathname === dash.href || (dash.href !== "/" && pathname.startsWith(dash.href + "/")))) return false;
  const sub = pathname === dash.href ? undefined : dash.subpages?.find((s) => pathname.startsWith(s.prefix));
  const current = (k: string) => (sub ? sub.params[k] : params.get(k)) ?? dash.defaults[k];
  return Object.entries(item.params).every(([k, v]) => current(k) === v);
}
