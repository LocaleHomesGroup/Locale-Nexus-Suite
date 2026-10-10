/**
 * HomeScope's catalogue format: what Launchpad keeps for each builder, read from
 * the "Estimation Source Data" boards in Monday's HomeScope workspace (Meeting4,
 * decision 5). catalogue.json, the 6 October snapshot, is the same shape without
 * the optional fields. Shared by the importer, the route and the screens.
 */

/** A file in a Monday file column. Referenced, not copied: the bytes stay on Monday for now. */
export interface HsImage {
  assetId: string;
  name: string;
}

export interface HsModel {
  name: string;
  /** "To suit block" frontage in metres. */
  frontage: number | null;
  houseArea: number | null;
  totalArea: number | null;
  beds: number | null;
  baths: number | null;
  /** Ticked in Monday as a corner-block design. */
  corner: boolean;
  /** Price per spec-range column, by letter: { A: 300000, B: 320000 }. A letter with no price is absent. */
  prices: Record<string, number>;
  /** "Standard" or "Dual Living". */
  blockType?: string | null;
  notes?: string | null;
}

export interface HsRange {
  name: string;
  /** "Base", "Level 1"… */
  level: string;
  position: number;
  /** The model price column this range reads: "A" is Specs Range A Price. */
  column: string;
}

export interface HsPriced {
  name: string;
  price: number;
}

export interface HsElevation extends HsPriced {
  image?: HsImage | null;
}

export interface HsColour extends HsPriced {
  description?: string | null;
  image?: HsImage | null;
}

export interface HsSiteCost extends HsPriced {
  workType: string;
  /** "Fixed" or "Provisional Sum". */
  costType?: string | null;
}

export interface HsAllowanceRule {
  /** "More than 6 months", "Up to 3 months", "Between 3-6 months". */
  due: string;
  /** How long the builder holds its price before titles are late. */
  holdMonths: number;
  /** "Fixed Price", "Percentage of Base Price", "Cumulative Percentage of Base Price". */
  type: string;
  value: number;
  /** Cumulative only: extra percent for each month after the first. */
  monthlyStep: number;
  /** Monday's "Topup Amount": added to the allowance once. */
  initial: number;
}

/** A BAL, coastal or noise rate. `area` is set when the builder prices by total floor area. */
export interface HsRate extends HsPriced {
  area: number | null;
}

export interface HsVariation {
  /** The variation area, "Electrical". */
  area: string;
  code: string;
  description: string;
  unit: string;
  /** Per unit when included. */
  charge: number;
  /** Per unit when excluded (0 = no credit rate). */
  credit: number;
}

export interface HsBoltOn {
  description: string;
  charge: number;
  credit: number;
}

export interface HsBuilder {
  name: string;
  address: string;
  /** LaVida: the delayed-title allowance sits inside the base build price. */
  bundleAllowance: boolean;
  /** New Choice: allowance percentages apply to the preliminary contract, not the base price. */
  allowanceOnPrelim: boolean;
  logo?: HsImage | null;
  models: HsModel[];
  ranges: HsRange[];
  elevations: HsElevation[];
  siteCosts: HsSiteCost[];
  allowances: HsAllowanceRule[];
  bal: HsRate[];
  coastal: HsRate[];
  noise: HsRate[];
  colours: HsColour[];
  variations: HsVariation[];
  /** Bolt-on pricing per model name. */
  boltOns: Record<string, HsBoltOn[]>;
}

/** The catalogue a screen prices from. */
export interface Catalogue {
  builders: HsBuilder[];
  /** "monday": imported by Launchpad. "snapshot": catalogue.json. */
  source: "monday" | "snapshot";
  /** An import's finish time (ISO), or the snapshot's date (YYYY-MM-DD). */
  asOf: string;
}

/** Something an import couldn't use, or that Ops should check, on one board. */
export interface ImportWarning {
  /** The Monday board's title. */
  board: string;
  /** What's wrong, and what HomeScope does about it. */
  message: string;
  /** The items it applies to, by name, each once. */
  items: string[];
}

export type ImportTrigger = "cli" | "screen";

/** One import run, as launchpad.homescope_imports keeps it. */
export interface ImportRecord {
  id: string;
  finishedAt: string;
  trigger: ImportTrigger;
  status: "ok" | "failed";
  calls: number;
  builders: number;
  changed: number;
  warnings: ImportWarning[];
  error: string | null;
}

export interface BuilderCounts {
  name: string;
  models: number;
  ranges: number;
  elevations: number;
  colours: number;
  siteCosts: number;
  variations: number;
  boltOnModels: number;
}

/** What an import did, for the CLI and the Operations screen. */
export interface ImportSummary {
  status: "ok" | "failed";
  dryRun: boolean;
  calls: number;
  builders: BuilderCounts[];
  /** Builders that got a new version. */
  changed: string[];
  /** Builders no longer on Monday, now retired. */
  retired: string[];
  warnings: ImportWarning[];
  error: string | null;
}

/** GET /api/homescope/catalogue. */
export type CatalogueResponse =
  | { kind: "off" }
  | { kind: "live"; catalogue: Catalogue | null; lastImport: ImportRecord | null }
  | { kind: "error"; message: string };
