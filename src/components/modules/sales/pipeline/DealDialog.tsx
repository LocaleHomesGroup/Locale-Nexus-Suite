"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Archive,
  ArchiveRestore,
  Briefcase,
  CircleDot,
  ExternalLink,
  History,
  MessagesSquare,
  Plus,
  SendHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { SyncBadge } from "@/components/ui/sync-badge";
import { useCascading } from "@/components/ui/list-motion";
import type { Job } from "@/data/jobs";
import {
  CURRENT_REP,
  DEAL_PRIORITIES,
  PIPELINE_STAGES,
  REPS,
  type DealChange,
  type DealEvent,
  type DealPriority,
  type DealUpdate,
  type PipelineDeal,
  type PipelineStage,
} from "../data";
import { PRIORITY_STYLES, STAGE_DOT, dealNo, relativeTime } from "./DealCard";
import { diffDeal, draftFromDeal, type DealDraft } from "./deal-writes";

const EMPTY_DRAFT: DealDraft = {
  client: "",
  notes: "",
  priority: "medium",
  stage: "Appointment booked",
  rep: CURRENT_REP,
  suburb: "",
  valueK: "",
  pkg: "",
  nextStep: "",
};

/**
 * One dialog for "New deal" and a deal's details, after HRIS's TicketDialog.
 * New deal stays a narrow single column. Details goes wide: the deal's fields
 * on the left, and on the right its Updates thread interleaved with the edit
 * history, so the conversation and the trail of who changed what sit beside
 * the fields. A lost deal opens frozen: reopen it to edit or post.
 */
