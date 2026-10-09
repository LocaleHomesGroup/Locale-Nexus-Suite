import { after, before, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { readServerEnv } from "../../env";
import { memoryFileStore, supabaseFileStore, type FileStore } from "../../storage";
import { MAX_FILE_BYTES, downloadPendingFiles, storagePath } from "./files";
import { fakeMonday } from "./test-fakes";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  await db.query("insert into mirror.monday_boards (id, name) values (10, 'Test board')");
  await db.query("insert into mirror.monday_items (id, board_id, name, monday_updated_at) values (1001, 10, 'Test item', now())");
});
after(async () => close());

/** Each test starts from its own files, so none depends on what an earlier one left. Item 1001 unless given. */
async function setFiles(...files: [id: number, name: string, itemId?: number][]): Promise<void> {
  await db.query("delete from mirror.monday_assets");
  for (const [id, name, itemId = 1001] of files) {
    await db.query("insert into mirror.monday_assets (id, item_id, column_id, name) values ($1, $2, 'files', $3)", [id, itemId, name]);
  }
}

interface AssetRow {
  id: number;
  storage_path: string | null;
  sha256: string | null;
  file_size: number | null;
  file_extension: string | null;
  monday_created_at: Date | null;
  download_attempts: number;
  download_error: string | null;
}
const assetRows = () =>
  db.query<AssetRow>(
    `select id, storage_path, sha256, file_size, file_extension, monday_created_at, download_attempts, download_error
     from mirror.monday_assets order by id`,
  );

/** What Monday says about each file. Any other asset id is a 3-byte PDF. */
const MONDAY_FILES: Record<string, { name: string; file_extension: string; file_size: number; created_at?: string }> = {
  "9001": { name: "Plan v2.pdf", file_extension: ".pdf", file_size: 3, created_at: "2026-10-01T02:03:04Z" },
  "9002": { name: "huge.mov", file_extension: ".mov", file_size: MAX_FILE_BYTES + 1 },
  "9003": { name: "flaky.jpg", file_extension: ".jpg", file_size: 3 },
  "9005": { name: "notes.constructor", file_extension: ".constructor", file_size: 3 },
  "9006": { name: "notes.__proto__", file_extension: ".__proto__", file_size: 3 },
};
const fakeMondayFiles = () =>
  fakeMonday((_doc, vars) => ({
    assets: (vars.ids as string[]).map((id) => ({
      id,
      ...(MONDAY_FILES[id] ?? { name: `file-${id}.pdf`, file_extension: ".pdf", file_size: 3 }),
      public_url: `https://files.example.test/${id}`,
    })),
  }));

const fetchFile = (async (url: string) =>
  url.endsWith("/9003") ? new Response("nope", { status: 500 }) : new Response(new Uint8Array([1, 2, 3]))) as unknown as typeof fetch;

const MIB = 1024 * 1024;

/**
 * A download of `bytes` bytes served lazily in 1 MiB chunks (the last one shorter), counting the chunks pulled.
 * Every chunk is a view of one shared buffer, so even a 50 MiB download costs the test 1 MiB. Nothing is pulled
 * until it's read.
 */
function lazyDownload(bytes: number, headers: Record<string, string> = {}) {
  const buffer = new Uint8Array(MIB).fill(7);
  const pulled = { chunks: 0, bytes: 0 };
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (pulled.bytes >= bytes) return controller.close();
        const chunk = buffer.subarray(0, Math.min(MIB, bytes - pulled.bytes));
        pulled.chunks += 1;
        pulled.bytes += chunk.byteLength;
        controller.enqueue(chunk);
      },
    },
    { highWaterMark: 0 },
  );
  return { fetch: (async () => new Response(body, { headers })) as unknown as typeof fetch, pulled };
}

