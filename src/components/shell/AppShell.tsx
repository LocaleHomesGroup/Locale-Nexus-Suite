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
import { JarvisBubble } from "./assistant/JarvisBubble";

/**
 * The dashboard shell — HRIS § 1.1. The root owns the viewport (`h-dvh
 * overflow-hidden`), so the document never scrolls; each page scrolls inside
 * the content area. Below `md` the rail is a drawer behind a hamburger and the
 * mobile top bar appears; desktop has no duplicate top bar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <NavProvider>
      <Shell>{children}</Shell>
    </NavProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dashboardId } = useNavState();
  const dash = dashboardById(dashboardId);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // New page → start at the top (the scroll container outlives navigations).
  // Section changes inside a dashboard scroll up from the rail's click handler.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="flex h-dvh max-h-dvh w-full overflow-hidden bg-gradient-to-br from-white via-haven-50/25 to-silver/70 text-foreground dark:from-[#111113] dark:via-[#121817] dark:to-[#111113]">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          aria-label="Close navigation menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />

      <main className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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

        <div ref={scrollRef} id="launchpad-scroll" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Jarvis — on every dashboard, with that dashboard's own questions. */}
      <JarvisBubble />
    </div>
  );
}
