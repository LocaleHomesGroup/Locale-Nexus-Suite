"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, ArchiveRestore, CircleDot, History, MessagesSquare, Plus, SendHorizontal, Ticket as TicketIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { dashboardById } from "@/components/shell/dashboards";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { useCascading } from "@/components/ui/list-motion";
import type { ModuleId } from "@/state/launchpad-store";
import {
  ASSIGNEES,
  BOARD_OWNER,
  PRIORITY_STYLES,
  PROJECTS,
  PROJECT_BY_ID,
  STATUS_LABEL,
  TICKET_DASHBOARDS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  dashboardName,
  formatTicketNo,
  seatName,
  type Ticket,
  type TicketChange,
  type TicketEvent,
  type TicketPriority,
  type TicketReply,
} from "./data";
import { diffTicket, draftFromTicket, relativeTime, type TicketDraft } from "./logic";
import { StatusLabel } from "./TicketCard";

const NO_PROJECT = "none";
const UNASSIGNED = "unassigned";

export interface TicketDialogInitial {
  dashboard?: ModuleId | null;
  project?: string | null;
  raisedBy: string;
}

const blankDraft = (initial?: TicketDialogInitial): TicketDraft => ({
  title: "",
  details: "",
  dashboard: initial?.dashboard ?? "",
  project: initial?.project ?? null,
  priority: "medium",
  status: "todo",
  assignee: BOARD_OWNER,
});

/**
 * One dialog for "New ticket" and a ticket's details, after HRIS's
 * TicketDialog. New ticket is a narrow single column. Details goes wide: the
 * fields on the left, and on the right the replies and the history merged in
 * time order, with a reply box. An archived ticket opens read-only, with
 * Restore in place of Archive.
 */
