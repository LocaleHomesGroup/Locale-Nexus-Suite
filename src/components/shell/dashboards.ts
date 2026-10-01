import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Columns3,
  DollarSign,
  FilePlus2,
  FileSpreadsheet,
  FileCheck2,
  HardHat,
  HeartPulse,
  Home,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  LifeBuoy,
  Laptop,
  ListChecks,
  MapPinned,
  Megaphone,
  Package,
  Radio,
  Receipt,
  RefreshCcw,
  Settings,
  Tags,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ModuleId } from "@/state/launchpad-store";
import { CATEGORIES, CATEGORY_SLUGS } from "@/components/modules/knowledge/data";
import { HOUSE_IMAGE_BASE } from "@/data/jobs";
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
 * is how `/sales` highlights Pipeline.
 */
export interface NavItem {
  /** Stable id, also the badge key: "sales:pipeline". */
  key: string;
  label: string;
  icon: LucideIcon;
  params: Record<string, string>;
  /** Nested views, shown under the item while it is active. */
  children?: NavItem[];
}

export interface Dashboard {
  id: ModuleId;
  /** Rail caption and switcher label: "Sales". */
  label: string;
  /** Switch-loader heading: "Sales dashboard". */
  title: string;
  href: string;
  icon: LucideIcon;
  tone: DashboardTone;
  defaults: Record<string, string>;
  items: NavItem[];
  /** External shortcuts listed under the nav ("Open HomeScope ↗"). */
  links?: { label: string; href: string; icon: LucideIcon }[];
}

const tab = (dash: string, id: string, label: string, icon: LucideIcon, children?: NavItem[]): NavItem => ({
  key: `${dash}:${id}`,
  label,
  icon,
  params: { tab: id },
  children,
});

/** A dashboard with a single screen gets one item that is always active. */
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
    defaults: { tab: "jobs", view: "upload" },
    items: [
      tab("operations", "jobs", "CRM Dash Sync", RefreshCcw),
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
    label: "Sales",
    title: "Sales dashboard",
    href: "/sales",
    icon: TrendingUp,
    tone: "haven",
    defaults: { tab: "pipeline" },
    items: [
      tab("sales", "pipeline", "Pipeline", Columns3),
      tab("sales", "clients", "My clients", Users),
      tab("sales", "week", "My week", CalendarDays),
      tab("sales", "build", "Under construction", HardHat),
      tab("sales", "costing", "Rapid costing", Calculator),
      tab("sales", "submissions", "My Deal Submissions", FileCheck2),
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
    defaults: { tab: "performance" },
    items: [
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
    defaults: {},
    items: [only("finance", "Health check", HeartPulse)],
  },
  {
    id: "accounts",
    label: "Accounts",
    title: "Accounts dashboard",
    href: "/accounts",
    icon: DollarSign,
    tone: "nectar",
    defaults: { tab: "invoicing" },
    items: [
      tab("accounts", "invoicing", "Builder invoicing", Receipt),
      tab("accounts", "reports", "Reports", BarChart3),
      tab("accounts", "expenses", "Expenses", Wallet),
    ],
  },
  {
    id: "wealth",
    label: "Wealth",
    title: "Wealth dashboard",
    href: "/wealth",
    icon: Building2,
    tone: "skyblue",
    defaults: {},
    items: [only("wealth", "Package generator", Package)],
  },
  {
    id: "hr",
    label: "HR",
    title: "HR dashboard",
    href: "/hr",
    icon: Users,
    tone: "charcoal",
    defaults: { tab: "dashboard" },
    items: [
      tab("hr", "dashboard", "Dashboard", LayoutDashboard),
      tab("hr", "people", "Employees", Users),
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
    defaults: {},
    items: [only("projects", "Project board", ClipboardList)],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    title: "Knowledge base",
    href: "/knowledge",
    icon: BookOpen,
    tone: "charcoal",
    defaults: { cat: CATEGORY_SLUGS[CATEGORIES[0].name] },
    items: CATEGORIES.map((c) => ({
      key: `knowledge:${CATEGORY_SLUGS[c.name]}`,
      label: c.name,
      icon: c.icon,
      params: { cat: CATEGORY_SLUGS[c.name] },
    })),
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
      tab("leadership", "overview", "Business dashboard", BarChart3),
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
    defaults: {},
    items: [only("it", "Help desk", LifeBuoy)],
  },
];

/**
 * Each Locale sub-brand with its dashboards (the command palette lists
 * dashboards in this order). Derived from each dashboard's `tone`, so a group
 * can never disagree with the accent its dashboards wear.
 */
export const DASHBOARD_GROUPS: { tone: DashboardTone; label: string; dashboards: Dashboard[] }[] = (
  [
    ["haven", "Locale Homes"],
    ["nectar", "Locale Financial"],
    ["skyblue", "Locale Wealth"],
    ["charcoal", "Company"],
  ] as const
).map(([tone, label]) => ({ tone, label, dashboards: DASHBOARDS.filter((d) => d.tone === tone) }));

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

/** An item's URL: the dashboard path plus the params that differ from the defaults. */
export function hrefFor(dash: Dashboard, item: NavItem): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(item.params)) {
    if (dash.defaults[k] !== v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `${dash.href}?${s}` : dash.href;
}

/** Is `item` the one showing? Compares its params with the URL (defaults filled in). */
export function isItemActive(dash: Dashboard, item: NavItem, pathname: string, params: URLSearchParams): boolean {
  if (!(pathname === dash.href || (dash.href !== "/" && pathname.startsWith(dash.href + "/")))) return false;
  return Object.entries(item.params).every(([k, v]) => (params.get(k) ?? dash.defaults[k]) === v);
}
