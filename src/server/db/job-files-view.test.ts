import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;

/** A Monday item. A subitem names its job in `parent`, which needn't be mirrored yet. */
async function item(id: number, board: number, name: string, opts: { parent?: number; removed?: boolean } = {}) {
  await db.query(
    `insert into mirror.monday_items (id, board_id, parent_item_id, name, state, monday_updated_at, removed_at)
     values ($1, $2, $3, $4, $5, '2026-10-07T00:00:00Z', $6)`,
    [id, board, opts.parent ?? null, name, opts.removed ? "deleted" : "active", opts.removed ? "2026-10-08T00:00:00Z" : null],
  );
}

/** A file on an item. A path means it was copied; an error means the downloader gave up on it. */
async function file(
  id: number,
  itemId: number,
  name: string,
  opts: { path?: string; attempts?: number; error?: string; removed?: boolean } = {},
) {
  await db.query(
    `insert into mirror.monday_assets (id, item_id, column_id, name, storage_path, download_attempts, download_error, removed_at)
     values ($1, $2, 'files', $3, $4, $5, $6, $7)`,
    [id, itemId, name, opts.path ?? null, opts.attempts ?? 0, opts.error ?? null, opts.removed ? "2026-10-08T00:00:00Z" : null],
  );
}

interface Row {
  asset_id: number;
  item_id: number;
  subitem_id: number | null;
  copy_error: string | null;
}

/** The view's row for one file: none when the view leaves it out. */
const rowFor = (assetId: number) =>
  db.query<Row>(
    "select asset_id, item_id, subitem_id, copy_error from launchpad.monday_job_files where asset_id = $1",
    [assetId],
  );

const copyErrorOf = async (assetId: number) => {
  const rows = await rowFor(assetId);
  assert.equal(rows.length, 1, `file ${assetId} should be listed`);
  return rows[0].copy_error;
};

before(async () => {
  ({ db, close } = await migratedTestDb());
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, division, region, sync_enabled)
                  values (10, 1, 'Test sales board', 'homes_sales_wa', 'sales', 'homes', 'WA', true),
                         (30, 1, 'Test land board', 'exclusive_land', 'exclusive_land', null, null, true)`);
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, type, board_key, parent_board_id, sync_enabled)
                  values (11, 1, 'Subitems of Test sales board', 'sub_items_board', 'homes_sales_wa:subitems', 10, true)`);

  await item(1001, 10, "Test Client A"); // a live job
  await item(1002, 10, "Test Client B", { removed: true }); // a removed job
  await item(2001, 11, "Slab Down", { parent: 1001 }); // a live milestone of the live job
  await item(2002, 11, "Frame Stage", { parent: 1002 }); // a live milestone of the removed job
  await item(2003, 11, "Roof Stage", { parent: 1999 }); // a milestone whose job (1999) isn't in the mirror
  await item(2004, 11, "Lock Up", { parent: 1001, removed: true }); // a removed milestone of the live job
  await item(3001, 30, "Lot 1 Test Street, Testville"); // a live lot

  await file(9001, 1001, "plan.pdf", { path: "10/1001/9001/plan.pdf" }); // copied
  await file(9002, 2001, "slab.pdf", { attempts: 1 }); // one try failed, two to go: still copying
  await file(9003, 1001, "tour.mov", { error: "too_large" });
  await file(9004, 2001, "survey.pdf", { attempts: 3, error: "download failed: HTTP 500" });
  await file(9005, 1001, "notes.pdf", { attempts: 3, error: "Monday didn't return this file" });
  await file(9006, 1001, "quote.pdf", { path: "10/1001/9006/quote.pdf", error: "download failed: HTTP 500" }); // copied since
  await file(9007, 1001, "old.pdf", { path: "10/1001/9007/old.pdf", removed: true }); // the file was removed
  await file(9008, 2002, "frame.pdf", { path: "10/2002/9008/frame.pdf" }); // copied, but its job is removed
  await file(9009, 2003, "roof.pdf", { path: "10/2003/9009/roof.pdf" }); // copied, but its job isn't mirrored
  await file(9010, 2004, "lockup.pdf", { path: "10/2004/9010/lockup.pdf" }); // copied, but its milestone is removed
  await file(9011, 1002, "contract.pdf", { path: "10/1002/9011/contract.pdf" }); // copied, but the job is removed
  await file(9012, 3001, "lot.pdf", { path: "10/3001/9012/lot.pdf" });
  await file(9013, 1001, "blank.pdf", { attempts: 3, error: "" }); // an error of no words is still an error
});
after(async () => close());

