"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Circle,
  ClipboardList,
  FolderOpen,
  HardHat,
  History,
  House,
  Lock,
  MapPinned,
  Pencil,
} from "lucide-react";
import type { Job, Milestone } from "@/data/jobs";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { Dialog } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { SyncBadge } from "@/components/ui/sync-badge";
import { CLIENT_PHONE, DOCUMENT_SLOTS } from "./data";
import { LOT_FIELDS } from "./detail/DetailCards";
import { StatusIcon } from "./detail/MilestoneCards";
import { MondayPill, jobHref } from "./JobsTable";

/** How many audit lines the quick view shows; the job page has the rest. */
const ACTIVITY_LINES = 5;

/**
 * One section of the quick view, in its own box. The boxes cascade in just
 * after the dialog's zoom (HRIS § 14.3: small rise, capped stagger), so the
 * dialog arrives first and its contents settle into it.
 */
function Box({
  index,
  icon: Icon,
  title,
  meta,
  problem = false,
  className,
  children,
}: {
  index: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  meta?: React.ReactNode;
  /** A box about something wrong (a sync conflict): rose, never the dashboard accent. */
  problem?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const titleId = React.useId();
  return (
    <motion.section
      aria-labelledby={titleId}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.32, ease: EASE_OUT, delay: reduce ? 0 : Math.min(0.12 + index * 0.05, 0.42) }}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border p-4 shadow-xs",
        problem
          ? "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
          : "border-hairline bg-card",
        className,
      )}
    >
      <header className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            problem ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" : "bg-tone-soft text-tone-ink",
          )}
          aria-hidden
        >
          <Icon className="size-3.5" />
        </span>
        <h3
          id={titleId}
          className={cn("text-[13px] font-semibold", problem && "text-rose-800 dark:text-rose-200")}
        >
          {title}
        </h3>
        {meta ? <span className="ml-auto">{meta}</span> : null}
      </header>
      {children}
    </motion.section>
  );
}

/** A label and its value, on one hairline-divided row. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-hairline py-1.5 first:border-t-0">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] break-words text-foreground">{children || "—"}</dd>
    </div>
  );
}

function Owner({ by }: { by: "launchpad" | "hubspot" }) {
  return by === "hubspot" ? (
    <Pill tone="neutral" icon={Lock}>
      HubSpot owns
    </Pill>
  ) : (
    <Pill tone="tone" icon={Pencil}>
      Launchpad owns
    </Pill>
  );
}

/** The right-hand words for a milestone, the same wording the job page uses. */
function milestoneState(m: Milestone): { text: string; caution: boolean } {
  if (m.status === "done" && !m.date) return { text: "Completed · no date", caution: true };
  if (m.status === "done") return { text: m.date, caution: false };
  if (m.status === "pendingDate") return { text: "Awaiting date", caution: true };
  if (m.status === "prog") return { text: m.due ? `In progress · due ${m.due}` : "In progress", caution: false };
  if (m.status === "na") return { text: "Not applicable", caution: false };
  return { text: "Not started", caution: false };
}

