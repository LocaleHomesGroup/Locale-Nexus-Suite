"use client";

import { useTabParam } from "@/hooks/useTabParam";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { BusinessDashboard } from "./BusinessDashboard";
import { CustomDashboard } from "./CustomDashboard";
import { useCustomDashboard } from "./useCustomDashboard";
import { LEADERSHIP_TABS } from "./data";

/**
 * Leadership (the mockup's `wm`): a real-time Business dashboard and a
 * self-serve Custom dashboard with Jarvis. The tab lives in `?tab=`.
 */
export function LeadershipScreen() {
  // Both views are listed in the Leadership rail, not as a strip in the page.
  const [tab, , dir] = useTabParam(LEADERSHIP_TABS, "overview");
  const custom = useCustomDashboard();

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "custom" ? <CustomDashboard state={custom} /> : <BusinessDashboard />}
      </TabPanels>
    </PageContainer>
  );
}
