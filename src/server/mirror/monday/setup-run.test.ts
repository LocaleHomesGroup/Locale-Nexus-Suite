import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migratedTestDb } from "../../db/pglite";
import { addStaff } from "../../db/test-fixtures";
import type { Db } from "../../db/types";
import { Q } from "./queries";
import { matchReps, runSetup } from "./setup";
import { fakeMonday } from "./test-fakes";

/** The config here is invented, like setup.test.ts's: the real one is Jerry's, read at run time and never copied in. */
const config = (jobNumberColumn = "text4") => ({
  workspaces: { production: { id: 1, name: "Test workspace" } },
  production: {
    boards: {
      homes_sales_wa: { parent: 100, subitems: 101 },
      homes_handed_over_wa: { parent: 150, subitems: null },
      exclusive_land: { parent: 300, subitems: null },
      wealth_sales: { parent: 400, subitems: 401 },
    },
    parentColumns: {
      shared_homes: { _applies_to: ["homes_sales_wa", "homes_handed_over_wa"], job_number: jobNumberColumn, sales_rep: "text_r" },
      per_board: { homes_sales_wa: { builder: "color_a", invented_field: "x" } },
    },
    subitemColumns: { all_boards: { milestone_status: "status", due_date: "date" }, per_board: {} },
  },
});

const dir = mkdtempSync(join(tmpdir(), "lp-setup-run-"));
let files = 0;
const writeConfig = (value: unknown) => {
  const path = join(dir, `monday-${(files += 1)}.json`);
  writeFileSync(path, JSON.stringify(value));
  return path;
};

const col = (id: string, title: string, type = "text") => ({ id, title, type });
const board = (id: number, columns: ReturnType<typeof col>[], over: Record<string, unknown> = {}) => ({
  id: String(id),
  name: `Test board ${id}`,
  type: "board",
  state: "active",
  updated_at: "2026-10-07T00:00:00Z",
  workspace: { id: "1" },
  columns,
  groups: [],
  ...over,
});

const NAME = col("name", "Name", "name");
const LAND = [NAME, col("status", "Status", "status"), col("text_e", "Estate"), col("num_p", "Land Price", "numbers"), col("num_q", "Price", "numbers"), col("files", "Plans & Files", "file")];

/** A Monday that shows boards 100, 150 and 300 in the workspace, and 101 by id. It can't see 400 or 401. */
const mondayFor = () =>
  fakeMonday((document, variables) => {
    if (document === Q.workspaces) return { workspaces: [{ id: "1", name: "Test workspace", kind: "open" }] };
    if (document === Q.users) return { users: [{ id: "5001", name: "Test User A", email: null, kind: "member", status: "ACTIVE", is_deleted: false }] };
    if (document === Q.boardsInWorkspaces) {
      return { boards: [board(100, [NAME, col("text4", "Job")]), board(150, [NAME]), board(300, LAND)] };
    }
    if (document === Q.boardsById) {
      const ids = variables.ids as string[];
      return { boards: ids.includes("101") ? [board(101, [NAME, col("status", "Status", "status")], { type: "sub_items_board", workspace: null })] : [] };
    }
    throw new Error(`unexpected document: ${document.slice(0, 40)}`);
  });

/** A Monday that lists `inWorkspace` in the workspace, and returns from `byId` the boards asked for by id. */
const mondayWith = (inWorkspace: ReturnType<typeof board>[], byId: ReturnType<typeof board>[] = []) =>
  fakeMonday((document, variables) => {
    if (document === Q.workspaces) return { workspaces: [{ id: "1", name: "Test workspace", kind: "open" }] };
    if (document === Q.users) return { users: [] };
    if (document === Q.boardsInWorkspaces) return { boards: inWorkspace };
    if (document === Q.boardsById) return { boards: byId.filter((b) => (variables.ids as string[]).includes(b.id)) };
    throw new Error(`unexpected document: ${document.slice(0, 40)}`);
  });

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => {
  rmSync(dir, { recursive: true, force: true });
  await close();
});

const fieldMap = () =>
  db.query<{ board_id: number; field_key: string; column_id: string; source: string }>(
    "select board_id, field_key, column_id, source from mirror.monday_field_map order by board_id, field_key",
  );

