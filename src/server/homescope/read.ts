import type { MondayClient } from "../mirror/monday/client";
import { normaliseItem, type ItemRow, type RawItem } from "../mirror/monday/normalise";
import { Q } from "../mirror/monday/queries";
import { BOARDS, HOMESCOPE_WORKSPACE, SOURCE_FOLDER, type BoardKey, type ColumnInfo, type EstimationBoards } from "./boards";

/** Monday doesn't have the workspace, the folder or a board where the import expects it. Nothing is imported. */
export class CatalogueSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogueSourceError";
  }
}

const FOLDERS = "query ($ws: [ID]) { folders(workspace_ids: $ws, limit: 100) { id name children { id name } } }";

/** Items per call. 250 keeps the widest board (Models, 76 columns) far under Monday's complexity limit. */
export const PAGE_SIZE = 250;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.toLowerCase();

/**
 * Every item on the catalogue's twelve boards. Three calls find them (workspaces,
 * the workspace's folders, the boards' columns), then one per 250 items: about 29 in
 * all at October 2026's size. Read only, through the mirror's client.
 */
export async function readEstimationBoards(monday: MondayClient): Promise<EstimationBoards> {
  const { workspaces } = await monday.query<{ workspaces: { id: string; name: string }[] }>(Q.workspaces);
  const ws = workspaces.find((w) => same(w.name, HOMESCOPE_WORKSPACE));
  if (!ws) throw new CatalogueSourceError(`No Monday workspace named "${HOMESCOPE_WORKSPACE}" is visible to this token`);

  type Folder = { id: string; name: string; children: ({ id: string; name: string } | null)[] | null };
  const { folders } = await monday.query<{ folders: Folder[] }>(FOLDERS, { ws: [ws.id] });
  const folder = folders.find((f) => same(f.name, SOURCE_FOLDER));
  if (!folder) throw new CatalogueSourceError(`The ${HOMESCOPE_WORKSPACE} workspace has no folder named "${SOURCE_FOLDER}"`);

  const ids = {} as Record<BoardKey, string>;
  const missing: string[] = [];
  for (const [key, title] of Object.entries(BOARDS) as [BoardKey, string][]) {
    const child = (folder.children ?? []).find((c) => c != null && same(c.name, title));
    if (child) ids[key] = child.id;
    else missing.push(title);
  }
  if (missing.length) throw new CatalogueSourceError(`"${SOURCE_FOLDER}" is missing ${missing.join(", ")}`);

  const { boards } = await monday.query<{ boards: { id: string; columns: ColumnInfo[] | null }[] }>(Q.boardsById, {
    ids: Object.values(ids),
  });
  const out = {} as EstimationBoards;
  for (const [key, id] of Object.entries(ids) as [BoardKey, string][]) {
    const columns = (boards.find((b) => b.id === id)?.columns ?? []).map((c) => ({ id: c.id, title: c.title, type: c.type }));
    out[key] = { columns, items: await readItems(monday, id) };
  }
  return out;
}

type Page = { cursor: string | null; items: RawItem[] };

async function readItems(monday: MondayClient, boardId: string): Promise<ItemRow[]> {
  const first = await monday.query<{ boards: { items_page: Page }[] }>(Q.firstItemsPage, { board: [boardId], limit: PAGE_SIZE });
  let page: Page | undefined = first.boards[0]?.items_page;
  const items: ItemRow[] = [];
  while (page) {
    for (const raw of page.items) {
      const n = normaliseItem(raw, Number(boardId));
      if (n) items.push(n.item);
    }
    if (!page.cursor) break;
    const next: { next_items_page: Page } = await monday.query(Q.nextItemsPage, { cursor: page.cursor, limit: PAGE_SIZE });
    page = next.next_items_page;
  }
  return items;
}
