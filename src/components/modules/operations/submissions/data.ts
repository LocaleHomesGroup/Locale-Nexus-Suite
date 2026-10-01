/**
 * Operations → Submission review — static board content from the mockup
 * (`lm` queue + `am` Ops review). The Nguyen deal itself is NOT here: it lives
 * in the store (`submissionDocs` / `submissionStatus`) because the rep edits the
 * same record in Sales → My Deal Submissions.
 *
 * Shared vocabulary with Sales (keep identical):
 *   doc.state          ""         not reviewed
 *                      "verified" accepted by Ops
 *                      "fix"      sent back to the rep with `fixNote`
 *   submissionStatus   "draft"    rep still completing documents
 *                      "review"   submitted, waiting in the Ops review queue
 *                      "changes"  Ops requested a fix — back with the rep
 *                      "approved" approved, builder pack generated and delivered
 */

export type DocState = "" | "verified" | "fix";

// Readers accept the aliases in the store's type comment ("ok", "submitted",
// "fix") so either side can be ported first; writers use the mockup values.
export const isVerified = (state: string) => state === "verified" || state === "ok";
export const isInReview = (status: string) => status === "review" || status === "submitted";
export const isChangesRequested = (status: string) => status === "changes" || status === "fix";

export type StageKey = "draft" | "docs" | "review" | "submitted" | "accepted";

export interface PipelineStage {
  key: StageKey;
  label: string;
  note: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { key: "draft", label: "Rep draft", note: "Data entered once" },
  { key: "docs", label: "Docs required", note: "Checklist enforced" },
  { key: "review", label: "Ops review", note: "Clean ~30 min · flagged 1 hr+" },
  { key: "submitted", label: "Sent to builder", note: "Auto-delivered" },
  { key: "accepted", label: "Builder accepted", note: "Job no issued" },
];

export interface QueueCard {
  client: string;
  builder: string;
  /** Rep initials, as the board shows them. */
  rep: string;
  /** "uploaded/required". */
  docs: string;
  /** Amber line — what is holding it up. */
  flag?: string;
  /** Muted line — where it is now. */
  est?: string;
}

/** The deals on the board other than the live Nguyen submission. */
export const STATIC_QUEUE: Record<StageKey, QueueCard[]> = {
  draft: [{ client: "R. Singh", builder: "New Era", rep: "KE", docs: "2/8" }],
  docs: [
    { client: "P. Okonkwo", builder: "Move Homes", rep: "AM", docs: "6/8", flag: "Awaiting finance letter" },
    { client: "T. and S. Mwangi", builder: "Levita", rep: "DO", docs: "5/7", flag: "Deposit receipt missing" },
  ],
  review: [],
  submitted: [{ client: "J. and L. Carmody", builder: "Levita", rep: "DO", docs: "7/7", est: "Sent 4 Aug, 2:10pm" }],
  accepted: [{ client: "B. Barber", builder: "Move Homes", rep: "AM", docs: "8/8", est: "Job no 25501 issued" }],
};

export const NGUYEN = {
  client: "M. and T. Nguyen",
  builder: "Forma",
  rep: "KE",
  repName: "K. Ellery",
} as const;

/** The static "Ops review — M. and T. Nguyen" summary card on the queue. */
export const OPS_CHECKLIST: [string, boolean][] = [
  ["Signed contract pack", true],
  ["Deposit receipt", true],
  ["Finance pre-approval letter", true],
  ["Compliance sketch matches quote", true],
  ["Pricing checked against current price list", false],
  ["Builder form fields complete", false],
];

export const DELIVERY_METHODS: [string, string][] = [
  ["Move Homes", "Excel workbook · Teams folder"],
  ["Forma", "Excel workbook · Teams folder"],
  ["Levita", "PDF · strict email subject line"],
  ["New Choice", "Most complex · manual steps"],
  ["New Era", "PDFs by email · no shared folder"],
];

/** Checks run on every uploaded document before Ops opens it. */
export const AUTOMATED_CHECKS: [string, boolean][] = [
  ["Filename matches convention", true],
  ["Buyer names match the deal record", true],
  ["Signature present on final page", true],
  ["Dated within validity period", true],
];

export const FIX_REASONS = ["Wrong document", "Not signed", "Illegible scan", "Out of date"] as const;

export const DEFAULT_FIX_NOTE = "Please re-upload a correct copy";

/**
 * What the rep entered on the deal form (from the mockup's Sales submission
 * wizard, steps 1–3) — shown beside a document in "Compare to deal form".
 */
export const DEAL_FORM: { section: string; rows: [string, string][] }[] = [
  {
    section: "Deal details",
    rows: [
      ["Buyers", "M. Nguyen and T. Nguyen · IDs attached"],
      ["Buyer type", "Retail"],
      ["Rep", "K. Ellery"],
    ],
  },
  {
    section: "Land and title",
    rows: [
      ["Lot and street", "Lot 361 Camperdown Way, Lakelands"],
      ["Titles due", "12 Jul 2027 · flagged: 9+ months out"],
      ["Zoning", "RMD-R40 · proof attached"],
    ],
  },
  {
    section: "Finance and deposit",
    rows: [
      ["Finance", "Bank · broker: R. Chen, Locale Financial"],
      ["Deposit", "$5,000 non-refundable · paid"],
      ["Settlement agent", "Captured · land agent captured"],
    ],
  },
];

/** Pages in the simulated document preview. */
export const PREVIEW_PAGES = 3;
