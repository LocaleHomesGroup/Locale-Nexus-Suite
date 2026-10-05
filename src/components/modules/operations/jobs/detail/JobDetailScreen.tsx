"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, BookOpen } from "lucide-react";
import type { Job, Milestone } from "@/data/jobs";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { SyncBadge } from "@/components/ui/sync-badge";
import { ErrorState } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { useOperationsSync } from "../../sync/OperationsSyncProvider";
import type { MilestoneKind } from "../../sync/types";
import { MONEY_MILESTONES, isRegression, liveMilestone } from "../../review/review";
import { DEFAULT_BUILDER_DATE, DEFAULT_SITE_START } from "../data";
import { MondayPill } from "../JobsTable";
import { DealDetailsCard, JobDetailsCard, LandHouseCard } from "./DetailCards";
import { ConstructionCard, PreconCard, type MilestoneDraft } from "./MilestoneCards";
import { DocumentsCard, OpenInCard } from "./SideCards";
import { AuditLog } from "./AuditLog";
import { ConflictDialog, HandoverDialog } from "./JobDialogs";

/** The Knowledge SOP, deep-linked as a search so the article is the only result. */
const CONFLICT_GUIDE = `/knowledge?cat=sops&q=${encodeURIComponent("Resolving a sync conflict")}`;

function BackLink() {
  return (
    <Link href="/operations?tab=jobs" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 w-fit")}>
      <ArrowLeft /> All jobs
    </Link>
  );
}

/** /operations/jobs/[id] — one job, mirrored from HubSpot and Monday (mockup `h === "detail"`). */
export function JobDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { jobs } = useLaunchpad();
  const job = jobs.find((j) => String(j.id) === id);

  if (!job) {
    return (
      <PageContainer>
        <BackLink />
        <Card>
          <ErrorState
            title="Job not found"
            message={`No job with ID "${id}" is mirrored in CRM dash sync. The link may be out of date.`}
            onBack={() => router.push("/operations?tab=jobs")}
          />
        </Card>
      </PageContainer>
    );
  }
  return <JobDetail job={job} />;
}

