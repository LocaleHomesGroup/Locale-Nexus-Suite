"use client";

import { useTabParam } from "@/hooks/useTabParam";
import { useNavBadge } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { ADMIN_TABS } from "./data";
import { AdminOverview } from "./AdminOverview";
import { AdminRoles } from "./AdminRoles";
import { AdminMasterList } from "./AdminMasterList";
import { useAdmin } from "./admin-store";

/**
 * Admin: Simple HRIS's Admin view, cut to what the Launchpad needs before
 * sign-in and RBAC. Roles & permissions grants dashboards and sets each
 * section's access; the Global Master List is HR's roster with who's online.
 * Static: nothing it grants gates anything yet.
 */
export function AdminScreen() {
  const [tab, , dir] = useTabParam(ADMIN_TABS, "overview");
  const { changing } = useAdmin();

  // HRIS's rail count, as a Launchpad badge: role changes still inside their undo window.
  const inFlight = Object.keys(changing).length;
  useNavBadge("admin:roles", { count: inFlight, tone: "pending", label: inFlight === 1 ? "role change pending" : "role changes pending" });

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "overview" ? <AdminOverview /> : tab === "roles" ? <AdminRoles /> : <AdminMasterList />}
      </TabPanels>
    </PageContainer>
  );
}
