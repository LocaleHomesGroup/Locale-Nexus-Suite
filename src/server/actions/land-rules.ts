import type { LiveLot } from "@/data/live/types";

/** The board after an action. `lots` is null when the reload failed: on success that still means the action went through. */
export type LandActionResult = { ok: true; lots: LiveLot[] | null } | { ok: false; error: string; lots: LiveLot[] | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Checked before the database is asked. There's no sign-in yet, so the staff id
 * is whoever "Viewing as" names: the deployment must be protected (spec section 7).
 */
export function checkHoldInput(input: { lotId?: string; holdId?: string; staffId: string; client?: string }): string | null {
  if (input.lotId !== undefined && !UUID.test(input.lotId)) return "That lot isn't recognised. Reload the page.";
  if (input.holdId !== undefined && !UUID.test(input.holdId)) return "That hold isn't recognised. Reload the page.";
  if (!STAFF_ID.test(input.staffId)) return "Pick who you're viewing as first.";
  if ((input.client ?? "").length > 120) return "Keep the client's name under 120 characters.";
  return null;
}

const MESSAGES: Record<string, string> = {
  land_lot_not_found: "That lot has gone from the list. Reload the page.",
  land_lot_not_available: "Someone got there first: this lot isn't available any more.",
  land_hold_already_yours: "You already hold this lot, or you're in its queue.",
  land_hold_queue_full: "The hold queue is full: three reps are already on this lot.",
  land_hold_not_open: "That hold has already ended.",
  land_hold_not_yours: "Only the rep who placed the hold can do that.",
  land_hold_not_active: "Your hold has lapsed, so the lot can't be marked sold from it.",
};

export function landErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  for (const [code, message] of Object.entries(MESSAGES)) if (text.includes(code)) return message;
  console.error("[exclusive-land] unexpected error:", e);
  return "That didn't go through. Try again in a moment.";
}
