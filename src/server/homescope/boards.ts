import type { ItemRow } from "../mirror/monday/normalise";

/**
 * Where HomeScope's catalogue lives on Monday, and which column holds each field.
 * Boards and columns are found by title (a column also by type), never by id, so
 * no Monday id enters this public repo. Ops edit these boards today, in the
 * HomeScope workspace's "Estimation Source Data" folder. The Design section of
 * docs/superpowers/plans/2026-10-09-homescope-catalogue-import.md explains each field.
 */
export const HOMESCOPE_WORKSPACE = "HomeScope";
export const SOURCE_FOLDER = "Estimation Source Data";

/** The twelve boards, by their titles on Monday. */
export const BOARDS = {
  builders: "Builders",
  models: "Models",
  levels: "Levels",
  ranges: "Specification Ranges",
  elevations: "Elevation Styles",
  colours: "Color Options",
  siteCosts: "Site Works Costs",
  allowances: "Title Allowances",
  bal: "Site Costs - BAL Rating",
  coastal: "Site Costs - Coastal Distance",
  noise: "Site Costs - Noise Package",
  variations: "Variations",
} as const;

export type BoardKey = keyof typeof BOARDS;

type Field = readonly [title: string, type: string];

/**
 * Each field the import reads: the column's title and type. Matching the type as well
 * as the title skips the Models board's stray text columns titled "Builder", "Leads"
 * and "Corner Block". Variations' builder is the "Builder" status, not "Builder
 * Linked": HomeScope reads the status, and Move's variations have no link.
 */
export const FIELDS = {
  builders: {
    address: ["Address", "location"],
    logo: ["Logo", "file"],
    bundleAllowance: ["Title Allowances In Base", "checkbox"],
    allowanceOnPrelim: ["Calculate Allowance On Prelim", "checkbox"],
  },
  models: {
    builder: ["Builder", "board_relation"],
    priceA: ["Specs Range A Price", "numbers"],
    priceB: ["Specs Range B Price", "numbers"],
    priceC: ["Specs Range C Price", "numbers"],
    priceD: ["Specs Range D Price", "numbers"],
    frontage: ["To Suit Block", "numbers"],
    houseArea: ["House Area (m²)", "numbers"],
    totalArea: ["Total Area (m²)", "numbers"],
    beds: ["Bedroom", "numbers"],
    baths: ["Bathroom", "numbers"],
    corner: ["Corner Block", "checkbox"],
    blockType: ["Block Type", "text"],
    notes: ["Notes", "text"],
  },
  levels: {
    position: ["Level Position", "numbers"],
  },
  ranges: {
    builder: ["Builder", "board_relation"],
    priceColumn: ["Model Price Column", "text"],
    level: ["Levels", "board_relation"],
  },
  elevations: {
    builder: ["Builder", "board_relation"],
    style: ["Style Name", "text"],
    price: ["Style Price", "numbers"],
    image: ["Main Image", "file"],
  },
  colours: {
    builder: ["Builder", "board_relation"],
    description: ["Description", "text"],
    image: ["Main Image", "file"],
  },
  siteCosts: {
    builder: ["Builder", "board_relation"],
    workType: ["Work Type", "text"],
    costType: ["Cost Type", "text"],
    price: ["Price", "numbers"],
  },
  allowances: {
    builders: ["Builders", "board_relation"],
    holdMonths: ["Price Hold Period", "numbers"],
    type: ["Allowance Type", "status"],
    value: ["Allowance Value", "numbers"],
    monthlyStep: ["Monthly Step %", "numbers"],
    topUp: ["Topup Amount", "numbers"],
  },
  bal: {
    builder: ["Builder", "board_relation"],
    area: ["Total Floor Area", "numbers"],
    price: ["Price", "numbers"],
  },
  coastal: {
    builder: ["Builder", "board_relation"],
    area: ["Total Floor Area", "numbers"],
    price: ["Price", "numbers"],
  },
  noise: {
    builder: ["Builder", "board_relation"],
    area: ["Total Floor Area", "numbers"],
    price: ["Price", "numbers"],
  },
  variations: {
    builder: ["Builder", "status"],
    description: ["Description", "long_text"],
    unit: ["Unit", "text"],
    charge: ["Charge", "numbers"],
    credit: ["Credit", "numbers"],
    code: ["Item Code", "text"],
  },
} as const satisfies Record<BoardKey, Record<string, Field>>;

export type FieldOf<K extends BoardKey> = keyof (typeof FIELDS)[K];

/** Each board's column ids, by field. */
export type ColumnIds = { [K in BoardKey]: Record<FieldOf<K>, string> };

export interface ColumnInfo {
  id: string;
  title: string;
  type: string;
}

/** One board as read: its columns and its items. */
export interface BoardDump {
  columns: ColumnInfo[];
  items: ItemRow[];
}

export type EstimationBoards = Record<BoardKey, BoardDump>;

/** The boards no longer have a column the import needs. Nothing is imported, and the current catalogue stays. */
export class CatalogueFormatError extends Error {
  constructor(readonly problems: string[]) {
    super(`HomeScope's Monday boards have changed: ${problems.join("; ")}. Nothing was imported.`);
    this.name = "CatalogueFormatError";
  }
}

/**
 * Each board's column ids by field. A title matches without regard to case or
 * surrounding spaces, and the type must match exactly; the first match wins.
 * Throws CatalogueFormatError naming every missing field, so a renamed column
 * stops the import instead of reading as blank prices.
 */
export function resolveColumns(columns: Record<BoardKey, ColumnInfo[]>): ColumnIds {
  const problems: string[] = [];
  const out = {} as Record<BoardKey, Record<string, string>>;
  for (const key of Object.keys(BOARDS) as BoardKey[]) {
    out[key] = {};
    for (const [field, [title, type]] of Object.entries(FIELDS[key]) as [string, Field][]) {
      const col = (columns[key] ?? []).find((c) => c.title.trim().toLowerCase() === title.toLowerCase() && c.type === type);
      if (col) out[key][field] = col.id;
      else problems.push(`${BOARDS[key]} has no ${type} column titled "${title}"`);
    }
  }
  if (problems.length) throw new CatalogueFormatError(problems);
  return out as ColumnIds;
}
