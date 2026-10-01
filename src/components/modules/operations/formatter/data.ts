/**
 * Operations → Doc formatter — static content from the mockup (`dm` + `sm`).
 * The upload is simulated: whichever file you "drop", extraction returns the
 * Forma August 2026 price list below.
 */

export type FormatterView = "upload" | "processing" | "review" | "changes" | "jobs" | "templates";

/** Sub-view order, for the direction of the panel slide. */
export const VIEW_ORDER: FormatterView[] = ["upload", "processing", "review", "changes", "jobs", "templates"];

export const SAMPLE_FILE = { name: "Forma_PriceList_Aug26.pdf", size: "2.4 MB" } as const;

export type TemplateBrand = "Homes" | "Group" | "Wealth";

export const OUTPUT_TEMPLATES: { name: string; brand: TemplateBrand }[] = [
  { name: "Homes · Builder price list", brand: "Homes" },
  { name: "Homes · Variation price schedule", brand: "Homes" },
  { name: "Group · Rapid costing input", brand: "Group" },
  { name: "Wealth · Portfolio summary", brand: "Wealth" },
];

export const DEFAULT_TEMPLATE = "Homes · Builder price list";

// ── Processing ────────────────────────────────────────────────────────────

export const PROCESS_STEPS = ["Reading the file", "Extracting fields", "Matching to template"] as const;
/** When each step completes (ms after Start), then when review opens. */
export const STEP_AT = [700, 1500, 2300] as const;
export const REVIEW_AT = 3000;

// ── Extraction review ─────────────────────────────────────────────────────

export interface ExtractedField {
  /** Field label. */
  k: string;
  /** Extracted (or corrected) value; "" = not found. */
  v: string;
  /** Extraction confidence, 0–100. */
  c: number;
  /** Set once a person has typed a value — it then counts as confirmed. */
  resolved?: boolean;
}

export const SEED_FIELDS: ExtractedField[] = [
  { k: "Builder", v: "Forma", c: 98 },
  { k: "Price list effective date", v: "01 August 2026", c: 94 },
  { k: "Region", v: "Perth metro", c: 91 },
  { k: "Base price, The Aspen", v: "$284,900", c: 96 },
  { k: "Base price, The Marlowe", v: "$312,400", c: 88 },
  { k: "Base price, The Sorrento", v: "$268,750", c: 62 },
  { k: "Double storey loading", v: "$41,200", c: 89 },
  { k: "Coastal allowance, under 1km", v: "$6,480", c: 71 },
  { k: "BAL-19 allowance", v: "$3,950", c: 93 },
  { k: "BAL-29 allowance", v: "", c: 0 },
  { k: "Noise attenuation, category 2", v: "$5,120", c: 86 },
  { k: "Promotion, Finishing Touch", v: "$18,000", c: 90 },
  { k: "Wholesale marketing fee", v: "", c: 0 },
];

export type Confidence = "high" | "check" | "missing";

/** ≥85% (or typed in by a person) = high; 50–84% = check; below = missing. */
export function confidenceOf(f: ExtractedField): Confidence {
  return f.resolved || f.c >= 85 ? "high" : f.c >= 50 ? "check" : "missing";
}

/**
 * The output workbook preview. Field rows read their cells from the extracted
 * fields by index (`b`, `c`), so an edit on the left updates the sheet at once.
 */
export type SheetRow =
  | { n: string; kind: "hdr"; a: string }
  | { n: string; kind: "sub"; a: string; b: string; c: string }
  | { n: string; kind: "field"; a: string; b: number; c?: number };

