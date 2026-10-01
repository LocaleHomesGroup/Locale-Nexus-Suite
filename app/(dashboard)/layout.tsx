import { AppShell } from "@/components/shell/AppShell";
import { LaunchpadProvider } from "@/state/launchpad-store";

/**
 * Every Launchpad screen shares this layout. It stays mounted across
 * navigations, so the store (jobs, audit log, notifications) survives moving
 * between modules.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LaunchpadProvider>
      <AppShell>{children}</AppShell>
    </LaunchpadProvider>
  );
}
