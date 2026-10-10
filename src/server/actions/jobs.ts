"use server";

import type { Milestone } from "@/data/jobs";
import { getDb } from "@/server/db/postgres";
import { loadJobMilestones } from "@/server/read/jobs";

/**
 * A live job's milestones, for the job page and the Operations View dialog. The job list carries only a summary of them,
 * so a job's own screen asks for the rest. With no database there are none. A failure rejects, so the screen can say so.
 */
export async function jobMilestones(itemId: number): Promise<{ precon: Milestone[]; milestones: Milestone[] }> {
  if (!Number.isSafeInteger(itemId) || itemId <= 0) return { precon: [], milestones: [] };
  const db = getDb();
  if (!db) return { precon: [], milestones: [] };
  return loadJobMilestones(db, itemId);
}