export const SHEET_ROWS: SheetRow[] = [
  { n: "1", kind: "hdr", a: "LOCALE HOMES — FORMA PRICE LIST" },
  { n: "2", kind: "field", a: "Effective", b: 1 },
  { n: "3", kind: "field", a: "Region", b: 2 },
  { n: "4", kind: "sub", a: "Design", b: "Base price", c: "Storey loading" },
  { n: "5", kind: "field", a: "The Aspen", b: 3, c: 6 },
  { n: "6", kind: "field", a: "The Marlowe", b: 4, c: 6 },
  { n: "7", kind: "field", a: "The Sorrento", b: 5, c: 6 },
  { n: "8", kind: "field", a: "Coastal under 1km", b: 7 },
  { n: "9", kind: "field", a: "BAL-19", b: 8 },
  { n: "10", kind: "field", a: "BAL-29", b: 9 },
  { n: "11", kind: "field", a: "Noise cat 2", b: 10 },
  { n: "12", kind: "field", a: "Finishing Touch", b: 11 },
  { n: "13", kind: "field", a: "Wholesale fee", b: 12 },
];

// ── Price changes ─────────────────────────────────────────────────────────

export interface PriceChange {
  m: string;
  prev: number;
  now: number;
}

/** Forma August 2026 against July 2026. */
export const PRICE_CHANGES: PriceChange[] = [
  { m: "The Aspen", prev: 279400, now: 284900 },
  { m: "The Marlowe", prev: 306900, now: 312400 },
  { m: "The Sorrento", prev: 268750, now: 268750 },
  { m: "The Halcyon", prev: 328100, now: 341600 },
  { m: "Double storey loading", prev: 39800, now: 41200 },
  { m: "Coastal allowance, under 1km", prev: 6480, now: 6480 },
  { m: "BAL-29 allowance", prev: 8900, now: 9420 },
  { m: "Noise attenuation, cat 2", prev: 5480, now: 5120 },
];

/** A move of this size or more (either way) is flagged for review. */
export const REVIEW_THRESHOLD = 0.04;

export const REPORT_ROUTING: [string, string][] = [
  ["To", "sean@localegroup.au"],
  ["Copy", "shannen@localegroup.au, alison@localegroup.au"],
  ["Attached", "Forma_PriceList_Aug2026.xlsx"],
];

export const PUBLISH_TARGETS: [string, string][] = [
  ["Monday Models board", "312 model rows updated"],
  ["Branded PDF", "generated and filed to SharePoint"],
  ["Rapid costing", "picks up the new rates immediately"],
];

// ── Jobs ──────────────────────────────────────────────────────────────────

export interface FormatterJob {
  file: string;
  template: string;
  status: "Complete" | "Expired";
  date: string;
  note: string;
}

export const FORMATTER_JOBS: FormatterJob[] = [
  {
    file: "Forma_PriceList_Aug26.pdf",
    template: "Builder price list v3",
    status: "Complete",
    date: "7 August 2026",
    note: "available until 5 Sep 2026",
  },
  {
    file: "MoveHomes_Variations_Jul.xlsx",
    template: "Variation price schedule v2",
    status: "Complete",
    date: "3 August 2026",
    note: "available until 1 Sep 2026",
  },
  {
    file: "LaVida_PriceList_Jul26.pdf",
    template: "Builder price list v3",
    status: "Expired",
    date: "2 July 2026",
    note: "purged",
  },
];

// ── Templates ─────────────────────────────────────────────────────────────

export interface TemplateVersion {
  name: string;
  version: string;
  active: boolean;
  created: string;
}

export const TEMPLATE_LIBRARY: { group: TemplateBrand; items: TemplateVersion[] }[] = [
  {
    group: "Homes",
    items: [
      { name: "Builder price list", version: "v3", active: true, created: "12 June 2026" },
      { name: "Variation price schedule", version: "v2", active: true, created: "3 May 2026" },
      { name: "Builder price list", version: "v2", active: false, created: "8 Feb 2026" },
    ],
  },
  { group: "Group", items: [{ name: "Rapid costing input", version: "v1", active: true, created: "21 July 2026" }] },
  { group: "Wealth", items: [{ name: "Portfolio summary", version: "v1", active: true, created: "2 April 2026" }] },
];
