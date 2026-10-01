"use client";

import * as React from "react";
import {
  BUILDER_CLAIMS,
  MILESTONE_HUBSPOT_STAGE,
  PRECON_HUBSPOT_PROPERTY,
  STATUS_LABEL,
  type Job,
  type MilestoneStatus,
} from "@/data/jobs";
import type { PortalUpdate } from "@/data/seed";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { clockStamp } from "@/lib/utils";
import { SyncTrailDialog } from "./SyncTrailDialog";
import { HUBSPOT_STAGE_ORDER, seedConstruction, type MilestoneKind, type SyncStep } from "./types";

/**
 * CRM Dash Sync's write engine — the mockup's `Er` (milestone), `ls` (detail
 * fields), `yc` (hand over to construction), `ss` (conflict), `gc` / `mc`
 * (portal inbox). Every write is saved to Launchpad first, then pushed to
 * Monday, HubSpot and — when the builder bills that stage — Xero, on the same
 * timed trail as the prototype so the demo reads the same.
 *
 * It lives in the Operations layout, so a trail started from the jobs list
 * keeps running (and stays on screen) when you open a job. Timers go through
 * the store's `later`, so the jobs still finish syncing if you leave
 * Operations mid-run.
 */
interface OperationsSync {
  /** Mark a milestone (construction or preconstruction) and sync it. */
  syncMilestone: (jobId: number, name: string, date: string, kind?: MilestoneKind, status?: MilestoneStatus) => void;
  /** Push an edited card ("Job details", "Land and house") to HubSpot and Monday. */
  syncDetails: (jobId: number, label: string) => void;
  /** Move a sales-board job to the construction pipeline. */
  handOver: (jobId: number, siteStart: string) => void;
  /** Settle a Monday vs CRM Dash disagreement. */
  resolveConflict: (jobId: number, keep: "monday" | "crm") => void;
  acceptPortalUpdate: (update: PortalUpdate) => void;
  dismissPortalUpdate: (id: string) => void;
  /** True while a trail still has a step in flight. */
  syncing: boolean;
}

const Ctx = React.createContext<OperationsSync | null>(null);

export function useOperationsSync(): OperationsSync {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useOperationsSync must be used inside <OperationsSyncProvider>");
  return v;
}

