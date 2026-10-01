"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { withViewTransition } from "@/lib/with-view-transition";
import { cn } from "@/lib/utils";

/**
 * Light / dark toggle — HRIS § 4.2. Wrapped in a View Transition so the swap
 * cross-fades. The trailing glyph shows what tapping will switch TO.
 */
export function ThemeToggle({ collapsed, className }: { collapsed: boolean; className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => withViewTransition(() => setTheme(isDark ? "light" : "dark"))}
      title={collapsed ? (isDark ? "Dark mode" : "Light mode") : undefined}
      aria-label="Toggle dark mode"
      className={cn(
        "sb-row mt-3 mb-1 flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left",
        className,
      )}
    >
      <span className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {isDark ? <Moon className="size-4 shrink-0" /> : <Sun className="size-4 shrink-0" />}
        <span className="sb-collapse-fade">{isDark ? "Dark" : "Light"}</span>
      </span>
      <span className="sb-collapse-fade text-zinc-400" aria-hidden>
        {isDark ? "☀" : "☾"}
      </span>
    </button>
  );
}
