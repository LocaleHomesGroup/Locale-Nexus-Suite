"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { RapidCosting } from "./costing/RapidCosting";
import { SalesOverview } from "./SalesOverview";
import { portalHrefFor } from "./moved-tabs";

const TABS = ["overview", "pipeline", "clients", "build", "costing", "land", "team"] as const;

/**
 * Sales: the team's view. An Overview (the default) and six sections in
 * `?tab=`, listed in the Sales rail with the "Open HomeScope" link. Each pane
 * renders its own PageHeader. A consultant's own Sales (My week, My Deal
 * Submissions, and the board and clients in their scope) is the Sales portal,
 * modules/consultant.
 */
export function SalesScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  // My week and My Deal Submissions moved to the portal: an old link follows them.
  const params = useSearchParams();
  const router = useRouter();
  const moved = portalHrefFor(params.get("tab"));
  React.useEffect(() => {
    if (moved) router.replace(moved);
  }, [moved, router]);

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
          ) : tab === "build" ? (
            <UnderConstruction />
          ) : tab === "costing" ? (
            <RapidCosting />
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
