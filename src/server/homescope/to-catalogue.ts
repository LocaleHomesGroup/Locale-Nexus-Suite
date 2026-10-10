import type { HsAllowanceRule, HsBuilder, HsImage, HsModel, HsRate, ImportWarning } from "@/data/homescope";
import { fileAssets, type ItemRow, type StoredValue } from "../mirror/monday/normalise";
import { BOARDS, resolveColumns, type BoardDump, type BoardKey, type ColumnIds, type EstimationBoards } from "./boards";

/**
 * The twelve "Estimation Source Data" boards, as HomeScope's catalogue: one
 * HsBuilder per builder on the Builders board, in board order. It reads them the way
 * HomeScope does, so it shows what HomeScope shows, and it says what it left out.
 * Pure: no database, no network. Throws CatalogueFormatError when a column is missing.
 */
export interface CatalogueResult {
  builders: HsBuilder[];
  warnings: ImportWarning[];
}

type Cell = StoredValue | undefined;

/** Warnings grouped by board and message, each item named once. */
class Warnings {
  private readonly byKey = new Map<string, ImportWarning>();
  add(board: string, message: string, itemName: string) {
    const key = `${board}\u0000${message}`;
    const w = this.byKey.get(key) ?? { board, message, items: [] };
    if (!w.items.includes(itemName)) w.items.push(itemName);
    this.byKey.set(key, w);
  }
  list(): ImportWarning[] {
    return [...this.byKey.values()];
  }
}

interface Ctx {
  boards: EstimationBoards;
  cols: ColumnIds;
  warnings: Warnings;
  /** Builders by name, in the Builders board's order. */
  byName: Map<string, HsBuilder>;
  /** Builder names by Monday item id, for the link columns. */
  nameById: Map<string, string>;
}

const cell = (it: ItemRow, columnId: string): Cell => it.column_values[columnId];
const active = (d: BoardDump) => d.items.filter((i) => i.state === "active");

