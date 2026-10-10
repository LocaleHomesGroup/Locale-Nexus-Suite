import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../../db/types";
import type { MondayClient } from "./client";
import { discoverBoards, discoverBoardsById, discoverUsers, discoverWorkspaces } from "./discover";

/**
 * Turns the mirror on for Locale's boards. Board ids and column ids come from
 * Jerry's config/environments/monday.json, read from the folder next to this
 * repo on Kane's machine, and land in the database: they are never copied
 * into git. Exclusive Land isn't in Jerry's column map, so its columns are
 * matched by title and Kane confirms the result.
 */
export const DEFAULT_JERRY_CONFIG = join(process.cwd(), "..", "Locale_Launchpad-main", "config", "environments", "monday.json");

type Purpose = "sales" | "construction" | "handed_over" | "exclusive_land" | "models" | "other";

export interface BoardPlan {
  boardKey: string;
  parentId: number;
  subitemsId: number | null;
  purpose: Purpose;
  division: "homes" | "wealth" | null;
  region: string | null;
}

export interface FieldPlan {
  boardId: number;
  fieldKey: string;
  columnId: string;
}

interface JerryProduction {
  boards: Record<string, unknown>;
  // A config can lack either section: nothing is mapped from one that isn't there.
  parentColumns?: Record<string, unknown>;
  subitemColumns?: Record<string, unknown>;
}

export function purposeOf(key: string): Purpose {
  if (key.includes("exclusive_land")) return "exclusive_land";
  if (key === "models") return "models";
  if (key.includes("handed_over")) return "handed_over";
  if (key.includes("construction")) return "construction";
  if (key.includes("sales")) return "sales";
  return "other";
}

export const divisionOf = (key: string): "homes" | "wealth" | null =>
  key.startsWith("homes_") ? "homes" : key.startsWith("wealth_") ? "wealth" : null;

/** The region a board key ends in. All eight that mirror.monday_boards allows. */
export const regionOf = (key: string): string | null => /_(wa|vic|qld|nsw|sa|nt|tas|act)$/.exec(key)?.[1].toUpperCase() ?? null;

const entries = (o: unknown): [string, unknown][] =>
  o && typeof o === "object" ? Object.entries(o as Record<string, unknown>).filter(([k]) => !k.startsWith("_")) : [];

const columnsOf = (o: unknown): [string, string][] =>
  entries(o).filter((e): e is [string, string] => typeof e[1] === "string");

/** The boards a config lists. Each needs a numeric parent id: an entry without one (a note, or an id written as text) is skipped. */
function boardsOf(config: Pick<JerryProduction, "boards">): BoardPlan[] {
  const boards: BoardPlan[] = [];
  for (const [key, value] of entries(config.boards)) {
    const b = value as { parent?: unknown; subitems?: unknown };
    if (typeof b?.parent !== "number") continue;
    boards.push({
      boardKey: key,
      parentId: b.parent,
      subitemsId: typeof b.subitems === "number" ? b.subitems : null,
      purpose: purposeOf(key),
      division: divisionOf(key),
      region: regionOf(key),
    });
  }
  return boards;
}

export function planFromJerryConfig(
  config: JerryProduction,
  vocabulary: Set<string>,
): { boards: BoardPlan[]; fields: FieldPlan[]; unknownFields: string[] } {
  const boards = boardsOf(config);
  const byKey = new Map(boards.map((b) => [b.boardKey, b]));
  const fields = new Map<string, FieldPlan>();
  const unknown = new Set<string>();
  const add = (boardId: number, fieldKey: string, columnId: string) => {
    if (!vocabulary.has(fieldKey)) {
      unknown.add(fieldKey);
      return;
    }
    fields.set(`${boardId}:${fieldKey}`, { boardId, fieldKey, columnId });
  };

  for (const [groupKey, group] of entries(config.parentColumns)) {
    if (groupKey === "per_board") continue;
    const appliesTo = (group as { _applies_to?: unknown } | null)?._applies_to;
    if (!Array.isArray(appliesTo)) continue;
    for (const boardKey of appliesTo) {
      const board = byKey.get(String(boardKey));
      if (board) for (const [field, column] of columnsOf(group)) add(board.parentId, field, column);
    }
  }
  for (const [boardKey, cols] of entries(config.parentColumns?.per_board)) {
    const board = byKey.get(boardKey);
    if (board) for (const [field, column] of columnsOf(cols)) add(board.parentId, field, column);
  }

  const shared = columnsOf(config.subitemColumns?.all_boards);
  const overrides = config.subitemColumns?.per_board as Record<string, Record<string, unknown>> | undefined;
  for (const board of boards) {
    if (board.subitemsId === null) continue;
    const merged = new Map<string, string | null>(shared);
    for (const [field, column] of entries(overrides?.[board.boardKey])) {
      merged.set(field, typeof column === "string" ? column : null);
    }
    for (const [field, column] of merged) if (column) add(board.subitemsId, field, column);
  }

  return { boards, fields: [...fields.values()], unknownFields: [...unknown] };
}

