import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { discoverBoards, discoverBoardsById, discoverUsers, discoverWorkspaces } from "./discover";
import { Q } from "./queries";
import { fakeMonday } from "./test-fakes";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

/** A board as the API returns it: two columns and one group unless `over` says otherwise. */
const board = (id: number | string, over: Record<string, unknown> = {}) => ({
  id: String(id),
  name: `Test board ${id}`,
  type: "board",
  state: "active",
  updated_at: "2026-10-07T00:00:00Z",
  workspace: { id: "1" },
  columns: [
    { id: "name", title: "Name", type: "name" },
    { id: "status", title: "Status", type: "status" },
  ],
  groups: [{ id: "topics", title: "Group A", color: "#579bfc", position: "65536.0", archived: false, deleted: false }],
  ...over,
});

test("discover: workspaces are saved, one with an unusable id is skipped, and a rename keeps the sync switch", async () => {
  let answer: { id: string; name: string; kind?: string }[] = [
    { id: "1", name: "Test workspace", kind: "open" },
    { id: "abc", name: "Bad id", kind: "open" },
    { id: "2", name: "Test workspace 2" },
  ];
  const monday = fakeMonday((document) => {
    assert.equal(document, Q.workspaces);
    return { workspaces: answer };
  });
  assert.equal(await discoverWorkspaces(db, monday), 2);

  await db.query("update mirror.monday_workspaces set sync_enabled = true where id = 1");
  answer = [{ id: "1", name: "Test workspace, renamed", kind: "open" }];
  assert.equal(await discoverWorkspaces(db, monday), 1);

  const rows = await db.query<{ id: number; name: string; kind: string | null; sync_enabled: boolean }>(
    "select id, name, kind, sync_enabled from mirror.monday_workspaces order by id",
  );
  assert.deepEqual(rows, [
    { id: 1, name: "Test workspace, renamed", kind: "open", sync_enabled: true },
    { id: 2, name: "Test workspace 2", kind: null, sync_enabled: false },
  ]);
  assert.equal(monday.stats.calls, 2);
});

test("discover: boards come 100 to a page with their columns and groups, and odd boards are stored sensibly", async () => {
  const asked: { ws: unknown; page: unknown }[] = [];
  const monday = fakeMonday((document, variables) => {
    assert.equal(document, Q.boardsInWorkspaces);
    asked.push({ ws: variables.ws, page: variables.page });
    if (variables.page === 1) return { boards: Array.from({ length: 100 }, (_, i) => board(1000 + i)) };
    return {
      boards: [
        board(1100, { workspace: { id: "77" } }),
        board(1101, { workspace: null, state: "archived" }),
        board(1102, { state: "mystery" }),
        board("abc"),
      ],
    };
  });

  assert.equal(await discoverBoards(db, monday, [1]), 103, "the board with an unusable id isn't counted");
  assert.deepEqual(asked, [
    { ws: ["1"], page: 1 },
    { ws: ["1"], page: 2 },
  ]);

  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from mirror.monday_boards");
  assert.equal(n, 103);
  const odd = await db.query<{ id: number; workspace_id: number | null; state: string }>(
    "select id, workspace_id, state from mirror.monday_boards where id in (1100, 1101, 1102) order by id",
  );
  assert.deepEqual(odd, [
    { id: 1100, workspace_id: 77, state: "active" },
    { id: 1101, workspace_id: null, state: "archived" },
    { id: 1102, workspace_id: 1, state: "active" },
  ]);
  const [placeholder] = await db.query<{ name: string }>("select name from mirror.monday_workspaces where id = 77");
  assert.equal(placeholder.name, "Workspace 77", "a workspace we hadn't listed gets a placeholder");

  const columns = await db.query<{ id: string; title: string; type: string; position: number }>(
    "select id, title, type, position from mirror.monday_columns where board_id = 1000 order by position",
  );
  assert.deepEqual(columns, [
    { id: "name", title: "Name", type: "name", position: 0 },
    { id: "status", title: "Status", type: "status", position: 1 },
  ]);
  const groups = await db.query("select id, title, color, position, archived, deleted from mirror.monday_groups where board_id = 1000");
  assert.deepEqual(groups, [{ id: "topics", title: "Group A", color: "#579bfc", position: "65536.0", archived: false, deleted: false }]);
});

