"use client";

import { useTabParam } from "@/hooks/useTabParam";
import { usePortal } from "@/state/portal-store";
import { useNavBadge } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { useClientJob } from "./parts";
import { ClientOverview } from "./ClientOverview";
import { ClientFinance } from "./ClientFinance";
import { MyOptions } from "./MyOptions";
import { MyBuild } from "./MyBuild";
import { ClientDocuments } from "./ClientDocuments";
import { ClientMessages } from "./ClientMessages";

const TABS = ["overview", "finance", "options", "build", "documents", "messages"] as const;

/**
 * The Client portal — what a Locale buyer sees, from the client-journey
 * meeting (docs/Meeting1.md): one place to follow their home from enquiry to
 * keys, with the builders they were matched to, their finance, the build as
 * it happens, their documents and one thread for everyone on the build.
 *
 * Staff preview it as R. de Thierry and J. Kumar (job 25431). Its milestones
 * are the job's own, so a milestone Operations syncs moves this page too, and
 * the builder's site updates arrive from the Developer portal.
 */
export function ClientScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  const { job } = useClientJob();
  const { messages, unread } = usePortal();
  const unreadCount = messages.filter((m) => m.jobId === job.id && unread.has(m.id)).length;
  useNavBadge("client:messages", { count: unreadCount, label: "unread" });

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "overview" ? (
          <ClientOverview />
        ) : tab === "finance" ? (
          <ClientFinance />
        ) : tab === "options" ? (
          <MyOptions />
        ) : tab === "build" ? (
          <MyBuild />
        ) : tab === "documents" ? (
          <ClientDocuments />
        ) : (
          <ClientMessages />
        )}
      </TabPanels>
    </PageContainer>
  );
}