/** Accents folded (Peña is Pena), lower-case, straight apostrophes, no punctuation but apostrophes, ampersands and hyphens, single spaces. */
export function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'& -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LOT_TITLES: Record<string, string[]> = {
  lot_status: ["status", "lot status", "availability"],
  lot_address: ["address", "street", "street address", "lot address"],
  lot_suburb: ["suburb"],
  lot_state: ["state"],
  lot_estate: ["estate", "estate name", "development"],
  lot_developer: ["developer", "land developer"],
  lot_builder: ["builder", "package builder"],
  lot_land_price: ["land price", "lot price"],
  lot_package_price: ["package price", "house and land price", "h&l price"],
  lot_design: ["design", "house design", "home design"],
  lot_area: ["lot size", "land size", "area", "size", "sqm"],
  lot_frontage: ["frontage"],
  lot_zoning: ["zoning", "r code", "r-code", "rcode"],
  lot_title: ["title", "titled", "title status"],
  lot_title_eta: ["title eta", "title date", "titles expected", "expected titles", "title due"],
  lot_rebate: ["rebate", "rebates", "incentive"],
  lot_files: ["files", "plans", "plans and files", "plans & files", "documents"],
};

/** Exclusive Land's columns by title. Each column is used once; what doesn't match is listed for Kane. */
export function matchLotColumns(columns: { id: string; title: string; type: string }[]): {
  fields: { fieldKey: string; columnId: string }[];
  unmatched: string[];
} {
  const used = new Set<string>();
  const fields: { fieldKey: string; columnId: string }[] = [];
  for (const [fieldKey, titles] of Object.entries(LOT_TITLES)) {
    const column = columns.find((c) => !used.has(c.id) && titles.includes(normaliseName(c.title)));
    if (column) {
      used.add(column.id);
      fields.push({ fieldKey, columnId: column.id });
    }
  }
  const unmatched = columns.filter((c) => !used.has(c.id) && c.type !== "name").map((c) => c.title);
  return { fields, unmatched };
}

/**
 * Monday's free-text rep names to staff: full name, go-by name plus surname, or first plus
 * last name, compared loosely (normaliseName). Each match keeps Monday's own text: the
 * loaders look an alias up by `lower(btrim(sales_rep))`, so matchReps stores that key.
 * A name that two different people could be (one's full name and another's go-by plus surname,
 * or two people with one name) matches nobody and is listed as unmatched: a wrong match puts one
 * rep's clients under another, where an unmatched name is listed for a person to alias once.
 */
/**
 * Monday's own artifacts in a person's name, cleaned on the Monday side only (a staff name like "McDonald" is never
 * split): the "(Deactivated User)" or "(Deactivated)" Monday adds to someone who left, and a first name typed onto the
 * surname with no space ("JayTan"), split once, between the first name and the rest.
 */
export function cleanMondayName(raw: string): string {
  const base = raw.replace(/\s*\(deactivated(?: user)?\)\s*$/i, "").trim();
  return /\s/.test(base) ? base : base.replace(/^(\p{Lu}?\p{Ll}+)(?=\p{Lu})/u, "$1 ");
}