test("discover: a board seen again has its columns and groups replaced, not added to", async () => {
  // This test seeds its own board, so it proves the replacing when run alone as well as in the file.
  const NAME = { id: "name", title: "Name", type: "name" };
  const first = fakeMonday(() => ({
    boards: [
      board(1200, {
        columns: [NAME, { id: "status", title: "Status", type: "status" }, { id: "owner", title: "Owner", type: "people" }],
        groups: [
          { id: "topics", title: "Group A", color: "#579bfc", position: "65536.0", archived: false, deleted: false },
          { id: "done", title: "Done", color: "#00c875", position: "131072.0", archived: false, deleted: false },
        ],
      }),
    ],
  }));
  await discoverBoards(db, first, [1]);
  const columnIds = async () =>
    (await db.query<{ id: string }>("select id from mirror.monday_columns where board_id = 1200 order by position")).map((c) => c.id);
  assert.deepEqual(await columnIds(), ["name", "status", "owner"]);
  assert.equal((await db.query("select id from mirror.monday_groups where board_id = 1200")).length, 2);

  const again = fakeMonday(() => ({
    boards: [
      board(1200, {
        name: "Test board 1200, renamed",
        columns: [NAME, { id: "date", title: "Due", type: "date" }],
        groups: [{ id: "topics", title: "Group A, renamed", color: "#579bfc", position: "65536.0", archived: false, deleted: false }],
      }),
    ],
  }));
  await discoverBoards(db, again, [1]);

  const columns = await db.query<{ id: string; position: number }>(
    "select id, position from mirror.monday_columns where board_id = 1200 order by position",
  );
  assert.deepEqual(columns, [
    { id: "name", position: 0 },
    { id: "date", position: 1 },
  ]);
  const groups = await db.query<{ id: string; title: string }>("select id, title from mirror.monday_groups where board_id = 1200");
  assert.deepEqual(groups, [{ id: "topics", title: "Group A, renamed" }]);
  const [renamed] = await db.query<{ name: string }>("select name from mirror.monday_boards where id = 1200");
  assert.equal(renamed.name, "Test board 1200, renamed");
});

test("discover: boards by id go in batches of 100, and the ids Monday returned come back", async () => {
  const batches: number[] = [];
  const monday = fakeMonday((document, variables) => {
    assert.equal(document, Q.boardsById);
    const ids = variables.ids as string[];
    batches.push(ids.length);
    // 2050 is a board this token can't see: Monday leaves it out.
    return { boards: ids.filter((id) => id !== "2050").map((id) => board(id, { type: "sub_items_board", workspace: null })) };
  });

  assert.deepEqual(await discoverBoardsById(db, monday, []), []);
  assert.equal(monday.stats.calls, 0, "nothing to ask for, nothing sent");

  const found = await discoverBoardsById(db, monday, Array.from({ length: 150 }, (_, i) => 2000 + i));
  assert.equal(found.length, 149);
  assert.ok(!found.includes(2050));
  assert.deepEqual(batches, [100, 50]);
  const stored = await db.query<{ type: string; n: number }>(
    "select type, count(*)::int as n from mirror.monday_boards where id between 2000 and 2149 group by type",
  );
  assert.deepEqual(stored, [{ type: "sub_items_board", n: 149 }]);
});

test("discover: users come 200 to a page, and one with an unusable id is skipped", async () => {
  const user = (id: number | string, over: Record<string, unknown> = {}) => ({
    id: String(id),
    name: `Test User ${id}`,
    email: null,
    enabled: true,
    is_guest: false,
    ...over,
  });
  const pages: unknown[] = [];
  const monday = fakeMonday((document, variables) => {
    assert.equal(document, Q.users);
    pages.push(variables.page);
    if (variables.page === 1) return { users: Array.from({ length: 200 }, (_, i) => user(5000 + i)) };
    return { users: [user(5200, { name: null, enabled: null, is_guest: null }), user("abc")] };
  });

  assert.equal(await discoverUsers(db, monday), 201);
  assert.deepEqual(pages, [1, 2]);
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from mirror.monday_users");
  assert.equal(n, 201);
  const [sparse] = await db.query("select name, enabled, is_guest from mirror.monday_users where id = 5200");
  assert.deepEqual(sparse, { name: null, enabled: null, is_guest: null });
});
