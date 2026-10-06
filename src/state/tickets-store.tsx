"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirm, useLaunchpad, type ModuleId } from "@/state/launchpad-store";
import {
  BOARD_ACTOR,
  BOARD_OWNER,
  dashboardName,
  formatTicketNo,
  seedTickets,
  type Ticket,
  type TicketEvent,
  type TicketStatus,
} from "@/components/modules/tickets/data";
import { diffTicket, nextTicketNo, type TicketDraft } from "@/components/modules/tickets/logic";
import { TicketDialog } from "@/components/modules/tickets/TicketDialog";

/**
 * The Tickets board's state: every ticket, the writes that change them, and
 * the "New ticket" dialog, which any dashboard's rail can open. It sits in the
 * dashboard layout (inside the Launchpad store, because a new ticket lands in
 * the inbox), so a ticket raised on Sales is on the board when you get there,
 * and Jarvis reads the same list.
 *
 * Every write appends to the ticket's history, as HRIS's `ticket_events`.
 * Writes apply at once: the board is the Launchpad's own, nothing leaves it.
 * Static: a reload resets to the seed.
 */

export interface NewTicketOptions {
  /** The dashboard it starts on. Null on Tickets itself. */
  dashboard?: ModuleId | null;
  project?: string | null;
  /** Who the rail shows: the staff persona, or the previewed employee. */
  raisedBy: string;
}

interface TicketsStore {
  tickets: Ticket[];
  /** Opens "New ticket" over the current page. */
  openNewTicket: (opts: NewTicketOptions) => void;
  /** False when nothing changed. */
  saveTicket: (no: number, draft: TicketDraft) => boolean;
  moveTicket: (no: number, to: TicketStatus) => void;
  replyTicket: (no: number, body: string) => void;
  archiveTicket: (no: number) => void;
  restoreTicket: (no: number) => void;
}

const Ctx = React.createContext<TicketsStore | null>(null);

export function useTickets(): TicketsStore {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useTickets must be used inside <TicketsProvider>");
  return ctx;
}

let eventSeq = 0;
const eventId = (no: number) => `${no}-e${Date.now().toString(36)}${(eventSeq++).toString(36)}`;