test("files: paths are board/item/asset/name with unsafe characters swapped", () => {
  assert.equal(storagePath(10, 1001, 9001, "Plan v2 (final).pdf"), "10/1001/9001/Plan_v2_final.pdf");
  const sneaky = storagePath(10, 1001, 9001, "../../etc/passwd");
  assert.equal(sneaky.split("/").length, 4, "a name can't add path segments");
  assert.ok(!sneaky.includes("../"));
  assert.equal(storagePath(10, 1001, 9001, ".."), "10/1001/9001/file");
  assert.equal(storagePath(10, 1001, 9001, ""), "10/1001/9001/file");
});

test("files: past its deadline a run fetches nothing and leaves every file for the next one", async () => {
  await setFiles([9001, "Plan v2.pdf"], [9002, "huge.mov"], [9003, "flaky.jpg"]);
  const monday = fakeMondayFiles();
  const store = memoryFileStore();
  const r = await downloadPendingFiles({ db, monday, store, fetch: fetchFile }, { max: 10, deadline: new Date(Date.now() - 1000) });
  assert.deepEqual(r, { downloaded: 0, tooLarge: 0, failed: 0, pending: 3 });
  assert.equal(monday.documents.length, 0, "no Monday call after the deadline");
  assert.equal(store.files.size, 0);
  assert.deepEqual((await assetRows()).map((a) => a.download_attempts), [0, 0, 0]);
});

test("files: a deadline that passes mid-run lets the download under way finish, and the rest wait uncharged", async () => {
  await setFiles([9001, "Plan v2.pdf"], [9003, "flaky.jpg"], [9004, "scan.pdf"]);
  // A deadline a minute off until the first download is under way, then long past. No real clock involved.
  let lapsed = false;
  const deadline = { getTime: () => (lapsed ? 0 : Date.now() + 60_000) } as unknown as Date;
  const lapsingFetch = (async () => {
    lapsed = true;
    return new Response(new Uint8Array([1, 2, 3]));
  }) as unknown as typeof fetch;
  const store = memoryFileStore();
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store, fetch: lapsingFetch }, { max: 10, deadline });
  assert.deepEqual(r, { downloaded: 1, tooLarge: 0, failed: 0, pending: 2 });
  assert.equal(store.files.size, 1);
  const rows = await assetRows();
  assert.equal(rows.filter((a) => a.storage_path !== null).length, 1);
  assert.deepEqual(rows.filter((a) => a.storage_path === null).map((a) => [a.download_attempts, a.download_error]), [[0, null], [0, null]]);
});

test("files: downloads what it can, skips what's too big, and retries what failed", async () => {
  await setFiles([9001, "Plan v2.pdf"], [9002, "huge.mov"], [9003, "flaky.jpg"]);
  const store = memoryFileStore();
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store, fetch: fetchFile }, { max: 10 });
  assert.deepEqual(r, { downloaded: 1, tooLarge: 1, failed: 1, pending: 1 });

  const saved = store.files.get("monday-files/10/1001/9001/Plan_v2.pdf");
  assert.ok(saved);
  assert.equal(saved.contentType, "application/pdf");
  const rows = await assetRows();
  assert.equal(rows[0].storage_path, "10/1001/9001/Plan_v2.pdf");
  assert.equal(rows[0].sha256, createHash("sha256").update(new Uint8Array([1, 2, 3])).digest("hex"));
  // What Monday and the download said about the file is kept with it.
  assert.equal(rows[0].file_size, 3);
  assert.equal(rows[0].monday_created_at?.toISOString(), "2026-10-01T02:03:04.000Z");
  assert.deepEqual([rows[1].download_error, rows[1].file_size, rows[1].file_extension], ["too_large", MAX_FILE_BYTES + 1, "mov"]);
  assert.deepEqual([rows[2].download_attempts, rows[2].download_error], [1, null]);
});

