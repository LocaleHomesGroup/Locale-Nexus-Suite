import { AppShell } from "@/components/shell/AppShell";
import { LaunchpadProvider } from "@/state/launchpad-store";
import { PortalProvider } from "@/state/portal-store";
import { TicketsProvider } from "@/state/tickets-store";
import { SalesStateProvider } from "@/components/modules/sales/sales-state";

/**
 * Every Launchpad screen shares this layout. It stays mounted across
 * navigations, so the store (jobs, audit log, notifications) survives moving
 * between modules. The portals (Client, Developer) live here too, so what a
 * builder sends a client in one portal is waiting in the other. Tickets sit
 * inside the Launchpad store (a new ticket lands in the inbox) and around the
 * shell, so any dashboard's rail can raise one and Jarvis can read them.
 * Sales' deals, to-dos and lots live here as well, so the Sales Manager
 * dashboard and the Sales Representative portal show the same board.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LaunchpadProvider>
      <PortalProvider>
        <TicketsProvider>
          <SalesStateProvider>
            <AppShell>{children}</AppShell>
          </SalesStateProvider>
        </TicketsProvider>
      </PortalProvider>
    </LaunchpadProvider>
  );
}
