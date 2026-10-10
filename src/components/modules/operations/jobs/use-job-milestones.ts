"use client";

import * as React from "react";
import type { Job } from "@/data/jobs";
import { jobMilestones } from "@/server/actions/jobs";
import { withMilestones, type FetchedMilestones, type MilestoneLoad } from "./milestone-load";

/**
 * A live job's milestones, for the screen that shows them. The job list carries only a summary of them, so this asks for the
 * rest on mount and whenever the job changes, and drops an answer the screen has moved on from (as LiveDocumentsCard does for
 * files). `live` says the job's milestones are fetched at all (a sample job keeps its own). `active` is whether to ask now, for
 * a dialog that is only sometimes open: each time it turns on the earlier answer is dropped and it asks afresh, and while it
 * is off the last answer stays, which a closing dialog still draws as it fades out.
 *
 * Returns the job with its milestones once they are in, and where they are: loading, failed, or ready.
 */
export function useJobMilestones<J extends Job | undefined>(job: J, live: boolean, active: boolean = live): { job: J; load: MilestoneLoad } {
  const id = job?.id;
  const [fetched, setFetched] = React.useState<FetchedMilestones>(null);
  const [wasActive, setWasActive] = React.useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setFetched(null);
  }
  React.useEffect(() => {
    if (!live || !active || id === undefined) return;
    let cancelled = false;
    jobMilestones(id).then(
      (found) => !cancelled && setFetched({ id, found }),
      () => !cancelled && setFetched({ id, found: "failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [live, active, id]);
  return React.useMemo(() => withMilestones(job, live, fetched), [job, live, fetched]);
}
