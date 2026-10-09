import type { Db } from "../../db/types";
import type { AssetRef, ItemRow, UpdateRow } from "./normalise";

/** Upserts into mirror.monday_*. Batches travel as one JSON parameter; duplicate ids are dropped first. */

const dedupe = <T extends { id: number | string }>(rows: T[]): T[] => [...new Map(rows.map((r) => [r.id, r])).values()];
/**
 * Rows as JSON text for `$n::jsonb`. Postgres refuses a NUL character (and a lone surrogate) anywhere in json
 * or text, which would fail the whole batch, and the same window would fail on every run after. So each string
 * drops its NULs and has any lone surrogate replaced (U+FFFD) before it's written.
 */
const json = (v: unknown) =>
  JSON.stringify(v, (_key, x) => (typeof x === "string" ? x.replaceAll("\u0000", "").toWellFormed() : x));

export interface BoardRow {
  id: number;
  workspace_id: number | null;
  name: string;
  type: string;
  state: string;
  monday_updated_at: string | null;
}

export interface ColumnRow {
  id: string;
  title: string;
  type: string;
  position: number;
}

export interface GroupRow {
  id: string;
  title: string;
  color: string | null;
  position: string | null;
  archived: boolean;
  deleted: boolean;
}

export interface SyncedBoard {
  id: number;
  name: string;
  board_key: string | null;
  purpose: string | null;
  parent_board_id: number | null;
}

export async function upsertWorkspaces(db: Db, rows: { id: number; name: string; kind: string | null }[]): Promise<void> {
  if (rows.length === 0) return;
  await db.query(
    `insert into mirror.monday_workspaces as w (id, name, kind)
     select x.id, x.name, x.kind from jsonb_to_recordset($1::jsonb) as x(id bigint, name text, kind text)
     on conflict (id) do update set name = excluded.name, kind = excluded.kind, synced_at = now()`,
    [json(dedupe(rows))],
  );
}

export async function upsertBoards(db: Db, rows: BoardRow[]): Promise<void> {
  if (rows.length === 0) return;
  const unique = dedupe(rows);
  // A board can sit in a workspace we haven't listed: add a placeholder for it.
  await db.query(
    `insert into mirror.monday_workspaces (id, name)
     select distinct x.workspace_id, 'Workspace ' || x.workspace_id
     from jsonb_to_recordset($1::jsonb) as x(workspace_id bigint)
     where x.workspace_id is not null
     on conflict (id) do nothing`,
    [json(unique)],
  );
  await db.query(
    `insert into mirror.monday_boards as b (id, workspace_id, name, type, state, monday_updated_at)
     select x.id, x.workspace_id, x.name, coalesce(x.type, 'board'),
            case when x.state in ('active', 'archived', 'deleted') then x.state else 'active' end,
            x.monday_updated_at
     from jsonb_to_recordset($1::jsonb) as x(
       id bigint, workspace_id bigint, name text, type text, state text, monday_updated_at timestamptz)
     on conflict (id) do update set
       workspace_id = coalesce(excluded.workspace_id, b.workspace_id), name = excluded.name, type = excluded.type,
       state = excluded.state, monday_updated_at = excluded.monday_updated_at, synced_at = now()`,
    [json(unique)],
  );
}

/** Makes a board's columns match `rows`: upserts them and drops columns Monday no longer has. */
export async function replaceColumns(db: Db, boardId: number, rows: ColumnRow[]): Promise<void> {
  await db.query(
    `with incoming as (
       select * from jsonb_to_recordset($2::jsonb) as x(id text, title text, type text, position integer)
     ), up as (
       insert into mirror.monday_columns as c (board_id, id, title, type, position)
       select $1, id, title, type, position from incoming
       on conflict (board_id, id) do update set
         title = excluded.title, type = excluded.type, position = excluded.position, synced_at = now()
       returning 1
     )
     delete from mirror.monday_columns c
     where c.board_id = $1 and not exists (select 1 from incoming i where i.id = c.id)`,
    [boardId, json(dedupe(rows))],
  );
}