test("files: a file that keeps failing stops being tried after three attempts", async () => {
  await setFiles([9003, "flaky.jpg"]);
  // A failed download's body is let go, not left open.
  let cancelled = 0;
  const failing = (async () =>
    new Response(new ReadableStream({ cancel: () => void (cancelled += 1) }), { status: 500 })) as unknown as typeof fetch;
  const store = memoryFileStore();
  for (let run = 1; run <= 3; run++) await downloadPendingFiles({ db, monday: fakeMondayFiles(), store, fetch: failing }, { max: 10 });
  const [row] = await assetRows();
  assert.equal(row.download_attempts, 3);
  assert.match(row.download_error ?? "", /500/);
  assert.equal(cancelled, 3, "each failed answer's body was cancelled");
  const again = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store, fetch: failing }, { max: 10 });
  assert.equal(again.pending, 0);
});

test("files: Storage that can't take files fails the run before any file is charged", async () => {
  await setFiles([9001, "Plan v2.pdf"], [9003, "flaky.jpg"]);
  const monday = fakeMondayFiles();
  const broken: FileStore = {
    ...memoryFileStore(),
    ensureBucket: async () => {
      throw new Error("Storage: the service is unreachable");
    },
  };
  await assert.rejects(downloadPendingFiles({ db, monday, store: broken, fetch: fetchFile }, { max: 10 }), /unreachable/);
  assert.deepEqual((await assetRows()).map((a) => a.download_attempts), [0, 0]);
  assert.equal(monday.documents.length, 0, "nothing was asked of Monday either");

  // With nothing to download, Storage isn't touched at all.
  await setFiles();
  const idle = await downloadPendingFiles({ db, monday, store: broken, fetch: fetchFile }, { max: 10 });
  assert.deepEqual(idle, { downloaded: 0, tooLarge: 0, failed: 0, pending: 0 });
});

test("files: Storage refusing one file charges that file an attempt and still takes the others", async () => {
  await setFiles([9001, "Plan v2.pdf"], [9004, "scan.pdf"]);
  const inner = memoryFileStore();
  const picky: FileStore = {
    ...inner,
    async upload(bucket, path, body, contentType) {
      if (path.includes("/9001/")) throw new Error("Storage upload failed: refused");
      await inner.upload(bucket, path, body, contentType);
    },
  };
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store: picky, fetch: fetchFile }, { max: 10 });
  assert.deepEqual(r, { downloaded: 1, tooLarge: 0, failed: 1, pending: 1 });
  assert.deepEqual([...inner.files.keys()], ["monday-files/10/1001/9004/file-9004.pdf"]);
  const [refused, taken] = await assetRows();
  assert.deepEqual([refused.storage_path, refused.download_attempts, refused.download_error], [null, 1, null]);
  assert.equal(taken.storage_path, "10/1001/9004/file-9004.pdf");
});

test("files: three uploads refused in a row stop the run, and the files after them wait uncharged", async () => {
  await setFiles([9011, "a.pdf"], [9012, "b.pdf"], [9013, "c.pdf"], [9014, "d.pdf"], [9015, "e.pdf"]);
  const full: FileStore = {
    ...memoryFileStore(),
    upload: async () => {
      throw new Error("Storage upload failed: quota exceeded");
    },
  };
  await assert.rejects(downloadPendingFiles({ db, monday: fakeMondayFiles(), store: full, fetch: fetchFile }, { max: 5 }), {
    message: "Storage refused 3 uploads in a row, so this run stopped: Storage upload failed: quota exceeded",
  });
  // Newest first: the three tried are charged (one refusal looks like an outage's first), the other two untouched.
  assert.deepEqual((await assetRows()).map((a) => [a.id, a.download_attempts, a.download_error]), [
    [9011, 0, null],
    [9012, 0, null],
    [9013, 1, null],
    [9014, 1, null],
    [9015, 1, null],
  ]);
});