test("runSetup: turns on the boards Monday shows, links each subitems board, and maps the fields", async () => {
  const lines: string[] = [];
  const monday = mondayFor();
  const report = await runSetup(db, monday, { jerryConfigPath: writeConfig(config()), log: (line) => lines.push(line) });

  assert.deepEqual(report.boardsEnabled, ["homes_sales_wa", "homes_handed_over_wa", "exclusive_land"]);
  assert.deepEqual(report.notVisible, ["wealth_sales"], "a board the token can't see is reported, not enabled");
  assert.deepEqual(report.unknownFields, ["invented_field"]);
  assert.equal(report.fieldsMapped, 7);
  assert.deepEqual(report.lotFields, [
    { fieldKey: "lot_status", columnId: "status" },
    { fieldKey: "lot_estate", columnId: "text_e" },
    { fieldKey: "lot_land_price", columnId: "num_p" },
    { fieldKey: "lot_files", columnId: "files" },
  ]);
  assert.deepEqual(report.lotUnmatched, ["Price"], "a bare Price is left for a person to place");
  assert.deepEqual(lines, ["discovering workspaces and users", "discovering boards in workspace 1"]);
  assert.equal(monday.stats.calls, 4, "workspaces, users, the workspace's boards, and the subitems board by id");

  const boards = await db.query(
    "select id, board_key, purpose, division, region, type, parent_board_id, sync_enabled from mirror.monday_boards order by id",
  );
  assert.deepEqual(boards, [
    { id: 100, board_key: "homes_sales_wa", purpose: "sales", division: "homes", region: "WA", type: "board", parent_board_id: null, sync_enabled: true },
    { id: 101, board_key: "homes_sales_wa:subitems", purpose: null, division: null, region: null, type: "sub_items_board", parent_board_id: 100, sync_enabled: true },
    { id: 150, board_key: "homes_handed_over_wa", purpose: "handed_over", division: "homes", region: "WA", type: "board", parent_board_id: null, sync_enabled: true },
    { id: 300, board_key: "exclusive_land", purpose: "exclusive_land", division: null, region: null, type: "board", parent_board_id: null, sync_enabled: true },
  ]);
  const [workspace] = await db.query<{ sync_enabled: boolean }>("select sync_enabled from mirror.monday_workspaces where id = 1");
  assert.equal(workspace.sync_enabled, true);
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from mirror.monday_users");
  assert.equal(n, 1);

  assert.deepEqual(await fieldMap(), [
    { board_id: 100, field_key: "builder", column_id: "color_a", source: "jerry_config" },
    { board_id: 100, field_key: "job_number", column_id: "text4", source: "jerry_config" },
    { board_id: 100, field_key: "sales_rep", column_id: "text_r", source: "jerry_config" },
    { board_id: 101, field_key: "due_date", column_id: "date", source: "jerry_config" },
    { board_id: 101, field_key: "milestone_status", column_id: "status", source: "jerry_config" },
    { board_id: 150, field_key: "job_number", column_id: "text4", source: "jerry_config" },
    { board_id: 150, field_key: "sales_rep", column_id: "text_r", source: "jerry_config" },
    { board_id: 300, field_key: "lot_estate", column_id: "text_e", source: "title_match" },
    { board_id: 300, field_key: "lot_files", column_id: "files", source: "title_match" },
    { board_id: 300, field_key: "lot_land_price", column_id: "num_p", source: "title_match" },
    { board_id: 300, field_key: "lot_status", column_id: "status", source: "title_match" },
  ]);
});

test("runSetup: a second run follows the config, but never overrides a mapping a person made", async () => {
  await db.query("update mirror.monday_field_map set column_id = 'text_mine', source = 'manual' where board_id = 100 and field_key = 'job_number'");
  await db.query("update mirror.monday_field_map set column_id = 'num_mine', source = 'manual' where board_id = 300 and field_key = 'lot_land_price'");

  await runSetup(db, mondayFor(), { jerryConfigPath: writeConfig(config("text9")), log: () => {} });

  const map = await fieldMap();
  const of = (board: number, key: string) => map.find((m) => m.board_id === board && m.field_key === key);
  assert.deepEqual(of(100, "job_number"), { board_id: 100, field_key: "job_number", column_id: "text_mine", source: "manual" });
  assert.deepEqual(of(300, "lot_land_price"), { board_id: 300, field_key: "lot_land_price", column_id: "num_mine", source: "manual" });
  assert.deepEqual(of(150, "job_number"), { board_id: 150, field_key: "job_number", column_id: "text9", source: "jerry_config" });
  assert.equal(map.length, 11, "no duplicates");
});

