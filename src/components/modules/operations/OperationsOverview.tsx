"use client";

import { AlertTriangle, ArrowLeftRight, ClipboardCheck, FileSpreadsheet, Hash, Hourglass, House, ShieldCheck, Tags } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { DashboardOverview } from "../overview/DashboardOverview";
import { isAwaiting, needsSync } from "./jobs/filters";
import { jobRef } from "./review/review";
import { STATIC_QUEUE } from "./submissions/data";
import { PRICE_LISTS } from "./pricing/data";
import { FORMATTER_JOBS } from "./formatter/data";

/**
 * Operations › Overview. Jobs, sync and the review queue are read live from the
 * store, so settling job 25501's conflict clears its card here too; the
 * submission board, price lists and formatter jobs are the sections' own data.
 */
export function OperationsOverview() {
  const { jobs, reviewItems } = useLaunchpad();

  const construction = jobs.filter((j) => j.board === "construction").length;
  const conflicts = jobs.filter(needsSync);
  const awaiting = jobs.filter(isAwaiting).length;
  const held = reviewItems.filter((i) => i.status === "pending").length;
  // The submission board: its static deals plus the live Nguyen submission.
  const inSubmission = Object.values(STATIC_QUEUE).flat().length + 1;
  const waitingOnDocs = STATIC_QUEUE.docs.length;
  const published = PRICE_LISTS.filter((p) => p.status === "Published").length;
  const due = PRICE_LISTS.filter((p) => p.status === "Awaiting PDF").map((p) => p.builder);
  const changes = PRICE_LISTS.reduce((n, p) => n + p.changes, 0);
  const changedLists = PRICE_LISTS.filter((p) => p.changes > 0).length;
  const outputs = FORMATTER_JOBS.filter((j) => j.status === "Complete");

  return (
    <DashboardOverview
      title="Operations overview"
      description="Jobs, deal submissions and builder price lists, as they stand this morning."
      headline={[
        {
          label: "Jobs",
          value: jobs.length,
          sub: `${construction} construction · ${jobs.length - construction} sales`,
          icon: House,
          to: "operations:jobs",
        },
        {
          label: "Sync needs attention",
          value: conflicts.length,
          sub: conflicts.length
            ? `Job ${jobRef(conflicts[0])} · ${conflicts[0].client}`
            : "Monday and Launchpad agree",
          icon: conflicts.length ? AlertTriangle : ShieldCheck,
          tone: "ok",
          alert: conflicts.length > 0,
          to: "operations:jobs",
          query: { filter: "sync" },
        },
        {
          label: "Review queue",
          value: held,
          sub: held ? "held from Monday and HubSpot" : "nothing held",
          icon: Hourglass,
          tone: held ? "pending" : "ok",
          to: "operations:review",
        },
        {
          label: "In submission",
          value: inSubmission,
          sub: `${waitingOnDocs} waiting on documents`,
          icon: ClipboardCheck,
          to: "operations:submissions",
        },
      ]}
      moreLabel="More from each section"
      more={[
        {
          label: "Awaiting a job number",
          value: awaiting,
          sub: awaiting ? "the builder hasn't issued one" : "every job is numbered",
          icon: Hash,
          tone: "pending",
          to: "operations:jobs",
          query: { filter: "awaiting" },
        },
        {
          label: "Price lists current",
          value: `${published} of ${PRICE_LISTS.length}`,
          sub: due.length ? `${due.join(", ")} due` : "every builder is current",
          icon: Tags,
          to: "operations:pricing",
        },
        {
          label: "Price changes",
          value: changes,
          sub: `this month · ${changedLists} lists`,
          icon: ArrowLeftRight,
          to: "operations:pricing",
        },
        {
          label: "Formatter outputs",
          value: outputs.length,
          sub: outputs[0]?.note ?? "none ready",
          icon: FileSpreadsheet,
          to: "operations:formatter:jobs",
        },
      ]}
    />
  );
}
