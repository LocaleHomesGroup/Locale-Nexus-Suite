"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  BUILDER_CLAIMS,
  MILESTONE_HUBSPOT_STAGE,
  PRECON_HUBSPOT_PROPERTY,
  STATUS_LABEL,
  type Job,
  type MilestoneStatus,
} from "@/data/jobs";
import type { PortalUpdate } from "@/data/seed";
import { useLaunchpad } from "@/state/launchpad-store";
import { aud, clockStamp } from "@/lib/utils";
import { SyncTrailDialog } from "./SyncTrailDialog";
import {
  HUBSPOT_STAGE_ORDER,
  seedConstruction,
  trailDone,
  type MilestoneKind,
  type SyncRun,
  type SyncSystem,
  type SyncTrail,
} from "./types";

/**
 * CRM Dash Sync's write engine — the mockup's `Er` (milestone), `ls` (detail
 * fields), `yc` (hand over to construction), `ss` (conflict), `gc` / `mc`
 * (portal inbox). Every write is saved to Launchpad first, then pushed to
 * Monday, HubSpot and — when the builder bills that stage — Xero, on the same
 * timings as the prototype.
 *
 * Syncs run in the background. Nothing blocks the page: the job shows
 * "Syncing", a toast follows the run ("Syncing 25501 · Slab Down…" → "25501 ·
 * Slab Down synced") and its "View sync trail" opens the step-by-step trail on
 * demand. A trail open when its run lands closes itself a moment later.
 *
 * It lives in the Operations layout, so a run started from the jobs list keeps
 * going when you open a job. Timers go through the store's `later`, so jobs
 * still finish syncing if you leave Operations mid-run.
 */
export type PortalSyncState = { trailId: string; state: "syncing" | "synced" };

interface OperationsSync {
  /** Mark a milestone (construction or preconstruction) and sync it. */
  syncMilestone: (jobId: number, name: string, date: string, kind?: MilestoneKind, status?: MilestoneStatus) => void;
  /** Push an edited card ("Job details", "Land and house") to HubSpot and Monday. */
  syncDetails: (jobId: number, label: string) => void;
  /** Move a sales-board job to the construction pipeline. */
  handOver: (jobId: number, siteStart: string) => void;
  /** Settle a Monday vs CRM Dash disagreement. */
  resolveConflict: (jobId: number, keep: "monday" | "crm") => void;
  /** A person accepted a portal update — only now does anything sync. */
  acceptPortalUpdate: (update: PortalUpdate) => void;
  /** Accept several at once, as one trail. */
  acceptPortalUpdates: (updates: PortalUpdate[]) => void;
  dismissPortalUpdate: (id: string) => void;
  /** Accepted portal updates still syncing (or just synced), by update id. */
  portalSync: Record<string, PortalSyncState>;
  /** The latest trail that wrote to a job. */
  trailForJob: (jobId: number) => SyncTrail | undefined;
  /** Open a trail in the sync trail dialog. */
  viewTrail: (trailId: string) => void;
  /** True while any run still has a step in flight. */
  syncing: boolean;
}

/** One hop after the Launchpad save: in flight for `ms`, then landed. */
interface Leg {
  sys: SyncSystem;
  pending: string;
  done: string;
  ms: number;
  /** The store write this system's confirmation stands for. */
  onLand?: () => void;
}

/** One run: what was saved to Launchpad, the hops after it, and what to record when it lands. */
interface RunPlan {
  jobId: number;
  label: string;
  saved: string;
  legs: Leg[];
  finish?: () => void;
}

const Ctx = React.createContext<OperationsSync | null>(null);

export function useOperationsSync(): OperationsSync {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useOperationsSync must be used inside <OperationsSyncProvider>");
  return v;
}

/** "25501" or, before a job number exists, the client. */
function jobName(job: Job | undefined): string {
  return job ? job.jobNo || job.client : "Job";
}

