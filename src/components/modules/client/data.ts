/**
 * Client portal — the static half of one client's journey: the stages before
 * there was a job (enquiry, consultation, finance, package), the budget split,
 * the builder options their consultation was matched to, and their documents.
 * The live half (milestones, messages, site updates) comes from the shared
 * stores, so it moves when Operations or the builder moves it.
 *
 * The client is job 25431 (`CLIENT_JOB_ID`): R. de Thierry and J. Kumar,
 * The Aspen by Forma at Seaside Rise, Lakelands. Prices are Forma's price list
 * (sales/costing/data.ts) and the Seaside Rise land price Rapid costing uses.
 */
import { DEFAULT_LAND_PRICE, HOUSE_BASE_PRICE } from "@/components/modules/sales/costing/data";
import type { JourneyStageId } from "@/data/journey";

/** The client's consultant, from the job (`rep`). */
export const CONSULTANT_ROLE = "Home sales consultant";

/** What happened at each stage before the sale, and when. */
export const PRE_SALE: Partial<Record<JourneyStageId, { date: string; detail: string }>> = {
  enquiry: { date: "02 Oct 2025", detail: "Website enquiry: first home, northern suburbs, around $600k." },
  consultation: { date: "09 Oct 2025", detail: "58-minute Teams call with A. Mercer, recorded with your consent." },
  finance: { date: "16 Oct 2025", detail: "Locale Financial assessed your borrowing capacity at $700,000." },
  package: {
    date: "30 Oct 2025",
    detail: "Four house and land packages from four builders, scored against your brief.",
  },
};

/* ── Finance ───────────────────────────────────────────────────────────── */

/**
 * The budget, as the meeting describes it: find out what the client can borrow,
 * then split it between the land and the build and package it up.
 */
export const BORROWING_CAPACITY = 700_000;
export const PRE_APPROVAL = { date: "24 Oct 2025", lender: "Arranged by Locale Financial" };

export const PACKAGE_SPLIT = {
  land: { amount: DEFAULT_LAND_PRICE, label: "Land", detail: "Lot 361, 8 Camperdown Way, Seaside Rise" },
  build: { amount: HOUSE_BASE_PRICE["The Aspen"], label: "Build", detail: "The Aspen, Forma base price" },
  extras: {
    amount: 31_600,
    label: "Site costs and upgrades",
    detail: "Fixed site works, BAL-12.5, alfresco and ducted air",
  },
} as const;

export const PACKAGE_TOTAL = PACKAGE_SPLIT.land.amount + PACKAGE_SPLIT.build.amount + PACKAGE_SPLIT.extras.amount;
/** The build contract with Forma: the house plus site costs and upgrades. */
export const BUILD_CONTRACT = PACKAGE_SPLIT.build.amount + PACKAGE_SPLIT.extras.amount;

/**
 * Progress payments on the build contract, each due when its milestone is
 * reached. A standard schedule; the contract has the exact amounts.
 */
export const PROGRESS_PAYMENTS: { stage: string; milestone: string; pct: number }[] = [
  { stage: "Deposit", milestone: "Deposit Claim", pct: 5 },
  { stage: "Slab", milestone: "Slab Down", pct: 15 },
  { stage: "Plate height", milestone: "Plate Height", pct: 20 },
  { stage: "Roof cover", milestone: "Roof Cover", pct: 20 },
  { stage: "Lock up", milestone: "Lock Up", pct: 25 },
  { stage: "Practical completion", milestone: "Practical Completion", pct: 15 },
];

/* ── My options: the builder match ─────────────────────────────────────── */

/** What the consultation recording says the client wants (read by AI, checked by A. Mercer). */
export const BRIEF: { label: string; value: string }[] = [
  { label: "Budget", value: "Up to $700,000, ideally under $600,000" },
  { label: "Home", value: "4 bedrooms, 2 bathrooms and a study" },
  { label: "Storeys", value: "Single storey, low-maintenance block" },
  { label: "Where", value: "Lakelands or close by, near schools and the train" },
  { label: "Timing", value: "Keys before the end of 2026" },
];

/** What worried them, in their words — each one is answered in the scores. */
export const CONCERNS: { said: string; answer: string }[] = [
  {
    said: "What if the builder goes broke halfway through?",
    answer: "Builder confidence weighs years trading, on-time handovers and home indemnity insurance.",
  },
  {
    said: "We don't want surprise site costs.",
    answer: "Every package price includes fixed site works, so the totals compare like for like.",
  },
];

export type MatchFactor = "budget" | "brief" | "time" | "confidence";

/** How the match score is weighted. */
export const FACTORS: { key: MatchFactor; label: string; weight: number; detail: string }[] = [
  { key: "brief", label: "Brief fit", weight: 0.35, detail: "Bedrooms, study, single storey, location" },
  { key: "budget", label: "Budget fit", weight: 0.3, detail: "Package total against what you can borrow" },
  {
    key: "confidence",
    label: "Builder confidence",
    weight: 0.2,
    detail: "Years trading, on-time handovers, insurance",
  },
  { key: "time", label: "Build time", weight: 0.15, detail: "Weeks from site start to keys" },
];

