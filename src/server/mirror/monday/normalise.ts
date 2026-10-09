/** API items and updates to the rows the mirror stores. Tolerant: nothing here throws on odd data. */

export interface RawColumnValue {
  id: string;
  type: string;
  text: string | null;
  value: string | null;
  index?: number | null;
  label?: string | null;
  date?: string | null;
  linked_item_ids?: (string | number)[] | null;
  display_value?: string | null;
}

export interface RawItem {
  id: string;
  name: string;
  state?: string | null;
  created_at?: string | null;
  updated_at: string;
  creator_id?: string | null;
  group?: { id: string } | null;
  board?: { id: string; name?: string | null } | null;
  parent_item?: { id: string } | null;
  column_values?: RawColumnValue[] | null;
}

export interface RawUpdate {
  id: string;
  item_id: string | null;
  body?: string | null;
  text_body?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  creator_id?: string | null;
  assets?: { id: string; name: string }[] | null;
}

/** One column value as stored in mirror.monday_items.column_values. */
export interface StoredValue {
  type: string;
  text: string | null;
  value: unknown;
  label?: string;
  index?: number;
  date?: string;
  display_value?: string;
  linked_item_ids?: string[];
}

export interface ItemRow {
  id: number;
  board_id: number;
  /** For creating a placeholder board row when the item is on a board we haven't seen. Not stored on the item. */
  board_name: string | null;
  group_id: string | null;
  parent_item_id: number | null;
  name: string;
  state: "active" | "archived" | "deleted";
  creator_id: number | null;
  monday_created_at: string | null;
  monday_updated_at: string;
  column_values: Record<string, StoredValue>;
}

export interface AssetRef {
  id: number;
  item_id: number;
  column_id: string | null;
  update_id: number | null;
  name: string;
}

export interface UpdateRow {
  id: number;
  item_id: number;
  creator_id: number | null;
  body: string | null;
  text_body: string | null;
  monday_created_at: string | null;
  monday_updated_at: string | null;
}

/**
 * A Monday id: a positive whole number, sent as a number or as a string of digits. Nothing else is an id, even where
 * Number() would read it as one (true, [7], "0x10", "1e3", " 12 ").
 */
export function toId(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function parseJson(raw: string | null | undefined): unknown {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const STATES = new Set(["active", "archived", "deleted"]);

export function normaliseValue(cv: RawColumnValue): StoredValue {
  const out: StoredValue = { type: cv.type ?? "unknown", text: cv.text ?? null, value: parseJson(cv.value) };
  if (cv.label != null) out.label = cv.label;
  if (cv.index != null) out.index = cv.index;
  if (cv.date != null) out.date = cv.date;
  if (cv.display_value != null) out.display_value = cv.display_value;
  if (Array.isArray(cv.linked_item_ids)) out.linked_item_ids = cv.linked_item_ids.map(String);
  return out;
}

/** The uploaded files a file column holds ({"files": [{"assetId": ...}]}). Links and docs have no asset. */
export function fileAssets(value: unknown): { id: number; name: string }[] {
  const files = (value as { files?: unknown } | null)?.files;
  if (!Array.isArray(files)) return [];
  return files.flatMap((f) => {
    if (!f) return [];
    const file = f as { assetId?: unknown; name?: unknown };
    const id = toId(file.assetId);
    if (id === null) return [];
    return [{ id, name: typeof file.name === "string" && file.name ? file.name : `file-${id}` }];
  });
}

export function normaliseItem(raw: RawItem, boardIdFallback?: number): { item: ItemRow; assets: AssetRef[] } | null {
  if (!raw) return null;
  const id = toId(raw.id);
  const boardId = toId(raw.board?.id) ?? boardIdFallback ?? null;
  if (id === null || boardId === null || !raw.updated_at) return null;

  const column_values: Record<string, StoredValue> = {};
  const assets: AssetRef[] = [];
  for (const cv of raw.column_values ?? []) {
    if (!cv || typeof cv.id !== "string") continue;
    const stored = normaliseValue(cv);
    column_values[cv.id] = stored;
    if (stored.type === "file") {
      for (const f of fileAssets(stored.value)) {
        assets.push({ id: f.id, item_id: id, column_id: cv.id, update_id: null, name: f.name });
      }
    }
  }

  return {
    item: {
      id,
      board_id: boardId,
      board_name: raw.board?.name ?? null,
      group_id: raw.group?.id ?? null,
      parent_item_id: toId(raw.parent_item?.id),
      name: raw.name || `Item ${id}`,
      state: raw.state && STATES.has(raw.state) ? (raw.state as ItemRow["state"]) : "active",
      creator_id: toId(raw.creator_id),
      monday_created_at: raw.created_at ?? null,
      monday_updated_at: raw.updated_at,
      column_values,
    },
    assets,
  };
}

export function normaliseUpdate(raw: RawUpdate): { update: UpdateRow; assets: AssetRef[] } | null {
  if (!raw) return null;
  const id = toId(raw.id);
  const itemId = toId(raw.item_id);
  if (id === null || itemId === null) return null;
  const assets = (raw.assets ?? []).flatMap((a) => {
    const assetId = toId(a?.id);
    return assetId === null ? [] : [{ id: assetId, item_id: itemId, column_id: null, update_id: id, name: a.name || `file-${assetId}` }];
  });
  return {
    update: {
      id,
      item_id: itemId,
      creator_id: toId(raw.creator_id),
      body: raw.body ?? null,
      text_body: raw.text_body ?? null,
      monday_created_at: raw.created_at ?? null,
      monday_updated_at: raw.updated_at ?? null,
    },
    assets,
  };
}