function MilestoneList({ items }: { items: Milestone[] }) {
  return (
    <ul>
      {items.map((m) => {
        const state = milestoneState(m);
        return (
          <li key={m.name} className="flex items-center gap-2 border-t border-hairline py-1.5 first:border-t-0">
            <StatusIcon m={m} />
            <span
              className={cn(
                "min-w-0 truncate text-xs",
                m.status === "na" ? "text-subtle-foreground line-through" : "text-foreground",
              )}
            >
              {m.name}
            </span>
            <span
              className={cn(
                "ml-auto shrink-0 text-xs whitespace-nowrap tabular-nums",
                state.caution ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
              )}
            >
              {state.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function doneCount(items: Milestone[]) {
  const done = items.filter((m) => m.status === "done").length;
  return (
    <Pill tone="neutral" className="tabular-nums">
      {done} of {items.length} done
    </Pill>
  );
}

/**
 * CRM dash sync › View — everything on one job, read only, without leaving the
 * list. Each part of the job page sits in its own box. Editing stays on the
 * job page, which the footer opens.
 */
export function JobViewDialog({ job, open, onClose }: { job: Job | undefined; open: boolean; onClose: () => void }) {
  const { activity, lotDetails } = useLaunchpad();
  const reduce = useReducedMotion();

  // Keep showing the last job while the dialog animates out.
  const last = React.useRef(job);
  if (job) last.current = job;
  const j = last.current;

  const history = React.useMemo(
    () => (j ? activity.filter((e) => !e.jobs || e.jobs.includes(j.id)).slice(0, ACTIVITY_LINES) : []),
    [activity, j],
  );

  if (!j) return null;

  const lot = lotDetails[j.id];
  const construction = j.board === "construction";
  // The document convention keys on the job number; a job without one files under its record ID.
  const prefix = j.jobNo || j.recordId;
  const title = `${j.jobNo ? `Job ${j.jobNo}` : "New job"} · ${j.client}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      icon={House}
      title={title}
      description={`${j.builder} · ${j.address}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Link href={jobHref(j.id)} className={buttonVariants({ variant: "default" })}>
            Open job page <ArrowUpRight />
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT, delay: reduce ? 0 : 0.08 }}
          className="flex flex-wrap items-center gap-1.5"
        >
          <Pill tone="neutral">
            Record ID <span className="font-mono">{j.recordId}</span>
          </Pill>
          <Pill tone="neutral">HubSpot · {j.hsStage}</Pill>
          <MondayPill job={j} long />
          <SyncBadge sync={j.sync} className="ml-auto" />
        </motion.div>

        {j.sync === "conflict" && j.conflict ? (
          <Box index={0} icon={AlertTriangle} title={`Conflict on ${j.conflict.field}`} problem>
            <p className="text-[13px] leading-relaxed text-rose-800 dark:text-rose-200">
              Launchpad: {j.conflict.hub}. Monday: {j.conflict.monday}. Nothing on this milestone syncs until it&apos;s
              resolved on the job page.
            </p>
          </Box>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Box index={1} icon={ClipboardList} title="Job details" meta={<Owner by="launchpad" />}>
            <dl>
              <Row label="Job number">
                {j.jobNo ? <span className="font-mono text-xs font-semibold">{j.jobNo}</span> : "Awaiting"}
              </Row>
              <Row label="Sale won date">{j.saleWon}</Row>
              <Row label="Site address">{j.address}</Row>
              <Row label="Buyer type">{j.buyerType}</Row>
              <Row label="Block titled">{j.blockTitled}</Row>
              {j.blockDue ? <Row label="Block titled due">{j.blockDue}</Row> : null}
            </dl>
          </Box>

          <Box index={2} icon={Lock} title="Deal details" meta={<Owner by="hubspot" />}>
            <dl>
              <Row label="Deal name">{j.jobNo ? `${j.jobNo} ${j.client}` : j.client}</Row>
              <Row label="Client">{j.client}</Row>
              <Row label="Sales rep">{j.rep}</Row>
              <Row label="Client phone">
                <span className="tabular-nums">{CLIENT_PHONE}</span>
              </Row>
              <Row label="Builder">{j.builder}</Row>
            </dl>
          </Box>

          <Box index={3} icon={MapPinned} title="Land and house">
            <dl>
              {LOT_FIELDS.map((f) => (
                <Row key={f.key} label={f.label}>
                  {lot?.[f.key]}
                </Row>
              ))}
            </dl>
          </Box>

          <Box
            index={4}
            icon={FolderOpen}
            title="Documents"
            meta={
              <Pill tone="neutral" className="tabular-nums">
                {DOCUMENT_SLOTS.filter((d) => d.uploaded).length} of {DOCUMENT_SLOTS.length}
              </Pill>
            }
          >
            <ul className="flex flex-col gap-1.5">
              {DOCUMENT_SLOTS.map((d) => (
                <li
                  key={d.slug}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border border-hairline px-3 py-2",
                    d.uploaded ? "bg-card" : "bg-canvas dark:bg-white/[0.02]",
                  )}
                >
                  {d.uploaded ? (
                    <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-label="Uploaded" />
                  ) : (
                    <Circle className="size-3.5 shrink-0 text-subtle-foreground" aria-label="Not uploaded" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-xs text-foreground">{d.label}</span>
                    <span className="block text-xs break-words text-subtle-foreground">
                      {d.uploaded ? (
                        <span className="font-mono">{`${prefix}_${d.slug}.pdf`}</span>
                      ) : (
                        "Not uploaded yet"
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Box>

          <Box index={5} icon={ClipboardList} title="Preconstruction" meta={doneCount(j.precon)}>
            <MilestoneList items={j.precon} />
          </Box>

          {construction ? (
            <Box index={6} icon={HardHat} title="Construction" meta={doneCount(j.milestones)}>
              <MilestoneList items={j.milestones} />
            </Box>
          ) : null}

          <Box
            index={construction ? 7 : 6}
            icon={History}
            title="Recent activity"
            className={construction ? "sm:col-span-2" : undefined}
          >
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing has been changed on this job through Launchpad yet.</p>
            ) : (
              <ul>
                {history.map((e, i) => (
                  <li key={`${e.when}-${i}`} className="border-t border-hairline py-2 first:border-t-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-[13px] font-medium text-foreground">{e.action}</p>
                      <p className="shrink-0 text-xs text-subtle-foreground">
                        {e.who} · {e.when}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
                    {e.targets.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {e.targets.map((t) => (
                          <Pill key={t} variant="caps" tone="neutral">
                            {t}
                          </Pill>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Box>
        </div>
      </div>
    </Dialog>
  );
}
