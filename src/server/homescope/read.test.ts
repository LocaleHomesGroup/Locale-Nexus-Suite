import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeMonday } from "../mirror/monday/test-fakes";
import { BOARDS, type BoardKey } from "./boards";
import { CatalogueSourceError, PAGE_SIZE, readEstimationBoards } from "./read";

const KEYS = Object.keys(BOARDS) as BoardKey[];
/** Made-up ids: board n is "10n". */
const boardId = (key: BoardKey) => String(100 + KEYS.indexOf(key));
const raw = (id: number, name: string) => ({ id: String(id), name, state: "active", updated_at: "2026-10-09T00:00:00Z", column_values: [] });

/** A Monday with the HomeScope workspace and folder. `variations` gets two pages; every other board one item. */
function monday(over: { folderName?: string; drop?: string; workspace?: string } = {}) {
  const children = KEYS.filter((k) => BOARDS[k] !== over.drop).map((k) => ({ id: boardId(k), name: BOARDS[k] }));
  return fakeMonday((doc, vars) => {
    if (doc.includes("workspaces(")) return { workspaces: [{ id: "1", name: "Other" }, { id: "2", name: over.workspace ?? "HomeScope" }] };
    if (doc.includes("folders(")) {
      assert.deepEqual(vars.ws, ["2"]);
      return { folders: [{ id: "f1", name: "Estimation Leads and Agreements", children: [] }, { id: "f2", name: over.folderName ?? "Estimation Source Data", children }] };
    }
    if (doc.includes("next_items_page")) {
      assert.equal(vars.cursor, "page-2");
      assert.equal(vars.limit, PAGE_SIZE);
      return { next_items_page: { cursor: null, items: [raw(902, "Test Variation Two")] } };
    }
    if (doc.includes("items_page")) {
      const id = (vars.board as string[])[0];
      const key = KEYS.find((k) => boardId(k) === id)!;
      return { boards: [{ items_page: { cursor: key === "variations" ? "page-2" : null, items: [raw(Number(id) * 10, `Test ${BOARDS[key]}`)] } }] };
    }
    if (doc.includes("boards(ids: $ids")) {
      return { boards: (vars.ids as string[]).map((id) => ({ id, name: "x", columns: [{ id: "name", title: "Name", type: "name" }] })) };
    }
    throw new Error(`unexpected document: ${doc.slice(0, 60)}`);
  });
}

test("read: finds the twelve boards by title in the HomeScope folder and follows each board's pages", async () => {
  const m = monday();
  const boards = await readEstimationBoards(m);
  assert.deepEqual(Object.keys(boards).sort(), [...KEYS].sort());
  assert.deepEqual(boards.builders.items.map((i) => i.name), ["Test Builders"]);
  assert.deepEqual(boards.variations.items.map((i) => i.name), ["Test Variations", "Test Variation Two"]);
  assert.deepEqual(boards.models.columns, [{ id: "name", title: "Name", type: "name" }]);
  // workspaces + folders + boards, then one page per board and one more for variations.
  assert.equal(m.stats.calls, 3 + KEYS.length + 1);
});

test("read: the workspace, the folder or a board not where it should be stops the read with what's missing", async () => {
  await assert.rejects(readEstimationBoards(monday({ workspace: "Renamed" })), (e) => e instanceof CatalogueSourceError && /No Monday workspace named "HomeScope"/.test(e.message));
  await assert.rejects(readEstimationBoards(monday({ folderName: "Old Data" })), (e) => e instanceof CatalogueSourceError && /no folder named "Estimation Source Data"/.test(e.message));
  await assert.rejects(readEstimationBoards(monday({ drop: "Levels" })), (e) => e instanceof CatalogueSourceError && /is missing Levels/.test(e.message));
});
