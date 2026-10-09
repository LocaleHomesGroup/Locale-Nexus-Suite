import { connection } from "next/server";
import { AppShell } from "@/components/shell/AppShell";
import { LaunchpadProvider } from "@/state/launchpad-store";
import { PortalProvider } from "@/state/portal-store";
import { TicketsProvider } from "@/state/tickets-store";
import { LiveDataProvider } from "@/state/live-data";
import { SalesStateProvider } from "@/components/modules/sales/sales-state";
import type { LiveData } from "@/data/live/types";
import { hasDatabase } from "@/server/env";
import { loadLiveData } from "@/server/read/live-data";

/**
 * Every Launchpad screen shares this layout. It stays mounted across
 * navigations, so the store (jobs, audit log, notifications) survives moving
 * between modules. The portals (Client, Developer) live here too, so what a
 * builder sends a client in one portal is waiting in the other. Tickets sit
 * inside the Launchpad store (a new ticket lands in the inbox) and around the
 * shell, so any dashboard's rail can raise one and Jarvis can read them.
 * Sales' deals, to-dos and lots live here as well, so the Sales Manager
 * dashboard and the Sales Representative portal show the same board.
 *
 * With a database configured (SUPABASE_DB_URL), the layout renders per request
 * and reads live data for Exclusive Land, My clients, All clients and the
 * Operations job list. Without one it stays static and nothing is read.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let live: LiveData | null = null;
  if (hasDatabase()) {
    await connection();
    // No argument: the loader opens the database inside its own try. getDb() here would throw on a bad URL, outside it, and crash every page.
    live = await loadLiveData();
  }
  return (
    <LaunchpadProvider>
      <PortalProvider>
        <TicketsProvider>
          <SalesStateProvider>
            <LiveDataProvider data={live}>
              <AppShell>{children}</AppShell>
            </LiveDataProvider>
          </SalesStateProvider>
        </TicketsProvider>
      </PortalProvider>
    </LaunchpadProvider>
  );
}