function JobDetail({ job }: { job: Job }) {
  const { activity, updateJob, logActivity } = useLaunchpad();
  const { syncMilestone, syncDetails, handOver, resolveConflict, fileReview, trailForJob, viewTrail } =
    useOperationsSync();
  const trail = trailForJob(job.id);
  // The audit log is this job's own history: entries scoped to it, plus any that apply to every job.
  const history = React.useMemo(
    () => activity.filter((e) => !e.jobs || e.jobs.includes(job.id)),
    [activity, job.id],
  );

  const [draft, setDraft] = React.useState<MilestoneDraft | null>(null);
  const [detailsDirty, setDetailsDirty] = React.useState(false);
  const [landDirty, setLandDirty] = React.useState(false);
  const [handoverOpen, setHandoverOpen] = React.useState(false);
  const [siteStart, setSiteStart] = React.useState(DEFAULT_SITE_START);
  const [conflictOpen, setConflictOpen] = React.useState(false);
  // Whether the job arrived without a number — entering one ticks Builder Acceptance on save.
  const openedWithoutJobNo = React.useRef(!job.jobNo);

  const editMilestone = (kind: MilestoneKind, m: Milestone) =>
    setDraft({
      kind,
      name: m.name,
      // Open, in-progress and builder-marked-done-without-a-date items default to Completed.
      status: m.status === "open" || m.status === "prog" || m.status === "pendingDate" ? "done" : m.status,
      date: m.date || DEFAULT_BUILDER_DATE,
      source: "Broker email",
    });

  const saveMilestone = () => {
    if (!draft) return;
    const current = liveMilestone(job, { kind: draft.kind, milestone: draft.name });
    // Taking back a milestone that moves money, or backdating it, waits for a
    // person in the review queue. Everything else applies and syncs now.
    if (MONEY_MILESTONES.has(draft.name) && isRegression(current, draft.status, draft.date)) {
      fileReview(
        job.id,
        draft.kind,
        draft.name,
        { status: draft.status, date: draft.status === "done" ? draft.date : "" },
        draft.source,
      );
    } else {
      syncMilestone(job.id, draft.name, draft.date, draft.kind, draft.status);
    }
    setDraft(null);
  };

  const saveDetails = () => {
    setDetailsDirty(false);
    if (openedWithoutJobNo.current && job.jobNo.trim()) {
      openedWithoutJobNo.current = false;
      updateJob(job.id, (j) => ({
        precon: j.precon.map((m) =>
          m.name === "Builder Acceptance" && m.status !== "done" ? { ...m, status: "done", date: "05 Aug 2026" } : m,
        ),
      }));
      logActivity(
        "details",
        "Job number entered",
        `${job.jobNo.trim()} · deal renamed, Builder Acceptance ticked`,
        ["Monday", "HubSpot"],
        job.id,
      );
    }
    syncDetails(job.id, "Job details");
  };

  const editor = {
    draft,
    setDraft,
    onEdit: editMilestone,
    onSave: saveMilestone,
    // A milestone in dispute can't be edited until the conflict is settled.
    conflictOn: job.sync === "conflict" ? job.conflict?.milestone : undefined,
    onConflict: () => setConflictOpen(true),
  };
  const title = `${job.jobNo ? `Job ${job.jobNo}` : "New job"} · ${job.client}`;

  return (
    <PageContainer>
      <div className="flex flex-col gap-3">
        <BackLink />
        <PageHeader
          title={title}
          actions={
            <>
              <SyncBadge sync={job.sync} className="text-[13px]" />
              {trail ? (
                <Button variant="link" size="sm" className="h-auto text-xs" onClick={() => viewTrail(trail.id)}>
                  View sync trail
                </Button>
              ) : null}
            </>
          }
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone="neutral">{job.builder}</Pill>
          <Pill tone="neutral">
            Record ID <span className="font-mono text-xs">{job.recordId}</span>
          </Pill>
          <Pill tone="neutral">HubSpot · {job.hsStage}</Pill>
          <MondayPill job={job} long />
        </div>
      </div>

      {job.sync === "conflict" && job.conflict ? (
        <Reveal index={0}>
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-500/10"
          >
            <AlertTriangle className="size-4 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="max-w-[70ch] text-[13px] leading-relaxed text-rose-800 dark:text-rose-200">
                <strong className="font-semibold">Conflict on {job.conflict.field}.</strong> Launchpad:{" "}
                {job.conflict.hub}. Monday: {job.conflict.monday}. Nothing on this milestone syncs until it&apos;s
                resolved.
              </p>
              <Link
                href={CONFLICT_GUIDE}
                className="mt-1 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-rose-800 underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45 dark:text-rose-200"
              >
                <BookOpen className="size-3.5" aria-hidden />
                Guide: Resolving a sync conflict
              </Link>
            </div>
            <Button size="sm" className="pulse-rose ml-auto" onClick={() => setConflictOpen(true)}>
              Resolve
            </Button>
          </div>
        </Reveal>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={1}>
            <DealDetailsCard job={job} />
          </Reveal>
          <Reveal index={2}>
            <JobDetailsCard
              job={job}
              dirty={detailsDirty}
              onEdit={(patch) => {
                updateJob(job.id, patch);
                setDetailsDirty(true);
              }}
              onSave={saveDetails}
              onMoveToConstruction={() => setHandoverOpen(true)}
            />
          </Reveal>
          <Reveal index={3}>
            <LandHouseCard
              jobId={job.id}
              dirty={landDirty}
              onDirty={() => setLandDirty(true)}
              onSave={() => {
                setLandDirty(false);
                syncDetails(job.id, "Land and house");
              }}
            />
          </Reveal>
          <Reveal index={4}>
            <PreconCard job={job} editor={editor} />
          </Reveal>
          {job.board === "construction" ? (
            <Reveal index={5}>
              <ConstructionCard job={job} editor={editor} />
            </Reveal>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={2}>
            <DocumentsCard job={job} />
          </Reveal>
          <Reveal index={3}>
            <AuditLog entries={history} />
          </Reveal>
          <Reveal index={4}>
            <OpenInCard job={job} />
          </Reveal>
        </div>
      </div>

      <HandoverDialog
        open={handoverOpen}
        job={job}
        siteStart={siteStart}
        onSiteStart={setSiteStart}
        onClose={() => setHandoverOpen(false)}
        onConfirm={() => {
          setHandoverOpen(false);
          handOver(job.id, siteStart);
        }}
      />
      <ConflictDialog
        open={conflictOpen}
        job={job}
        onClose={() => setConflictOpen(false)}
        onResolve={(keep) => {
          setConflictOpen(false);
          resolveConflict(job.id, keep);
        }}
      />
    </PageContainer>
  );
}
