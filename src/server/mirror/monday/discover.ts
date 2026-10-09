import type { Db } from "../../db/types";
import type { MondayClient } from "./client";
import { toId } from "./normalise";
import { Q } from "./queries";
import { replaceColumns, replaceGroups, upsertBoards, upsertUsers, upsertWorkspaces } from "./store";

interface RawBoard {
  id: string;
  name: string;
  type?: string | null;
  state?: string | null;
  updated_at?: string | null;
  workspace?: { id: string | null } | null;
  columns?: { id: string; title: string; type: string }[] | null;
  groups?: { id: string; title: string; color?: string | null; position?: string | null; archived?: boolean | null; deleted?: boolean | null }[] | null;
}

async function saveBoards(db: Db, boards: RawBoard[]): Promise<number[]> {
  const rows = boards.flatMap((b) => {
    const id = toId(b.id);
    return id === null
      ? []
      : [{ id, workspace_id: toId(b.workspace?.id), name: b.name, type: b.type ?? "board", state: b.state ?? "active", monday_updated_at: b.updated_at ?? null }];
  });
  await upsertBoards(db, rows);
  for (const b of boards) {
    const id = toId(b.id);
    if (id === null) continue;
    await replaceColumns(db, id, (b.columns ?? []).map((c, position) => ({ id: c.id, title: c.title, type: c.type, position })));
    await replaceGroups(
      db,
      id,
      (b.groups ?? []).map((g) => ({
        id: g.id, title: g.title, color: g.color ?? null, position: g.position ?? null,
        archived: g.archived ?? false, deleted: g.deleted ?? false,
      })),
    );
  }
  return rows.map((r) => r.id);
}

/** Every workspace the token can see. One call. */
export async function discoverWorkspaces(db: Db, monday: MondayClient): Promise<number> {
  const data = await monday.query<{ workspaces: { id: string; name: string; kind?: string | null }[] }>(Q.workspaces);
  const rows = data.workspaces.flatMap((w) => {
    const id = toId(w.id);
    return id === null ? [] : [{ id, name: w.name, kind: w.kind ?? null }];
  });
  await upsertWorkspaces(db, rows);
  return rows.length;
}

/** Every board in these workspaces, with columns and groups. One call per 100 boards. */
export async function discoverBoards(db: Db, monday: MondayClient, workspaceIds: number[]): Promise<number> {
  let total = 0;
  for (let page = 1; page <= 50; page++) {
    const data = await monday.query<{ boards: RawBoard[] }>(Q.boardsInWorkspaces, { ws: workspaceIds.map(String), page });
    total += (await saveBoards(db, data.boards)).length;
    if (data.boards.length < 100) break;
  }
  return total;
}

/** These boards by id (subitems boards, or boards outside the workspace). Returns the ids Monday returned. */
export async function discoverBoardsById(db: Db, monday: MondayClient, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const found: number[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const data = await monday.query<{ boards: RawBoard[] }>(Q.boardsById, { ids: ids.slice(i, i + 100).map(String) });
    found.push(...(await saveBoards(db, data.boards)));
  }
  return found;
}

export async function discoverUsers(db: Db, monday: MondayClient): Promise<number> {
  let total = 0;
  for (let page = 1; page <= 20; page++) {
    const data = await monday.query<{ users: { id: string; name?: string | null; email?: string | null; enabled?: boolean | null; is_guest?: boolean | null }[] }>(
      Q.users,
      { page },
    );
    const rows = data.users.flatMap((u) => {
      const id = toId(u.id);
      return id === null ? [] : [{ id, name: u.name ?? null, email: u.email ?? null, enabled: u.enabled ?? null, is_guest: u.is_guest ?? null }];
    });
    await upsertUsers(db, rows);
    total += rows.length;
    if (data.users.length < 200) break;
  }
  return total;
}
