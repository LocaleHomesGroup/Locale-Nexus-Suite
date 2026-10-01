"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { JOBS, LOT_DETAILS, type Job, type LotDetail, type SubmissionDoc } from "@/data/jobs";
import {
  SEED_ACTIVITY,
  SEED_NOTIFICATIONS,
  SEED_PORTAL_UPDATES,
  SEED_SUBMISSION_DOCS,
  type ActivityEntry,
  type ActivityType,
  type AppNotification,
  type NotificationKind,
  type PortalUpdate,
} from "@/data/seed";

/**
 * The Launchpad's in-memory state — everything the mockup's root component held
 * that more than one module reads. It lives in the dashboard layout, which App
 * Router keeps mounted across navigations, so a milestone synced in Operations
 * is still synced when you come back from Sales. Nothing is persisted: a reload
 * resets the prototype to its seed data.
 *
 * Module-private state (a form draft, a filter) stays in the module.
 */

/**
 * The deal submission's lifecycle, as the mockup writes it:
 * draft (rep building it) → review (sent to Ops) → changes (Ops asked for fixes)
 * → approved. Shared by Sales → My Deal Submissions and Operations → Submission review.
 */
export type SubmissionStatus = "draft" | "review" | "changes" | "approved" | string;

export type ModuleId =
  | "home"
  | "operations"
  | "sales"
  | "marketing"
  | "finance"
  | "accounts"
  | "wealth"
  | "hr"
  | "projects"
  | "knowledge"
  | "leadership"
  | "it";

interface LaunchpadStore {
  jobs: Job[];
  /** Merge a patch (or the result of `fn(job)`) into one job. */
  updateJob: (id: number, patch: Partial<Job> | ((job: Job) => Partial<Job>)) => void;

  lotDetails: Record<number, LotDetail>;
  updateLot: (id: number, patch: Partial<LotDetail>) => void;

  /** Audit log shown on the job detail page, newest first. */
  activity: ActivityEntry[];
  logActivity: (type: ActivityType, action: string, detail: string, targets: string[]) => void;

  notifications: AppNotification[];
  /** Add a notification (newest first). `kind: "red"` marks it as needing action. */
  notify: (msg: string, kind?: NotificationKind) => void;
  dismissNotification: (index: number) => void;
  clearNotifications: () => void;

  /** Builder-portal and email updates waiting for a human in Operations. */
  portalUpdates: PortalUpdate[];
  setPortalUpdates: React.Dispatch<React.SetStateAction<PortalUpdate[]>>;

  /** The Nguyen deal submission — edited by the rep in Sales, reviewed by Ops. */
  submissionDocs: SubmissionDoc[];
  setSubmissionDocs: React.Dispatch<React.SetStateAction<SubmissionDoc[]>>;
  submissionStatus: SubmissionStatus;
  setSubmissionStatus: React.Dispatch<React.SetStateAction<SubmissionStatus>>;

  /** Navigate to a module, optionally on a sub-tab (`?tab=`). */
  go: (module: ModuleId, tab?: string | null) => void;
  /** Open a job's detail page in Operations. */
  openJob: (id: number) => void;

  /**
   * Schedule a callback that is cancelled if the store unmounts — use for the
   * simulated multi-step syncs so a timer never fires into a dead tree.
   */
  later: (fn: () => void, ms: number) => void;
}

const Ctx = createContext<LaunchpadStore | null>(null);

export function LaunchpadProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>(JOBS);
  const [lotDetails, setLotDetails] = useState<Record<number, LotDetail>>(LOT_DETAILS);
  const [activity, setActivity] = useState<ActivityEntry[]>(SEED_ACTIVITY);
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);
  const [portalUpdates, setPortalUpdates] = useState<PortalUpdate[]>(SEED_PORTAL_UPDATES);
  const [submissionDocs, setSubmissionDocs] = useState<SubmissionDoc[]>(SEED_SUBMISSION_DOCS);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>("draft");

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const updateJob = useCallback<LaunchpadStore["updateJob"]>((id, patch) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...(typeof patch === "function" ? patch(j) : patch) } : j)),
    );
  }, []);

  const updateLot = useCallback<LaunchpadStore["updateLot"]>((id, patch) => {
    setLotDetails((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const logActivity = useCallback<LaunchpadStore["logActivity"]>((type, action, detail, targets) => {
    setActivity((prev) => [{ type, action, detail, targets, who: "S. Hart", when: "Just now" }, ...prev]);
  }, []);

  const notify = useCallback<LaunchpadStore["notify"]>((msg, kind = "ok") => {
    setNotifications((prev) => [{ msg, when: "Just now", kind }, ...prev]);
  }, []);

  const dismissNotification = useCallback((index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  }, []);
  const clearNotifications = useCallback(() => setNotifications([]), []);

  const go = useCallback<LaunchpadStore["go"]>(
    (module, tab) => {
      const base = module === "home" ? "/" : `/${module}`;
      router.push(tab ? `${base}?tab=${encodeURIComponent(tab)}` : base);
    },
    [router],
  );
  const openJob = useCallback((id: number) => router.push(`/operations/jobs/${id}`), [router]);

  const value = useMemo<LaunchpadStore>(
    () => ({
      jobs,
      updateJob,
      lotDetails,
      updateLot,
      activity,
      logActivity,
      notifications,
      notify,
      dismissNotification,
      clearNotifications,
      portalUpdates,
      setPortalUpdates,
      submissionDocs,
      setSubmissionDocs,
      submissionStatus,
      setSubmissionStatus,
      go,
      openJob,
      later,
    }),
    [
      jobs,
      updateJob,
      lotDetails,
      updateLot,
      activity,
      logActivity,
      notifications,
      notify,
      dismissNotification,
      clearNotifications,
      portalUpdates,
      submissionDocs,
      submissionStatus,
      go,
      openJob,
      later,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLaunchpad(): LaunchpadStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLaunchpad must be used inside <LaunchpadProvider>");
  return v;
}

/**
 * The success confirmation after an action (the mockup's bottom toast). Sonner,
 * top-right, like Simple HRIS. Use `toast.error` from sonner for failures.
 */
export function confirm(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined);
}