export function TicketsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { notify } = useLaunchpad();
  // Stamped when the store is created, so ages and "this week" stay meaningful whenever it runs.
  const [tickets, setTickets] = React.useState<Ticket[]>(() => seedTickets(Date.now()));
  // The latest list, for numbering: two raises in one tick still get two numbers.
  const latest = React.useRef(tickets);
  latest.current = tickets;

  const [newTicket, setNewTicket] = React.useState<{ open: boolean; opts: NewTicketOptions }>({
    open: false,
    opts: { raisedBy: BOARD_ACTOR },
  });

  const update = React.useCallback((no: number, fn: (t: Ticket) => Ticket) => {
    const next = latest.current.map((t) => (t.no === no ? fn(t) : t));
    latest.current = next;
    setTickets(next);
  }, []);

  const createTicket = React.useCallback(
    (draft: TicketDraft, raisedBy: string) => {
      if (!draft.title.trim() || !draft.dashboard) return;
      const no = nextTicketNo(latest.current);
      const at = Date.now();
      const ticket: Ticket = {
        no,
        title: draft.title.trim(),
        details: draft.details.trim(),
        dashboard: draft.dashboard,
        project: draft.project,
        priority: draft.priority,
        status: "todo",
        raisedBy,
        assignee: draft.assignee ?? BOARD_OWNER,
        createdAt: at,
        updatedAt: at,
        archived: null,
        replies: [],
        history: [{ id: eventId(no), actor: raisedBy, at, action: "created" }],
      };
      const next = [...latest.current, ticket];
      latest.current = next;
      setTickets(next);
      const where = dashboardName(ticket.dashboard);
      toast.success(`${formatTicketNo(no)} raised for ${where}`, {
        description: ticket.title,
        action: { label: "View", onClick: () => router.push(`/tickets?tab=board&ticket=${no}`) },
      });
      notify(`New ticket ${formatTicketNo(no)} · ${where}: ${ticket.title}`);
    },
    [notify, router],
  );

  const saveTicket = React.useCallback(
    (no: number, draft: TicketDraft) => {
      const t = latest.current.find((x) => x.no === no);
      if (!t || t.archived) return false;
      const changes = diffTicket(t, draft);
      if (!changes.length) return false;
      const at = Date.now();
      const event: TicketEvent = {
        id: eventId(no),
        actor: BOARD_ACTOR,
        at,
        action: changes.every((c) => c.field === "status") ? "moved" : "updated",
        changes,
      };
      update(no, (x) => ({
        ...x,
        title: draft.title.trim(),
        details: draft.details.trim(),
        dashboard: draft.dashboard || x.dashboard,
        project: draft.project,
        priority: draft.priority,
        status: draft.status,
        assignee: draft.assignee,
        updatedAt: at,
        history: [...x.history, event],
      }));
      confirm(`${formatTicketNo(no)} saved`, `${changes.length} ${changes.length === 1 ? "change" : "changes"} · in its history`);
      return true;
    },
    [update],
  );

  const moveTicket = React.useCallback(
    (no: number, to: TicketStatus) => {
      const t = latest.current.find((x) => x.no === no);
      if (!t || t.archived || t.status === to) return;
      const at = Date.now();
      update(no, (x) => ({
        ...x,
        status: to,
        updatedAt: at,
        history: [
          ...x.history,
          { id: eventId(no), actor: BOARD_ACTOR, at, action: "moved", changes: [{ field: "status", from: x.status, to }] },
        ],
      }));
    },
    [update],
  );

  const replyTicket = React.useCallback(
    (no: number, body: string) => {
      const text = body.trim();
      const t = latest.current.find((x) => x.no === no);
      if (!text || !t || t.archived) return;
      const at = Date.now();
      update(no, (x) => ({
        ...x,
        updatedAt: at,
        replies: [...x.replies, { id: `${no}-r${Date.now().toString(36)}${(eventSeq++).toString(36)}`, author: BOARD_ACTOR, body: text, at }],
      }));
    },
    [update],
  );

  const archiveTicket = React.useCallback(
    (no: number) => {
      const t = latest.current.find((x) => x.no === no);
      if (!t || t.archived) return;
      const at = Date.now();
      update(no, (x) => ({
        ...x,
        archived: { at, by: BOARD_ACTOR },
        updatedAt: at,
        history: [...x.history, { id: eventId(no), actor: BOARD_ACTOR, at, action: "archived" }],
      }));
      confirm(`${formatTicketNo(no)} archived`, "Off the board · restore it from Archived");
    },
    [update],
  );

  const restoreTicket = React.useCallback(
    (no: number) => {
      const t = latest.current.find((x) => x.no === no);
      if (!t?.archived) return;
      const at = Date.now();
      update(no, (x) => ({
        ...x,
        archived: null,
        updatedAt: at,
        history: [...x.history, { id: eventId(no), actor: BOARD_ACTOR, at, action: "restored" }],
      }));
      confirm(`${formatTicketNo(no)} restored`, `Back on the board in ${t.status === "done" ? "Done" : "its column"}`);
    },
    [update],
  );

  const openNewTicket = React.useCallback((opts: NewTicketOptions) => setNewTicket({ open: true, opts }), []);

  const value = React.useMemo<TicketsStore>(
    () => ({ tickets, openNewTicket, saveTicket, moveTicket, replyTicket, archiveTicket, restoreTicket }),
    [tickets, openNewTicket, saveTicket, moveTicket, replyTicket, archiveTicket, restoreTicket],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* "New ticket", mounted once for every dashboard. */}
      <TicketDialog
        open={newTicket.open}
        onClose={() => setNewTicket((s) => ({ ...s, open: false }))}
        ticket={null}
        initial={newTicket.opts}
        onCreate={(draft) => createTicket(draft, newTicket.opts.raisedBy)}
      />
    </Ctx.Provider>
  );
}
