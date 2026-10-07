"use client";

import * as React from "react";
import { useTabParam } from "@/hooks/useTabParam";
import { useNavBadge, useNavReselect } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { CURRENT_REP } from "../sales/data";
import { SalesViewProvider, type SalesScope } from "../sales/sales-state";
import { Pipeline } from "../sales/pipeline/Pipeline";
import { MyClients } from "../sales/clients/MyClients";
import { MyWeek } from "../sales/week/MyWeek";
import { DealSubmissions } from "../sales/submissions/DealSubmissions";
import { ConsultantOverview } from "./ConsultantOverview";
import { MyProgress } from "./MyProgress";
import { useChangesRequested } from "./use-changes-requested";

const TABS = ["overview", "pipeline", "clients", "week", "progress", "submissions"] as const;

/** One consultant's Sales. A module constant, so the view context stays the same object. */
const SCOPE: SalesScope = { kind: "rep", rep: CURRENT_REP };

/**
 * The Sales portal: one consultant's own Sales, where the Sales dashboard is
 * the team's. My pipeline, My clients, My week and My Deal Submissions are the
 * Sales sections in the rep's scope, on the same store as the dashboard; the
 * Overview and My progress are the portal's own.
 *
 * Staff preview it as A. Mercer, the rep the rest of the prototype uses.
 */
export function ConsultantScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  const [reselect, setReselect] = React.useState(0);
  useNavReselect("consultant:", () => setReselect((n) => n + 1));
  const changes = useChangesRequested();
  useNavBadge("consultant:submissions", {
    count: changes,
    tone: "pending",
    label: changes === 1 ? "submission sent back" : "submissions sent back",
  });

  return (
    <SalesViewProvider scope={SCOPE} reselect={reselect}>
      <PageContainer>
        <TabPanels value={tab} dir={dir}>
          {tab === "overview" ? (
            <ConsultantOverview />
          ) : tab === "pipeline" ? (
            <Pipeline />
          ) : tab === "clients" ? (
            <MyClients />
          ) : tab === "week" ? (
            <MyWeek />
          ) : tab === "progress" ? (
            <MyProgress />
          ) : (
            <DealSubmissions />
          )}
        </TabPanels>
      </PageContainer>
    </SalesViewProvider>
  );
}
