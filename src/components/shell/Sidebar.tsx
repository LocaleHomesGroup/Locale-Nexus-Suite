"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { ExternalLink, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_SWAP } from "@/lib/motion";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useLaunchpad } from "@/state/launchpad-store";
import { Avatar } from "@/components/ui/avatar";
import { CollapsibleSidebarShell, SidebarCollapsedDot, SidebarFocusTile } from "./CollapsibleSidebarShell";
import { SidebarLogoHeader } from "./SidebarLogoHeader";
import { ThemeToggle } from "./ThemeToggle";
import { ViewSwitcher } from "./ViewSwitcher";
import { PaletteTrigger } from "./CommandPalette";
import { RailTooltip } from "./RailTooltip";
import {
  NOTIFICATIONS_HREF,
  NOTIFICATIONS_ICON,
  dashboardById,
  hrefFor,
  isItemActive,
  spaceOf,
  type Dashboard,
  type NavItem,
} from "./dashboards";
import { TONES, type ToneClasses } from "./dashboard-tones";
import { useNavState, type NavBadge } from "./nav-state";

/**
 * The Launchpad rail — one per dashboard, HRIS-style. Its nav IS the
 * dashboard's sections (there is no tab strip in the page), in the dashboard's
 * own accent. Top to bottom:
 *
 *   logo · Search (Ctrl K)                    fixed
 *   sections · links · Inbox                  the only part that scrolls
 *   Switch view                               HRIS's dashboard list, always in view
 *   theme · user card · sign out              pinned, always in view
 *
 * The nav region takes the free height, so the Switch view card sits at the
 * same place on every dashboard. On a viewport too short for both (under
 * ~800px), the nav keeps a few rows and the middle scrolls as one, so the
 * footer stays pinned and nothing is cut off.
 *
 * Collapse: the pull-tab, or Ctrl+B / ⌘B. Collapse is desktop-only; below md
 * the rail is a drawer, and while the drawer is closed it is `inert`.
 *
 * A portal (Client, Developer, Employee) keeps the same rail but is its own space: the
 * caption and logo point at the portal, the staff Inbox is gone (the client
 * has Messages instead), the user card names who is being previewed, and the
 * Switch view lists only the portals.
 */
const RAIL_ID = "launchpad-sidebar-nav";
const MOBILE_QUERY = "(max-width: 767px)";

// The drawer's slide (and its rows' staggered slide-in) as inline styles:
// globals.css's unlayered `*` transition rule outranks Tailwind's
// `transition-*` utilities, so a class here would never animate. Mobile only;
// on desktop the collapse rules in globals.css own the rail's transitions.
const DRAWER_TRANSITION: React.CSSProperties = {
  transitionProperty: "transform, opacity, box-shadow",
  transitionDuration: "360ms",
  transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
};
const DRAWER_ROW_TRANSITION: React.CSSProperties = {
  transitionProperty: "color, background-color, transform, opacity",
  transitionDuration: "300ms",
  transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
};

