"use client";

import { useTabParam } from "@/hooks/useTabParam";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { CrmDashSync } from "./jobs/CrmDashSync";
import { SubmissionReview } from "./submissions/SubmissionReview";
import { PricingTab } from "./pricing/PricingTab";
import { DocFormatter } from "./formatter/DocFormatter";

/** Operations — tab ids, labels and default exactly as the mockup (`?tab=`). */
// The four sections are listed in the Operations rail (src/components/shell/dashboards.ts),
// never as a strip in the page.
const TABS = ["jobs", "submissions", "pricing", "formatter"] as const;

export function OperationsScreen() {
  const [tab, , dir] = useTabParam(TABS, "jobs");

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "jobs" ? (
          <CrmDashSync />
        ) : tab === "submissions" ? (
          <SubmissionReview />
        ) : tab === "pricing" ? (
          <PricingTab />
        ) : (
          <DocFormatter />
        )}
      </TabPanels>
    </PageContainer>
  );
}
