"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Clock, TriangleAlert, Upload } from "lucide-react";
import { checklistFor } from "@/data/jobs";
import { useLaunchpad, confirm, type SubmissionStatus } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, PANEL_VARIANTS, rowDelay } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { useSalesTabReselect } from "../sales-state";
import { NewSubmissionDialog } from "./NewSubmissionDialog";
import { SubmissionDetail } from "./SubmissionDetail";
import {
  localDocsSetter,
  localStatusSetter,
  updateLocalSubmissions,
  useLocalSubmissions,
} from "./local-submissions";
import {
  NGUYEN_BUILDER,
  NGUYEN_CLIENT,
  NGUYEN_ID,
  isApproved,
  isChangesRequested,
  isFixDoc,
  isInReview,
  isVerifiedDoc,
  plural,
  statusLabel,
  surnameOf,
  type SubmissionBuilder,
} from "./data";

interface ListRow {
  key: string;
  client: string;
  builder: string;
  status: string;
  tone: PillTone;
  note: React.ReactNode;
  /** Needs the rep — rose ring and rose note. */
  hot: boolean;
  icon: "done" | "alert" | "waiting";
  /** Opens the submission; rows without one are read-only in the prototype. */
  onOpen?: () => void;
  action?: string;
}

/**
 * Sales → My Deal Submissions (mockup `gm`, `i === "submissions"`). The list
 * of the rep's submissions and what each is waiting on; the Nguyen deal is the
 * shared one Ops reviews, new ones start from "New deal submission".
 */
