import type { HsBuilder } from "@/data/homescope";
import type { ItemRow, StoredValue } from "../mirror/monday/normalise";
import { BOARDS, FIELDS, type BoardKey, type ColumnInfo, type EstimationBoards } from "./boards";

/**
 * Made-up Monday boards for the catalogue tests. Column ids are "<board>.<field>".
 * No real builder, price or Monday id belongs here: the repo is public.
 */

export function columnsFor(key: BoardKey): ColumnInfo[] {
  return [
    { id: "name", title: "Name", type: "name" },
    ...Object.entries(FIELDS[key]).map(([field, [title, type]]) => ({ id: `${key}.${field}`, title, type })),
  ];
}

export function allColumns(): Record<BoardKey, ColumnInfo[]> {
  const out = {} as Record<BoardKey, ColumnInfo[]>;
  for (const key of Object.keys(BOARDS) as BoardKey[]) out[key] = columnsFor(key);
  return out;
}

/** A cell as the mirror stores it, from a plain value: a number, text, a label, true for a ticked box, ids for a link, or an asset id for a file. */
function cellFor(type: string, v: unknown): StoredValue {
  switch (type) {
    case "numbers":
      return { type, text: v == null ? "" : String(v), value: v == null ? null : String(v) };
    case "checkbox":
      return { type, text: v ? "v" : "", value: v ? { checked: "true" } : null };
    case "status":
      return v == null ? { type, text: null, value: null } : { type, text: String(v), value: null, label: String(v) };
    case "board_relation":
      return { type, text: null, value: null, linked_item_ids: ((v as (string | number)[] | null) ?? []).map(String) };
    case "file":
      return { type, text: "", value: v == null ? null : { files: [{ assetId: Number(v), name: `image-${v}.jpg` }] } };
    default:
      return { type, text: v == null ? null : String(v), value: null };
  }
}

let nextId = 1;

/** An active item on `key`'s board. `cells` are keyed by field: { builder: ["1"], priceA: 300000 }. */
export function item(key: BoardKey, name: string, cells: Record<string, unknown> = {}, over: Partial<ItemRow> = {}): ItemRow {
  const column_values: Record<string, StoredValue> = {};
  for (const [field, v] of Object.entries(cells)) {
    const spec = (FIELDS[key] as Record<string, readonly [string, string]>)[field];
    if (!spec) throw new Error(`${BOARDS[key]} has no field "${field}" in FIELDS`);
    column_values[`${key}.${field}`] = cellFor(spec[1], v);
  }
  return {
    id: nextId++,
    board_id: 1,
    board_name: BOARDS[key],
    group_id: null,
    parent_item_id: null,
    name,
    state: "active",
    creator_id: null,
    monday_created_at: null,
    monday_updated_at: "2026-10-09T00:00:00Z",
    column_values,
    ...over,
  };
}

/** All twelve boards with every FIELDS column, empty unless given items. */
export function boards(items: Partial<Record<BoardKey, ItemRow[]>> = {}): EstimationBoards {
  const out = {} as EstimationBoards;
  for (const key of Object.keys(BOARDS) as BoardKey[]) out[key] = { columns: columnsFor(key), items: items[key] ?? [] };
  return out;
}

/** A builder with one made-up model and nothing else, for the store and run tests. */
export function testBuilder(name: string, priceA = 300_000): HsBuilder {
  return {
    name,
    address: "1 Test Street, Perth WA, Australia",
    bundleAllowance: false,
    allowanceOnPrelim: false,
    logo: null,
    models: [{ name: "Test Model", frontage: 12.5, houseArea: 150, totalArea: 200, beds: 4, baths: 2, corner: false, prices: { A: priceA } }],
    ranges: [],
    elevations: [],
    siteCosts: [],
    allowances: [],
    bal: [],
    coastal: [],
    noise: [],
    colours: [],
    variations: [],
    boltOns: {},
  };
}
