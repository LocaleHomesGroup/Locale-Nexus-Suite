"use client";

import * as React from "react";
import { toast } from "sonner";
import { useTabParam } from "@/hooks/useTabParam";
import { useNavBadge } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { HR_TABS, LEAVE_SEED, type HrTab, type LeaveRequest, type LeaveStatus } from "./data";
import { HrDashboardTab } from "./tabs/HrDashboardTab";
import { HrEmployeesTab } from "./tabs/HrEmployeesTab";
import { HrAttendanceTab } from "./tabs/HrAttendanceTab";
import { HrLeaveTab } from "./tabs/HrLeaveTab";
import { HrRecruitmentTab } from "./tabs/HrRecruitmentTab";
import { HrPerformanceTab } from "./tabs/HrPerformanceTab";
import { HrAssetsTab } from "./tabs/HrAssetsTab";

/**
 * HR — the mockup's `xm`: Horilla mirrored into seven sections, listed in the
 * HR rail. The leave queue is held here (not in the Leave section) so a
 * decision survives a section switch and the rail's Leave count stays in step,
 * as the mockup's `xm` held it.
 */
export function HrScreen() {
  const [tab, setTab, dir] = useTabParam(HR_TABS, "dashboard");
  const [leave, setLeave] = React.useState<LeaveRequest[]>(LEAVE_SEED);

  const pending = leave.filter((r) => r.status === "Pending").length;
  // Amber on the rail: these requests are waiting on a decision.
  useNavBadge("hr:leave", { count: pending, tone: "pending", label: "awaiting approval" });

  const setStatus = React.useCallback((id: string, status: LeaveStatus) => {
    setLeave((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }, []);

  const decide = React.useCallback(
    (req: LeaveRequest, status: Exclude<LeaveStatus, "Pending">) => {
      setStatus(req.id, status);
      const verb = status === "Approved" ? "approved" : "declined";
      toast.success(`Leave ${verb} — ${req.name}, ${req.when}`, {
        description: "Horilla and Xero updated via the live leave workflow.",
        action: { label: "Undo", onClick: () => setStatus(req.id, "Pending") },
      });
    },
    [setStatus],
  );

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        <TabBody tab={tab} leave={leave} onDecide={decide} goTab={setTab} />
      </TabPanels>
    </PageContainer>
  );
}

function TabBody({
  tab,
  leave,
  onDecide,
  goTab,
}: {
  tab: HrTab;
  leave: LeaveRequest[];
  onDecide: (req: LeaveRequest, status: Exclude<LeaveStatus, "Pending">) => void;
  goTab: (tab: HrTab) => void;
}) {
  switch (tab) {
    case "dashboard":
      return <HrDashboardTab goTab={goTab} />;
    case "people":
      return <HrEmployeesTab />;
    case "attendance":
      return <HrAttendanceTab />;
    case "leave":
      return <HrLeaveTab requests={leave} onDecide={onDecide} />;
    case "recruitment":
      return <HrRecruitmentTab />;
    case "performance":
      return <HrPerformanceTab />;
    case "assets":
      return <HrAssetsTab />;
  }
}