export function matchRepAliases(
  names: string[],
  staff: { id: string; name: string | null; preferred_name: string | null }[],
): { matched: { rep: string; staffId: string }[]; unmatched: string[] } {
  // Every key a person goes by, with who claims it. One person claiming a key twice is still one person.
  const claims = new Map<string, Set<string>>();
  const claim = (key: string, id: string) => {
    if (key) claims.set(key, (claims.get(key) ?? new Set<string>()).add(id));
  };
  for (const s of staff) {
    if (!s.name) continue;
    const parts = normaliseName(s.name).split(" ");
    const last = parts[parts.length - 1];
    claim(normaliseName(s.name), s.id);
    if (parts.length > 2) claim(`${parts[0]} ${last}`, s.id);
    if (s.preferred_name) claim(`${normaliseName(s.preferred_name)} ${last}`, s.id);
  }
  const index = new Map<string, string>();
  for (const [key, ids] of claims) if (ids.size === 1) index.set(key, [...ids][0]);

  const matched = new Map<string, string>();
  const unmatched = new Set<string>();
  for (const raw of names) {
    if (!raw.trim()) continue; // blank: there is no name to list
    const id = index.get(normaliseName(raw)) ?? index.get(normaliseName(cleanMondayName(raw)));
    if (id) matched.set(raw, id);
    else unmatched.add(raw.trim()); // this includes a name with nothing left once normalised (another script)
  }
  return { matched: [...matched].map(([rep, staffId]) => ({ rep, staffId })), unmatched: [...unmatched] };
}

export interface SetupReport {
  boardsEnabled: string[];
  notVisible: string[];
  fieldsMapped: number;
  unknownFields: string[];
  lotFields: { fieldKey: string; columnId: string }[];
  lotUnmatched: string[];
}

export async function runSetup(
  db: Db,
  monday: MondayClient,
  opts: { jerryConfigPath: string | null; log: (line: string) => void },
): Promise<SetupReport> {
  const path = opts.jerryConfigPath ?? DEFAULT_JERRY_CONFIG;
  if (!existsSync(path)) throw new Error(`Jerry's Monday config isn't at ${path}. Pass --jerry-config <path>.`);
  const config = JSON.parse(readFileSync(path, "utf8")) as { workspaces?: { production?: { id?: number; name?: string } }; production?: JerryProduction } | null;
  // A wrong file stops here, before anything is read from Monday or written.
  const production = config?.production;
  if (!production?.boards || Object.keys(production.boards).length === 0) {
    throw new Error(`No boards in ${path}. Is it Jerry's monday.json, with production.boards in it?`);
  }
  // The boards are planned ahead of the database read below, so a config with none Launchpad can use stops here too.
  if (boardsOf(production).length === 0) {
    throw new Error(`No boards Launchpad can use in ${path}: check production.boards (each needs a numeric parent id).`);
  }

  const vocabulary = new Set((await db.query<{ key: string }>("select key from mirror.monday_fields")).map((r) => r.key));
  const plan = planFromJerryConfig(production, vocabulary);

  opts.log("discovering workspaces and users");
  await discoverWorkspaces(db, monday);
  await discoverUsers(db, monday);
  const workspaceId = config?.workspaces?.production?.id;
  if (typeof workspaceId === "number") {
    await db.query("update mirror.monday_workspaces set sync_enabled = true where id = $1", [workspaceId]);
    opts.log(`discovering boards in workspace ${workspaceId}`);
    await discoverBoards(db, monday, [workspaceId]);
  }
  const wanted = plan.boards.flatMap((b) => (b.subitemsId === null ? [b.parentId] : [b.parentId, b.subitemsId]));
  const known = new Set((await db.query<{ id: number }>("select id from mirror.monday_boards")).map((r) => r.id));
  const missing = wanted.filter((id) => !known.has(id));
  const found = new Set([...known, ...(await discoverBoardsById(db, monday, missing))]);

  const report: SetupReport = { boardsEnabled: [], notVisible: [], fieldsMapped: 0, unknownFields: plan.unknownFields, lotFields: [], lotUnmatched: [] };
  for (const b of plan.boards) {
    if (!found.has(b.parentId)) {
      report.notVisible.push(b.boardKey);
      continue;
    }
    await db.query(
      `update mirror.monday_boards set board_key = $2, purpose = $3, division = $4, region = $5, sync_enabled = true
       where id = $1`,
      [b.parentId, b.boardKey, b.purpose, b.division, b.region],
    );
    if (b.subitemsId !== null && found.has(b.subitemsId)) {
      await db.query(
        `update mirror.monday_boards set board_key = $2, parent_board_id = $3, type = 'sub_items_board', sync_enabled = true
         where id = $1`,
        [b.subitemsId, `${b.boardKey}:subitems`, b.parentId],
      );
    } else if (b.subitemsId !== null) {
      // The parent is set up, but its subitems board can't be mirrored or mapped: say so.
      report.notVisible.push(`${b.boardKey}:subitems`);
    }
    report.boardsEnabled.push(b.boardKey);
  }

  for (const f of plan.fields) {
    if (!found.has(f.boardId)) continue;
    await db.query(
      `insert into mirror.monday_field_map (board_id, field_key, column_id, source) values ($1, $2, $3, 'jerry_config')
       on conflict (board_id, field_key) do update set column_id = excluded.column_id, source = 'jerry_config'
       where mirror.monday_field_map.source <> 'manual'`,
      [f.boardId, f.fieldKey, f.columnId],
    );
    report.fieldsMapped += 1;
  }

  const land = plan.boards.find((b) => b.purpose === "exclusive_land");
  if (land && found.has(land.parentId)) {
    const columns = await db.query<{ id: string; title: string; type: string }>(
      "select id, title, type from mirror.monday_columns where board_id = $1 order by position",
      [land.parentId],
    );
    const lots = matchLotColumns(columns);
    for (const f of lots.fields) {
      await db.query(
        `insert into mirror.monday_field_map (board_id, field_key, column_id, source) values ($1, $2, $3, 'title_match')
         on conflict (board_id, field_key) do nothing`,
        [land.parentId, f.fieldKey, f.columnId],
      );
    }
    report.lotFields = lots.fields;
    report.lotUnmatched = lots.unmatched;
  }
  return report;
}