export interface MatchOption {
  builder: string;
  design: string;
  spec: string;
  estate: string;
  land: number;
  /** Build contract including fixed site costs. */
  build: number;
  weeks: number;
  factors: Record<MatchFactor, number>;
  /** Why it scored as it did, in a sentence. */
  why: string;
}

export const MATCHES: MatchOption[] = [
  {
    builder: "Forma",
    design: "The Aspen",
    spec: "4 bed · 2 bath · study · 192 sqm",
    estate: "Seaside Rise, Lakelands",
    land: PACKAGE_SPLIT.land.amount,
    build: BUILD_CONTRACT,
    weeks: 32,
    factors: { brief: 96, budget: 94, confidence: 93, time: 84 },
    why: "Every room on your list, in Lakelands, with room to spare under your borrowing.",
  },
  {
    builder: "Move Homes",
    design: "The Fremont",
    spec: "4 bed · 2 bath · theatre · 198 sqm",
    estate: "Wellard Glen, Wellard",
    land: 259_000,
    build: 337_200,
    weeks: 30,
    factors: { brief: 82, budget: 85, confidence: 86, time: 92 },
    why: "The fastest build, but a theatre instead of a study, and further from your train line.",
  },
  {
    builder: "La Vida",
    design: "The Lucia",
    spec: "3 bed · 2 bath · study · 173 sqm",
    estate: "Rivergums, Baldivis",
    land: 236_000,
    build: 305_900,
    weeks: 36,
    factors: { brief: 68, budget: 92, confidence: 80, time: 74 },
    why: "The lowest price, but three bedrooms and further south than you wanted.",
  },
  {
    builder: "New Choice",
    design: "The Sorrento",
    spec: "4 bed · 2 bath · 186 sqm",
    estate: "The Gardens, Lakelands",
    land: 365_000,
    build: 289_300,
    weeks: 40,
    factors: { brief: 78, budget: 62, confidence: 84, time: 60 },
    why: "The right suburb, but over your ideal budget and the longest wait for keys.",
  },
];

/** The weighted match score, 0–100. */
export function matchScore(m: MatchOption): number {
  return Math.round(FACTORS.reduce((sum, f) => sum + m.factors[f.key] * f.weight, 0));
}

/* ── Documents ─────────────────────────────────────────────────────────── */

export type DocGroup = "Your package" | "Finance" | "Your build" | "At handover";

export interface ClientDoc {
  name: string;
  file: string;
  group: DocGroup;
  /** The milestone that produces it; until then it shows when it will arrive. */
  after?: string;
  /** Needs the client's signature (shown as "Signed" once its milestone is done). */
  signed?: boolean;
}

export const CLIENT_DOCS: ClientDoc[] = [
  {
    name: "Sales quotation",
    file: "Forma_Aspen_Quote_25431.pdf",
    group: "Your package",
    signed: true,
    after: "Builder Acceptance",
  },
  {
    name: "Compliance sketch",
    file: "Lot361_ComplianceSketch.pdf",
    group: "Your package",
    signed: true,
    after: "Compliance Sketch and Quote approved",
  },
  {
    name: "Offer and acceptance (land)",
    file: "Lot361_OandA.pdf",
    group: "Your package",
    signed: true,
    after: "Builder Acceptance",
  },
  { name: "Seaside Rise design guidelines", file: "Seaside_Rise_DesignGuidelines.pdf", group: "Your package" },
  { name: "Finance pre-approval", file: "PreApproval_Oct2025.pdf", group: "Finance" },
  {
    name: "Formal finance approval",
    file: "FormalApproval_25431.pdf",
    group: "Finance",
    after: "Formal Finance Approval",
  },
  {
    name: "Land settlement statement",
    file: "Lot361_Settlement.pdf",
    group: "Finance",
    after: "Settlement Confirmation",
  },
  {
    name: "Building contract",
    file: "Forma_Contract_25431.pdf",
    group: "Your build",
    signed: true,
    after: "Contracts Signed",
  },
  {
    name: "Home indemnity insurance",
    file: "HII_Certificate_25431.pdf",
    group: "Your build",
    after: "Contracts Signed",
  },
  {
    name: "Prestart selections",
    file: "Prestart_Selections_25431.pdf",
    group: "Your build",
    signed: true,
    after: "Prestart Meeting",
  },
  { name: "Building permit", file: "BuildingPermit_25431.pdf", group: "Your build", after: "Build Permit Received" },
  {
    name: "Practical completion report",
    file: "PCI_Report_25431.pdf",
    group: "At handover",
    after: "Practical Completion",
  },
  { name: "Keys and handover pack", file: "Handover_Pack_25431.pdf", group: "At handover", after: "Key Handover" },
  {
    name: "Warranty and maintenance guide",
    file: "Forma_Warranty_Guide.pdf",
    group: "At handover",
    after: "Key Handover",
  },
];

/** How long Locale keeps a client's records (the data retention policy). */
export const RETENTION_YEARS = 7;