function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Below md. False on the server and during hydration, then the real value. */
function useIsMobile(): boolean {
  return React.useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

export function Sidebar({ mobileOpen, onNavigate }: { mobileOpen: boolean; onNavigate: () => void }) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const { dashboardId } = useNavState();
  const isMobile = useIsMobile();
  const dash = dashboardById(dashboardId);
  const tone = TONES[dash.tone];
  const portal = spaceOf(dash) === "portal";
  const person = dash.persona ?? STAFF;

  // Ctrl+B / ⌘B toggles the rail (desktop). Ignored while typing in a
  // rich-text field, where the chord means bold.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "b") return;
      const el = e.target as HTMLElement | null;
      if (el?.isContentEditable) return;
      if (window.matchMedia(MOBILE_QUERY).matches) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <CollapsibleSidebarShell
      collapsed={collapsed}
      onToggle={toggle}
      innerWidthClassName="md:w-64"
      accentClassName={tone.pullTab}
      id={RAIL_ID}
      ariaLabel={`${dash.label} navigation`}
      inert={isMobile && !mobileOpen}
      style={isMobile ? DRAWER_TRANSITION : undefined}
      className={cn(
        "flex h-dvh w-[85vw] max-w-[20rem] shrink-0 flex-col border-r md:w-64 md:max-w-none",
        tone.rail,
        "fixed inset-y-0 left-0 z-50 transform-gpu will-change-transform md:static md:z-auto md:translate-x-0 md:opacity-100",
        mobileOpen
          ? "translate-x-0 opacity-100 shadow-2xl shadow-black/25"
          : "-translate-x-full opacity-0 shadow-none md:translate-x-0 md:opacity-100",
      )}
    >
      <RailTooltip railId={RAIL_ID} enabled={collapsed && !isMobile} />

      <div className="shrink-0 px-5 pt-6 pb-3">
        <SidebarLogoHeader
          collapsed={collapsed}
          captionClassName={tone.caption}
          caption={portal ? dash.title : undefined}
          href={portal ? dash.href : undefined}
          homeLabel={portal ? `${dash.title} overview` : undefined}
        />
      </div>

      <div className="sb-collapse-shift shrink-0 px-5 pb-3">
        <PaletteTrigger collapsed={collapsed} />
      </div>

      {/* Middle: the dashboard's sections at their full height, then Switch
          view, scrolling together as one block when the window is too short
          for both. The sections are never squeezed into a box of their own:
          they are this dashboard's navigation, and all of them stay in view. */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable] [scrollbar-width:thin]">
        <div className="sb-collapse-shift pt-1 pr-[14px] pb-4 pl-5">
          {/* The nav reads ?tab= etc.; useSearchParams needs a Suspense boundary
              on static pages. The fallback is the same nav with the defaults. */}
          <React.Suspense
            fallback={
              <RailNav dash={dash} tone={tone} params={EMPTY_PARAMS} collapsed={collapsed} mobileOpen={mobileOpen} isMobile={isMobile} onNavigate={onNavigate} />
            }
          >
            <LiveRailNav dash={dash} tone={tone} collapsed={collapsed} mobileOpen={mobileOpen} isMobile={isMobile} onNavigate={onNavigate} />
          </React.Suspense>
        </div>

        <div className={cn("border-t pt-4 pr-[14px] pb-4 pl-5", tone.divider)}>
          <div className="sb-collapse-shift">
            <ViewSwitcher current={dash} collapsed={collapsed} onSwitch={onNavigate} />
          </div>
        </div>
      </div>

      {/* Pinned footer: always in view, whatever the nav's length. */}
      <div className={cn("shrink-0 border-t px-5 pt-2.5 pb-4", tone.divider)}>
        <div className="sb-collapse-shift flex flex-col gap-2">
          <ThemeToggle collapsed={collapsed} />
          <div
            data-rail-tip={`${person.name}, ${person.role}`}
            className={cn("vs-collapse-box flex items-center gap-2.5 rounded-md border px-[3px] py-1.5", tone.softCard)}
          >
            <Avatar name={person.name} tone={portal ? (dash.tone === "haven" ? "haven" : "charcoal") : "haven"} size="sm" />
            <div className="sb-collapse-fade min-w-0 flex-1">
              <div className="truncate text-[13px] leading-tight font-medium text-zinc-900 dark:text-zinc-100">{person.name}</div>
              {/* No RBAC yet, so this account sees every dashboard, the
                  manager-only pages included — and a portal is a staff
                  preview of what its client or developer sees. Say so. */}
              <div className={cn("mt-px truncate text-xs leading-tight", tone.caption)}>{person.role}</div>
            </div>
          </div>
          <button
            type="button"
            data-rail-tip="Sign out"
            onClick={() =>
              toast("Sign-in isn't wired up yet", {
                description: "This is the static prototype. Accounts and roles come with RBAC.",
              })
            }
            className={cn(
              "group/row sb-row relative flex h-8 w-full items-center justify-start gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-zinc-500 hover:bg-red-500/10 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
              collapsed && "md:ring-0!",
            )}
          >
            <SidebarFocusTile collapsed={collapsed} />
            <LogOut className="relative size-[15px] shrink-0" aria-hidden />
            <span className="sb-collapse-fade">Sign out</span>
          </button>
        </div>
      </div>
    </CollapsibleSidebarShell>
  );
}

