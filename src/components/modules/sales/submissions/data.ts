/**
 * My Deal Submissions — the rep's side of the deal-submission workflow
 * (mockup `gm` "submissions" tab + `rc`). The Nguyen submission is shared with
 * Operations → Submission review through the store; everything here is the
 * static copy and the status vocabulary both sides agree on.
 */
import type { PillTone } from "@/components/ui/pill";
import type { SubmissionStatus } from "@/state/launchpad-store";

/** The Nguyen deal — the one Ops reviews (mockup id "S-118"). */
export const NGUYEN_ID = "S-118";
export const NGUYEN_CLIENT = "M. and T. Nguyen";
export const NGUYEN_BUILDER = "Forma";
export const SUBMISSION_REP = "K. Ellery";

export const SUBMISSION_BUILDERS = ["Forma", "Move Homes", "La Vida", "New Era", "New Choice"] as const;
export type SubmissionBuilder = (typeof SUBMISSION_BUILDERS)[number];

/** What each builder's paperwork adds, shown in the New deal submission dialog. */
export const BUILDER_SUBMISSION_NOTE: Record<SubmissionBuilder, string> = {
  Forma: ", delivered to their Teams folder as a checklist workbook",
  "Move Homes": ", plus a Delayed Title Agreement if titles are more than 9 months out",
  "La Vida": ", and the pack is emailed to their submissions inbox",
  "New Era": ". Contracts are created 4 to 6 weeks after submission",
  "New Choice": ", including a BAL certificate under 12 months old",
};

export const SUBMISSION_STEPS = [
  "Deal details",
  "Land and title",
  "Finance and deposit",
  "Documents",
  "Review and submit",
] as const;

/** Steps 1–3 are captured from the deal record; the rep only confirms them. */
export const STEP_FACTS: Record<1 | 2 | 3, [label: string, value: string][]> = {
  1: [
    ["Buyers", "M. Nguyen and T. Nguyen · IDs attached"],
    ["Buyer type", "Retail"],
    ["Rep", "K. Ellery"],
  ],
  2: [
    ["Lot and street", "Lot 361 Camperdown Way, Lakelands"],
    ["Titles due", "12 Jul 2027 · flagged: 9+ months out"],
    ["Zoning", "RMD-R40 · proof attached"],
  ],
  3: [
    ["Finance", "Bank · broker: R. Chen, Locale Financial"],
    ["Deposit", "$5,000 non-refundable · paid"],
    ["Settlement agent", "Captured · land agent captured"],
  ],
};

export const DOC_CATEGORIES = ["Build", "Land", "Finance"] as const;

/* ── Shared status vocabulary ───────────────────────────────────────────
 * The mockup writes doc state "verified" / "fix" and submission status
 * "draft" → "review" → "changes" | "approved". `SubmissionDoc`'s comment in
 * src/data/jobs.ts calls an accepted doc "ok", so both spellings are read as
 * verified — whichever the Ops review writes, the rep sees the same thing.
 */
export const isVerifiedDoc = (state: string) => state === "verified" || state === "ok";
export const isFixDoc = (state: string) => state === "fix";

export const isApproved = (s: SubmissionStatus) => s === "approved";
export const isInReview = (s: SubmissionStatus) => s === "review" || s === "submitted";
export const isChangesRequested = (s: SubmissionStatus) => s === "changes" || s === "fix";
/** Submitted = with Ops or past it; the form is read-only from the rep's side. */
export const isSubmitted = (s: SubmissionStatus) => isInReview(s) || isApproved(s);

export function statusLabel(s: SubmissionStatus): string {
  if (isApproved(s)) return "Approved";
  if (isInReview(s)) return "In ops review";
  if (isChangesRequested(s)) return "Changes requested";
  return "In progress";
}

/** Status carries a verdict (UI guide § 1): done emerald, in review amber, action rose. */
export function statusTone(s: SubmissionStatus): PillTone {
  if (isApproved(s)) return "ok";
  if (isInReview(s)) return "pending";
  if (isChangesRequested(s)) return "problem";
  return "neutral";
}

/** "M. and T. Nguyen" → "Nguyen" — the surname used in file names and messages. */
export const surnameOf = (client: string) => client.trim().split(" ").pop() ?? client;

export const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? "s" : ""}`;