test("runSetup: a config file that isn't there is reported before anything is touched", async () => {
  const untouchable = new Proxy({}, { get: () => { throw new Error("touched"); } }) as never;
  await assert.rejects(
    runSetup(untouchable, untouchable, { jerryConfigPath: join(dir, "no-such-file.json"), log: () => {} }),
    /isn't at .*no-such-file\.json\. Pass --jerry-config/,
  );
});

test("runSetup: a config with no usable boards is refused before anything is touched", async () => {
  const untouchable = new Proxy({}, { get: () => { throw new Error("touched"); } }) as never;
  const refused = (value: unknown) => runSetup(untouchable, untouchable, { jerryConfigPath: writeConfig(value), log: () => {} });

  // Every parent id sent as text or missing: nothing here is a board Launchpad can use.
  await assert.rejects(
    refused({ production: { boards: { _note: "x", homes_sales_wa: { parent: "100", subitems: 101 }, exclusive_land: { subitems: null } } } }),
    /No boards Launchpad can use in .*monday-\d+\.json: check production\.boards \(each needs a numeric parent id\)\./,
  );
  await assert.rejects(refused({ production: { boards: "homes_sales_wa" } }), /No boards Launchpad can use in/);
  // A file holding only null has no production section at all: the old way to get here was a TypeError.
  await assert.rejects(refused(null), /No boards in .*monday-\d+\.json/);
});

test("runSetup: a config with boards but no column sections sets the boards up and maps nothing", async () => {
  const thin = { workspaces: { production: { id: 1 } }, production: { boards: { homes_sales_nt: { parent: 800, subitems: null } } } };
  const report = await runSetup(db, mondayWith([board(800, [NAME])]), { jerryConfigPath: writeConfig(thin), log: () => {} });

  assert.deepEqual(report.boardsEnabled, ["homes_sales_nt"]);
  assert.equal(report.fieldsMapped, 0);
  assert.deepEqual(report.unknownFields, []);
  assert.deepEqual(await db.query("select board_id from mirror.monday_field_map where board_id = 800"), []);
});

test("runSetup: a subitems board the token can't see is reported, and its parent is still set up", async () => {
  const config = {
    workspaces: { production: { id: 1 } },
    production: {
      boards: { homes_sales_vic: { parent: 700, subitems: 701 } },
      parentColumns: { per_board: { homes_sales_vic: { job_number: "text4" } } },
      subitemColumns: { all_boards: { milestone_status: "status" } },
    },
  };
  // Board 700 is in the workspace. Asked for 701 by id, Monday returns nothing.
  const monday = mondayWith([board(700, [NAME, col("text4", "Job")])]);
  const report = await runSetup(db, monday, { jerryConfigPath: writeConfig(config), log: () => {} });

  assert.deepEqual(report.boardsEnabled, ["homes_sales_vic"]);
  assert.deepEqual(report.notVisible, ["homes_sales_vic:subitems"]);
  assert.equal(report.fieldsMapped, 1, "the parent's field only: nothing can be mapped on a board we don't have");
  assert.equal(monday.stats.calls, 4, "workspaces, users, the workspace's boards, and 701 by id");
  assert.deepEqual(await db.query("select id from mirror.monday_boards where id = 701"), []);
  assert.deepEqual(await db.query("select board_id from mirror.monday_field_map where board_id = 701"), []);
  const [parent] = await db.query<{ board_key: string; region: string; sync_enabled: boolean }>(
    "select board_key, region, sync_enabled from mirror.monday_boards where id = 700",
  );
  assert.deepEqual(parent, { board_key: "homes_sales_vic", region: "VIC", sync_enabled: true });
});

test("runSetup: boards in all eight regions are accepted, each with the region its key ends in", async () => {
  const codes = ["wa", "vic", "qld", "nsw", "sa", "nt", "tas", "act"];
  const boards = Object.fromEntries(codes.map((code, i) => [`wealth_sales_${code}`, { parent: 810 + i, subitems: null }]));
  const listed = codes.map((_, i) => board(810 + i, [NAME]));
  const config = { workspaces: { production: { id: 1 } }, production: { boards, parentColumns: {}, subitemColumns: {} } };
  await runSetup(db, mondayWith(listed), { jerryConfigPath: writeConfig(config), log: () => {} });

  const rows = await db.query("select board_key, region, division from mirror.monday_boards where id between 810 and 817 order by id");
  assert.deepEqual(
    rows,
    codes.map((code) => ({ board_key: `wealth_sales_${code}`, region: code.toUpperCase(), division: "wealth" })),
  );
});

