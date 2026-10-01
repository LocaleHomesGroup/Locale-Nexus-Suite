"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { ExternalLink, LogOut, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_SWAP } from "@/lib/motion";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useLaunchpad } from "@/state/launchpad-store";
import { Avatar } from "@/components/ui/avatar";
import { CollapsibleSidebarShell, SidebarCollapsedDot } from "./CollapsibleSidebarShell";
import { SidebarLogoHeader } from "./SidebarLogoHeader";
import { ThemeToggle } from "./ThemeToggle";
import { ViewSwitcher } from "./ViewSwitcher";
import {
  NOTIFICATIONS_HREF,
  NOTIFICATIONS_ICON,
  dashboardById,
  hrefFor,
  isItemActive,
  type Dashboard,
  type NavItem,
} from "./dashboards";
import { TONES, type ToneClasses } from "./dashboard-tones";
import { useNavState, type NavBadge } from "./nav-state";

/**
 * The Launchpad rail — one per dashboard, HRIS-style. Its nav IS the
 * dashboard's sections (there is no tab strip in the page), in the dashboard's
 * own accent. Slots, top to bottom (HRIS § 2.3): brand row · the dashboard's
 * nav + inbox in one scroll surface · Switch view + theme toggle (inside the
 * scroll surface, so a short viewport still reaches them) · user card and
 * sign-out, anchored at the bottom.
 *
 * Collapse: the pull-tab, or Ctrl+B / ⌘B. Collapse is desktop-only; below md
 * the rail is a drawer.
 */
export function Sidebar({ mobileOpen, onNavigate }: { mobileOpen: boolean; onNavigate: () => void }) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const { dashboardId } = useNavState();
  const dash = dashboardById(dashboardId);
  const tone = TONES[dash.tone];

  // Ctrl+B / ⌘B toggles the rail (desktop). Ignored while typing in a
  // rich-text field, where the chord means bold.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "b") return;
      const el = e.target as HTMLElement | null;
      if (el?.isContentEditable) return;
      if (window.matchMedia("(max-width: 767px)").matches) return;
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
      id="launchpad-sidebar-nav"
      ariaLabel={`${dash.label} navigation`}
      className={cn(
        "flex h-dvh w-[85vw] max-w-[20rem] shrink-0 flex-col border-r md:w-64 md:max-w-none",
        tone.rail,
        "fixed inset-y-0 left-0 z-50 transform-gpu will-change-transform md:static md:z-auto md:translate-x-0 md:opacity-100",
        "transition-[transform,opacity,box-shadow,width] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        mobileOpen
          ? "translate-x-0 opacity-100 shadow-2xl shadow-black/25"
          : "-translate-x-full opacity-0 shadow-none md:translate-x-0 md:opacity-100",
      )}
    >
      <div className="shrink-0 px-5 pt-6 pb-3">
        <SidebarLogoHeader collapsed={collapsed} captionClassName={tone.caption} />
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:thin]">
        <div className="sb-collapse-shift px-5 pr-3 pb-4">
          {/* The nav reads ?tab= etc.; useSearchParams needs a Suspense boundary
              on static pages. The fallback is the same nav with the defaults. */}
          <React.Suspense
            fallback={<RailNav dash={dash} tone={tone} params={EMPTY_PARAMS} collapsed={collapsed} mobileOpen={mobileOpen} onNavigate={onNavigate} />}
          >
            <LiveRailNav dash={dash} tone={tone} collapsed={collapsed} mobileOpen={mobileOpen} onNavigate={onNavigate} />
          </React.Suspense>

          <div className={cn("mt-5 border-t pt-4", tone.divider)}>
            <ViewSwitcher current={dash} collapsed={collapsed} onSwitch={onNavigate} />
            <ThemeToggle collapsed={collapsed} className={cn(tone.softCard, tone.softCardHover)} />
          </div>
        </div>
      </div>

      <div className={cn("shrink-0 border-t p-5", tone.divider)}>
        <div className="sb-collapse-shift">
          <div className={cn("vs-collapse-box flex items-center gap-2.5 rounded-md border px-[3px] py-2", tone.softCard)}>
            <Avatar name="Shannan Hart" tone="haven" size="sm" />
            <div className="sb-collapse-fade min-w-0 flex-1">
              <div className="truncate text-[13px] leading-tight font-medium text-zinc-900 dark:text-zinc-100">Shannan Hart</div>
              <div className={cn("mt-px truncate text-[11px] leading-tight", tone.caption)}>Operations</div>
            </div>
            <MoreHorizontal className="sb-collapse-fade mr-1.5 size-4 shrink-0 text-zinc-400" aria-hidden />
          </div>
          <button
            type="button"
            title={collapsed ? "Sign out" : undefined}
            onClick={() =>
              toast("Sign-in isn't wired up yet", {
                description: "This is the static prototype — accounts and roles come with RBAC.",
              })
            }
            className="sb-row mt-3 flex h-8 w-full items-center justify-start gap-3 rounded-lg px-2.5 text-sm font-medium text-zinc-500 hover:bg-red-500/10 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            <span className="sb-collapse-fade">Sign out</span>
          </button>
        </div>
      </div>
    </CollapsibleSidebarShell>
  );
}

