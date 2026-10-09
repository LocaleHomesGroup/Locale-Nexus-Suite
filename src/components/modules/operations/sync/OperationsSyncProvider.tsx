"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BUILDER_CLAIMS,
  MILESTONE_HUBSPOT_STAGE,
  PRECON_HUBSPOT_PROPERTY,
  STATUS_LABEL,
  type Job,
  type MilestoneStatus,
} from "@/data/jobs";
import type { MilestoneState, ReviewItem } from "@/data/seed";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { useJobs } from "@/state/live-data";
import { clockStamp } from "@/lib/utils";
import { useNavBadge } from "@/components/shell/nav-state";
import { isStale, jobRef, liveMilestone, reviewSummary } from "../review/review";
import { SyncTrailDialog } from "./SyncTrailDialog";
import {
  movesStageForward,
  seedConstruction,
  trailDone,
  type MilestoneKind,
  type SyncRun,
  type SyncSystem,
  type SyncTrail,
} from "./types";

/**
 * CRM dash sync's write engine — the mockup's `Er` (milestone), `ls` (detail
 * fields), `yc` (hand over to construction) and `ss` (conflict), plus the
 * review queue. Every write is saved to Launchpad first, then pushed to
 * Monday, HubSpot and — when the builder bills that stage — Xero, on the same
 * timings as the prototype.
 *
 * Syncs run in the background. Nothing blocks the page: the job shows
 * "Syncing", a toast follows the run ("Syncing 25501 · Slab Down…" → "25501 ·
 * Slab Down synced") and its "View sync trail" opens the step-by-step trail on
 * demand. A trail open when its run lands closes itself a moment later.
 *
 * A regression on a money milestone is the exception: it is filed in the review
 * queue instead, and syncs only once a person releases it.
 *
 * It lives in the Operations layout, so a run started on one Operations page
 * keeps going when you open another. Timers go through the store's `later`, so
 * jobs still finish syncing if you leave Operations mid-run.
 */
interface OperationsSync {
  /** Mark a milestone (construction or preconstruction) and sync it. */
  syncMilestone: (jobId: number, name: string, date: string, kind?: MilestoneKind, status?: MilestoneStatus) => void;
  /** Push an edited card ("Job details", "Land and house") to HubSpot and Monday. */
  syncDetails: (jobId: number, label: string) => void;
  /** Move a sales-board job to the construction pipeline. */
  handOver: (jobId: number, siteStart: string) => void;
  /** Settle a Monday vs Launchpad disagreement. */
  resolveConflict: (jobId: number, keep: "monday" | "crm") => void;
  /** Hold a money-milestone regression in the review queue instead of applying it. */
  fileReview: (jobId: number, kind: MilestoneKind, name: string, proposed: MilestoneState, source?: string) => void;
  /** Apply a held change and sync it onward. Refused once the milestone has moved since it was filed. */
  releaseReview: (id: string, reason: string) => void;
  /** Close a held change without applying it. The reason is the only record, so it is required. */
  dismissReview: (id: string, reason: string) => void;
  /** The latest trail that wrote to a job. */
  trailForJob: (jobId: number) => SyncTrail | undefined;
  /** Open a trail in the sync trail dialog. */
  viewTrail: (trailId: string) => void;
  /** True while any run still has a step in flight. */
  syncing: boolean;
}