/** "Monday and HubSpot", "Monday, HubSpot and Xero". */
function systemsList(systems: string[]): string {
  const s = [...new Set(systems)];
  return s.length <= 1 ? (s[0] ?? "") : `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
}

export function OperationsSyncProvider({ children }: { children: React.ReactNode }) {
  const { jobs, updateJob, logActivity, notify, setPortalUpdates, later } = useLaunchpad();
  const [trails, setTrails] = React.useState<SyncTrail[]>([]);
  const [viewing, setViewing] = React.useState<string | null>(null);
  const [portalSync, setPortalSync] = React.useState<Record<string, PortalSyncState>>({});

  // Read the latest jobs (and which trail is on screen) inside timers without
  // re-creating every handler.
  const jobsRef = React.useRef<Job[]>(jobs);
  jobsRef.current = jobs;
  const viewingRef = React.useRef(viewing);
  viewingRef.current = viewing;
  const seq = React.useRef(0);
  const remaining = React.useRef<Record<string, number>>({});

  const findJob = React.useCallback((id: number) => jobsRef.current.find((j) => j.id === id), []);

  const patchRun = React.useCallback((trailId: string, runId: string, fn: (r: SyncRun) => SyncRun) => {
    setTrails((prev) =>
      prev.map((t) => (t.id === trailId ? { ...t, runs: t.runs.map((r) => (r.id === runId ? fn(r) : r)) } : t)),
    );
  }, []);

  /**
   * Start a trail of one or more runs in the background. The toast follows it
   * from "Syncing…" to "synced"; its action opens the trail.
   */
  const startTrail = React.useCallback(
    (subject: string, plans: RunPlan[], opts: { summary: string; onComplete?: () => void }) => {
      const trailId = `trail-${++seq.current}`;
      const runs: SyncRun[] = plans.map((p, i) => ({
        id: `${trailId}-${i}`,
        jobId: p.jobId,
        label: p.label,
        steps: [{ sys: "Launchpad", state: "done", label: p.saved, meta: clockStamp() }],
        done: false,
      }));
      remaining.current[trailId] = plans.length;
      setTrails((prev) => [{ id: trailId, subject, runs }, ...prev].slice(0, 12));

      const view = { label: "View sync trail", onClick: () => setViewing(trailId) };
      const next = systemsList(plans.flatMap((p) => p.legs.map((l) => l.sys)));
      toast.loading(`Syncing ${subject}…`, {
        id: trailId,
        description: `Saved to Launchpad. ${next || "Connected systems"} updating in the background.`,
        action: view,
      });

      const complete = () => {
        toast.success(`${subject} synced`, { id: trailId, description: opts.summary, duration: 6000, action: view });
        opts.onComplete?.();
        // A trail someone is watching closes itself once it lands: no "Done" to click.
        if (viewingRef.current === trailId) later(() => setViewing((v) => (v === trailId ? null : v)), 1800);
      };

      const advance = (runId: string, plan: RunPlan, i: number) => {
        if (i >= plan.legs.length) {
          patchRun(trailId, runId, (r) => ({ ...r, done: true }));
          plan.finish?.();
          remaining.current[trailId] -= 1;
          if (remaining.current[trailId] === 0) complete();
          return;
        }
        const leg = plan.legs[i];
        patchRun(trailId, runId, (r) => ({
          ...r,
          steps: [...r.steps, { sys: leg.sys, state: "pending", label: leg.pending, meta: "" }],
        }));
        later(() => {
          leg.onLand?.();
          patchRun(trailId, runId, (r) => ({
            ...r,
            steps: [...r.steps.slice(0, -1), { sys: leg.sys, state: "done", label: leg.done, meta: clockStamp() }],
          }));
          advance(runId, plan, i + 1);
        }, leg.ms);
      };

      plans.forEach((plan, i) => advance(runs[i].id, plan, 0));
      return trailId;
    },
    [later, patchRun],
  );

  /** A job that still carries an unresolved conflict stays flagged after an unrelated sync. */
  const settle = React.useCallback(
    (jobId: number) => updateJob(jobId, (j) => ({ sync: j.conflict ? "conflict" : "ok" })),
    [updateJob],
  );

  /** Save a milestone to Launchpad now and plan its push to Monday, HubSpot and Xero. */
  const planMilestone = React.useCallback(
    (
      jobId: number,
      name: string,
      date: string,
      kind: MilestoneKind,
      status: MilestoneStatus,
      via?: PortalUpdate,
    ): { plan: RunPlan; summary: string } => {
      const job = findJob(jobId);
      const done = status === "done";
      const list = kind === "precon" ? "precon" : "milestones";
      const builder = job?.builder ?? "";
      const stage = MILESTONE_HUBSPOT_STAGE[name];
      const property = PRECON_HUBSPOT_PROPERTY[name];
      const claim = done ? BUILDER_CLAIMS[builder]?.[name] : undefined;
      const hubspotWrites = done && (kind === "precon" ? Boolean(property) : Boolean(stage));

      updateJob(jobId, (j) => ({
        sync: "pending",
        lastSource: via ? "Portal review, just now" : "Ops entry, just now",
        [list]: j[list].map((m) => (m.name === name ? { ...m, status, date: done ? date : "" } : m)),
      }));

      const hubspot = !done
        ? "HubSpot unchanged · syncs when the milestone is Completed"
        : kind === "precon"
          ? property
            ? `HubSpot · ${property} set`
            : "Recorded in CRM Dash · no HubSpot property mapped for this milestone"
          : stage
            ? `HubSpot · date property set, deal stage → ${stage}`
            : "Recorded in CRM Dash · no matching HubSpot stage for this milestone";

      const legs: Leg[] = [
        {
          sys: "Monday",
          pending: "Monday subitem updating",
          done: `Monday · ${name} ${done ? "set to Completed, Date Completed filled" : `status set to ${STATUS_LABEL[status]}`}`,
          ms: 1300,
        },
        {
          sys: "HubSpot",
          pending: "HubSpot updating",
          done: hubspot,
          ms: 1300,
          // A completion only ever moves the deal forward.
          onLand: () => {
            if (kind !== "precon" && done && stage) {
              updateJob(jobId, (j) =>
                HUBSPOT_STAGE_ORDER.indexOf(stage) > HUBSPOT_STAGE_ORDER.indexOf(j.hsStage) ? { hsStage: stage } : {},
              );
            }
          },
        },
      ];
      if (claim) {
        legs.push({
          sys: "Xero",
          pending: "Xero · raising draft invoice",
          done: `Xero · draft invoice for ${builder}, ${aud(claim)} + GST, waiting for approval in Accounts`,
          ms: 1200,
        });
      }

      const builderDate = done && date ? date : "not set";
      const source = via ? ` · accepted from ${via.source}` : "";
      const finish = () => {
        settle(jobId);
        logActivity(
          "milestone",
          done ? `${name} marked Completed` : `${name} set to ${STATUS_LABEL[status]}`,
          `Builder date ${builderDate}${
            kind === "precon"
              ? " · preconstruction subitem"
              : stage && done
                ? ` · stage advanced to ${stage}`
                : stage
                  ? ""
                  : " · no matching HubSpot stage"
          }${source}`,
          hubspotWrites ? ["Monday", "HubSpot"] : ["Monday"],
          jobId,
        );
        if (claim) {
          logActivity("invoice", "Draft invoice created", `${builder} · ${aud(claim)} + GST · awaiting approval in Accounts`, ["Xero"], jobId);
        }
        if (via) notify(`Portal update applied — ${jobName(job)} ${name}`);
      };

      const summary = claim
        ? `Monday and HubSpot updated. Draft invoice raised in Xero for Accounts to approve.`
        : hubspotWrites
          ? "Monday and HubSpot updated."
          : done
            ? "Monday updated. Nothing maps to HubSpot for this milestone."
            : "Monday updated. HubSpot syncs once it's Completed.";

      return { plan: { jobId, label: `${jobName(job)} · ${name}`, saved: `Saved to Launchpad · ${name} ${done ? `= ${date}` : `→ ${STATUS_LABEL[status]}`}`, legs, finish }, summary };
    },
    [findJob, logActivity, notify, settle, updateJob],
  );

  /** Plan the move from the sales board to the construction pipeline. */
  const planHandover = React.useCallback(
    (jobId: number, siteStart: string, via?: PortalUpdate): RunPlan => {
      const job = findJob(jobId);
      updateJob(jobId, { sync: "pending" });
      return {
        jobId,
        label: `${jobName(job)} · Move to construction`,
        saved: `Saved to Launchpad · handed to construction, site start ${siteStart}`,
        legs: [
          {
            sys: "Monday",
            pending: "Monday moving item to Construction Pipeline",
            done: "Monday · item moved, 8 milestone subitems created",
            ms: 1400,
          },
          {
            sys: "HubSpot",
            pending: "HubSpot updating",
            done: "HubSpot · pipeline → Construction (WA), stage → Site Start",
            ms: 1400,
            onLand: () =>
              updateJob(jobId, (j) => ({
                board: "construction",
                hsStage: "Site Start",
                sync: j.conflict ? "conflict" : "ok",
                lastSource: via ? "Portal review, just now" : "Ops entry, just now",
                milestones: j.milestones.length ? j.milestones : seedConstruction(siteStart),
              })),
          },
        ],
        finish: () => {
          logActivity(
            "milestone",
            "Moved to construction",
            via
              ? `Site start ${siteStart} detected in the ${via.builder} portal, confirmed by a human · 8 construction subitems seeded`
              : `Site start ${siteStart} · 8 construction subitems seeded on the Monday board`,
            ["Monday", "HubSpot"],
            jobId,
          );
          if (via) notify(`Portal update applied — ${jobName(job)} moved to construction`);
        },
      };
    },
    [findJob, logActivity, notify, updateJob],
  );

  const syncMilestone = React.useCallback<OperationsSync["syncMilestone"]>(
    (jobId, name, date, kind = "construction", status = "done") => {
      const { plan, summary } = planMilestone(jobId, name, date, kind, status);
      startTrail(plan.label, [plan], { summary });
    },
    [planMilestone, startTrail],
  );

  const syncDetails = React.useCallback<OperationsSync["syncDetails"]>(
    (jobId, label) => {
      const job = findJob(jobId);
      updateJob(jobId, { sync: "pending", lastSource: "Ops entry, just now" });
      const plan: RunPlan = {
        jobId,
        label: `${jobName(job)} · ${label}`,
        saved: `Saved to Launchpad · ${label} updated · by S. Hart`,
        legs: [
          { sys: "HubSpot", pending: "HubSpot deal properties updating", done: "HubSpot · deal properties updated", ms: 1200 },
          { sys: "Monday", pending: "Monday columns updating", done: "Monday · item columns updated", ms: 1200 },
        ],
        finish: () => {
          settle(jobId);
          logActivity("details", `${label} updated`, "Edited in Launchpad and pushed to both systems", ["Monday", "HubSpot"], jobId);
        },
      };
      startTrail(plan.label, [plan], { summary: "HubSpot deal and Monday item updated." });
    },
    [findJob, logActivity, settle, startTrail, updateJob],
  );

  const handOver = React.useCallback<OperationsSync["handOver"]>(
    (jobId, siteStart) => {
      const plan = planHandover(jobId, siteStart);
      startTrail(plan.label, [plan], { summary: "Moved to construction in Monday and HubSpot. 8 milestones seeded." });
    },
    [planHandover, startTrail],
  );

  const resolveConflict = React.useCallback<OperationsSync["resolveConflict"]>(
    (jobId, keep) => {
      const job = findJob(jobId);
      const c = job?.conflict;
      if (!job || !c) return;
      const name = c.milestone ?? "Slab Down";
      updateJob(jobId, { conflict: undefined, sync: "pending" });

      if (keep === "monday") {
        const date = c.mondayDate ?? "";
        logActivity(
          "conflict",
          "Conflict resolved",
          `${c.field} · accepted Monday's value, ${date || "no date"}`,
          [],
          jobId,
        );
        syncMilestone(jobId, name, date, "construction", date ? "done" : "pendingDate");
        return;
      }

      const hubDate = c.hubDate ?? "";
      logActivity(
        "conflict",
        "Conflict resolved",
        `${c.field} · kept the CRM Dash value, ${hubDate || "no date"}`,
        [],
        jobId,
      );
      const plan: RunPlan = {
        jobId,
        label: `${jobName(job)} · ${name}`,
        saved: `Saved to Launchpad · kept CRM Dash's ${c.field.toLowerCase()}`,
        legs: [
          {
            sys: "Monday",
            pending: "Monday subitem updating",
            done: hubDate ? `Monday · ${name} date set back to ${hubDate}` : `Monday · ${name} date cleared to match CRM Dash`,
            ms: 1300,
          },
        ],
        finish: () => {
          settle(jobId);
          logActivity(
            "milestone",
            `Monday corrected · ${name}`,
            hubDate ? `Date set back to ${hubDate}` : "Date cleared to match CRM Dash · still awaiting the builder's date",
            ["Monday"],
            jobId,
          );
        },
      };
      startTrail(plan.label, [plan], { summary: "Monday now matches CRM Dash." });
    },
    [findJob, logActivity, settle, startTrail, syncMilestone, updateJob],
  );

  /** Plan one accepted portal update. */
  const planPortal = React.useCallback(
    (u: PortalUpdate): RunPlan =>
      u.kind === "move"
        ? planHandover(u.jobId, u.date, u)
        : planMilestone(u.jobId, u.milestone, u.date, u.kind, "done", u).plan,
    [planHandover, planMilestone],
  );

  /** Accepted updates stay in the inbox, marked syncing, until their trail lands. */
  const acceptUpdates = React.useCallback(
    (updates: PortalUpdate[], subject: string, summary: string) => {
      const ids = updates.map((u) => u.id);
      const trailId = startTrail(subject, updates.map(planPortal), {
        summary,
        onComplete: () => {
          setPortalSync((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, { trailId, state: "synced" as const }])) }));
          later(() => {
            setPortalUpdates((prev) => prev.filter((p) => !ids.includes(p.id)));
            setPortalSync((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !ids.includes(id))));
          }, 1400);
        },
      });
      setPortalSync((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, { trailId, state: "syncing" as const }])) }));
    },
    [later, planPortal, setPortalUpdates, startTrail],
  );

  const acceptPortalUpdate = React.useCallback<OperationsSync["acceptPortalUpdate"]>(
    (u) => {
      const job = findJob(u.jobId);
      acceptUpdates(
        [u],
        u.kind === "move" ? `${jobName(job)} · Move to construction` : `${jobName(job)} · ${u.milestone}`,
        u.kind === "move" ? "Moved to construction in Monday and HubSpot. 8 milestones seeded." : "Monday and HubSpot updated.",
      );
    },
    [acceptUpdates, findJob],
  );

  const acceptPortalUpdates = React.useCallback<OperationsSync["acceptPortalUpdates"]>(
    (updates) => {
      if (updates.length === 0) return;
      if (updates.length === 1) return acceptPortalUpdate(updates[0]);
      acceptUpdates(
        updates,
        `${updates.length} portal updates`,
        `${updates.map((u) => jobName(findJob(u.jobId))).join(", ")} written to Monday and HubSpot.`,
      );
    },
    [acceptPortalUpdate, acceptUpdates, findJob],
  );

  const dismissPortalUpdate = React.useCallback<OperationsSync["dismissPortalUpdate"]>(
    (id) => {
      setPortalUpdates((prev) => prev.filter((p) => p.id !== id));
      toast.success("Update dismissed · logged for follow-up");
    },
    [setPortalUpdates],
  );

  const trailForJob = React.useCallback(
    (jobId: number) => trails.find((t) => t.runs.some((r) => r.jobId === jobId)),
    [trails],
  );
  const viewTrail = React.useCallback((trailId: string) => setViewing(trailId), []);

  const syncing = trails.some((t) => !trailDone(t));

  // Keep the last trail on screen while the dialog plays its close.
  const shown = React.useRef<SyncTrail | null>(null);
  const current = viewing ? trails.find((t) => t.id === viewing) : undefined;
  if (current) shown.current = current;

  const value = React.useMemo<OperationsSync>(
    () => ({
      syncMilestone,
      syncDetails,
      handOver,
      resolveConflict,
      acceptPortalUpdate,
      acceptPortalUpdates,
      dismissPortalUpdate,
      portalSync,
      trailForJob,
      viewTrail,
      syncing,
    }),
    [
      syncMilestone,
      syncDetails,
      handOver,
      resolveConflict,
      acceptPortalUpdate,
      acceptPortalUpdates,
      dismissPortalUpdate,
      portalSync,
      trailForJob,
      viewTrail,
      syncing,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <SyncTrailDialog open={Boolean(current)} trail={current ?? shown.current} onClose={() => setViewing(null)} />
    </Ctx.Provider>
  );
}