export async function replaceGroups(db: Db, boardId: number, rows: GroupRow[]): Promise<void> {
  await db.query(
    `with incoming as (
       select * from jsonb_to_recordset($2::jsonb)
         as x(id text, title text, color text, position text, archived boolean, deleted boolean)
     ), up as (
       insert into mirror.monday_groups as g (board_id, id, title, color, position, archived, deleted)
       select $1, id, title, color, position, coalesce(archived, false), coalesce(deleted, false) from incoming
       on conflict (board_id, id) do update set
         title = excluded.title, color = excluded.color, position = excluded.position,
         archived = excluded.archived, deleted = excluded.deleted, synced_at = now()
       returning 1
     )
     delete from mirror.monday_groups g
     where g.board_id = $1 and not exists (select 1 from incoming i where i.id = g.id)`,
    [boardId, json(dedupe(rows))],
  );
}

/** Upserts items. Returns how many rows were new or changed (a copy with the same updated_at is skipped). */
export async function upsertItems(db: Db, items: ItemRow[]): Promise<number> {
  if (items.length === 0) return 0;
  const unique = dedupe(items);
  const boards = dedupe(unique.map((i) => ({ id: i.board_id, name: i.board_name ?? `Board ${i.board_id}` })));
  await db.query(
    `insert into mirror.monday_boards (id, name)
     select x.id, x.name from jsonb_to_recordset($1::jsonb) as x(id bigint, name text)
     on conflict (id) do nothing`,
    [json(boards)],
  );
  const rows = await db.query<{ id: number }>(
    `insert into mirror.monday_items as i (
       id, board_id, group_id, parent_item_id, name, state, creator_id,
       monday_created_at, monday_updated_at, column_values, synced_at, removed_at
     )
     select x.id, x.board_id, x.group_id, x.parent_item_id, x.name, x.state, x.creator_id,
            x.monday_created_at, x.monday_updated_at, x.column_values, now(),
            case when x.state = 'active' then null else now() end
     from jsonb_to_recordset($1::jsonb) as x(
       id bigint, board_id bigint, group_id text, parent_item_id bigint, name text, state text,
       creator_id bigint, monday_created_at timestamptz, monday_updated_at timestamptz, column_values jsonb)
     on conflict (id) do update set
       board_id = excluded.board_id,
       group_id = excluded.group_id,
       parent_item_id = excluded.parent_item_id,
       name = excluded.name,
       state = excluded.state,
       creator_id = excluded.creator_id,
       monday_created_at = excluded.monday_created_at,
       monday_updated_at = excluded.monday_updated_at,
       column_values = excluded.column_values,
       synced_at = now(),
       removed_at = case when excluded.state = 'active' then null else coalesce(i.removed_at, now()) end
     where (i.monday_updated_at, i.state, i.board_id, i.group_id, i.name, i.parent_item_id, i.removed_at is null)
       is distinct from
       (excluded.monday_updated_at, excluded.state, excluded.board_id, excluded.group_id, excluded.name,
        excluded.parent_item_id, excluded.state = 'active')
     returning i.id`,
    [json(unique.map(({ board_name: _board, ...row }) => row))],
  );
  return rows.length;
}

/**
 * Records the files these items' file columns hold now, and marks removed any
 * file a column no longer holds. Files attached to updates are left alone.
 */
export async function syncFileAssets(db: Db, itemIds: number[], assets: AssetRef[]): Promise<void> {
  if (itemIds.length === 0) return;
  const unique = dedupe(assets);
  if (unique.length > 0) {
    await db.query(
      `insert into mirror.monday_assets as a (id, item_id, column_id, update_id, name)
       select x.id, x.item_id, x.column_id, x.update_id, x.name
       from jsonb_to_recordset($1::jsonb) as x(id bigint, item_id bigint, column_id text, update_id bigint, name text)
       on conflict (id) do update set
         item_id = excluded.item_id, column_id = coalesce(excluded.column_id, a.column_id),
         update_id = coalesce(excluded.update_id, a.update_id), name = excluded.name,
         removed_at = null, synced_at = now()`,
      [json(unique)],
    );
  }
  await db.query(
    `update mirror.monday_assets a set removed_at = now()
     where a.item_id in (select (jsonb_array_elements_text($1::jsonb))::bigint)
       and a.column_id is not null and a.removed_at is null
       and a.id not in (select (jsonb_array_elements_text($2::jsonb))::bigint)`,
    [json([...new Set(itemIds)]), json(unique.map((a) => a.id))],
  );
}