/** A numbers cell. Blank or unreadable is null, never 0: a blank price means "not offered", not "free". */
export function num(c: Cell): number | null {
  const raw = typeof c?.value === "string" || typeof c?.value === "number" ? String(c.value) : (c?.text ?? "");
  const t = raw.replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const str = (c: Cell): string | null => c?.text?.trim() || null;
const checked = (c: Cell): boolean => {
  const v = (c?.value as { checked?: unknown } | null)?.checked;
  return v === true || v === "true" || c?.text === "v";
};
const linked = (c: Cell): string[] => c?.linked_item_ids ?? [];
const label = (c: Cell): string | null => c?.label?.trim() || str(c);
const image = (c: Cell): HsImage | null => {
  const f = fileAssets(c?.value)[0];
  return f ? { assetId: String(f.id), name: f.name } : null;
};

/** The builders an item links to. None: HomeScope doesn't show it, so neither does Launchpad, and Ops hear about it. */
function buildersOf(ctx: Ctx, key: BoardKey, it: ItemRow, columnId: string): HsBuilder[] {
  const found = linked(cell(it, columnId)).flatMap((id) => {
    const name = ctx.nameById.get(id);
    const b = name ? ctx.byName.get(name) : undefined;
    return b ? [b] : [];
  });
  if (!found.length) ctx.warnings.add(BOARDS[key], "isn't linked to a builder, so HomeScope doesn't show it", it.name.trim());
  return found;
}

function addBuilders(ctx: Ctx) {
  const c = ctx.cols.builders;
  for (const it of active(ctx.boards.builders)) {
    const name = it.name.trim();
    if (ctx.byName.has(name)) {
      ctx.warnings.add(BOARDS.builders, "appears twice; the first is used", name);
      continue;
    }
    ctx.nameById.set(String(it.id), name);
    ctx.byName.set(name, {
      name,
      address: str(cell(it, c.address)) ?? "",
      bundleAllowance: checked(cell(it, c.bundleAllowance)),
      allowanceOnPrelim: checked(cell(it, c.allowanceOnPrelim)),
      logo: image(cell(it, c.logo)),
      models: [],
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
    });
  }
}

const RANGE_COLUMN = /^specs range ([a-z]) price$/i;

function addRanges(ctx: Ctx) {
  const lc = ctx.cols.levels;
  const rc = ctx.cols.ranges;
  const levels = new Map(
    active(ctx.boards.levels).map((it) => [String(it.id), { name: it.name.trim(), position: num(cell(it, lc.position)) ?? 0 }]),
  );
  for (const it of active(ctx.boards.ranges)) {
    const name = it.name.trim();
    const column = RANGE_COLUMN.exec(str(cell(it, rc.priceColumn)) ?? "")?.[1]?.toUpperCase();
    if (!column) {
      ctx.warnings.add(BOARDS.ranges, 'has no Model Price Column like "Specs Range A Price", so it can\'t be priced', name);
      continue;
    }
    const level = levels.get(linked(cell(it, rc.level))[0] ?? "");
    if (!level) {
      ctx.warnings.add(BOARDS.ranges, "isn't linked to a level, so HomeScope can't place it", name);
      continue;
    }
    for (const b of buildersOf(ctx, "ranges", it, rc.builder)) b.ranges.push({ name, level: level.name, position: level.position, column });
  }
}

const PRICE_FIELDS = [
  ["A", "priceA"],
  ["B", "priceB"],
  ["C", "priceC"],
  ["D", "priceD"],
] as const;

function addModels(ctx: Ctx) {
  const c = ctx.cols.models;
  for (const it of active(ctx.boards.models)) {
    const name = it.name.trim();
    const builders = buildersOf(ctx, "models", it, c.builder);
    if (!builders.length) continue;
    const prices: Record<string, number> = {};
    for (const [letter, field] of PRICE_FIELDS) {
      const p = num(cell(it, c[field]));
      if (p != null) prices[letter] = p;
    }
    const model: HsModel = {
      name,
      frontage: num(cell(it, c.frontage)),
      houseArea: num(cell(it, c.houseArea)),
      totalArea: num(cell(it, c.totalArea)),
      beds: num(cell(it, c.beds)),
      baths: num(cell(it, c.baths)),
      corner: checked(cell(it, c.corner)),
      prices,
      blockType: str(cell(it, c.blockType)),
      notes: str(cell(it, c.notes)),
    };
    if (!Object.keys(prices).length) ctx.warnings.add(BOARDS.models, "has no price in any spec range", name);
    if (model.frontage == null && !model.corner) {
      ctx.warnings.add(BOARDS.models, "has no To Suit Block and isn't a corner design, so no block search finds it", name);
    }
    for (const b of builders) {
      if (b.models.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
        ctx.warnings.add(BOARDS.models, `appears twice at ${b.name}; HomeScope prices the first`, name);
      }
      b.models.push({ ...model, prices: { ...prices } });
    }
  }
}

function addPricedLists(ctx: Ctx) {
  const e = ctx.cols.elevations;
  for (const it of active(ctx.boards.elevations)) {
    // The item name is always "Front Elevation" on this board: the style's own name is a column.
    const name = str(cell(it, e.style)) ?? it.name.trim();
    const elevation = { name, price: num(cell(it, e.price)) ?? 0, image: image(cell(it, e.image)) };
    for (const b of buildersOf(ctx, "elevations", it, e.builder)) b.elevations.push({ ...elevation });
  }
  const k = ctx.cols.colours;
  for (const it of active(ctx.boards.colours)) {
    // Colour schemes carry no price on Monday: HomeScope prices them at 0.
    const colour = { name: it.name.trim(), price: 0, description: str(cell(it, k.description)), image: image(cell(it, k.image)) };
    for (const b of buildersOf(ctx, "colours", it, k.builder)) b.colours.push({ ...colour });
  }
  const s = ctx.cols.siteCosts;
  for (const it of active(ctx.boards.siteCosts)) {
    const site = {
      name: it.name.trim(),
      workType: str(cell(it, s.workType)) ?? "",
      costType: str(cell(it, s.costType)),
      price: num(cell(it, s.price)) ?? 0,
    };
    for (const b of buildersOf(ctx, "siteCosts", it, s.builder)) b.siteCosts.push({ ...site });
  }
}

function addAllowances(ctx: Ctx) {
  const a = ctx.cols.allowances;
  for (const it of active(ctx.boards.allowances)) {
    const rule: HsAllowanceRule = {
      due: it.name.trim(),
      holdMonths: num(cell(it, a.holdMonths)) ?? 0,
      type: label(cell(it, a.type)) ?? "",
      value: num(cell(it, a.value)) ?? 0,
      monthlyStep: num(cell(it, a.monthlyStep)) ?? 0,
      initial: num(cell(it, a.topUp)) ?? 0,
    };
    for (const b of buildersOf(ctx, "allowances", it, a.builders)) b.allowances.push({ ...rule });
  }
}

function addRates(ctx: Ctx) {
  for (const key of ["bal", "coastal", "noise"] as const) {
    const r = ctx.cols[key];
    for (const it of active(ctx.boards[key])) {
      const rate: HsRate = { name: it.name.trim(), price: num(cell(it, r.price)) ?? 0, area: num(cell(it, r.area)) };
      for (const b of buildersOf(ctx, key, it, r.builder)) b[key].push({ ...rate });
    }
  }
}

const BOLT_ON = /^bolt on pricing\s*-\s*(.+)$/i;

/** Runs after addModels: a bolt-on line attaches to one of the builder's designs. */
function addVariations(ctx: Ctx) {
  const v = ctx.cols.variations;
  for (const it of active(ctx.boards.variations)) {
    const name = it.name.trim();
    // HomeScope reads a variation's builder from this status, not from "Builder Linked".
    const builderName = label(cell(it, v.builder));
    const b = builderName ? ctx.byName.get(builderName) : undefined;
    if (!b) {
      ctx.warnings.add(
        BOARDS.variations,
        builderName ? `names builder "${builderName}", which isn't on the Builders board` : "has no Builder",
        name,
      );
      continue;
    }
    const charge = num(cell(it, v.charge)) ?? 0;
    const credit = num(cell(it, v.credit)) ?? 0;
    const description = str(cell(it, v.description)) ?? "";
    const bolt = BOLT_ON.exec(name);
    if (bolt) {
      const design = bolt[1].trim().toLowerCase();
      const model = b.models.find((m) => m.name.toLowerCase() === design);
      if (!model) {
        ctx.warnings.add(BOARDS.variations, `is bolt-on pricing for a design ${b.name} doesn't have, so HomeScope skips it`, name);
        continue;
      }
      (b.boltOns[model.name] ??= []).push({ description, charge, credit });
      continue;
    }
    b.variations.push({ area: name, code: str(cell(it, v.code)) ?? "", description, unit: str(cell(it, v.unit)) ?? "", charge, credit });
  }
}

/** Gaps a quote would hit, per builder. */
function checkBuilders(ctx: Ctx) {
  for (const b of ctx.byName.values()) {
    if (b.models.length && !b.ranges.length) {
      ctx.warnings.add(BOARDS.ranges, "has designs but no spec ranges, so none of them can be priced", b.name);
    }
    if (!b.allowances.length) {
      ctx.warnings.add(BOARDS.allowances, "has no delayed-title rule, so HomeScope adds no title allowance", b.name);
    }
  }
}

export function toCatalogue(boards: EstimationBoards): CatalogueResult {
  const columns = Object.fromEntries(Object.entries(boards).map(([k, d]) => [k, d.columns])) as Record<BoardKey, BoardDump["columns"]>;
  const ctx: Ctx = { boards, cols: resolveColumns(columns), warnings: new Warnings(), byName: new Map(), nameById: new Map() };
  addBuilders(ctx);
  addRanges(ctx);
  addModels(ctx);
  addPricedLists(ctx);
  addAllowances(ctx);
  addRates(ctx);
  addVariations(ctx);
  checkBuilders(ctx);
  return { builders: [...ctx.byName.values()], warnings: ctx.warnings.list() };
}
