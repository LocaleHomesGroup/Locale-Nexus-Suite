"use client";

import { useLaunchpad } from "@/state/launchpad-store";
import { DEVELOPER } from "@/data/portal";
import type { Job, LotDetail } from "@/data/jobs";
import { currentStage, type JourneyStageId } from "@/data/journey";
import type { PillTone } from "@/components/ui/pill";

/**
 * Pieces the Developer portal's sections share: its Locale clients (live from
 * the Launchpad store) and how a journey stage reads from the builder's side.
 */
export interface DeveloperJob {
  job: Job;
  lot: LotDetail;
  stage: JourneyStageId | "done";
}

/** Every job Locale has sold this developer's homes on, live. */
export function useDeveloperJobs(): DeveloperJob[] {
  const { jobs, lotDetails } = useLaunchpad();
  return jobs
    .filter((j) => j.builder === DEVELOPER)
    .map((job) => ({ job, lot: lotDetails[job.id], stage: currentStage(job)?.id ?? "done" }));
}

/** Who has the next move at each post-sale stage, from the builder's side. */
export const STAGE_VIEW: Partial<Record<JourneyStageId | "done", { label: string; tone: PillTone; withYou: boolean }>> =
  {
    operations: { label: "Locale operations", tone: "neutral", withYou: false },
    precon: { label: "Pre-construction", tone: "tone", withYou: true },
    construction: { label: "Construction", tone: "tone", withYou: true },
    handover: { label: "Handover", tone: "ok", withYou: true },
    done: { label: "Complete", tone: "ok", withYou: false },
  };

/** "The Aspen · Lot 361, Seaside Rise" */
export const homeLine = (lot: LotDetail) => `${lot.design} · ${lot.lot.split(",")[0]}, ${lot.estate}`;
