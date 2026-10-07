"use client";

import * as React from "react";
import { useTabParam } from "@/hooks/useTabParam";
import { useNavReselect } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { SalesViewProvider, TEAM_SCOPE } from "./sales-state";
import { Pipeline } from "./pipeline/Pipeline";
import { MyClients } from "./clients/MyClients";
import { UnderConstruction } from "./build/UnderConstruction";
import { ExclusiveLand } from "./land/ExclusiveLand";
import { Team } from "./team/Team";
import { MyWeek } from "./week/MyWeek";
import { RapidCosting } from "./costing/RapidCosting";
import { DealSubmissions } from "./submissions/DealSubmissions";
import { SalesOverview } from "./SalesOverview";

const TABS = ["overview", "pipeline", "clients", "week", "build", "costing", "submissions", "land", "team"] as const;

/**
 * Sales — the mockup's `gm`: an Overview (the default) and eight sections in `?tab=`,
 * listed in the Sales rail along with the "Open HomeScope" link. Each pane
 * renders its own PageHeader. Rapid costing, My week and My Deal Submissions
 * are built in their folders.
 */
export function SalesScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  // The mockup's tab setter also cleared the open submission (`f(null)`).
  // Switching sections remounts the pane, which does that; re-clicking the
  // section that is showing (in the rail) bumps this so a pane can reset
  // itself too (useSalesTabReselect).
  const [reselect, setReselect] = React.useState(0);
  useNavReselect("sales:", () => setReselect((n) => n + 1));

  return (
    <SalesViewProvider scope={TEAM_SCOPE} reselect={reselect}>
      <PageContainer>
        <TabPanels value={tab} dir={dir}>
          {tab === "overview" ? (
            <SalesOverview />
          ) : tab === "pipeline" ? (
            <Pipeline />
          ) : tab === "clients" ? (
            <MyClients />
          ) : tab === "week" ? (
            <MyWeek />
          ) : tab === "build" ? (
            <UnderConstruction />
          ) : tab === "costing" ? (
            <RapidCosting />
          ) : tab === "submissions" ? (
            <DealSubmissions />
          ) : tab === "land" ? (
            <ExclusiveLand />
          ) : (
            <Team />
          )}
        </TabPanels>
      </PageContainer>
    </SalesViewProvider>
  );
}
