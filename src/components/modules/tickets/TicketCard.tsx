"use client";

import { FolderKanban, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { dashboardById } from "@/components/shell/dashboards";
import { Avatar } from "@/components/ui/avatar";
import type { ModuleId } from "@/state/launchpad-store";
import {
  PRIORITY_STYLES,
  PROJECT_BY_ID,
  STATUS_FILL,
  STATUS_LABEL,
  dashboardName,
  formatTicketNo,
  seatName,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from "./data";
import { ageLabel } from "./logic";

/**
 * The ticket's look, after HRIS's TicketCard: the card on the board and the
 * drag overlay, plus the chips the dialog, the Overview and Archived reuse, so
 * a priority or a column wears the same colour everywhere.
 */

const CHIP = "inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium";

export function PriorityChip({ priority, className }: { priority: TicketPriority; className?: string }) {
  const p = PRIORITY_STYLES[priority];
  return (
    <span className={cn(CHIP, p.chip, className)}>
      <span className={cn("size-1.5 rounded-full", p.dot)} aria-hidden />
      {p.label}
      <span className="sr-only"> priority</span>
    </span>
  );
}

/** A column's dot and name: "● In Progress". */
export function StatusLabel({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", STATUS_FILL[status])} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** The dashboard a ticket improves, with that dashboard's icon. */
export function DashboardChip({ id, className }: { id: ModuleId; className?: string }) {
  const Icon = dashboardById(id).icon;
  return (
    <span className={cn(CHIP, "bg-muted text-muted-foreground", className)} title={`Dashboard: ${dashboardName(id)}`}>
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{dashboardName(id)}</span>
    </span>
  );
}

export function ProjectChip({ id, className }: { id: string; className?: string }) {
  const p = PROJECT_BY_ID[id];
  if (!p) return null;
  return (
    <span className={cn(CHIP, "bg-tone-soft text-tone-ink", className)} title={`Project: ${p.name}`}>
      <FolderKanban className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">Project: </span>
      <span className="truncate">{p.name}</span>
    </span>
  );
}

/** Who it's assigned to: avatar and first name. */
export function AssigneeChip({ seat, className }: { seat: string | null; className?: string }) {
  const name = seatName(seat);
  if (!name) return <span className={cn(CHIP, "bg-muted text-subtle-foreground", className)}>Unassigned</span>;
  return (
    <span className={cn(CHIP, "border border-border bg-card pl-0.5 text-foreground", className)} title={`Assigned to ${name}`}>
      <Avatar name={name} size="xs" className="size-4 text-[10px]" />
      <span className="sr-only">Assigned to </span>
      <span className="truncate">{name.split(" ")[0]}</span>
    </span>
  );
}

/**
 * The card's surface. The board puts it on a button (or on the drag overlay,
 * lifted, with no hover states), so one look serves both.
 */
export function ticketCardClass({ ghosted = false, overlay = false }: { ghosted?: boolean; overlay?: boolean }) {
  return cn(
    "group/card relative block w-full rounded-lg border border-border bg-card p-3 text-left shadow-xs outline-none select-none",
    "transition-[translate,box-shadow,opacity,border-color] duration-150 ease-out motion-reduce:transition-none",
    "focus-visible:ring-3 focus-visible:ring-ring/45",
    !overlay &&
      "cursor-pointer hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md motion-reduce:hover:translate-y-0 md:cursor-grab md:active:cursor-grabbing",
    ghosted && "opacity-40",
    overlay && "cursor-grabbing border-tone-line shadow-xl shadow-black/15 ring-1 ring-tone-line dark:shadow-black/50",
  );
}

/** Number and priority, title and details, where and who, then who raised it, replies and age. */
export function TicketCardBody({ ticket }: { ticket: Ticket }) {
  const replies = ticket.replies.length;
  return (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium text-muted-foreground">{formatTicketNo(ticket.no)}</span>
        <PriorityChip priority={ticket.priority} />
      </span>

      <span className="mt-1.5 line-clamp-2 text-sm leading-snug font-medium text-foreground">{ticket.title}</span>
      {ticket.details ? (
        <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{ticket.details}</span>
      ) : null}

      <span className="mt-2 flex flex-wrap gap-1">
        <DashboardChip id={ticket.dashboard} />
        {ticket.project ? <ProjectChip id={ticket.project} className="max-w-[12rem]" /> : null}
        <AssigneeChip seat={ticket.assignee} />
      </span>

      <span className="mt-2.5 flex items-center gap-1.5">
        <Avatar name={ticket.raisedBy} size="xs" />
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          <span className="sr-only">Raised by </span>
          {ticket.raisedBy}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-subtle-foreground">
          {replies > 0 ? (
            <span className="flex items-center gap-0.5" title={`${replies} ${replies === 1 ? "reply" : "replies"}`}>
              <MessageSquare className="size-3" aria-hidden />
              {replies}
              <span className="sr-only"> {replies === 1 ? "reply" : "replies"}</span>
            </span>
          ) : null}
          <span suppressHydrationWarning className="tabular-nums" title="Open for">
            {ageLabel(ticket.createdAt)}
          </span>
        </span>
      </span>
    </>
  );
}