test("files: a stored file between refused uploads starts the count again", async () => {
  await setFiles([9011, "a.pdf"], [9012, "b.pdf"], [9013, "c.pdf"], [9014, "d.pdf"], [9015, "e.pdf"]);
  const inner = memoryFileStore();
  // Newest first, so the uploads go 9015, 9014, 9013, 9012, 9011: refused, refused, stored, refused, refused.
  const patchy: FileStore = {
    ...inner,
    async upload(bucket, path, body, contentType) {
      if (!path.includes("/9013/")) throw new Error("Storage upload failed: busy");
      await inner.upload(bucket, path, body, contentType);
    },
  };
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store: patchy, fetch: fetchFile }, { max: 5 });
  assert.deepEqual(r, { downloaded: 1, tooLarge: 0, failed: 4, pending: 4 });
});

test("files: failed downloads don't count towards stopping the run, only Storage's refusals do", async () => {
  await setFiles([9011, "a.pdf"], [9012, "b.pdf"], [9013, "c.pdf"], [9014, "d.pdf"]);
  const down = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store: memoryFileStore(), fetch: down }, { max: 5 });
  assert.deepEqual(r, { downloaded: 0, tooLarge: 0, failed: 4, pending: 4 });
});

test("files: a file over the limit is given up as it streams in, whatever size Monday gave", async () => {
  await setFiles([9004, "scan.pdf"]); // Monday says 3 bytes
  const download = lazyDownload(80 * MIB);
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store: memoryFileStore(), fetch: download.fetch }, { max: 10 });
  assert.deepEqual(r, { downloaded: 0, tooLarge: 1, failed: 0, pending: 0 });
  assert.ok(download.pulled.chunks <= 52, `read ${download.pulled.chunks} MiB of an 80 MiB file`);
  const [row] = await assetRows();
  assert.equal(row.download_error, "too_large");
  assert.equal(row.file_size, null, "its real size is unknown");
});

test("files: a download that declares itself over the limit is refused unread", async () => {
  await setFiles([9004, "scan.pdf"]); // Monday says 3 bytes
  const download = lazyDownload(80 * MIB, { "content-length": String(MAX_FILE_BYTES + 1) });
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store: memoryFileStore(), fetch: download.fetch }, { max: 10 });
  assert.deepEqual(r, { downloaded: 0, tooLarge: 1, failed: 0, pending: 0 });
  assert.equal(download.pulled.chunks, 0);
  const [row] = await assetRows();
  assert.deepEqual([row.download_error, row.file_size, row.file_extension], ["too_large", MAX_FILE_BYTES + 1, "pdf"]);
});

test("files: a download in uneven chunks is stored whole", async () => {
  await setFiles([9004, "scan.pdf"]);
  const parts = [new Uint8Array([1, 2, 3, 4, 5]), new Uint8Array([6]), new Uint8Array([7, 8, 9, 10, 11, 12, 13])];
  const chunked = (async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const part of parts) controller.enqueue(part);
          controller.close();
        },
      }),
    )) as unknown as typeof fetch;
  const store = memoryFileStore();
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store, fetch: chunked }, { max: 10 });
  assert.deepEqual(r, { downloaded: 1, tooLarge: 0, failed: 0, pending: 0 });
  const whole = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.deepEqual(store.files.get("monday-files/10/1001/9004/file-9004.pdf")?.body, whole);
  const [row] = await assetRows();
  assert.equal(row.sha256, createHash("sha256").update(whole).digest("hex"));
  assert.equal(row.file_size, 13);
});

test("files: a download of exactly the limit is stored", async () => {
  await setFiles([9004, "scan.pdf"]); // Monday says 3 bytes
  const download = lazyDownload(MAX_FILE_BYTES);
  const store = memoryFileStore();
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store, fetch: download.fetch }, { max: 10 });
  assert.deepEqual(r, { downloaded: 1, tooLarge: 0, failed: 0, pending: 0 });
  assert.equal(store.files.get("monday-files/10/1001/9004/file-9004.pdf")?.body.byteLength, MAX_FILE_BYTES);
  const [row] = await assetRows();
  assert.deepEqual([row.file_size, row.download_error], [MAX_FILE_BYTES, null]);
});

