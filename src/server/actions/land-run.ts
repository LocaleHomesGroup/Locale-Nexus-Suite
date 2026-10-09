import type { Db } from "@/server/db/types";
import { loadLots } from "@/server/read/lots";
import { checkHoldInput, landErrorMessage, type LandActionResult } from "./land-rules";

/**
 * The Exclusive Land actions with the database passed in, so a test can hand them PGlite or a stub. land.ts is
 * the "use server" file that supplies getDb(); it exports only the three actions, because every async function a
 * "use server" file exports is a public endpoint.
 *
 * A server action takes whatever a request body carries, so the arguments are `unknown` here and anything that
 * isn't a string becomes "": the input check then refuses it with its own sentence, and nothing can throw at .trim().
 */
const text = (v: unknown): string => (typeof v === "string" ? v : "");

async function run(db: Db | null, sql: string, params: unknown[]): Promise<LandActionResult> {
  if (!db) return { ok: false, error: "Live data isn't connected.", lots: null };
  try {
    await db.query(sql, params);
  } catch (e) {
    return { ok: false, error: landErrorMessage(e), lots: await loadLots(db).catch(() => null) };
  }
  // The action went through: a reload that fails mustn't report it as failed.
  return { ok: true, lots: await loadLots(db).catch(() => null) };
}

/** Places a 24-hour hold, or joins the queue when the lot is already held. */
export async function placeHold(db: Db | null, lotId: unknown, staffId: unknown, client: unknown): Promise<LandActionResult> {
  const lot = text(lotId);
  const staff = text(staffId);
  const who = text(client);
  const bad = checkHoldInput({ lotId: lot, staffId: staff, client: who });
  if (bad) return { ok: false, error: bad, lots: null };
  return run(db, "select launchpad.place_hold($1::uuid, $2, $3)", [lot, staff, who.trim() || null]);
}

/** Releases the holder's hold, or takes a queued rep out of the queue. */
export async function releaseHold(db: Db | null, holdId: unknown, staffId: unknown): Promise<LandActionResult> {
  const hold = text(holdId);
  const staff = text(staffId);
  const bad = checkHoldInput({ holdId: hold, staffId: staff });
  if (bad) return { ok: false, error: bad, lots: null };
  return run(db, "select launchpad.release_hold($1::uuid, $2)", [hold, staff]);
}

/** Deposit received: the holder marks the lot sold. */
export async function markLotSold(db: Db | null, holdId: unknown, staffId: unknown, client: unknown): Promise<LandActionResult> {
  const hold = text(holdId);
  const staff = text(staffId);
  const who = text(client);
  const bad = checkHoldInput({ holdId: hold, staffId: staff, client: who });
  if (bad) return { ok: false, error: bad, lots: null };
  return run(db, "select launchpad.mark_lot_sold($1::uuid, $2, $3)", [hold, staff, who.trim() || null]);
}