test("matchReps: Monday's spellings of a rep become the aliases the loaders join on", async () => {
  await addStaff(db, "test-rep-a", { department: "sales" });
  await addStaff(db, "test-rep-b", { name: "Test O'Rep", department: "sales" });
  await addStaff(db, "test-seat-c", { name: null, department: "sales" });

  await db.query("insert into mirror.monday_workspaces (id, name) values (9, 'Test rep workspace')");
  await db.query(
    `insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled)
     values (600, 9, 'Test rep board', 'homes_sales_reps_test', 'sales', true)`,
  );
  await db.query("insert into mirror.monday_field_map (board_id, field_key, column_id) values (600, 'sales_rep', 'text_r')");
  const rep = (text: string | null) => JSON.stringify(text === null ? {} : { text_r: { type: "text", text, value: null } });
  await db.query(
    `insert into mirror.monday_items (id, board_id, name, monday_updated_at, column_values) values
       (6001, 600, 'Test Client A', now(), $1::jsonb), (6002, 600, 'Test Client B', now(), $2::jsonb),
       (6003, 600, 'Test Client C', now(), $3::jsonb), (6004, 600, 'Test Client D', now(), $4::jsonb)`,
    [rep("TEST REP A"), rep(" Test  O’Rep. "), rep("Nobody Known"), rep(null)],
  );

  assert.deepEqual(await matchReps(db), { matched: 2, unmatched: ["Nobody Known"] });

  const aliases = await db.query("select alias, staff_id, source from launchpad.staff_aliases order by alias");
  assert.deepEqual(aliases, [
    { alias: "test  o’rep.", staff_id: "test-rep-b", source: "setup" },
    { alias: "test rep a", staff_id: "test-rep-a", source: "setup" },
  ]);
  // The join the loaders make: lower(btrim(sales_rep)). Both spellings now resolve.
  const resolved = await db.query<{ item_id: number; staff_id: string }>(
    `select j.item_id, a.staff_id
       from launchpad.monday_jobs j join launchpad.staff_aliases a on a.alias = lower(btrim(j.sales_rep))
      order by j.item_id`,
  );
  assert.deepEqual(resolved, [
    { item_id: 6001, staff_id: "test-rep-a" },
    { item_id: 6002, staff_id: "test-rep-b" },
  ]);
});

test("matchReps: running it again changes nothing, and an alias a person set is kept", async () => {
  await db.query("update launchpad.staff_aliases set staff_id = 'test-rep-a', source = 'manual' where alias = 'test  o’rep.'");
  assert.deepEqual(await matchReps(db), { matched: 2, unmatched: ["Nobody Known"] });
  const aliases = await db.query("select alias, staff_id, source from launchpad.staff_aliases order by alias");
  assert.deepEqual(aliases, [
    { alias: "test  o’rep.", staff_id: "test-rep-a", source: "manual" },
    { alias: "test rep a", staff_id: "test-rep-a", source: "setup" },
  ]);
});

test("matchReps: a name that already has an alias isn't listed as unmatched again, and is still counted when staff match it", async () => {
  // "Nobody Known" was left unmatched above. Someone adds the alias by hand, so it stops being listed.
  await db.query("insert into launchpad.staff_aliases (alias, staff_id, source) values ('nobody known', 'test-rep-a', 'manual')");
  // The two names that match staff have aliases by now as well, and are still matched: no name is dropped from the input.
  assert.deepEqual(await matchReps(db), { matched: 2, unmatched: [] });
});

test("matchReps: only an alias that is the key the loaders join on hides a name", async () => {
  // Monday's text can hold a non-breaking space. btrim leaves it, so the loaders' key, lower(btrim(text)), keeps it too.
  const nbsp = String.fromCharCode(0xa0);
  await db.query(
    "insert into mirror.monday_items (id, board_id, name, monday_updated_at, column_values) values (6005, 600, 'Test Client E', now(), $1::jsonb)",
    [JSON.stringify({ text_r: { type: "text", text: `Ghost Person${nbsp}`, value: null } })],
  );
  await db.query("insert into launchpad.staff_aliases (alias, staff_id, source) values ('ghost person', 'test-rep-a', 'manual')");
  // 'ghost person' isn't that key, so this text still resolves to nobody and is still listed.
  assert.deepEqual(await matchReps(db), { matched: 2, unmatched: ["Ghost Person"] });

  await db.query("insert into launchpad.staff_aliases (alias, staff_id, source) values ($1, 'test-rep-a', 'manual')", [`ghost person${nbsp}`]);
  assert.deepEqual(await matchReps(db), { matched: 2, unmatched: [] });
});