export function OperationsSyncProvider({ children }: { children: React.ReactNode }) {
  const { jobs, updateJob, logActivity, notify, setPortalUpdates, later } = useLaunchpad();
  const [steps, setSteps] = React.useState<SyncStep[]>([]);
  const [title, setTitle] = React.useState("Syncing");
  const [open, setOpen] = React.useState(false);

  // Read the latest jobs inside timers without re-creating every handler.
  const jobsRef = React.useRef<Job[]>(jobs);
  jobsRef.current = jobs;

  const startTrail = React.useCallback((t: string, first: SyncStep[]) => {
    setTitle(t);
    setSteps(first);
    setOpen(true);
  }, []);

  /** A job that still carries an unresolved conflict stays flagged after an unrelated sync. */
  const settle = React.useCallback(
    (jobId: number) => updateJob(jobId, (j) => ({ sync: j.conflict ? "conflict" : "ok" })),
    [updateJob],
  );

  const syncMilestone = React.useCallback<OperationsSync["syncMilestone"]>(
    (jobId, name, date, kind = "construction", status = "done") => {
      const done = status === "done";
      const list = kind === "precon" ? "precon" : "milestones";
      const builder = jobsRef.current.find((j) => j.id === jobId)?.builder ?? "";
      const stage = MILESTONE_HUBSPOT_STAGE[name];
      const property = PRECON_HUBSPOT_PROPERTY[name];
      const claim = done ? BUILDER_CLAIMS[builder]?.[name] : undefined;

      startTrail(`${name} · syncing`, [
        {
          sys: "Launchpad",
          state: "done",
          label: `Saved to Launchpad · ${name} ${done ? `= ${date}` : `→ ${STATUS_LABEL[status]}`}`,
          meta: clockStamp(),
        },
        { sys: "Monday", state: "pending", label: "Monday subitem updating", meta: "" },
      ]);
      updateJob(jobId, (j) => ({
        sync: "pending",
        lastSource: "Ops entry, just now",
        [list]: j[list].map((m) => (m.name === name ? { ...m, status, date: done ? date : "" } : m)),
      }));

      later(() => {
        setSteps((s) => [
          s[0],
          {
            sys: "Monday",
            state: "done",
            label: `Monday · ${name} ${done ? "set to Completed, Date Completed filled" : `status set to ${STATUS_LABEL[status]}`}`,
            meta: clockStamp(),
          },
          { sys: "HubSpot", state: "pending", label: "HubSpot updating", meta: "" },
        ]);
      }, 1300);

      later(() => {
        const hubspot = !done
          ? "HubSpot unchanged · syncs when the milestone is Completed"
          : kind === "precon"
            ? property
              ? `HubSpot · ${property} set`
              : "Recorded in CRM Dash · no HubSpot property mapped for this milestone"
            : stage
              ? `HubSpot · date property set, deal stage → ${stage}`
              : "Recorded in CRM Dash · no matching HubSpot stage for this milestone";

        // A completion only ever moves the deal forward.
        if (kind !== "precon" && done && stage) {
          updateJob(jobId, (j) =>
            HUBSPOT_STAGE_ORDER.indexOf(stage) > HUBSPOT_STAGE_ORDER.indexOf(j.hsStage) ? { hsStage: stage } : {},
          );
        }

        const hubStep: SyncStep = { sys: "HubSpot", state: "done", label: hubspot, meta: clockStamp() };
        const builderDate = done && date ? date : "not set";

        if (claim) {
          setSteps((s) => [
            s[0],
            s[1],
            hubStep,
            { sys: "Xero", state: "pending", label: "Xero · raising draft invoice", meta: "" },
          ]);
          later(() => {
            setSteps((s) => [
              s[0],
              s[1],
              s[2],
              {
                sys: "Xero",
                state: "done",
                label: `Xero · draft invoice created for ${builder} — awaiting approval in Accounts`,
                meta: clockStamp(),
              },
            ]);
            settle(jobId);
            logActivity(
              "milestone",
              `${name} marked Completed`,
              `Builder date ${builderDate}${stage && kind !== "precon" ? ` · stage advanced to ${stage}` : ""}`,
              ["Monday", "HubSpot"],
            );
            logActivity("invoice", "Draft invoice created", `${builder} · awaiting approval in Accounts`, ["Xero"]);
            confirm(`${name} synced · draft invoice created in Xero`);
          }, 1200);
          return;
        }

        setSteps((s) => [s[0], s[1], hubStep]);
        settle(jobId);
        logActivity(
          "milestone",
          `${name} set to ${STATUS_LABEL[status]}`,
          `Builder date ${builderDate}${
            kind === "precon"
              ? " · preconstruction subitem"
              : stage
                ? ` · stage advanced to ${stage}`
                : " · no matching HubSpot stage"
          }`,
          kind === "precon" && !property ? ["Monday"] : ["Monday", "HubSpot"],
        );
        confirm(`${name} synced`);
      }, 2600);
    },
    [later, logActivity, settle, startTrail, updateJob],
  );

  const syncDetails = React.useCallback<OperationsSync["syncDetails"]>(
    (jobId, label) => {
      startTrail(`${label} · syncing`, [
        { sys: "Launchpad", state: "done", label: `Saved to Launchpad · ${label} updated · by S. Hart`, meta: clockStamp() },
        { sys: "HubSpot", state: "pending", label: "HubSpot deal properties updating", meta: "" },
      ]);
      updateJob(jobId, { sync: "pending", lastSource: "Ops entry, just now" });
      later(() => {
        setSteps((s) => [
          s[0],
          { sys: "HubSpot", state: "done", label: "HubSpot · deal properties updated", meta: clockStamp() },
          { sys: "Monday", state: "pending", label: "Monday columns updating", meta: "" },
        ]);
      }, 1200);
      later(() => {
        setSteps((s) => [s[0], s[1], { sys: "Monday", state: "done", label: "Monday · item columns updated", meta: clockStamp() }]);
        settle(jobId);
        logActivity("details", `${label} updated`, "Edited in Launchpad and pushed to both systems", ["Monday", "HubSpot"]);
        confirm(`${label} synced to HubSpot and Monday`);
      }, 2400);
    },
    [later, logActivity, settle, startTrail, updateJob],
  );

  const handOver = React.useCallback<OperationsSync["handOver"]>(
    (jobId, siteStart) => {
      updateJob(jobId, { sync: "pending" });
      startTrail("Move to construction · syncing", [
        { sys: "Launchpad", state: "done", label: "Saved to Launchpad · handed to construction", meta: clockStamp() },
        { sys: "Monday", state: "pending", label: "Monday moving item to Construction Pipeline", meta: "" },
      ]);
      later(() => {
        setSteps((s) => [
          s[0],
          { sys: "Monday", state: "done", label: "Monday · item moved, 7 milestone subitems created", meta: clockStamp() },
          { sys: "HubSpot", state: "pending", label: "HubSpot updating", meta: "" },
        ]);
      }, 1400);
      later(() => {
        setSteps((s) => [
          s[0],
          s[1],
          {
            sys: "HubSpot",
            state: "done",
            label: "HubSpot · pipeline → Construction (WA), stage → Site Start",
            meta: clockStamp(),
          },
        ]);
        updateJob(jobId, (j) => ({
          board: "construction",
          hsStage: "Site Start",
          sync: j.conflict ? "conflict" : "ok",
          lastSource: "Ops entry, just now",
          milestones: seedConstruction(siteStart),
        }));
        logActivity(
          "milestone",
          "Moved to construction",
          `Site start ${siteStart} · 8 construction subitems seeded on the Monday board`,
          ["Monday", "HubSpot"],
        );
        confirm("Job handed to construction across all three systems");
      }, 2800);
    },
    [later, logActivity, startTrail, updateJob],
  );

  const resolveConflict = React.useCallback<OperationsSync["resolveConflict"]>(
    (jobId, keep) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      const field = job?.conflict?.field ?? "Slab Down date";
      if (keep === "monday") {
        updateJob(jobId, (j) => ({
          sync: "ok",
          conflict: undefined,
          milestones: j.milestones.map((m) =>
            m.name === "Slab Down" ? { ...m, status: "done", date: "28 Jul 2026" } : m,
          ),
        }));
        logActivity("conflict", "Conflict resolved", `${field} · accepted Monday's value, 28 Jul 2026`, ["HubSpot"]);
        later(() => syncMilestone(jobId, "Slab Down", "28 Jul 2026"), 150);
        return;
      }
      updateJob(jobId, { sync: "ok", conflict: undefined });
      logActivity("conflict", "Conflict resolved", `${field} · kept the CRM Dash value`, ["Monday"]);
      confirm("Kept CRM Dash value · Monday will be corrected on next sync");
    },
    [later, logActivity, syncMilestone, updateJob],
  );

  const acceptPortalUpdate = React.useCallback<OperationsSync["acceptPortalUpdate"]>(
    (u) => {
      setPortalUpdates((prev) => prev.filter((p) => p.id !== u.id));
      if (u.kind === "move") {
        updateJob(u.jobId, (j) => ({
          board: "construction",
          hsStage: "Site Start",
          lastSource: "Portal review, just now",
          milestones: j.milestones.length ? j.milestones : seedConstruction(u.date),
        }));
        logActivity(
          "milestone",
          "Moved to construction",
          `Site start ${u.date} detected in the ${u.builder} portal, confirmed by a human`,
          ["Monday", "HubSpot"],
        );
        notify(`Portal update applied — ${u.jobNo || u.client} moved to construction`);
        confirm("Job moved to construction · 8 milestones seeded");
        return;
      }
      notify(`Portal update applied — ${u.jobNo || u.client} ${u.milestone}`);
      syncMilestone(u.jobId, u.milestone, u.date, u.kind, "done");
    },
    [logActivity, notify, setPortalUpdates, syncMilestone, updateJob],
  );

  const dismissPortalUpdate = React.useCallback<OperationsSync["dismissPortalUpdate"]>(
    (id) => {
      setPortalUpdates((prev) => prev.filter((p) => p.id !== id));
      confirm("Update dismissed · logged for follow-up");
    },
    [setPortalUpdates],
  );

  const syncing = open && steps.some((s) => s.state === "pending");

  const value = React.useMemo<OperationsSync>(
    () => ({ syncMilestone, syncDetails, handOver, resolveConflict, acceptPortalUpdate, dismissPortalUpdate, syncing }),
    [syncMilestone, syncDetails, handOver, resolveConflict, acceptPortalUpdate, dismissPortalUpdate, syncing],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <SyncTrailDialog open={open} title={title} steps={steps} onClose={() => setOpen(false)} />
    </Ctx.Provider>
  );
}
