"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon } from "lucide-react";
import { withViewTransition } from "@/lib/with-view-transition";
import { cn } from "@/lib/utils";
import { SidebarFocusTile } from "./CollapsibleSidebarShell";

/**
 * Light / dark — HRIS § 4.2, as a switch row in the rail's pinned footer.
 * Wrapped in a View Transition so the swap cross-fades. The knob's position
 * comes from the `dark` class (set before first paint), not from JS state, so
 * it never jumps after hydration.
 */
export function ThemeToggle({ collapsed, className }: { collapsed: boolean; className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={() => withViewTransition(() => setTheme(isDark ? "light" : "dark"))}
      data-rail-tip={isDark ? "Dark theme: on" : "Dark theme: off"}
      className={cn(
        "group/row sb-row relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium text-zinc-600 dark:text-zinc-400",
        "hover:bg-black/[0.04] hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
        collapsed && "md:ring-0!",
        className,
      )}
    >
      <SidebarFocusTile collapsed={collapsed} />
      <Moon className="relative size-[15px] shrink-0" aria-hidden />
      <span className="sb-collapse-fade min-w-0 flex-1 truncate">Dark theme</span>
      <span aria-hidden className="sb-collapse-fade relative mr-0.5 h-4 w-7 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-200">
        <span className="absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow-sm dark:translate-x-3 dark:bg-charcoal" />
      </span>
    </button>
  );
}