export async function upsertUpdates(db: Db, updates: UpdateRow[], assets: AssetRef[]): Promise<number> {
  if (updates.length === 0) return 0;
  const rows = await db.query<{ id: number }>(
    `insert into mirror.monday_updates as u (id, item_id, creator_id, body, text_body, monday_created_at, monday_updated_at)
     select x.id, x.item_id, x.creator_id, x.body, x.text_body, x.monday_created_at, x.monday_updated_at
     from jsonb_to_recordset($1::jsonb) as x(
       id bigint, item_id bigint, creator_id bigint, body text, text_body text,
       monday_created_at timestamptz, monday_updated_at timestamptz)
     on conflict (id) do update set
       body = excluded.body, text_body = excluded.text_body,
       monday_updated_at = excluded.monday_updated_at, synced_at = now()
     where u.monday_updated_at is distinct from excluded.monday_updated_at
     returning u.id`,
    [json(dedupe(updates))],
  );
  const unique = dedupe(assets);
  if (unique.length > 0) {
    await db.query(
      `insert into mirror.monday_assets as a (id, item_id, column_id, update_id, name)
       select x.id, x.item_id, null, x.update_id, x.name
       from jsonb_to_recordset($1::jsonb) as x(id bigint, item_id bigint, update_id bigint, name text)
       on conflict (id) do update set update_id = coalesce(a.update_id, excluded.update_id), synced_at = now()`,
      [json(unique)],
    );
  }
  return rows.length;
}

/** Marks items gone. Returns how many were live until now. */
export async function markRemoved(db: Db, ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db.query<{ id: number }>(
    `update mirror.monday_items
        set removed_at = now(), state = case when state = 'active' then 'deleted' else state end
      where id in (select (jsonb_array_elements_text($1::jsonb))::bigint) and removed_at is null
      returning id`,
    [json([...new Set(ids)])],
  );
  return rows.length;
}

export async function upsertUsers(
  db: Db,
  rows: { id: number; name: string | null; email: string | null; enabled: boolean | null; is_guest: boolean | null }[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.query(
    `insert into mirror.monday_users as u (id, name, email, enabled, is_guest)
     select x.id, x.name, x.email, x.enabled, x.is_guest
     from jsonb_to_recordset($1::jsonb) as x(id bigint, name text, email text, enabled boolean, is_guest boolean)
     on conflict (id) do update set
       name = excluded.name, email = excluded.email, enabled = excluded.enabled, is_guest = excluded.is_guest, synced_at = now()`,
    [json(dedupe(rows))],
  );
}

/** Live items on a board: id to Monday's updated_at in milliseconds. */
export async function itemStamps(db: Db, boardId: number): Promise<Map<number, number>> {
  const rows = await db.query<{ id: number; updated: Date }>(
    "select id, monday_updated_at as updated from mirror.monday_items where board_id = $1 and removed_at is null",
    [boardId],
  );
  return new Map(rows.map((r) => [r.id, new Date(r.updated).getTime()]));
}

/** Boards being mirrored, parents before their subitems boards. With a key, that board and its subitems board. */
export async function syncedBoards(db: Db, boardKey?: string): Promise<SyncedBoard[]> {
  return db.query<SyncedBoard>(
    `select b.id, b.name, b.board_key, b.purpose, b.parent_board_id
     from mirror.monday_boards b
     left join mirror.monday_boards p on p.id = b.parent_board_id
     where b.sync_enabled
       and ($1::text is null or b.board_key = $1 or p.board_key = $1)
     order by b.parent_board_id nulls first, b.id`,
    [boardKey ?? null],
  );
}