export function DealDialog({
  open,
  onClose,
  deal,
  job,
  onCreate,
  onSave,
  onLost,
  onReopen,
  onPost,
  onOpenJob,
  ownerLocked = false,
}: {
  open: boolean;
  onClose: () => void;
  /** null → New deal. Otherwise the live deal, so a posted update shows at once. */
  deal: PipelineDeal | null;
  job?: Job;
  onCreate: (draft: DealDraft) => void;
  /** False when nothing changed. */
  onSave: (id: string, draft: DealDraft) => boolean;
  onLost: (id: string) => void;
  onReopen: (id: string) => void;
  onPost: (id: string, body: string) => void;
  onOpenJob: () => void;
  /** The Sales portal: the deal stays the rep's. Managers reassign from the Sales dashboard. */
  ownerLocked?: boolean;
}) {
  const isCreate = deal === null;
  const lost = Boolean(deal?.lost);
  const readOnly = !isCreate && lost;
  const formId = React.useId();
  const [draft, setDraft] = React.useState<DealDraft>(EMPTY_DRAFT);
  const [confirmingLost, setConfirmingLost] = React.useState(false);

  // Reset when the dialog opens or switches deal, not when the deal changes
  // underneath it: a posted update must not wipe a half-typed edit.
  const dealRef = React.useRef(deal);
  dealRef.current = deal;
  const dealId = deal?.id ?? null;
  React.useEffect(() => {
    if (!open) return;
    setConfirmingLost(false);
    setDraft(dealRef.current ? draftFromDeal(dealRef.current) : EMPTY_DRAFT);
  }, [open, dealId]);

  const set = <K extends keyof DealDraft>(k: K, v: DealDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const k = Number(draft.valueK);
  const valid = draft.client.trim() !== "" && draft.suburb.trim() !== "" && Number.isFinite(k) && k > 0;
  const changes = deal && valid ? diffDeal(deal, draft) : [];
  const dirty = changes.length > 0;
  const ready = valid && (isCreate || dirty);

  const submit = () => {
    if (!ready || readOnly) return;
    if (isCreate) onCreate(draft);
    else onSave(deal.id, draft);
    onClose();
  };

  const won = deal?.stage === "Sale won";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={isCreate ? Plus : Briefcase}
      size={isCreate ? "md" : "xl"}
      className={isCreate ? undefined : "md:h-[min(46rem,90dvh)]"}
      bodyClassName={
        isCreate
          ? undefined
          : "p-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] md:grid-rows-1 md:overflow-hidden"
      }
      title={
        isCreate ? (
          "New deal"
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-sm font-medium text-muted-foreground">{dealNo(deal)}</span>
            {deal.client}
            {lost ? (
              <Pill tone="neutral" icon={Archive}>
                Lost
              </Pill>
            ) : null}
            {deal.syncing ? <SyncBadge sync="pending" /> : null}
          </span>
        )
      }
      description={
        isCreate ? (
          "Adds the deal to Appointment booked and creates it in the HubSpot sales pipeline."
        ) : deal.lost ? (
          <span suppressHydrationWarning>
            Lost {relativeTime(deal.lost.at)} by {deal.lost.by} · reopen it to edit or post an update
          </span>
        ) : (
          <span suppressHydrationWarning>
            Made by {deal.rep} · {relativeTime(deal.createdAt)} · in {deal.stage}
          </span>
        )
      }
      footer={
        <>
          {!isCreate && !lost ? (
            <Button
              variant={confirmingLost ? "destructive" : "outline"}
              className="mr-auto"
              onClick={() => {
                if (!confirmingLost) return setConfirmingLost(true);
                onLost(deal.id);
                onClose();
              }}
            >
              <Archive aria-hidden />
              {confirmingLost ? "Confirm lost" : "Mark as lost"}
            </Button>
          ) : null}
          {!isCreate && lost ? (
            <Button
              variant="outline"
              className="mr-auto"
              onClick={() => {
                onReopen(deal.id);
                onClose();
              }}
            >
              <ArchiveRestore aria-hidden /> Reopen deal
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            {readOnly || (!isCreate && !dirty) ? "Close" : "Cancel"}
          </Button>
          {won && job && !lost ? (
            <Button variant="outline" onClick={onOpenJob}>
              Open job <ExternalLink aria-hidden />
            </Button>
          ) : null}
          {!readOnly ? (
            <Button
              type="submit"
              form={formId}
              variant={!isCreate && draft.stage === "Sale won" && deal.stage !== "Sale won" ? "brand" : "default"}
              disabled={!ready}
            >
              {isCreate ? "Add deal" : "Save changes"}
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
            <legend className="sr-only">{isCreate ? "New deal" : "Deal details"}</legend>
            <Cascade i={0}>
              <Field label="Client" htmlFor={`${formId}-client`}>
                <Input
                  id={`${formId}-client`}
                  value={draft.client}
                  onChange={(e) => set("client", e.target.value)}
                  placeholder="e.g. S. and A. Whitmore"
                  autoComplete="off"
                  maxLength={120}
                  required
                />
              </Field>
            </Cascade>

            <Cascade i={1}>
              <Field label="Details" htmlFor={`${formId}-notes`}>
                <Textarea
                  id={`${formId}-notes`}
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="What they want, where finance is at, anything the next person should know…"
                  rows={isCreate ? 3 : 4}
                  className="resize-y"
                />
              </Field>
            </Cascade>

            <Cascade i={2}>
              <PriorityPicker value={draft.priority} onChange={(p) => set("priority", p)} />
            </Cascade>

            {!isCreate ? (
              <Cascade i={3} className="grid gap-3 sm:grid-cols-2">
                <Field label="Stage" htmlFor={`${formId}-stage`}>
                  <SmoothSelect
                    id={`${formId}-stage`}
                    value={draft.stage}
                    onChange={(v) => set("stage", v)}
                    options={PIPELINE_STAGES.map((s) => ({ value: s, label: <StageLabel stage={s} /> }))}
                  />
                </Field>
                <OwnerField id={`${formId}-rep`} value={draft.rep} onChange={(v) => set("rep", v)} locked={ownerLocked} />
              </Cascade>
            ) : null}

            <Cascade i={4} className="grid gap-3 sm:grid-cols-2">
              <Field label="Suburb" htmlFor={`${formId}-suburb`}>
                <Input
                  id={`${formId}-suburb`}
                  value={draft.suburb}
                  onChange={(e) => set("suburb", e.target.value)}
                  placeholder="e.g. Baldivis"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="Estimated value" htmlFor={`${formId}-value`} hint="In thousands: 600 is $600k">
                <Input
                  id={`${formId}-value`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={draft.valueK}
                  onChange={(e) => set("valueK", e.target.value)}
                  placeholder="600"
                  className="tabular-nums"
                  required
                />
              </Field>
            </Cascade>

            <Cascade i={5} className="grid gap-3 sm:grid-cols-2">
              <Field label="Package" htmlFor={`${formId}-pkg`}>
                <Input
                  id={`${formId}-pkg`}
                  value={draft.pkg}
                  onChange={(e) => set("pkg", e.target.value)}
                  placeholder="e.g. The Aspen · Forma"
                  autoComplete="off"
                />
              </Field>
              {isCreate ? (
                <OwnerField id={`${formId}-rep`} value={draft.rep} onChange={(v) => set("rep", v)} locked={ownerLocked} />
              ) : (
                <NextStepField id={`${formId}-next`} value={draft.nextStep} onChange={(v) => set("nextStep", v)} />
              )}
            </Cascade>

            {isCreate ? (
              <Cascade i={6}>
                <NextStepField id={`${formId}-next`} value={draft.nextStep} onChange={(v) => set("nextStep", v)} />
              </Cascade>
            ) : null}

            {!isCreate && draft.stage === "Sale won" && deal.stage !== "Sale won" ? (
              <Cascade i={0}>
                <p className="rounded-lg border border-tone-line bg-tone-soft px-3 py-2 text-xs text-foreground">
                  Saving as Sale won creates the job in CRM Dash Sync automatically.
                </p>
              </Cascade>
            ) : null}
          </fieldset>
        </form>
      </div>

      {!isCreate ? (
        <Cascade
          i={6}
          className="border-t border-hairline md:flex md:min-h-0 md:flex-col md:border-t-0 md:border-l md:bg-canvas/60"
        >
          <ActivityRail deal={deal} onPost={(body) => onPost(deal.id, body)} />
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

function StageLabel({ stage }: { stage: PipelineStage }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-2 shrink-0 rounded-full", STAGE_DOT[stage])} aria-hidden />
      {stage}
    </span>
  );
}

function OwnerField({
  id,
  value,
  onChange,
  locked,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  locked?: boolean;
}) {
  if (locked) {
    return (
      <Field label="Owner" htmlFor={id} hint="Managers reassign deals from the Sales dashboard.">
        <Input id={id} value={value} readOnly aria-readonly className="bg-muted/40 text-muted-foreground" />
      </Field>
    );
  }
  const reps = REPS.includes(value as (typeof REPS)[number]) ? [...REPS] : [...REPS, value];
  return (
    <Field label="Owner" htmlFor={id}>
      <SmoothSelect
        id={id}
        value={value}
        onChange={onChange}
        options={reps.map((r) => ({
          value: r,
          label: (
            <span className="inline-flex items-center gap-2">
              <Avatar name={r} size="xs" />
              {r}
            </span>
          ),
          hint: r === CURRENT_REP ? "you" : undefined,
        }))}
      />
    </Field>
  );
}

function NextStepField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Next step" htmlFor={id}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Send costings by Friday"
        autoComplete="off"
        maxLength={80}
      />
    </Field>
  );
}

/** HRIS's priority radio row: the chosen one fills with its colour and grows a touch. */
function PriorityPicker({ value, onChange }: { value: DealPriority; onChange: (p: DealPriority) => void }) {
  const labelId = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + DEAL_PRIORITIES.length) % DEAL_PRIORITIES.length;
    onChange(DEAL_PRIORITIES[n]);
    refs.current[n]?.focus();
  };
  return (
    <div className="space-y-1.5">
      <Label id={labelId}>Priority</Label>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-3 gap-1.5">
        {DEAL_PRIORITIES.map((p, i) => {
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

/* ── Activity rail: Updates thread + edit history ─────────────────────────── */

type FeedItem = { kind: "update"; at: number; update: DealUpdate } | { kind: "event"; at: number; event: DealEvent };

const clip = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const priorityLabel = (p: string) => PRIORITY_STYLES[p as DealPriority]?.label ?? p;

/** One field change as a line on the trail. */
function describeChange(c: DealChange): string {
  switch (c.field) {
    case "client":
      return `renamed “${clip(c.from)}” → “${clip(c.to)}”`;
    case "notes":
      return "edited the details";
    case "priority":
      return `set priority ${priorityLabel(c.from)} → ${priorityLabel(c.to)}`;
    case "stage":
      return `moved ${c.from} → ${c.to}`;
    case "rep":
      return `handed the deal to ${c.to}`;
    case "suburb":
      return `changed the suburb to ${c.to}`;
    case "value":
      return `changed the value ${c.from} → ${c.to}`;
    case "pkg":
      return c.to ? `set the package to ${clip(c.to)}` : "cleared the package";
    case "nextStep":
      return c.to ? `set the next step “${clip(c.to)}”` : "cleared the next step";
  }
}

function describeEvent(e: DealEvent): string {
  switch (e.action) {
    case "created":
      return "made this deal";
    case "lost":
      return "marked this deal lost";
    case "reopened":
      return "reopened this deal";
    case "moved":
    case "updated":
      return (e.changes ?? []).map(describeChange).join(" · ") || "edited this deal";
  }
}

/**
 * The deal's conversation and trail in one chronological feed: updates read as
 * chat entries, edits as compact system lines between them. The newest entry
 * stays in view, and a new one slides in at the foot.
 */
function ActivityRail({ deal, onPost }: { deal: PipelineDeal; onPost: (body: string) => void }) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const [draft, setDraft] = React.useState("");
  const listRef = React.useRef<HTMLOListElement>(null);
  const first = React.useRef(true);
  const lost = Boolean(deal.lost);

  const feed = React.useMemo<FeedItem[]>(
    () =>
      [
        ...deal.updates.map((u) => ({ kind: "update" as const, at: u.at, update: u })),
        ...deal.history.map((e) => ({ kind: "event" as const, at: e.at, event: e })),
      ].sort((a, b) => a.at - b.at),
    [deal.updates, deal.history],
  );

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: first.current || reduce ? "auto" : "smooth" });
    first.current = false;
  }, [feed.length, reduce]);

  const send = () => {
    const body = draft.trim();
    if (!body || lost) return;
    onPost(body);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-col gap-2.5 px-5 py-4 md:h-full md:px-4">
      <div className="flex items-center gap-1.5">
        <MessagesSquare className="size-3.5 text-subtle-foreground" aria-hidden />
        <h3 className="text-xs font-semibold text-foreground">
          Updates{deal.updates.length ? <span className="text-muted-foreground"> ({deal.updates.length})</span> : null}
        </h3>
        <span className="ml-auto flex items-center gap-1 text-xs text-subtle-foreground">
          <History className="size-3" aria-hidden />
          history included
        </span>
      </div>

      <ol
        ref={listRef}
        aria-label="Updates and history"
        className="flex max-h-72 min-h-0 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin] md:max-h-none md:flex-1"
      >
        {feed.length === 0 ? (
          <li className="py-1 text-xs text-muted-foreground">No activity yet. Updates and every edit to this deal land here.</li>
        ) : (
          <AnimatePresence initial={false}>
            {feed.map((item, i) => (
              <motion.li
                key={item.kind === "update" ? item.update.id : item.event.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: cascading ? rowDelay(i, reduce, 0.03) : 0 }}
              >
                {item.kind === "update" ? (
                  <div className="flex gap-2">
                    <Avatar name={item.update.author} size="xs" className="mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs">
                        <span className="font-semibold">{item.update.author}</span>
                        <span className="ml-1.5 text-subtle-foreground" suppressHydrationWarning>
                          {relativeTime(item.update.at)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap">{item.update.body}</p>
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
        )}
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
          disabled={lost}
          placeholder={lost ? "Lost. Reopen the deal to post an update." : "Post an update… (Shift+Enter for a new line)"}
          aria-label={`Post an update on ${deal.client}`}
          className="min-h-14 resize-none text-[13px]"
        />
        <Button size="icon" aria-label="Post update" disabled={!draft.trim() || lost} onClick={send}>
          <SendHorizontal />
        </Button>
      </div>
    </div>
  );
}