export function TicketDialog({
  open,
  onClose,
  ticket,
  initial,
  onCreate,
  onSave,
  onReply,
  onArchive,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  /** null → New ticket. Otherwise the live ticket, so a reply shows at once. */
  ticket: Ticket | null;
  /** New ticket: the dashboard and project it starts on, and who raises it. */
  initial?: TicketDialogInitial;
  onCreate?: (draft: TicketDraft) => void;
  /** False when nothing changed. */
  onSave?: (no: number, draft: TicketDraft) => boolean;
  onReply?: (no: number, body: string) => void;
  onArchive?: (no: number) => void;
  onRestore?: (no: number) => void;
}) {
  const isCreate = ticket === null;
  const archived = Boolean(ticket?.archived);
  const readOnly = !isCreate && archived;
  const formId = React.useId();
  const [draft, setDraft] = React.useState<TicketDraft>(() => blankDraft(initial));
  const [confirmingArchive, setConfirmingArchive] = React.useState(false);
  // A second click while the dialog closes must not raise a second ticket.
  const submitted = React.useRef(false);

  // Reset when the dialog opens or switches ticket, not when the ticket changes
  // underneath it: a posted reply must not wipe a half-typed edit.
  const ticketRef = React.useRef(ticket);
  ticketRef.current = ticket;
  const initialRef = React.useRef(initial);
  initialRef.current = initial;
  const ticketNo = ticket?.no ?? null;
  React.useEffect(() => {
    if (!open) return;
    submitted.current = false;
    setConfirmingArchive(false);
    setDraft(ticketRef.current ? draftFromTicket(ticketRef.current) : blankDraft(initialRef.current));
  }, [open, ticketNo]);

  const set = <K extends keyof TicketDraft>(k: K, v: TicketDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = draft.title.trim() !== "" && draft.dashboard !== "";
  const dirty = ticket ? diffTicket(ticket, draft).length > 0 : false;
  const ready = valid && (isCreate || dirty);

  const submit = () => {
    if (!ready || readOnly || submitted.current) return;
    submitted.current = true;
    if (isCreate) onCreate?.(draft);
    else onSave?.(ticket.no, draft);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={isCreate ? Plus : TicketIcon}
      iconTone={isCreate ? "haven" : "charcoal"}
      size={isCreate ? "md" : "xl"}
      className={isCreate ? undefined : "md:h-[min(46rem,90dvh)]"}
      bodyClassName={
        isCreate ? undefined : "p-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] md:grid-rows-1 md:overflow-hidden"
      }
      title={
        isCreate ? (
          "New ticket"
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-sm font-medium text-muted-foreground">{formatTicketNo(ticket.no)}</span>
            <span className="min-w-0">{ticket.title}</span>
            {archived ? (
              <Pill tone="neutral" icon={Archive}>
                Archived
              </Pill>
            ) : null}
          </span>
        )
      }
      description={
        isCreate ? (
          <>
            Raised by <span className="font-medium text-foreground">{initial?.raisedBy}</span>. It lands in To Do, assigned to{" "}
            {seatName(BOARD_OWNER)} unless you pick someone else.
          </>
        ) : ticket.archived ? (
          <span suppressHydrationWarning>
            Archived {relativeTime(ticket.archived.at)} by {ticket.archived.by} · restore it to edit or reply
          </span>
        ) : (
          <span suppressHydrationWarning>
            Raised by {ticket.raisedBy} · {relativeTime(ticket.createdAt)} · in {STATUS_LABEL[ticket.status]}
          </span>
        )
      }
      footer={
        <>
          {!isCreate && !archived ? (
            <Button
              variant={confirmingArchive ? "destructive" : "outline"}
              className="mr-auto"
              onClick={() => {
                if (!confirmingArchive) return setConfirmingArchive(true);
                onArchive?.(ticket.no);
                onClose();
              }}
            >
              <Archive aria-hidden />
              {confirmingArchive ? "Confirm archive" : "Archive"}
            </Button>
          ) : null}
          {!isCreate && archived ? (
            <Button
              variant="outline"
              className="mr-auto"
              onClick={() => {
                onRestore?.(ticket.no);
                onClose();
              }}
            >
              <ArchiveRestore aria-hidden /> Restore
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            {readOnly || (!isCreate && !dirty) ? "Close" : "Cancel"}
          </Button>
          {!readOnly ? (
            <Button type="submit" form={formId} disabled={!ready}>
              {isCreate ? "Raise ticket" : "Save changes"}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={cn(!isCreate && "px-5 py-4 md:min-h-0 md:overflow-y-auto")}>
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <fieldset disabled={readOnly} className="grid min-w-0 gap-3.5">
            <legend className="sr-only">{isCreate ? "New ticket" : "Ticket details"}</legend>
            <Cascade i={0}>
              <Field label="Title" htmlFor={`${formId}-title`}>
                <Input
                  id={`${formId}-title`}
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Sales › Pipeline: drag cards on a phone"
                  autoComplete="off"
                  maxLength={140}
                  required
                  data-autofocus
                />
              </Field>
            </Cascade>

            <Cascade i={1}>
              <Field label="Details" htmlFor={`${formId}-details`} hint={isCreate ? "Optional. What's slow, missing or confusing, and what would help." : undefined}>
                <Textarea
                  id={`${formId}-details`}
                  value={draft.details}
                  onChange={(e) => set("details", e.target.value)}
                  placeholder="What happens now, and what you'd like instead…"
                  rows={isCreate ? 3 : 4}
                  maxLength={2000}
                  className="resize-y"
                />
              </Field>
            </Cascade>

            <Cascade i={2} className="grid gap-3 sm:grid-cols-2">
              <Field label="Dashboard" htmlFor={`${formId}-dash`}>
                <SmoothSelect
                  id={`${formId}-dash`}
                  value={draft.dashboard}
                  onChange={(v) => set("dashboard", v)}
                  placeholder="Choose a dashboard"
                  options={TICKET_DASHBOARDS.map((id) => ({ value: id, label: <DashboardOption id={id} /> }))}
                />
              </Field>
              <Field label="Project" htmlFor={`${formId}-project`}>
                <SmoothSelect
                  id={`${formId}-project`}
                  value={draft.project ?? NO_PROJECT}
                  onChange={(v) => set("project", v === NO_PROJECT ? null : v)}
                  options={[
                    { value: NO_PROJECT, label: "No project" },
                    ...PROJECTS.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </Field>
            </Cascade>

            <Cascade i={3}>
              <PriorityPicker value={draft.priority} onChange={(p) => set("priority", p)} disabled={readOnly} />
            </Cascade>

            <Cascade i={4} className={cn("grid gap-3", !isCreate && "sm:grid-cols-2")}>
              {!isCreate ? (
                <Field label="Column" htmlFor={`${formId}-status`}>
                  <SmoothSelect
                    id={`${formId}-status`}
                    value={draft.status}
                    onChange={(v) => set("status", v)}
                    options={TICKET_STATUSES.map((s) => ({ value: s, label: <StatusLabel status={s} /> }))}
                  />
                </Field>
              ) : null}
              <Field label="Assigned to" htmlFor={`${formId}-assignee`}>
                <SmoothSelect
                  id={`${formId}-assignee`}
                  value={draft.assignee ?? UNASSIGNED}
                  onChange={(v) => set("assignee", v === UNASSIGNED ? null : v)}
                  options={[
                    ...[...ASSIGNEES, ...(draft.assignee && !ASSIGNEES.includes(draft.assignee) ? [draft.assignee] : [])].map((id) => ({
                      value: id,
                      label: (
                        <span className="inline-flex items-center gap-2">
                          <Avatar name={seatName(id) ?? id} size="xs" />
                          {seatName(id)}
                        </span>
                      ),
                      hint: id === BOARD_OWNER ? "board owner" : undefined,
                    })),
                    { value: UNASSIGNED, label: "Unassigned" },
                  ]}
                />
              </Field>
            </Cascade>
          </fieldset>
        </form>
      </div>

      {!isCreate ? (
        <Cascade i={5} className="border-t border-hairline md:flex md:min-h-0 md:flex-col md:border-t-0 md:border-l md:bg-canvas/60">
          <ActivityRail ticket={ticket} onReply={(body) => onReply?.(ticket.no, body)} />
        </Cascade>
      ) : null}
    </Dialog>
  );
}

/** Fields arrive in a soft 40ms cascade each time the dialog opens (HRIS's ticket-field). */
function Cascade({ i, className, children }: { i: number; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("min-w-0", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.38, ease: EASE_SWAP, delay: reduce ? 0 : 0.07 + i * 0.04 }}
    >
      {children}
    </motion.div>
  );
}

function DashboardOption({ id }: { id: ModuleId }) {
  const Icon = dashboardById(id).icon;
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="size-3.5 text-subtle-foreground" aria-hidden />
      {dashboardName(id)}
    </span>
  );
}

/** HRIS's priority radio row: the chosen one fills with its colour and grows a touch. */
function PriorityPicker({
  value,
  onChange,
  disabled,
}: {
  value: TicketPriority;
  onChange: (p: TicketPriority) => void;
  disabled?: boolean;
}) {
  const labelId = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + TICKET_PRIORITIES.length) % TICKET_PRIORITIES.length;
    onChange(TICKET_PRIORITIES[n]);
    refs.current[n]?.focus();
  };
  return (
    <div className="space-y-1.5">
      <Label id={labelId}>Priority</Label>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-4 gap-1.5">
        {TICKET_PRIORITIES.map((p, i) => {
          const active = value === p;
          return (
            <button
              key={p}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(p)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium outline-none select-none",
                "transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out motion-reduce:transition-none",
                "focus-visible:ring-3 focus-visible:ring-ring/45 disabled:pointer-events-none disabled:opacity-60",
                active
                  ? cn("scale-[1.03] border-transparent shadow-xs motion-reduce:scale-100", PRIORITY_STYLES[p].chip)
                  : "border-input text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]",
              )}
            >
              <span className={cn("size-1.5 rounded-full", PRIORITY_STYLES[p].dot)} aria-hidden />
              {PRIORITY_STYLES[p].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Activity rail: replies + history ──────────────────────────────────── */

type FeedItem = { kind: "reply"; at: number; reply: TicketReply } | { kind: "event"; at: number; event: TicketEvent };

const clip = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function describeChange(c: TicketChange): string {
  switch (c.field) {
    case "title":
      return `renamed it “${clip(c.to ?? "")}”`;
    case "details":
      return c.to ? "edited the details" : "cleared the details";
    case "dashboard":
      return `moved it to ${dashboardName(c.to as ModuleId)}`;
    case "project":
      return c.to
        ? `added it to ${PROJECT_BY_ID[c.to]?.name ?? c.to}`
        : `took it out of ${PROJECT_BY_ID[c.from ?? ""]?.name ?? "its project"}`;
    case "priority":
      return `set priority ${PRIORITY_STYLES[c.from as TicketPriority]?.label ?? c.from} → ${PRIORITY_STYLES[c.to as TicketPriority]?.label ?? c.to}`;
    case "status":
      return `moved ${STATUS_LABEL[c.from as keyof typeof STATUS_LABEL] ?? c.from} → ${STATUS_LABEL[c.to as keyof typeof STATUS_LABEL] ?? c.to}`;
    case "assignee":
      return c.to ? `assigned it to ${seatName(c.to)}` : "unassigned it";
  }
}

function describeEvent(e: TicketEvent): string {
  switch (e.action) {
    case "created":
      return "raised this ticket";
    case "archived":
      return "archived this ticket";
    case "restored":
      return "restored this ticket";
    case "moved":
    case "updated":
      return (e.changes ?? []).map(describeChange).join(" · ") || "edited this ticket";
  }
}

/**
 * The ticket's replies and trail in one feed, oldest first: replies read as
 * chat entries, edits as compact system lines between them. The newest entry
 * stays in view. Enter sends; Shift+Enter adds a line; an empty reply sends nothing.
 */
function ActivityRail({ ticket, onReply }: { ticket: Ticket; onReply: (body: string) => void }) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const [draft, setDraft] = React.useState("");
  const listRef = React.useRef<HTMLOListElement>(null);
  const first = React.useRef(true);
  const archived = Boolean(ticket.archived);

  const feed = React.useMemo<FeedItem[]>(
    () =>
      [
        ...ticket.replies.map((r) => ({ kind: "reply" as const, at: r.at, reply: r })),
        ...ticket.history.map((e) => ({ kind: "event" as const, at: e.at, event: e })),
      ].sort((a, b) => a.at - b.at),
    [ticket.replies, ticket.history],
  );

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: first.current || reduce ? "auto" : "smooth" });
    first.current = false;
  }, [feed.length, reduce]);

  const send = () => {
    const body = draft.trim();
    if (!body || archived) return;
    onReply(body);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-col gap-2.5 px-5 py-4 md:h-full md:px-4">
      <div className="flex items-center gap-1.5">
        <MessagesSquare className="size-3.5 text-subtle-foreground" aria-hidden />
        <h3 className="text-xs font-semibold text-foreground">
          Replies{ticket.replies.length ? <span className="text-muted-foreground"> ({ticket.replies.length})</span> : null}
        </h3>
        <span className="ml-auto flex items-center gap-1 text-xs text-subtle-foreground">
          <History className="size-3" aria-hidden />
          history included
        </span>
      </div>

      <ol
        ref={listRef}
        aria-label="Replies and history"
        className="flex max-h-72 min-h-0 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin] md:max-h-none md:flex-1"
      >
        <AnimatePresence initial={false}>
          {feed.map((item, i) => (
            <motion.li
              key={item.kind === "reply" ? item.reply.id : item.event.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: cascading ? rowDelay(i, reduce, 0.03) : 0 }}
            >
              {item.kind === "reply" ? (
                <div className="flex gap-2">
                  <Avatar name={item.reply.author} size="xs" className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className="font-semibold">{item.reply.author}</span>
                      <span className="ml-1.5 text-subtle-foreground" suppressHydrationWarning>
                        {relativeTime(item.reply.at)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap">{item.reply.body}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
                  <CircleDot className="mt-0.5 size-3 shrink-0 text-subtle-foreground/70" aria-hidden />
                  <p className="min-w-0 break-words">
                    <span className="font-medium text-foreground/80">{item.event.actor}</span> {describeEvent(item.event)}
                    <span className="ml-1.5 text-subtle-foreground" suppressHydrationWarning>
                      {relativeTime(item.event.at)}
                    </span>
                  </p>
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      <div className="flex items-end gap-1.5 border-t border-hairline pt-2.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={2000}
          disabled={archived}
          placeholder={archived ? "Archived. Restore it to reply." : "Reply… (Shift+Enter for a new line)"}
          aria-label={`Reply on ${formatTicketNo(ticket.no)}`}
          className="min-h-14 resize-none text-[13px]"
        />
        <Button size="icon" aria-label="Send reply" disabled={!draft.trim() || archived} onClick={send}>
          <SendHorizontal />
        </Button>
      </div>
    </div>
  );
}