const EMPTY_PARAMS = new URLSearchParams();

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

function RailNav({ dash, tone, params, collapsed, mobileOpen, onNavigate }: RailNavProps) {
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
    return (
      <Link
        key={item.key}
        href={href}
        scroll={false}
        aria-current={opts.active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        onClick={(e) => {
          onNavigate();
          if (exact) {
            e.preventDefault();
            fireReselect(item.key);
            return;
          }
          document.getElementById("launchpad-scroll")?.scrollTo({ top: 0 });
        }}
        style={{ transitionDelay: mobileOpen ? `${60 + index * 30}ms` : undefined }}
        className={cn(
          // The Tailwind transition drives the mobile drawer's staggered slide-in;
          // on desktop the unlayered .sb-row rule (globals.css) takes over for the collapse.
          "sb-row flex w-full items-center gap-2.5 rounded-md px-2.5 font-[450] transition-[color,background-color,box-shadow,transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none",
          opts.child ? "py-[6px] text-[13px]" : "py-[7px] text-[13.5px]",
          mobileOpen ? "translate-x-0 opacity-100" : "-translate-x-6 opacity-0 md:translate-x-0 md:opacity-100",
          opts.active
            ? opts.child
              ? tone.childActive
              : tone.navActive
            : cn("text-zinc-700 dark:text-zinc-300", tone.navHover),
        )}
      >
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
        <span className="sb-collapse-fade min-w-0 flex-1 truncate text-left">{item.label}</span>
        {opts.badge ? <BadgeChip badge={opts.badge} active={opts.active && !opts.child} /> : null}
      </Link>
    );
  };

  return (
    <>
      <p className={cn("sb-collapse-fade mb-1.5 px-2.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase", tone.caption)}>
        {dash.label}
      </p>
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
                        <span aria-hidden className={cn("sb-collapse-fade absolute top-1 bottom-1 left-[17px] w-px", "bg-zinc-200 dark:bg-white/10")} />
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
                title={collapsed ? `${l.label} (opens in a new tab)` : undefined}
                className={cn(
                  "sb-row flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] font-[450] text-zinc-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset dark:text-zinc-300",
                  tone.navHover,
                )}
              >
                <Icon className="size-[15px] shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
                <span className="sb-collapse-fade min-w-0 flex-1 truncate">{l.label}</span>
                <ExternalLink className="sb-collapse-fade size-3 shrink-0 text-zinc-400" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            );
          })}
        </div>
      ) : null}

      <p className="sb-collapse-fade mt-5 mb-1.5 px-2.5 text-[10.5px] font-medium tracking-[0.06em] text-zinc-400 uppercase">
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