export function DealSubmissions() {
  const { submissionDocs, setSubmissionDocs, submissionStatus, setSubmissionStatus, notify, jobs, openJob } =
    useLaunchpad();
  const reduce = useReducedMotion();
  const local = useLocalSubmissions();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Re-clicking the open "My Deal Submissions" tab returns to the list, as the
  // mockup's tab setter did (`f(null)`). Adjusted during render, not in an effect.
  const reselect = useSalesTabReselect();
  const [seenReselect, setSeenReselect] = React.useState(reselect);
  if (reselect !== seenReselect) {
    setSeenReselect(reselect);
    setOpenId(null);
  }

  const localOpen = openId ? local.find((s) => s.id === openId) : undefined;
  const view = openId === NGUYEN_ID ? NGUYEN_ID : localOpen ? localOpen.id : "list";

  const start = (client: string, builder: SubmissionBuilder) => {
    let id = "";
    do id = "S-" + Math.floor(Math.random() * 900 + 100);
    while (id === NGUYEN_ID || local.some((s) => s.id === id));
    updateLocalSubmissions((prev) => [
      { id, client, builder, docs: checklistFor(builder), status: "draft" },
      ...prev,
    ]);
    setDialogOpen(false);
    setOpenId(id);
    const msg = `${surnameOf(client)} submission started · ${builder}`;
    notify(msg, "ok");
    confirm(msg);
  };

  // ── The list ───────────────────────────────────────────────────────────
  const barberJob = jobs.find((j) => j.jobNo === "25501");
  const rows: ListRow[] = [
    ...local.map<ListRow>((s) => {
      const outstanding = s.docs.filter((d) => d.req && !d.file).length;
      const review = isInReview(s.status);
      return {
        key: s.id,
        client: s.client,
        builder: s.builder,
        status: review ? "In ops review" : "In progress",
        tone: review ? "pending" : "problem",
        note: review ? "With Ops · awaiting review" : `${plural(outstanding, "required document")} outstanding`,
        hot: s.status === "draft",
        icon: review ? "waiting" : "alert",
        onOpen: () => setOpenId(s.id),
        action: "Continue",
      };
    }),
    nguyenRow(submissionStatus, submissionDocs, () => setOpenId(NGUYEN_ID)),
    {
      key: "okonkwo",
      client: "P. Okonkwo",
      builder: "Move Homes",
      status: "Awaiting docs",
      tone: "problem",
      note: "Finance letter requested by Ops",
      hot: true,
      icon: "alert",
    },
    {
      key: "barber",
      client: "B. Barber",
      builder: "Move Homes",
      status: "Approved",
      tone: "ok",
      note: barberJob ? (
        <>
          Pack sent to builder · job no{" "}
          <button
            type="button"
            onClick={() => openJob(barberJob.id)}
            className="font-mono text-[11px] text-haven-700 underline-offset-2 hover:underline dark:text-haven-300"
            aria-label={`Open job ${barberJob.jobNo}`}
          >
            {barberJob.jobNo}
          </button>{" "}
          issued
        </>
      ) : (
        "Pack sent to builder · job no 25501 issued"
      ),
      hot: false,
      icon: "done",
    },
  ];

  const dir = view === "list" ? -1 : 1;

  return (
    <>
      <div className="overflow-x-clip">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={view}
            custom={dir}
            variants={PANEL_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE_SWAP }}
          >
            {view === NGUYEN_ID ? (
              <SubmissionDetail
                docs={submissionDocs}
                setDocs={setSubmissionDocs}
                status={submissionStatus}
                setStatus={setSubmissionStatus}
                onBack={() => setOpenId(null)}
                client={NGUYEN_CLIENT}
                builder={NGUYEN_BUILDER}
              />
            ) : localOpen ? (
              <SubmissionDetail
                docs={localOpen.docs}
                setDocs={localDocsSetter(localOpen.id)}
                status={localOpen.status}
                setStatus={localStatusSetter(localOpen.id)}
                onBack={() => setOpenId(null)}
                client={localOpen.client}
                builder={localOpen.builder}
              />
            ) : (
              <div className="flex flex-col gap-6">
                <PageHeader
                  eyebrow="Sales"
                  title="My deal submissions"
                  description="Your deal submissions and what each one is waiting on. Ops reviews everything before it reaches the builder."
                  actions={
                    <Button onClick={() => setDialogOpen(true)}>
                      <Upload /> New deal submission
                    </Button>
                  }
                />
                <Reveal index={0}>
                  <Card className="overflow-hidden">
                    <ul className="py-1">
                      <AnimatePresence initial={false}>
                        {rows.map((row, i) => (
                          <motion.li
                            key={row.key}
                            layout="position"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              transition: { duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(i, reduce) },
                            }}
                            className="border-t border-hairline first:border-t-0"
                          >
                            <SubmissionRow row={row} />
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </Card>
                </Reveal>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <NewSubmissionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onStart={start} />
    </>
  );
}

/** The Nguyen row reads the shared submission, so Ops' decisions show up here. */
function nguyenRow(
  status: SubmissionStatus,
  docs: { req: boolean; file: string; state: string }[],
  open: () => void,
): ListRow {
  const approved = isApproved(status);
  const review = isInReview(status);
  const changes = isChangesRequested(status);
  const outstanding = docs.filter((d) => d.req && !d.file).length;
  const fixes = docs.filter((d) => isFixDoc(d.state)).length;
  const verified = docs.filter((d) => isVerifiedDoc(d.state)).length;
  const withFile = docs.filter((d) => d.file).length;
  const hot = !approved && !review;
  return {
    key: NGUYEN_ID,
    client: NGUYEN_CLIENT,
    builder: NGUYEN_BUILDER,
    status: statusLabel(status),
    tone: approved ? "ok" : hot ? "problem" : "pending",
    note: approved
      ? "Pack sent to Forma · awaiting job number"
      : review
        ? `With Ops · ${verified} of ${withFile} documents verified`
        : changes
          ? `${plural(fixes, "document")} sent back — action needed`
          : `${plural(outstanding, "required document")} outstanding`,
    hot,
    icon: approved ? "done" : hot ? "alert" : "waiting",
    onOpen: open,
    action: hot ? "Continue" : "View",
  };
}

function SubmissionRow({ row }: { row: ListRow }) {
  const Icon = row.icon === "done" ? Check : row.icon === "alert" ? TriangleAlert : Clock;
  const body = (
    <>
      <Icon
        className={cn(
          "size-4 shrink-0",
          row.icon === "done"
            ? "text-emerald-600 dark:text-emerald-400"
            : row.icon === "alert"
              ? "text-rose-600 dark:text-rose-400"
              : "text-muted-foreground",
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1 basis-[220px]">
        <span className="block text-[13px] font-semibold">
          {row.client} <span className="font-normal text-muted-foreground">· {row.builder}</span>
        </span>
        <span
          className={cn(
            "block text-[11.5px]",
            row.hot ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground",
          )}
        >
          {row.note}
        </span>
      </span>
      <Pill variant="caps" tone={row.tone}>
        {row.status}
      </Pill>
      {row.action ? (
        <span className="inline-flex w-[88px] items-center justify-end gap-1 text-xs font-semibold whitespace-nowrap text-haven-700 dark:text-haven-300">
          {row.action}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      ) : (
        <span className="hidden w-[88px] sm:block" aria-hidden />
      )}
    </>
  );

  // Every row sits inset by the same amount so pills and actions line up; a
  // row that needs the rep gets the mockup's rose attention ring on top.
  const shell = cn(
    "mx-1.5 flex w-[calc(100%-0.75rem)] flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-3 py-3 text-left",
    row.hot && "pulse-rose my-1",
  );

  return row.onOpen ? (
    <button
      type="button"
      onClick={row.onOpen}
      className={cn(
        shell,
        "group cursor-pointer transition-colors hover:bg-haven-50/60 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none dark:hover:bg-haven-950/25",
      )}
    >
      {body}
    </button>
  ) : (
    <div className={shell}>{body}</div>
  );
}
