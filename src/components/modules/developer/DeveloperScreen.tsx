"use client";

import { useTabParam } from "@/hooks/useTabParam";
import { awaitingAcceptance } from "@/data/journey";
import { useNavBadge } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { useDeveloperJobs } from "./parts";
import { DeveloperOverview } from "./DeveloperOverview";
import { DeveloperClients } from "./DeveloperClients";
import { ClientUpdates } from "./ClientUpdates";
import { MatchInsights } from "./MatchInsights";
import { DesignsPricing } from "./DesignsPricing";
import { TermsRequirements } from "./TermsRequirements";

const TABS = ["overview", "clients", "updates", "insights", "products", "terms"] as const;

/**
 * The Developer portal — what a building company Locale sells for sees, from
 * the client-journey meeting (docs/Meeting1.md): Locale as the distribution
 * channel for builders, "a really great result for the building companies".
 * Its Locale clients and who has the next move, a way to keep those clients
 * in the loop, how its packages rank in Locale's recorded consultations ("this
 * is your weakness"), its designs and prices, and the terms and paperwork
 * Locale's consultants work to.
 *
 * Staff preview it as Forma. Its clients are the shared jobs, so accepting a
 * job here ticks Builder Acceptance in Operations too.
 */
export function DeveloperScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  const awaiting = useDeveloperJobs().filter((d) => awaitingAcceptance(d.job)).length;
  useNavBadge("developer:clients", { count: awaiting, tone: "pending", label: "awaiting your acceptance" });

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "overview" ? (
          <DeveloperOverview />
        ) : tab === "clients" ? (
          <DeveloperClients />
        ) : tab === "updates" ? (
          <ClientUpdates />
        ) : tab === "insights" ? (
          <MatchInsights />
        ) : tab === "products" ? (
          <DesignsPricing />
        ) : (
          <TermsRequirements />
        )}
      </TabPanels>
    </PageContainer>
  );
}
