"use client";

import * as React from "react";
import { toast } from "sonner";
import { useTabParam } from "@/hooks/useTabParam";
import { useNavBadge } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { useTickets } from "@/state/tickets-store";
import { TICKETS_TABS, formatTicketNo } from "./data";
import { TicketDialog } from "./TicketDialog";
import { TicketsOverview } from "./TicketsOverview";
import { TicketsBoard } from "./TicketsBoard";
import { TicketsProjects } from "./TicketsProjects";
import { TicketsArchived } from "./TicketsArchived";
import { useTicketParams } from "./use-ticket-params";

/**
 * Tickets: Simple HRIS's developer board as a Launchpad dashboard. Overview,
 * the Board, the Projects (once their own dashboard, now groups of tickets)
 * and Archived, in the rail. `?ticket=` opens a ticket over any of them.
 */
export function TicketsScreen() {
  const [tab, , dir] = useTabParam(TICKETS_TABS, "overview");
  const { tickets, saveTicket, replyTicket, archiveTicket, restoreTicket } = useTickets();
  const params = useTicketParams();

  // Amber on the rail: urgent tickets still open.
  const urgent = tickets.filter((t) => !t.archived && t.status !== "done" && t.priority === "urgent").length;
  useNavBadge("tickets:board", { count: urgent, tone: "pending", label: urgent === 1 ? "urgent ticket open" : "urgent tickets open" });

  // The open ticket. The last one stays mounted while the dialog animates out.
  const requested = params.ticket;
  const found = requested != null && !Number.isNaN(requested) ? tickets.find((t) => t.no === requested) : undefined;
  const [shownNo, setShownNo] = React.useState<number | null>(null);
  if (found && found.no !== shownNo) setShownNo(found.no);
  const shown = shownNo != null ? (tickets.find((t) => t.no === shownNo) ?? null) : null;

  // A number that doesn't exist says so and clears itself, rather than opening an empty dialog.
  const { closeTicket } = params;
  const reported = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (requested == null || found) {
      reported.current = null;
      return;
    }
    // Once per bad link, even when the effect runs twice (Strict Mode) or the URL is slow to clear.
    if (reported.current !== String(requested)) {
      reported.current = String(requested);
      toast.error(Number.isNaN(requested) ? "That isn't a ticket number" : `There's no ticket ${formatTicketNo(requested)}`);
    }
    closeTicket();
  }, [requested, found, closeTicket]);

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "overview" ? (
          <TicketsOverview />
        ) : tab === "board" ? (
          <TicketsBoard />
        ) : tab === "projects" ? (
          <TicketsProjects />
        ) : (
          <TicketsArchived />
        )}
      </TabPanels>

      {shown ? (
        <TicketDialog
          open={Boolean(found)}
          onClose={closeTicket}
          ticket={shown}
          onSave={saveTicket}
          onReply={replyTicket}
          onArchive={archiveTicket}
          onRestore={restoreTicket}
        />
      ) : null}
    </PageContainer>
  );
}
