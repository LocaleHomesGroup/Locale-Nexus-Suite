"use client";

import { useTabParam } from "@/hooks/useTabParam";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { CrmDashSync } from "./jobs/CrmDashSync";
import { InboundCapture } from "./inbound/InboundCapture";
import { ReviewQueueScreen } from "./review/ReviewQueueScreen";
import { AuditLogScreen } from "./audit/AuditLogScreen";
import { SubmissionReview } from "./submissions/SubmissionReview";
import { PricingTab } from "./pricing/PricingTab";
import { HomeScopePricing } from "./homescope/HomeScopePricing";
import { DocFormatter } from "./formatter/DocFormatter";
import { OperationsOverview } from "./OperationsOverview";

/** Operations — one section per rail item (`?tab=`), never a strip in the page. */
// The sections are listed in the Operations rail (src/components/shell/dashboards.ts).
const TABS = ["overview", "jobs", "review", "audit", "submissions", "pricing", "homescope", "formatter"] as const;
/** CRM dash sync's own views: the job list, or the Inbound capture preview nested under it. */
const JOB_VIEWS = ["list", "inbound"] as const;

export function OperationsScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  const [jobView] = useTabParam(JOB_VIEWS, "list", "view");
  const inbound = tab === "jobs" && jobView === "inbound";

  return (
    <PageContainer>
      <TabPanels value={inbound ? "jobs:inbound" : tab} dir={dir}>
        {tab === "overview" ? (
          <OperationsOverview />
        ) : inbound ? (
          <InboundCapture />
        ) : tab === "jobs" ? (
          <CrmDashSync />
        ) : tab === "review" ? (
          <ReviewQueueScreen />
        ) : tab === "audit" ? (
          <AuditLogScreen />
        ) : tab === "submissions" ? (
          <SubmissionReview />
        ) : tab === "pricing" ? (
          <PricingTab />
        ) : tab === "homescope" ? (
          <HomeScopePricing />
        ) : (
          <DocFormatter />
        )}
      </TabPanels>
    </PageContainer>
  );
}
