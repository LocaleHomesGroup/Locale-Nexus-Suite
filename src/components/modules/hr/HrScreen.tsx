"use client";

import * as React from "react";
import { useTabParam } from "@/hooks/useTabParam";
import { useNavBadge } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { HR_TABS, type HrTab } from "./data";
import { useLeave } from "./leave-store";
import { HrOverviewTab } from "./tabs/HrOverviewTab";
import { HrMasterListTab } from "./tabs/HrMasterListTab";
import { HrAttendanceTab } from "./tabs/HrAttendanceTab";
import { HrLeaveTab } from "./tabs/HrLeaveTab";
import { HrRecruitmentTab } from "./tabs/HrRecruitmentTab";
import { HrPerformanceTab } from "./tabs/HrPerformanceTab";
import { HrAssetsTab } from "./tabs/HrAssetsTab";

/**
 * HR — the mockup's `xm`: Horilla mirrored into seven sections, listed in the
 * HR rail. The leave queue lives in `leave-store.ts` (not in the Leave
 * section) so a decision survives a section switch, the rail's Leave count
 * stays in step, and Home's My day and Jarvis read the same queue.
 */
export function HrScreen() {
  const [tab, setTab, dir] = useTabParam(HR_TABS, "overview");
  const { requests } = useLeave();

  // Amber on the rail: these requests are waiting on a decision. A decision in
  // its undo window still counts: nothing has been sent yet.
  const pending = requests.filter((r) => r.status === "Pending").length;
  useNavBadge("hr:leave", { count: pending, tone: "pending", label: "awaiting approval" });

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        <TabBody tab={tab} goTab={setTab} />
      </TabPanels>
    </PageContainer>
  );
}

function TabBody({ tab, goTab }: { tab: HrTab; goTab: (tab: HrTab) => void }) {
  switch (tab) {
    case "overview":
      return <HrOverviewTab goTab={goTab} />;
    case "people":
      return <HrMasterListTab />;
    case "attendance":
      return <HrAttendanceTab />;
    case "leave":
      return <HrLeaveTab />;
    case "recruitment":
      return <HrRecruitmentTab />;
    case "performance":
      return <HrPerformanceTab />;
    case "assets":
      return <HrAssetsTab />;
  }
}
