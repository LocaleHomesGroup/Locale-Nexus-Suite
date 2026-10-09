"use server";

import { getDb } from "@/server/db/postgres";
import { markLotSold, placeHold, releaseHold } from "./land-run";
import type { LandActionResult } from "./land-rules";

// Every async function this file exports is a public endpoint, so it exports only the three actions. The
// checks, the SQL and the reload live in land-run.ts, which takes the database as an argument.

/** Places a 24-hour hold, or joins the queue when the lot is already held. */
export async function placeHoldAction(lotId: string, staffId: string, client: string): Promise<LandActionResult> {
  return placeHold(getDb(), lotId, staffId, client);
}

/** Releases the holder's hold, or takes a queued rep out of the queue. */
export async function releaseHoldAction(holdId: string, staffId: string): Promise<LandActionResult> {
  return releaseHold(getDb(), holdId, staffId);
}

/** Deposit received: the holder marks the lot sold. */
export async function markLotSoldAction(holdId: string, staffId: string, client: string): Promise<LandActionResult> {
  return markLotSold(getDb(), holdId, staffId, client);
}