test("files: a download one byte over the limit is too large", async () => {
  await setFiles([9004, "scan.pdf"]); // Monday says 3 bytes
  const download = lazyDownload(MAX_FILE_BYTES + 1);
  const store = memoryFileStore();
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store, fetch: download.fetch }, { max: 10 });
  assert.deepEqual(r, { downloaded: 0, tooLarge: 1, failed: 0, pending: 0 });
  assert.equal(store.files.size, 0);
  const [row] = await assetRows();
  assert.equal(row.download_error, "too_large");
});

test("files: a file whose item isn't mirrored isn't counted as waiting", async () => {
  await setFiles([9001, "Plan v2.pdf"], [9009, "orphan.pdf", 5555]);
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store: memoryFileStore(), fetch: fetchFile }, { max: 10 });
  assert.deepEqual(r, { downloaded: 1, tooLarge: 0, failed: 0, pending: 0 });
});

test("files: the newest files are fetched first", async () => {
  await setFiles([9001, "Plan v2.pdf"], [9900, "newer.pdf"]);
  const store = memoryFileStore();
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store, fetch: fetchFile }, { max: 1 });
  assert.deepEqual([...store.files.keys()], ["monday-files/10/1001/9900/file-9900.pdf"]);
  assert.equal(r.pending, 1);
});

test("files: each download runs under a timeout, and one that times out is charged an attempt", async () => {
  await setFiles([9001, "Plan v2.pdf"], [9004, "scan.pdf"]);
  const signals: unknown[] = [];
  const timing = (async (url: string, init?: RequestInit) => {
    signals.push(init?.signal);
    if (url.endsWith("/9004")) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    return new Response(new Uint8Array([1, 2, 3]));
  }) as unknown as typeof fetch;
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store: memoryFileStore(), fetch: timing }, { max: 10 });
  assert.deepEqual(r, { downloaded: 1, tooLarge: 0, failed: 1, pending: 1 });
  assert.equal(signals.length, 2);
  for (const signal of signals) assert.ok(signal instanceof AbortSignal && !signal.aborted, "each download gets a live signal");
  const [, timedOut] = await assetRows();
  assert.deepEqual([timedOut.download_attempts, timedOut.download_error], [1, null]);
});

test("files: an extension that names an Object property still gets a plain content type", async () => {
  await setFiles([9005, "notes.constructor"], [9006, "notes.__proto__"]);
  const store = memoryFileStore();
  const r = await downloadPendingFiles({ db, monday: fakeMondayFiles(), store, fetch: fetchFile }, { max: 10 });
  assert.equal(r.downloaded, 2);
  assert.deepEqual([...store.files.values()].map((f) => f.contentType), ["application/octet-stream", "application/octet-stream"]);
});