/** The writes: everything on OperationsSync but these three reads. Live data switches every one of them off. */
type WriteKey = Exclude<keyof OperationsSync, "trailForJob" | "viewTrail" | "syncing">;

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
  const router = useRouter();
  const { updateJob, logActivity, reviewItems, setReviewItems, later } = useLaunchpad();
  // Live jobs are Monday's own: nothing writes back while the Dash Sync go-live is held (Meeting3).
  const { jobs, live } = useJobs();
  const [trails, setTrails] = React.useState<SyncTrail[]>([]);
  const [viewing, setViewing] = React.useState<string | null>(null);

  // Every Operations page wears the rail, so the queue's count is published
  // here rather than by one screen.
  const waiting = reviewItems.filter((i) => i.status === "pending").length;
  useNavBadge("operations:review", { count: waiting, tone: "pending", label: "waiting on a person" });

  // Read the latest jobs and queue (and which trail is on screen) inside
  // timers without re-creating every handler.
  const jobsRef = React.useRef<Job[]>(jobs);
  jobsRef.current = jobs;
  const reviewRef = React.useRef<ReviewItem[]>(reviewItems);
  reviewRef.current = reviewItems;
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

  /**
   * Save a milestone to Launchpad now and plan its push to Monday, HubSpot and
   * Xero. `released` marks a change let out of the review queue.
   */
  const planMilestone = React.useCallback(
    (
      jobId: number,
      name: string,
      date: string,
      kind: MilestoneKind,
      status: MilestoneStatus,
      released = false,
    ): { plan: RunPlan; summary: string } => {
      const job = findJob(jobId);
      const done = status === "done";
      const list = kind === "precon" ? "precon" : "milestones";
      const builder = job?.builder ?? "";
      const stage = MILESTONE_HUBSPOT_STAGE[name];
      const property = PRECON_HUBSPOT_PROPERTY[name];
      // A builder bills a stage once. Re-saving a Completed milestone (a date
      // correction) must not raise a second draft invoice.
      const wasDone = job?.[list].find((m) => m.name === name)?.status === "done";
      const claim = done && !wasDone ? BUILDER_CLAIMS[builder]?.[name] : undefined;
      const hubspotWrites = done && (kind === "precon" ? Boolean(property) : Boolean(stage));
      // Said as it will happen: a deal already at or past this stage stays put.
      const stageMoves = kind !== "precon" && done && Boolean(stage) && movesStageForward(stage ?? "", job?.hsStage ?? "");

      updateJob(jobId, (j) => ({
        sync: "pending",
        lastSource: released ? "Review queue, just now" : "Ops entry, just now",
        [list]: j[list].map((m) => (m.name === name ? { ...m, status, date: done ? date : "" } : m)),
      }));

      const hubspot = !done
        ? "HubSpot unchanged · syncs when the milestone is Completed"
        : kind === "precon"
          ? property
            ? `HubSpot · ${property} set`
            : "Recorded in Launchpad · no HubSpot property mapped for this milestone"
          : stage
            ? stageMoves
              ? `HubSpot · date property set, deal stage → ${stage}`
              : `HubSpot · date property set, deal stage stays at ${job?.hsStage}`
            : "Recorded in Launchpad · no matching HubSpot stage for this milestone";

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
              updateJob(jobId, (j) => (movesStageForward(stage, j.hsStage) ? { hsStage: stage } : {}));
            }
          },
        },
      ];
      if (claim) {
        legs.push({
          sys: "Xero",
          pending: "Xero · raising draft invoice",
          done: `Xero · draft invoice for ${builder}, waiting for approval in Accounts`,
          ms: 1200,
        });
      }

      const builderDate = done && date ? date : "not set";
      const source = released ? " · released from the review queue" : "";
      const finish = () => {
        settle(jobId);
        logActivity(
          "milestone",
          done ? `${name} marked Completed` : `${name} set to ${STATUS_LABEL[status]}`,
          `Builder date ${builderDate}${
            kind === "precon"
              ? " · preconstruction subitem"
              : stage && done
                ? stageMoves
                  ? ` · stage advanced to ${stage}`
                  : ` · deal stage already at ${job?.hsStage}, not moved`
                : stage
                  ? ""
                  : " · no matching HubSpot stage"
          }${source}`,
          hubspotWrites ? ["Monday", "HubSpot"] : ["Monday"],
          jobId,
        );
        if (claim) {
          logActivity("invoice", "Draft invoice created", `${builder} · awaiting approval in Accounts`, ["Xero"], jobId);
        }
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
    [findJob, logActivity, settle, updateJob],
  );

  /** Plan the move from the sales board to the construction pipeline. */
  const planHandover = React.useCallback(
    (jobId: number, siteStart: string): RunPlan => {
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
                lastSource: "Ops entry, just now",
                milestones: j.milestones.length ? j.milestones : seedConstruction(siteStart),
              })),
          },
        ],
        finish: () => {
          logActivity(
            "milestone",
            "Moved to construction",
            `Site start ${siteStart} · 8 construction subitems seeded on the Monday board`,
            ["Monday", "HubSpot"],
            jobId,
          );
        },
      };
    },
    [findJob, logActivity, updateJob],
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
        `${c.field} · kept the Launchpad value, ${hubDate || "no date"}`,
        [],
        jobId,
      );
      const plan: RunPlan = {
        jobId,
        label: `${jobName(job)} · ${name}`,
        saved: `Saved to Launchpad · kept Launchpad's ${c.field.toLowerCase()}`,
        legs: [
          {
            sys: "Monday",
            pending: "Monday subitem updating",
            done: hubDate ? `Monday · ${name} date set back to ${hubDate}` : `Monday · ${name} date cleared to match Launchpad`,
            ms: 1300,
          },
        ],
        finish: () => {
          settle(jobId);
          logActivity(
            "milestone",
            `Monday corrected · ${name}`,
            hubDate ? `Date set back to ${hubDate}` : "Date cleared to match Launchpad · still awaiting the builder's date",
            ["Monday"],
            jobId,
          );
        },
      };
      startTrail(plan.label, [plan], { summary: "Monday now matches Launchpad." });
    },
    [findJob, logActivity, settle, startTrail, syncMilestone, updateJob],
  );

  /** Close one pending item: released, dismissed or superseded, with who decided and why. */
  const decide = React.useCallback(
    (id: string, status: ReviewItem["status"], decidedBy: string, decisionNote?: string) =>
      setReviewItems((prev) =>
        prev.map((i) =>
          i.id === id && i.status === "pending" ? { ...i, status, decidedAt: "Just now", decidedBy, decisionNote } : i,
        ),
      ),
    [setReviewItems],
  );

  const fileReview = React.useCallback<OperationsSync["fileReview"]>(
    (jobId, kind, name, proposed, source) => {
      const job = findJob(jobId);
      const existing = liveMilestone(job, { kind, milestone: name });
      if (!job || !existing) return;
      const held = { status: existing.status, date: existing.date };
      const summary = reviewSummary(job, name, held, proposed);
      const next = Math.max(0, ...reviewRef.current.map((i) => Number(i.id.replace(/\D/g, "")) || 0)) + 1;
      const item: ReviewItem = {
        id: `RQ-${next}`,
        status: "pending",
        jobId,
        kind,
        milestone: name,
        summary,
        queuedAt: "Just now",
        queuedBy: "S. Hart",
        source,
        held,
        proposed,
      };
      // A newer change to the same milestone replaces the one still waiting.
      setReviewItems((prev) => [
        item,
        ...prev.map((i) =>
          i.status === "pending" && i.jobId === jobId && i.milestone === name
            ? { ...i, status: "superseded" as const, decidedAt: "Just now", decidedBy: "System" }
            : i,
        ),
      ]);
      logActivity("review", "Filed to the review queue", `${summary} · held until Operations releases it`, [], jobId);
      toast.success("Filed to the review queue", {
        description: `${name} affects cashflow, so nothing was sent to Monday or HubSpot. It waits there until Operations releases it.`,
        action: { label: "Open review queue", onClick: () => router.push("/operations?tab=review") },
      });
    },
    [findJob, logActivity, router, setReviewItems],
  );

  const releaseReview = React.useCallback<OperationsSync["releaseReview"]>(
    (id, reason) => {
      const item = reviewRef.current.find((i) => i.id === id && i.status === "pending");
      if (!item) return;
      const job = findJob(item.jobId);
      // The screen already refuses this; the rule lives here too, so no other
      // caller can apply a change over one nobody is looking at.
      if (isStale(item, liveMilestone(job, item))) {
        toast.error("Releasing was refused", {
          description: `${item.milestone} has changed since this was queued. Dismiss it with a reason and make the change again.`,
        });
        return;
      }
      const note = reason.trim();
      decide(id, "accepted", "S. Hart", note || undefined);
      logActivity(
        "review",
        "Released from the review queue",
        `${item.summary}${note ? ` · “${note}”` : ""}`,
        [],
        item.jobId,
      );
      const { plan, summary } = planMilestone(
        item.jobId,
        item.milestone,
        item.proposed.date,
        item.kind,
        item.proposed.status,
        true,
      );
      startTrail(plan.label, [plan], { summary: `Released from the review queue. ${summary}` });
    },
    [decide, findJob, logActivity, planMilestone, startTrail],
  );

  const dismissReview = React.useCallback<OperationsSync["dismissReview"]>(
    (id, reason) => {
      const item = reviewRef.current.find((i) => i.id === id && i.status === "pending");
      const note = reason.trim();
      if (!item || !note) return;
      decide(id, "dismissed", "S. Hart", note);
      logActivity(
        "review",
        "Dismissed from the review queue",
        `${item.milestone} on ${jobRef(findJob(item.jobId))} · nothing changed · “${note}”`,
        [],
        item.jobId,
      );
      confirm("Dismissed · nothing was changed", "Monday and HubSpot were never told. The reason is in the audit log.");
    },
    [decide, findJob, logActivity],
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

  const value = React.useMemo<OperationsSync>(() => {
    const api: OperationsSync = {
      syncMilestone,
      syncDetails,
      handOver,
      resolveConflict,
      fileReview,
      releaseReview,
      dismissReview,
      trailForJob,
      viewTrail,
      syncing,
    };
    if (!live) return api;
    const readOnly = () =>
      toast.info("Read only for now", {
        // One id, so a repeat updates this toast instead of stacking another.
        id: "ops-read-only",
        description: "Nothing is written back to Monday or HubSpot while the Dash Sync go-live is on hold.",
      });
    // Typed over every write key: a write added to OperationsSync is a compile error until it is guarded here.
    const writes: Record<WriteKey, () => void> = {
      syncMilestone: readOnly,
      syncDetails: readOnly,
      handOver: readOnly,
      resolveConflict: readOnly,
      fileReview: readOnly,
      releaseReview: readOnly,
      dismissReview: readOnly,
    };
    return { ...api, ...writes };
  }, [
    syncMilestone,
    syncDetails,
    handOver,
    resolveConflict,
    fileReview,
    releaseReview,
    dismissReview,
    trailForJob,
    viewTrail,
    syncing,
    live,
  ]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <SyncTrailDialog open={Boolean(current)} trail={current ?? shown.current} onClose={() => setViewing(null)} />
    </Ctx.Provider>
  );
}
