"use client";

import * as React from "react";
import { undoable } from "@/lib/undoable";
import { useLaunchpad } from "@/state/launchpad-store";
import { CURRENT_REP, PIPELINE_STAGES, type DealChange, type DealEvent, type DealField, type PipelineDeal, type PipelineStage } from "../data";
import { useSalesState } from "../sales-state";
import { dealNo } from "./DealCard";

/** What the deal dialog edits. Value is in $k, as typed. */
export interface DealDraft {
  client: string;
  notes: string;
  priority: PipelineDeal["priority"];
  stage: PipelineStage;
  rep: string;
  suburb: string;
  valueK: string;
  pkg: string;
  nextStep: string;
}

export const draftFromDeal = (d: PipelineDeal): DealDraft => ({
  client: d.client,
  notes: d.notes,
  priority: d.priority,
  stage: d.stage,
  rep: d.rep,
  suburb: d.suburb,
  valueK: d.value.replace(/[^\d.]/g, ""),
  pkg: d.pkg,
  nextStep: d.nextStep,
});

/** "600" → "$600k". */
const valueFromK = (k: string) => `$${Math.round(Number(k))}k`;

/** The fields a draft sets, trimmed, as the deal stores them. */
function fieldsFromDraft(draft: DealDraft): Pick<PipelineDeal, DealField> {
  return {
    client: draft.client.trim(),
    notes: draft.notes.trim(),
    priority: draft.priority,
    stage: draft.stage,
    rep: draft.rep,
    suburb: draft.suburb.trim(),
    value: valueFromK(draft.valueK),
    pkg: draft.pkg.trim(),
    nextStep: draft.nextStep.trim(),
  };
}

/** The history lines a save would write: one change per field that differs. */
export function diffDeal(deal: PipelineDeal, draft: DealDraft): DealChange[] {
  const next = fieldsFromDraft(draft);
  return (Object.keys(next) as DealField[])
    .filter((f) => next[f] !== deal[f])
    .map((f) => ({ field: f, from: String(deal[f]), to: String(next[f]) }));
}

export const FIELD_LABELS: Record<DealField, string> = {
  client: "client",
  notes: "details",
  priority: "priority",
  stage: "stage",
  rep: "owner",
  suburb: "suburb",
  value: "value",
  pkg: "package",
  nextStep: "next step",
};

// How many undo windows each deal has open: its card says "Syncing" until all close.
const inFlight = new Map<string, number>();
const bump = (id: string, by: number) => {
  const n = Math.max(0, (inFlight.get(id) ?? 0) + by);
  if (n) inFlight.set(id, n);
  else inFlight.delete(id);
  return n > 0;
};

let seq = 0;
const eventId = () => `ev-${Date.now()}-${seq++}`;

type Patch = Partial<Pick<PipelineDeal, DealField | "lost">>;

/**
 * Deal writes. Each one shows on the board at once, and goes to HubSpot only
 * when its undo window closes (UI guide § 5.1). Undo reverts just the fields
 * that write set, and only where nothing newer has changed them since.
 */