test("storage: with no Supabase settings there is no file store", () => {
  const key = ["not", "a", "real", "key"].join("-");
  assert.equal(supabaseFileStore(readServerEnv({})), null);
  assert.equal(supabaseFileStore(readServerEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://storage-a.example.test" })), null);
  assert.equal(supabaseFileStore(readServerEnv({ SUPABASE_SERVICE_ROLE_KEY: key })), null);
});

/**
 * Stands in for Supabase Storage's bucket endpoint by replacing the global fetch for one test (no network: any
 * other request fails the test). Records each request; `bucket` sets what the endpoint answers. Its size limit is
 * MAX_FILE_BYTES unless `fileSizeLimit` says otherwise (null: none set).
 */
function fakeStorage(t: TestContext, bucket: { public: boolean; updatable: boolean; fileSizeLimit?: number | null }) {
  const requests: { what: string; timed: boolean; body: unknown }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    requests.push({
      what: `${method} ${url.host}`,
      timed: init?.signal instanceof AbortSignal,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    if (!/^storage-[a-z]\.example\.test$/.test(url.host) || url.pathname !== "/storage/v1/bucket/monday-files") {
      throw new Error(`unexpected request in a test: ${method} ${url}`);
    }
    if (method === "GET") {
      const at = "2026-10-01T00:00:00Z";
      const limit = bucket.fileSizeLimit === undefined ? MAX_FILE_BYTES : bucket.fileSizeLimit;
      return Response.json({
        id: "monday-files", name: "monday-files", owner: "", public: bucket.public,
        file_size_limit: limit, created_at: at, updated_at: at,
      });
    }
    if (method === "PUT" && bucket.updatable) return Response.json({ message: "Successfully updated" });
    return Response.json({ statusCode: "403", error: "Unauthorized", message: "not allowed" }, { status: 403 });
  });
  return requests;
}

const storageSettings = (host: string) =>
  readServerEnv({ NEXT_PUBLIC_SUPABASE_URL: `https://${host}.example.test`, SUPABASE_SERVICE_ROLE_KEY: ["not", "a", "real", "key"].join("-") });

test("storage: a bucket found public is made private, or the run stops", async (t) => {
  const bucket = { public: true, updatable: true };
  const requests = fakeStorage(t, bucket);
  const store = supabaseFileStore(storageSettings("storage-a"));
  assert.ok(store);
  await store.ensureBucket("monday-files", MAX_FILE_BYTES);
  assert.deepEqual(requests.map((r) => r.what), ["GET storage-a.example.test", "PUT storage-a.example.test"]);
  assert.deepEqual(requests[1].body, { id: "monday-files", name: "monday-files", public: false, file_size_limit: MAX_FILE_BYTES });

  bucket.updatable = false;
  await assert.rejects(store.ensureBucket("monday-files", MAX_FILE_BYTES), /monday-files is public and couldn't be made private: not allowed/);
});

test("storage: a bucket with a smaller size limit, or none, is given the full one", async (t) => {
  const bucket = { public: false, updatable: true, fileSizeLimit: MIB as number | null };
  const requests = fakeStorage(t, bucket);
  const store = supabaseFileStore(storageSettings("storage-e"));
  assert.ok(store);
  await store.ensureBucket("monday-files", MAX_FILE_BYTES);
  assert.deepEqual(requests.map((r) => r.what), ["GET storage-e.example.test", "PUT storage-e.example.test"]);
  assert.deepEqual(requests[1].body, { id: "monday-files", name: "monday-files", public: false, file_size_limit: MAX_FILE_BYTES });

  requests.length = 0;
  bucket.fileSizeLimit = null;
  await store.ensureBucket("monday-files", MAX_FILE_BYTES);
  assert.deepEqual(requests.map((r) => r.what), ["GET storage-e.example.test", "PUT storage-e.example.test"], "no limit set");

  requests.length = 0;
  bucket.fileSizeLimit = MAX_FILE_BYTES;
  await store.ensureBucket("monday-files", MAX_FILE_BYTES);
  assert.deepEqual(requests.map((r) => r.what), ["GET storage-e.example.test"], "a bucket already right is left alone");

  bucket.fileSizeLimit = MIB;
  bucket.updatable = false;
  await assert.rejects(store.ensureBucket("monday-files", MAX_FILE_BYTES), /monday-files has a size limit below 52428800 bytes, or none, and couldn't be updated: not allowed/);
});

test("storage: the client's fetch wrapper gives a request a timeout (seen through getBucket)", async (t) => {
  const requests = fakeStorage(t, { public: false, updatable: true });
  const store = supabaseFileStore(storageSettings("storage-b"));
  assert.ok(store);
  await store.ensureBucket("monday-files", MAX_FILE_BYTES);
  assert.equal(requests.length, 1);
  assert.ok(requests[0].timed, "the request has a signal");
});

test("storage: new settings get their own client", async (t) => {
  const requests = fakeStorage(t, { public: false, updatable: true });
  await supabaseFileStore(storageSettings("storage-c"))?.ensureBucket("monday-files", MAX_FILE_BYTES);
  await supabaseFileStore(storageSettings("storage-d"))?.ensureBucket("monday-files", MAX_FILE_BYTES);
  assert.deepEqual(requests.map((r) => r.what), ["GET storage-c.example.test", "GET storage-d.example.test"]);
});