const EMPTY_PARAMS = new URLSearchParams();

/** The signed-in staff member, shown on every Launchpad rail. */
const STAFF = { name: "Shannan Hart", role: "Manager · all dashboards" };

function LiveRailNav(props: Omit<RailNavProps, "params">) {
  const params = useSearchParams();
  return <RailNav {...props} params={params} />;
}

interface RailNavProps {
  dash: Dashboard;
  tone: ToneClasses;
  params: URLSearchParams;
  collapsed: boolean;
  mobileOpen: boolean;
  isMobile: boolean;
  onNavigate: () => void;
}

/** Only the params that differ from the dashboard's defaults, sorted — "what view is this". */
function viewKey(dash: Dashboard, entries: Iterable<[string, string]>): string {
  return [...entries]
    .filter(([k, v]) => dash.defaults[k] !== v)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

function RailNav({ dash, tone, params, collapsed, mobileOpen, isMobile, onNavigate }: RailNavProps) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { badges, fireReselect } = useNavState();
  const { notifications } = useLaunchpad();
  const urgent = notifications.some((n) => n.kind === "red");
  const onDashRoot = pathname === dash.href;
  const currentView = viewKey(dash, params.entries());

  // Running render position — drives the staggered mobile drawer slide-in.
  let order = 0;

  const row = (item: NavItem, opts: { child?: boolean; badge?: NavBadge; href?: string; active: boolean }) => {
    const Icon = item.icon;
    const href = opts.href ?? hrefFor(dash, item);
    // Already exactly here? Don't navigate — tell the module (it may reset itself).
    const exact = opts.href ? pathname === opts.href : onDashRoot && viewKey(dash, Object.entries(item.params)) === currentView;
    const index = order++;
    const attention = opts.badge && opts.badge.tone && opts.badge.tone !== "neutral";
    const tip = opts.badge
      ? `${item.label} (${opts.badge.count > 99 ? "99+" : opts.badge.count})`
      : item.tag
        ? `${item.label} (${item.tag})`
        : item.label;
    return (
      <Link
        key={item.key}
        href={href}
        scroll={false}
        aria-current={opts.active ? "page" : undefined}
        data-rail-tip={tip}
        onClick={(e) => {
          onNavigate();
          if (exact) {
            e.preventDefault();
            fireReselect(item.key);
            return;
          }
          document.getElementById("launchpad-scroll")?.scrollTo({ top: 0 });
        }}
        style={isMobile ? { ...DRAWER_ROW_TRANSITION, transitionDelay: mobileOpen ? `${60 + index * 30}ms` : "0ms" } : undefined}
        className={cn(
          "group/row sb-row relative flex w-full items-center gap-2.5 rounded-md px-2.5 font-[450] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
          collapsed && "md:ring-0!",
          opts.child ? "py-[6px] text-[13px]" : "py-[7px] text-sm",
          mobileOpen ? "translate-x-0 opacity-100" : "-translate-x-6 opacity-0 md:translate-x-0 md:opacity-100",
          opts.active
            ? opts.child
              ? tone.childActive
              : tone.navActive
            : cn("text-zinc-700 dark:text-zinc-300", tone.navHover),
        )}
      >
        <SidebarFocusTile collapsed={collapsed} />
        <span className="relative shrink-0">
          <Icon
            aria-hidden
            className={cn(
              opts.child ? "size-[14px]" : "size-[15px]",
              "shrink-0",
              opts.active && !opts.child ? tone.navActiveIcon : "text-zinc-400 dark:text-zinc-500",
              opts.active && opts.child && "text-current",
            )}
          />
          <SidebarCollapsedDot
            collapsed={collapsed}
            show={Boolean(attention)}
            tone={opts.badge?.tone === "problem" ? "bg-rose-500" : "bg-amber-500"}
          />
        </span>
        {item.tag ? (
          // A tagged label wraps rather than truncating: "Inbound capture" and
          // its chip don't fit one nested row, and a cut-off name hides the
          // very thing the tag is about.
          <span className="sb-collapse-fade min-w-0 flex-1 text-left leading-snug">
            {item.label}{" "}
            <span className="inline-block rounded-full border border-current/25 px-1.5 align-[1px] text-[10px] leading-4 font-semibold tracking-[0.12em] whitespace-nowrap uppercase opacity-75">
              {item.tag}
            </span>
          </span>
        ) : (
          <span className="sb-collapse-fade min-w-0 flex-1 truncate text-left">{item.label}</span>
        )}
        {opts.badge ? <BadgeChip badge={opts.badge} active={opts.active && !opts.child} /> : null}
      </Link>
    );
  };

  return (
    <>
      <nav className="flex flex-col gap-px" aria-label={`${dash.label} sections`}>
        {dash.items.map((item) => {
          const active = isItemActive(dash, item, pathname, params);
          const kids = item.children;
          return (
            <React.Fragment key={item.key}>
              {row(item, { active, badge: badges[item.key] })}
              {kids ? (
                <AnimatePresence initial={false}>
                  {active ? (
                    <motion.div
                      key={`${item.key}-children`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: reduce ? 0 : 0.26, ease: EASE_SWAP }}
                      className="overflow-hidden"
                    >
                      <div className="sb-collapse-indent relative my-0.5 flex flex-col gap-px pl-4">
                        {/* The thread that ties the nested views to their parent. */}
                        <span aria-hidden className="sb-collapse-fade absolute top-1 bottom-1 left-[17px] w-px bg-zinc-200 dark:bg-white/10" />
                        {kids.map((child) =>
                          row(child, {
                            child: true,
                            active: isItemActive(dash, child, pathname, params),
                            badge: badges[child.key],
                          }),
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              ) : null}
            </React.Fragment>
          );
        })}
      </nav>

      {dash.links?.length ? (
        <div className="mt-3 flex flex-col gap-px">
          {dash.links.map((l) => {
            const Icon = l.icon;
            return (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                data-rail-tip={`${l.label} (new tab)`}
                className={cn(
                  "group/row sb-row relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm font-[450] text-zinc-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset dark:text-zinc-300",
                  collapsed && "md:ring-0!",
                  tone.navHover,
                )}
              >
                <SidebarFocusTile collapsed={collapsed} />
                <Icon className="relative size-[15px] shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
                <span className="sb-collapse-fade min-w-0 flex-1 truncate">{l.label}</span>
                <ExternalLink className="sb-collapse-fade size-3 shrink-0 text-zinc-400" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            );
          })}
        </div>
      ) : null}

      {spaceOf(dash) === "portal" ? null : (
        <>
          <p className="sb-collapse-fade mt-5 mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
            Inbox
          </p>
          <nav className="flex flex-col gap-px" aria-label="Inbox">
            {row(
              { key: "inbox:notifications", label: "Notifications", icon: NOTIFICATIONS_ICON, params: {} },
              {
                href: NOTIFICATIONS_HREF,
                active: pathname === NOTIFICATIONS_HREF,
                badge:
                  notifications.length > 0
                    ? { count: notifications.length, tone: urgent ? "problem" : "neutral", label: "unread" }
                    : undefined,
              },
            )}
          </nav>
        </>
      )}
    </>
  );
}

function BadgeChip({ badge, active }: { badge: NavBadge; active: boolean }) {
  return (
    <span
      className={cn(
        "sb-collapse-fade ml-auto inline-flex min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] leading-[18px] font-semibold tabular-nums",
        active
          ? "bg-white/75 text-zinc-900 dark:bg-black/25 dark:text-current"
          : badge.tone === "problem"
            ? "bg-rose-500 text-white"
            : badge.tone === "pending"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
              : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      )}
    >
      {badge.count > 99 ? "99+" : badge.count}
      {badge.label ? <span className="sr-only"> {badge.label}</span> : null}
    </span>
  );
}