test("job files: the view keeps its nine columns, in order, and adds copy_error last", async () => {
  const columns = await db.query<{ name: string }>(
    `select a.attname as name
     from pg_attribute a
     where a.attrelid = 'launchpad.monday_job_files'::regclass and a.attnum > 0 and not a.attisdropped
     order by a.attnum`,
  );
  assert.deepEqual(
    columns.map((c) => c.name),
    [
      "asset_id",
      "item_id",
      "subitem_id",
      "name",
      "file_extension",
      "file_size",
      "storage_path",
      "downloaded_at",
      "monday_created_at",
      "copy_error",
    ],
  );
});

test("job files: a copied file has no copy error, and neither has one that is still copying", async () => {
  assert.equal(await copyErrorOf(9001), null, "copied");
  assert.equal(await copyErrorOf(9002), null, "still copying, with one failed try behind it");
  assert.equal(await copyErrorOf(9006), null, "copied after an earlier failure: an old error doesn't count against a stored file");
});

test("job files: a file over the size limit has copy_error too_large", async () => {
  assert.equal(await copyErrorOf(9003), "too_large");
});

test("job files: any other download error is copy_error failed, and the message stays in the mirror", async () => {
  assert.equal(await copyErrorOf(9004), "failed");
  assert.equal(await copyErrorOf(9005), "failed");
  assert.equal(await copyErrorOf(9013), "failed", "any error at all retires the file, even a blank one");
  const rows = await db.query<Record<string, unknown>>("select * from launchpad.monday_job_files where asset_id in (9004, 9005, 9013)");
  assert.equal(rows.length, 3);
  const shown = JSON.stringify(rows);
  assert.ok(!shown.includes("HTTP 500") && !shown.includes("didn't return"), "no column carries the raw failure message");
});

test("job files: a milestone's file under a removed job isn't listed, and is again if the job comes back", async () => {
  assert.deepEqual(await rowFor(9008), [], "its job is removed");
  await db.query("update mirror.monday_items set removed_at = null, state = 'active' where id = 1002");
  try {
    assert.deepEqual(await rowFor(9008), [{ asset_id: 9008, item_id: 1002, subitem_id: 2002, copy_error: null }]);
  } finally {
    await db.query("update mirror.monday_items set removed_at = '2026-10-08T00:00:00Z', state = 'deleted' where id = 1002");
  }
  assert.deepEqual(await rowFor(9008), [], "removed again");
});

test("job files: a milestone's file whose job isn't mirrored isn't listed, until the job arrives", async () => {
  assert.deepEqual(await rowFor(9009), [], "job 1999 is not in the mirror");
  await item(1999, 10, "Test Client C");
  try {
    assert.deepEqual(await rowFor(9009), [{ asset_id: 9009, item_id: 1999, subitem_id: 2003, copy_error: null }]);
  } finally {
    await db.query("delete from mirror.monday_items where id = 1999");
  }
  assert.deepEqual(await rowFor(9009), [], "job 1999 is gone again");
});

test("job files: a job's own file, a lot's own file and a live milestone's file are listed, under the job or lot", async () => {
  const rows = await db.query<Row>(
    "select asset_id, item_id, subitem_id, copy_error from launchpad.monday_job_files order by asset_id",
  );
  // Left out: 9007 (the file was removed), 9008 (its job is removed), 9009 (its job isn't mirrored),
  // 9010 (its milestone is removed) and 9011 (the job it sits on is removed).
  assert.deepEqual(rows, [
    { asset_id: 9001, item_id: 1001, subitem_id: null, copy_error: null },
    { asset_id: 9002, item_id: 1001, subitem_id: 2001, copy_error: null },
    { asset_id: 9003, item_id: 1001, subitem_id: null, copy_error: "too_large" },
    { asset_id: 9004, item_id: 1001, subitem_id: 2001, copy_error: "failed" },
    { asset_id: 9005, item_id: 1001, subitem_id: null, copy_error: "failed" },
    { asset_id: 9006, item_id: 1001, subitem_id: null, copy_error: null },
    { asset_id: 9012, item_id: 3001, subitem_id: null, copy_error: null },
    { asset_id: 9013, item_id: 1001, subitem_id: null, copy_error: "failed" },
  ]);
});