export function useDealWrites() {
  const { deals, setDeals } = useSalesState();
  const { notify } = useLaunchpad();
  const dealsRef = React.useRef(deals);
  dealsRef.current = deals;

  const write = React.useCallback(
    (
      deal: PipelineDeal,
      patch: Patch,
      event: DealEvent,
      toast: { message: string; description: string; done: { message: string; description?: string } },
    ) => {
      const now = event.at;
      const before: Patch = {};
      for (const k of Object.keys(patch) as (keyof Patch)[]) (before as Record<string, unknown>)[k] = deal[k];
      const movedStage = patch.stage !== undefined && patch.stage !== deal.stage;
      const stageSince = deal.stageSince;

      bump(deal.id, 1);
      setDeals((prev) => {
        const cur = prev.find((d) => d.id === deal.id);
        if (!cur) return prev;
        const next: PipelineDeal = {
          ...cur,
          ...patch,
          stageSince: movedStage ? now : cur.stageSince,
          syncing: true,
          history: [...cur.history, event],
        };
        // A deal that changes stage goes to the top of its new column.
        return movedStage ? [next, ...prev.filter((d) => d.id !== deal.id)] : prev.map((d) => (d.id === deal.id ? next : d));
      });

      const wonNow = movedStage && patch.stage === "Sale won";
      undoable({
        ...toast,
        commit: () => {
          const syncing = bump(deal.id, -1);
          setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, syncing } : d)));
          const cur = dealsRef.current.find((d) => d.id === deal.id);
          if (wonNow && cur && cur.stage === "Sale won" && !cur.lost) {
            notify(`Sale won · ${cur.client}, ${cur.suburb} ${cur.value} — job queued in CRM Dash Sync`);
          }
        },
        undo: () => {
          const syncing = bump(deal.id, -1);
          setDeals((prev) =>
            prev.map((d) => {
              if (d.id !== deal.id) return d;
              const reverted: PipelineDeal = { ...d, syncing, history: d.history.filter((e) => e.id !== event.id) };
              for (const k of Object.keys(patch) as (keyof Patch)[]) {
                if (Object.is(d[k], patch[k])) (reverted as unknown as Record<string, unknown>)[k] = before[k];
              }
              if (movedStage && d.stage !== patch.stage) return reverted;
              if (movedStage) reverted.stageSince = stageSince;
              return reverted;
            }),
          );
        },
      });
    },
    [notify, setDeals],
  );

  /** Drag or Alt+arrow: one stage change. */
  const moveDeal = React.useCallback(
    (id: string, to: PipelineStage) => {
      const deal = dealsRef.current.find((d) => d.id === id);
      if (!deal || deal.stage === to || deal.lost) return;
      const won = to === "Sale won";
      write(
        deal,
        { stage: to },
        { id: eventId(), actor: CURRENT_REP, at: Date.now(), action: "moved", changes: [{ field: "stage", from: deal.stage, to }] },
        {
          message: `Moving ${deal.client} to ${to}`,
          description: `${dealNo(deal)} · HubSpot deal stage`,
          done: won
            ? { message: `Sale won · ${deal.client}`, description: "CRM Dash Sync creates the job in Operations automatically." }
            : { message: `${deal.client} moved to ${to}`, description: "Deal stage updated in HubSpot." },
        },
      );
    },
    [write],
  );

  /** One step along the stages, for the keyboard. */
  const stepDeal = React.useCallback(
    (id: string, by: 1 | -1) => {
      const deal = dealsRef.current.find((d) => d.id === id);
      if (!deal) return;
      const to = PIPELINE_STAGES[PIPELINE_STAGES.indexOf(deal.stage) + by];
      if (to) moveDeal(id, to);
    },
    [moveDeal],
  );

  /** The dialog's Save changes. Returns false when nothing changed. */
  const saveDeal = React.useCallback(
    (id: string, draft: DealDraft): boolean => {
      const deal = dealsRef.current.find((d) => d.id === id);
      if (!deal) return false;
      const changes = diffDeal(deal, draft);
      if (changes.length === 0) return false;
      const next = fieldsFromDraft(draft);
      const patch: Patch = {};
      for (const c of changes) (patch as Record<string, unknown>)[c.field] = next[c.field];
      const onlyStage = changes.length === 1 && changes[0].field === "stage";
      const won = patch.stage === "Sale won";
      write(
        deal,
        patch,
        { id: eventId(), actor: CURRENT_REP, at: Date.now(), action: onlyStage ? "moved" : "updated", changes },
        {
          message: `Saving ${dealNo(deal)} · ${next.client}`,
          description: `${capitalise(changes.map((c) => FIELD_LABELS[c.field]).join(", "))} · HubSpot deal`,
          done: won
            ? { message: `Sale won · ${next.client}`, description: "CRM Dash Sync creates the job in Operations automatically." }
            : { message: `${dealNo(deal)} updated`, description: "Saved to HubSpot." },
        },
      );
      return true;
    },
    [write],
  );

  const markLost = React.useCallback(
    (id: string) => {
      const deal = dealsRef.current.find((d) => d.id === id);
      if (!deal || deal.lost) return;
      const at = Date.now();
      write(
        deal,
        { lost: { at, by: CURRENT_REP } },
        { id: eventId(), actor: CURRENT_REP, at, action: "lost" },
        {
          message: `Marking ${deal.client} as lost`,
          description: `${dealNo(deal)} · HubSpot closed lost`,
          done: { message: `${deal.client} marked lost`, description: "It's under Lost, where it can be reopened." },
        },
      );
    },
    [write],
  );

  const reopenDeal = React.useCallback(
    (id: string) => {
      const deal = dealsRef.current.find((d) => d.id === id);
      if (!deal?.lost) return;
      write(
        deal,
        { lost: undefined },
        { id: eventId(), actor: CURRENT_REP, at: Date.now(), action: "reopened" },
        {
          message: `Reopening ${deal.client}`,
          description: `Back to ${deal.stage} · HubSpot deal`,
          done: { message: `${deal.client} is back on the board`, description: `In ${deal.stage}.` },
        },
      );
    },
    [write],
  );

  /** New deal: lands in Appointment booked. Undo removes it. */
  const createDeal = React.useCallback(
    (draft: DealDraft) => {
      const at = Date.now();
      const no = Math.max(1000, ...dealsRef.current.map((d) => d.no)) + 1;
      const id = `d-${at}`;
      const deal: PipelineDeal = {
        ...fieldsFromDraft(draft),
        id,
        no,
        stage: "Appointment booked",
        createdAt: at,
        stageSince: at,
        syncing: true,
        updates: [],
        history: [{ id: eventId(), actor: CURRENT_REP, at, action: "created" }],
      };
      bump(id, 1);
      setDeals((prev) => [deal, ...prev]);
      undoable({
        message: `Adding ${deal.client} to Appointment booked`,
        description: `${dealNo(deal)} · creates it in the HubSpot sales pipeline`,
        commit: () => {
          const syncing = bump(id, -1);
          setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, syncing } : d)));
        },
        undo: () => {
          bump(id, -1);
          setDeals((prev) => prev.filter((d) => d.id !== id));
        },
        done: { message: `Deal added · ${deal.client}`, description: "In Appointment booked · synced to HubSpot." },
      });
      return id;
    },
    [setDeals],
  );

  /** An update on the deal's thread. Posts straight away, like a ticket reply. */
  const postUpdate = React.useCallback(
    (id: string, body: string) => {
      const at = Date.now();
      setDeals((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, updates: [...d.updates, { id: `up-${at}-${seq++}`, author: CURRENT_REP, body, at }] } : d,
        ),
      );
    },
    [setDeals],
  );

  return { moveDeal, stepDeal, saveDeal, markLost, reopenDeal, createDeal, postUpdate };
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
