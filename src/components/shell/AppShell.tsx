"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./Sidebar";
import { dashboardById } from "./dashboards";
import { TONES } from "./dashboard-tones";
import { NavProvider, useNavState } from "./nav-state";
import { DashboardSwitchProvider } from "./dashboard-switch";
import { CommandPalette, CommandPaletteProvider } from "./CommandPalette";
import { JarvisBubble } from "./assistant/JarvisBubble";

/**
 * The dashboard shell — HRIS § 1.1. The root owns the viewport (`h-dvh
 * overflow-hidden`), so the document never scrolls; each page scrolls inside
 * the content area (`<main id="launchpad-scroll">`). Below `md` the rail is a
 * drawer behind a hamburger and the mobile top bar appears; desktop has no
 * duplicate top bar.
 *
 * Keyboard: "Skip to content" is the first Tab stop and lands focus on the
 * page; Ctrl+K / ⌘K opens the command palette; Ctrl+B / ⌘B collapses the rail.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <NavProvider>
      <DashboardSwitchProvider>
        <CommandPaletteProvider>
          <Shell>{children}</Shell>
        </CommandPaletteProvider>
      </DashboardSwitchProvider>
    </NavProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dashboardId } = useNavState();
  const dash = dashboardById(dashboardId);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const scrollRef = React.useRef<HTMLElement>(null);

  // New page → start at the top (the scroll container outlives navigations).
  // Section changes inside a dashboard scroll up from the rail's click handler.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setMobileOpen(false);
  }, [pathname]);

  // The tone also goes on <html> so portalled dialogs, menus and toasts pick
  // up this dashboard's accent; the shell root carries it from the first
  // server render, so the page itself never flashes the default.
  React.useEffect(() => {
    document.documentElement.dataset.tone = dash.tone;
  }, [dash.tone]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const closeDrawer = React.useCallback(() => setMobileOpen(false), []);

  const skipToContent = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Focus the page without touching the URL hash (no history entry, no router).
    e.preventDefault();
    scrollRef.current?.focus();
  };

  return (
    <div
      data-tone={dash.tone}
      className="flex h-dvh max-h-dvh w-full overflow-hidden bg-gradient-to-br from-white via-tone-soft/40 to-silver/70 text-foreground dark:from-[#111113] dark:via-tone-soft/25 dark:to-[#111113]"
    >
      <a
        href="#launchpad-scroll"
        onClick={skipToContent}
        className="sr-only z-[120] rounded-lg bg-popover px-4 py-2.5 text-sm font-semibold text-foreground shadow-lg ring-2 ring-ring outline-none focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          aria-label="Close navigation menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <Sidebar mobileOpen={mobileOpen} onNavigate={closeDrawer} />

      <div className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "flex shrink-0 items-center gap-3 border-b bg-white/95 px-3 py-2.5 backdrop-blur-md supports-[padding:max(0px)]:pt-[max(0.625rem,env(safe-area-inset-top))] md:hidden dark:bg-[#141416]/95",
            TONES[dash.tone].mobileBorder,
          )}
        >
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="launchpad-sidebar-nav"
          >
            <Menu className="size-5" />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/locale-mark-charcoal.svg" alt="" className="size-6 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/locale-mark-silver.svg" alt="" className="hidden size-6 dark:block" />
          <span className="min-w-0 truncate text-sm font-semibold">{dash.title}</span>
        </header>

        {/* The page. Other code scrolls it by this id; the skip link and the
            palette land focus here (tabIndex -1: focusable, not a Tab stop). */}
        <main ref={scrollRef} id="launchpad-scroll" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto outline-none">
          {children}
        </main>
      </div>

      {/* Jarvis — on every dashboard, with that dashboard's own questions. */}
      <JarvisBubble />
      <CommandPalette onNavigate={closeDrawer} />
    </div>
  );
}
