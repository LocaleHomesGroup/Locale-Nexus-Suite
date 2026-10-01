"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The collapsible rail, ported from Simple HRIS.
 *
 * Why it's smooth: the rail only animates `width`, while all of its content
 * lives in a fixed-width inner panel that the rail clips — nothing inside
 * re-lays-out mid-animation. Labels fade via `.sb-collapse-fade` (opacity +
 * a short slide). Icons sit at the panel's left edge, so they stay put and
 * remain visible in the 64px collapsed rail. Collapse is desktop-only.
 */
export function CollapsibleSidebarShell({
  collapsed,
  onToggle,
  className,
  innerWidthClassName,
  accentClassName,
  id,
  ariaLabel,
  inert,
  style,
  children,
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  innerWidthClassName: string;
  /** Pull-tab accent (border / hover / focus ring) — the dashboard's tone. */
  accentClassName?: string;
  id?: string;
  ariaLabel?: string;
  /** The closed mobile drawer: off-screen, so out of the tab order and the a11y tree too. */
  inert?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <aside
      id={id}
      role="navigation"
      aria-label={ariaLabel}
      inert={inert || undefined}
      style={style}
      data-collapsible-rail=""
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(className, "overflow-visible md:relative md:z-30", collapsed && "md:w-16")}
    >
      <SidebarCollapseToggle collapsed={collapsed} onToggle={onToggle} className={accentClassName} />
      <div className="absolute inset-0 overflow-hidden">
        <div className={cn("flex h-full min-h-0 w-full flex-col", innerWidthClassName)}>{children}</div>
      </div>
    </aside>
  );
}

/**
 * The pull-tab on the rail's right seam — a physical handle you pull the rail
 * back and forth with. One chevron that rotates for direction. Ctrl+B / ⌘B
 * does the same from anywhere (wired in the Sidebar).
 */
function SidebarCollapseToggle({
  collapsed,
  onToggle,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={collapsed}
      aria-keyshortcuts="Control+B Meta+B"
      title={`${label} (Ctrl+B)`}
      className={cn(
        // Sits just below the logo plate so the collapsed "L" mark never covers it.
        "absolute top-[82px] -right-3.5 z-50 hidden size-7 items-center justify-center md:flex",
        "rounded-full border bg-white text-zinc-500 shadow-lg ring-1 ring-black/5",
        "transition-[transform,color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        "hover:scale-110 hover:shadow-xl focus-visible:ring-2 focus-visible:outline-none active:scale-95",
        "dark:bg-zinc-900 dark:text-zinc-400 dark:ring-white/10",
        className,
      )}
    >
      <ChevronLeft
        aria-hidden
        className={cn(
          "size-4 transition-transform duration-200 ease-out motion-reduce:transition-none",
          collapsed && "rotate-180",
        )}
      />
    </button>
  );
}

/**
 * Stand-in for a clipped count badge while the rail is collapsed: a dot on the
 * nav icon's corner. Desktop + collapsed only; the mobile drawer shows the badge.
 */
export function SidebarCollapsedDot({
  collapsed,
  show = true,
  tone = "bg-rose-500",
}: {
  collapsed: boolean;
  show?: boolean;
  tone?: string;
}) {
  if (!show) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -top-1 -right-1 size-2.5 opacity-0 transition-opacity duration-[var(--sb-collapse-ms)] ease-[var(--sb-collapse-ease)]",
        collapsed && "md:opacity-100",
      )}
    >
      {/* Pings three times when the rail collapses (the moment the badge
          count disappears behind the dot), then rests: never a forever-loop. */}
      <span
        className={cn(
          "absolute inset-0 rounded-full opacity-70 motion-reduce:animate-none",
          collapsed && "md:[animation:ping_1s_cubic-bezier(0,0,0.2,1)_3]",
          tone,
        )}
      />
      <span className={cn("absolute inset-0 rounded-full ring-2 ring-white dark:ring-[#111113]", tone)} />
    </span>
  );
}

/**
 * Focus (and optional hover) for a row on the collapsed rail. Each row is
 * clipped to a 36px tile there (`.sb-row`), which cuts a full-row focus ring
 * down to three sides; this draws the ring on the tile itself. The row needs
 * `group/row relative`, and drops its own ring while collapsed (`md:ring-0!`).
 * Desktop + collapsed only; the drawer keeps the row's own ring.
 */
export function SidebarFocusTile({ collapsed, hover = false }: { collapsed: boolean; hover?: boolean }) {
  if (!collapsed) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 left-0 hidden w-9 rounded-md ring-inset md:block",
        "group-focus-visible/row:ring-2 group-focus-visible/row:ring-ring",
        hover && "group-hover/row:bg-black/[0.04] dark:group-hover/row:bg-white/[0.06]",
      )}
    />
  );
}
