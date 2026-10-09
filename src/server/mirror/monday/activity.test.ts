import { test } from "node:test";
import assert from "node:assert/strict";
import { activityTime, parseActivityLogs, type BoardActivity } from "./activity";

const log = (event: string, data: object | null, at = "17597952000000000") => ({
  id: `${event}-${Math.random()}`,
  event,
  entity: "pulse",
  data: data ? JSON.stringify(data) : null,
  created_at: at,
});

test("activity: 17-digit times are tenths of a microsecond", () => {
  assert.equal(activityTime("17597952000000000")?.toISOString(), "2025-10-07T00:00:00.000Z");
  assert.equal(activityTime("2026-10-08T01:00:00Z")?.toISOString(), "2026-10-08T01:00:00.000Z");
  assert.equal(activityTime("garbage"), null);
});

test("activity: item ids from every event, a subitem's parent too, removals hinted, the newest time kept", () => {
  const boards: BoardActivity[] = [
    {
      id: "10",
      activity_logs: [
        log("update_column_value", { pulse_id: 1001, column_id: "status" }),
        log("create_pulse", { pulse_id: 1002 }),
        log("delete_pulse", { pulse_id: 1003 }),
        log("move_pulse_into_group", { pulse_id: 1001 }),
      ],
    },
    {
      id: "11",
      activity_logs: [
        log("archive_pulse", { pulse_id: 2001, parent_item_id: 1001 }, "17598816000000000"),
        log("update_column_value", { pulse_id: 2002, parent_item_id: 1004 }),
      ],
    },
  ];
  const scan = parseActivityLogs(boards, 1000);
  assert.deepEqual(scan.itemIds.sort(), [1001, 1002, 1003, 1004, 2001, 2002]);
  assert.deepEqual(scan.removedHints.sort(), [1003, 2001], "archiving a subitem doesn't hint its parent away");
  assert.equal(scan.latest?.toISOString(), "2025-10-08T00:00:00.000Z");
  assert.deepEqual(scan.fullBoards, []);
});

test("activity: board-level column events ask for a column refresh; junk data is skipped", () => {
  const scan = parseActivityLogs(
    [{ id: "10", activity_logs: [log("create_column", { column_id: "new" }), log("update_name", null), { ...log("x", null), data: "{bad" }] }],
    1000,
  );
  assert.deepEqual(scan.itemIds, []);
  assert.deepEqual(scan.columnsChangedBoards, [10]);
});

test("activity: a full page marks the board for another page (Review Focus 2)", () => {
  const logs = Array.from({ length: 3 }, (_, i) => log("update_column_value", { pulse_id: 1000 + i }));
  const scan = parseActivityLogs([{ id: "10", activity_logs: logs }, { id: "11", activity_logs: [] }], 3);
  assert.deepEqual(scan.fullBoards, [10]);
});

test("activity: item_id and the plural keys name items too, and a restore is not a removal", () => {
  const scan = parseActivityLogs(
    [
      {
        id: "10",
        activity_logs: [
          log("update_name", { item_id: 3001 }),
          log("delete_pulse", { pulse_ids: [3002, "3003", null, "junk"] }),
          log("restore_pulse", { pulse_id: 3004 }),
          log("unarchive_pulse", { pulse_id: 3005 }),
          log("archive_pulse", { item_ids: [3006] }),
        ],
      },
    ],
    1000,
  );
  assert.deepEqual(scan.itemIds.sort(), [3001, 3002, 3003, 3004, 3005, 3006]);
  assert.deepEqual(scan.removedHints.sort(), [3002, 3003, 3006]);
});

test("activity: only a 17-digit string is read as tenths of a microsecond; other lengths are not guessed at", () => {
  assert.equal(activityTime("1759795200000000"), null, "16 digits would read as 1975");
  assert.equal(activityTime("175979520000000000"), null, "18 digits would read as 2527");
});

test("activity: a board whose id can't be read is skipped whole, so no board id is ever NaN", () => {
  const named = (id: number) => [log("update_column_value", { pulse_id: id })];
  const scan = parseActivityLogs(
    [
      { id: "abc", activity_logs: [log("create_column", { column_id: "new" }), ...named(9001)] },
      { id: "", activity_logs: named(9002) },
      { id: "0", activity_logs: named(9003) },
      { id: "1e1", activity_logs: named(9004) },
      { id: undefined as unknown as string, activity_logs: named(9005) },
      { id: "10", activity_logs: named(1002) },
    ],
    1,
  );
  assert.deepEqual(scan.fullBoards, [10]);
  assert.deepEqual(scan.columnsChangedBoards, []);
  assert.deepEqual(scan.itemIds, [1002], "only the readable board's entries are used");
});

test("activity: an update event names its item but isn't a removal of it", () => {
  const scan = parseActivityLogs(
    [{ id: "10", activity_logs: [log("delete_update", { pulse_id: 1001 }), log("delete_pulse", { pulse_id: 1002 })] }],
    1000,
  );
  assert.deepEqual(scan.itemIds.sort(), [1001, 1002], "both items are refetched");
  assert.deepEqual(scan.removedHints, [1002], "only the item's own delete is a removal hint");
});

test("activity: null slots in a page still count toward a full page", () => {
  const logs = [null, null, log("create_pulse", { pulse_id: 1002 })] as unknown as BoardActivity["activity_logs"];
  const scan = parseActivityLogs([{ id: "10", activity_logs: logs }], 3);
  assert.deepEqual(scan.fullBoards, [10]);
  assert.deepEqual(scan.itemIds, [1002]);
});

test("activity: a null board or entry is skipped, not thrown on", () => {
  const scan = parseActivityLogs(
    [
      null as unknown as BoardActivity,
      { id: "10", activity_logs: null },
      { id: "11", activity_logs: [null, 5, log("create_pulse", { pulse_id: 1002 })] as unknown as BoardActivity["activity_logs"] },
    ],
    1000,
  );
  assert.deepEqual(scan.itemIds, [1002]);
  assert.deepEqual(scan.fullBoards, []);
});