/** Matches Monday's rep names to staff and stores the aliases it finds. Run after a backfill. */
export async function matchReps(db: Db): Promise<{ matched: number; unmatched: string[] }> {
  const names = (await db.query<{ rep: string }>(
    "select distinct btrim(sales_rep) as rep from launchpad.monday_jobs where sales_rep is not null",
  )).map((r) => r.rep);
  const staff = await db.query<{ id: string; name: string | null; preferred_name: string | null }>(
    "select id, name, preferred_name from launchpad.staff where not vacant",
  );
  const result = matchRepAliases(names, staff);
  for (const m of result.matched) {
    // The key the loaders join on, lower(btrim(sales_rep)), made by the same SQL here.
    await db.query(
      "insert into launchpad.staff_aliases (alias, staff_id, source) values (lower(btrim($1::text)), $2, 'setup') on conflict (alias) do nothing",
      [m.rep, m.staffId],
    );
  }
  // A name no staff member matches, but that already has an alias (made by hand, or kept from an earlier run), is dealt
  // with: only names with no alias row are listed. The check uses the loaders' key, lower(btrim(Monday's text)), made
  // from Monday's own text and not from the trimmed copy in `unmatched`. No name is taken out of the input above, so
  // `matched` still counts every name staff match, aliased or not.
  let unmatched = result.unmatched;
  if (unmatched.length > 0) {
    const open = await db.query<{ rep: string }>(
      `select r.rep from jsonb_array_elements_text($1::jsonb) as r(rep)
        where not exists (select 1 from launchpad.staff_aliases a where a.alias = lower(btrim(r.rep)))`,
      [JSON.stringify(names.filter((raw) => result.unmatched.includes(raw.trim())))],
    );
    const stillOpen = new Set(open.map((r) => r.rep.trim()));
    unmatched = unmatched.filter((name) => stillOpen.has(name));
  }
  return { matched: result.matched.length, unmatched };
}
