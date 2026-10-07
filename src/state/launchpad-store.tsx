"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { JOBS, LOT_DETAILS, type Job, type LotDetail, type SubmissionDoc } from "@/data/jobs";
import {
  SEED_CLAIMS,
  SEED_INVOICES,
  cents,
  type BuilderInvoice,
  type ClaimDecision,
  type ExpenseClaim,
} from "@/data/accounts";
import { undoable } from "@/lib/undoable";
import { aud } from "@/lib/utils";
import {
  SEED_ACTIVITY,
  SEED_NOTIFICATIONS,
  SEED_REVIEW_ITEMS,
  SEED_SUBMISSION_DOCS,
  type ActivityEntry,
  type ActivityType,
  type AppNotification,
  type NotificationKind,
  type ReviewItem,
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
  | "accounting"
  | "wealth"
  | "hr"
  | "knowledge"
  | "leadership"
  | "it"
  | "tickets"
  | "admin"
  | "client"
  | "developer"
  | "employee"
  | "consultant";

interface LaunchpadStore {
  jobs: Job[];
  /** Merge a patch (or the result of `fn(job)`) into one job. */
  updateJob: (id: number, patch: Partial<Job> | ((job: Job) => Partial<Job>)) => void;

  lotDetails: Record<number, LotDetail>;
  updateLot: (id: number, patch: Partial<LotDetail>) => void;

  /** Audit log shown on the job detail page, newest first. */
  activity: ActivityEntry[];
  /**
   * Record a write. `jobs` scopes it to the job(s) it touched, so each job page
   * shows only its own. `who` defaults to the signed-in user; a portal write
   * names its sender ("Forma · Developer portal").
   */
  logActivity: (
    type: ActivityType,
    action: string,
    detail: string,
    targets: string[],
    jobs?: number | number[],
    who?: string,
  ) => void;

  notifications: AppNotification[];
  /** Add a notification (newest first). `kind: "red"` marks it as needing action. */
  notify: (msg: string, kind?: NotificationKind) => void;
  dismissNotification: (index: number) => void;
  /** Drop every notification with exactly this message: what it asked for has been dealt with. */
  resolveNotification: (msg: string) => void;
  clearNotifications: () => void;

  /**
   * Operations' review queue: money-milestone regressions held back from
   * Monday and HubSpot, and the decisions taken on them, newest first. Filed,
   * released and dismissed through the Operations sync engine.
   */
  reviewItems: ReviewItem[];
  setReviewItems: React.Dispatch<React.SetStateAction<ReviewItem[]>>;

  /**
   * Builder invoices, approved in Accounts and read by Home and Jarvis. An
   * invoice inside its undo window is still "Draft": nothing has gone to Xero
   * or the builder yet, so it still counts as waiting everywhere.
   */
  invoices: BuilderInvoice[];
  setInvoices: React.Dispatch<React.SetStateAction<BuilderInvoice[]>>;
  /** Invoice ids inside their undo window. Accounts shows these as "Sending". */
  sendingInvoices: ReadonlySet<string>;
  /** Approve one or more drafts behind a single 6s undo window. Only the commit approves. */
  approveInvoices: (ids: string[]) => void;

  /** Expense claims, decided in Accounts. A claim inside its undo window is still "Awaiting approval". */
  claims: ExpenseClaim[];
  setClaims: React.Dispatch<React.SetStateAction<ExpenseClaim[]>>;
  /** Decisions inside their undo window, keyed by claim name (`ExpenseClaim.claim`). */
  decidingClaims: Readonly<Record<string, ClaimDecision>>;
  /** Approve or decline a claim behind a 6s undo window. Only the commit changes its status. */
  decideClaim: (claim: string, decision: ClaimDecision) => void;

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
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>(SEED_REVIEW_ITEMS);
  const [submissionDocs, setSubmissionDocs] = useState<SubmissionDoc[]>(SEED_SUBMISSION_DOCS);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>("draft");
  const [invoices, setInvoices] = useState<BuilderInvoice[]>(SEED_INVOICES);
  const [sendingInvoices, setSendingInvoices] = useState<ReadonlySet<string>>(() => new Set());
  const [claims, setClaims] = useState<ExpenseClaim[]>(SEED_CLAIMS);
  const [decidingClaims, setDecidingClaims] = useState<Readonly<Record<string, ClaimDecision>>>({});

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

  const logActivity = useCallback<LaunchpadStore["logActivity"]>((type, action, detail, targets, jobs, who = "S. Hart") => {
    const scope = jobs === undefined ? undefined : Array.isArray(jobs) ? jobs : [jobs];
    setActivity((prev) => [{ type, action, detail, targets, who, when: "Just now", jobs: scope }, ...prev]);
  }, []);

  const notify = useCallback<LaunchpadStore["notify"]>((msg, kind = "ok") => {
    setNotifications((prev) => [{ msg, when: "Just now", kind }, ...prev]);
  }, []);

  // Accounts writes. Refs hold the latest lists and the in-window ids, so a
  // double click can't start two windows for one invoice before a re-render.
  const invoicesRef = useRef(invoices);
  invoicesRef.current = invoices;
  const claimsRef = useRef(claims);
  claimsRef.current = claims;
  const sendingRef = useRef(new Set<string>());
  const decidingRef = useRef(new Map<string, ClaimDecision>());

  const markSending = useCallback((ids: string[], on: boolean) => {
    ids.forEach((id) => (on ? sendingRef.current.add(id) : sendingRef.current.delete(id)));
    setSendingInvoices(new Set(sendingRef.current));
  }, []);

  const approveInvoices = useCallback<LaunchpadStore["approveInvoices"]>(
    (ids) => {
      const list = invoicesRef.current.filter(
        (i) => ids.includes(i.id) && i.status === "Draft" && !sendingRef.current.has(i.id),
      );
      if (list.length === 0) return;
      const listIds = list.map((i) => i.id);
      const total = list.reduce((sum, i) => sum + i.amount, 0);
      const builders = [...new Set(list.map((i) => i.builder))];
      const one = list.length === 1 ? list[0] : null;
      markSending(listIds, true);
      undoable({
        message: one
          ? `Sending ${one.id} to ${one.builder}`
          : `Sending ${list.length} invoices to ${builders.length === 1 ? builders[0] : `${builders.length} builders`}`,
        description: `${aud(total)} + GST · approves in Xero`,
        commit: () => {
          setInvoices((prev) =>
            prev.map((u) =>
              listIds.includes(u.id) && u.status === "Draft" ? { ...u, status: "Approved", approvedNow: true } : u,
            ),
          );
          markSending(listIds, false);
          list.forEach((inv) => notify(`Invoice approved — ${inv.job} ${inv.stage}`));
        },
        undo: () => markSending(listIds, false),
        done: one
          ? { message: `${one.id} sent to ${one.builder}`, description: `Approved in Xero · ${one.job} ${one.stage}` }
          : { message: `${list.length} invoices sent`, description: `Approved in Xero · ${listIds.join(", ")}` },
      });
    },
    [markSending, notify],
  );

  const markDeciding = useCallback((claim: string, decision: ClaimDecision | null) => {
    if (decision) decidingRef.current.set(claim, decision);
    else decidingRef.current.delete(claim);
    setDecidingClaims(Object.fromEntries(decidingRef.current));
  }, []);

  const decideClaim = useCallback<LaunchpadStore["decideClaim"]>(
    (claim, decision) => {
      const c = claimsRef.current.find((x) => x.claim === claim);
      if (!c || c.status !== "Awaiting approval" || decidingRef.current.has(claim)) return;
      const approving = decision === "Approved";
      markDeciding(claim, decision);
      undoable({
        message: `${approving ? "Approving" : "Declining"} ${c.claim} for ${c.staff}`,
        description: approving
          ? `${cents(c.amount)} · codes to ${c.code} · ${c.account} in Xero`
          : `${cents(c.amount)} · ${c.staff} is told`,
        commit: () => {
          setClaims((prev) =>
            prev.map((x) => (x.claim === claim && x.status === "Awaiting approval" ? { ...x, status: decision } : x)),
          );
          markDeciding(claim, null);
        },
        undo: () => markDeciding(claim, null),
        done: approving
          ? {
              message: "Expense claim approved",
              description: `${c.claim} · ${c.staff} · ${cents(c.amount)} · coded ${c.code} · ${c.account} in Xero`,
            }
          : { message: "Expense claim declined", description: `${c.claim} · ${c.staff} · ${cents(c.amount)}` },
      });
    },
    [markDeciding],
  );

  const dismissNotification = useCallback((index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  }, []);
  const resolveNotification = useCallback((msg: string) => {
    setNotifications((prev) => (prev.some((n) => n.msg === msg) ? prev.filter((n) => n.msg !== msg) : prev));
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
      resolveNotification,
      clearNotifications,
      reviewItems,
      setReviewItems,
      submissionDocs,
      setSubmissionDocs,
      submissionStatus,
      setSubmissionStatus,
      invoices,
      setInvoices,
      sendingInvoices,
      approveInvoices,
      claims,
      setClaims,
      decidingClaims,
      decideClaim,
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
      resolveNotification,
      clearNotifications,
      reviewItems,
      submissionDocs,
      submissionStatus,
      invoices,
      sendingInvoices,
      approveInvoices,
      claims,
      decidingClaims,
      decideClaim,
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
