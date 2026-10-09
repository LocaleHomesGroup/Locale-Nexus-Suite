import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { RunDeadlineError } from "../limits";
import { getWatermark, setWatermark } from "../runs";
import { HubSpotError, createHubSpotClient, isAllowedHubSpotRequest } from "./client";
import { runHubSpotPass } from "./pass";
import { MODIFIED, type HubSpotObject } from "./properties";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const deal = (id: number, updated: string) => ({
  id: String(id),
  properties: { dealname: `Test deal ${id}`, hs_lastmodifieddate: updated },
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: updated,
  archived: false,
});

function fakeHubSpot(portal = 1234) {
  const sent: { method: string; path: string; body: { after?: string; filterGroups: { filters: { value: string }[] }[] } | null }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const method = init?.method ?? "GET";
    sent.push({ method, path: u.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (u.pathname === "/account-info/v3/details") return json({ portalId: portal });
    if (u.pathname === "/crm/v3/owners") {
      return json({
        results: u.searchParams.get("archived") === "true"
          ? []
          : [{ id: "77", email: "rep.a@example.com", firstName: "Test", lastName: "Rep A", userId: 7, teams: [], archived: false, updatedAt: "2026-10-01T00:00:00Z" }],
      });
    }
    if (u.pathname === "/crm/v3/pipelines/deals") {
      return json({ results: [{ id: "default", label: "Test pipeline", displayOrder: 0, archived: false, stages: [{ id: "s1", label: "Stage 1" }] }] });
    }
    if (u.pathname === "/crm/v3/objects/deals/search") {
      const n = sent.filter((s) => s.path === "/crm/v3/objects/deals/search").length;
      // The first page claims 9,800 results already: the pass must restart from the newest it saw.
      return n === 1
        ? json({ total: 9801, results: [deal(1001, "2026-10-07T01:00:00Z")], paging: { next: { after: "9800" } } })
        : json({ total: 1, results: [deal(1002, "2026-10-07T02:00:00Z")] });
    }
    if (u.pathname.endsWith("/search")) return json({ total: 0, results: [] });
    if (u.pathname === "/crm/v4/associations/deals/contacts/batch/read") {
      // Of the deals asked about, only 1001 has a contact.
      const { inputs } = JSON.parse(String(init?.body)) as { inputs: { id: string }[] };
      return json({ results: inputs.filter((i) => i.id === "1001").map((i) => ({ from: { id: i.id }, to: [{ toObjectId: 501 }] })) });
    }
    return json({ message: "not found" }, 404);
  }) as unknown as typeof fetch;
  return { fn, sent };
}

const noSleep = async () => {};

/**
 * An invented token about as long as a real one. The client replaces every copy of its token in an error's text, so
 * a one-letter token would be found inside ordinary words.
 */
const TOKEN = "test-token-for-the-mirror";

/** A fetch that answers each request with the next step; a step that throws makes the fetch reject. */
function scripted(steps: (() => Response)[]) {
  const sent: { url: string; signal: AbortSignal | null }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    sent.push({ url, signal: init?.signal ?? null });
    const step = steps.shift();
    if (!step) throw new Error("no fake response left");
    return step();
  }) as unknown as typeof fetch;
  return { fn, sent };
}

/** A clock the test moves by hand. Its sleep records the wait and moves the clock, so a wait that is taken shows in the time. */
function clock(start = 1_000_000) {
  let t = start;
  const slept: number[] = [];
  return {
    start,
    slept,
    now: () => t,
    tick: (ms: number) => { t += ms; },
    sleep: async (ms: number) => { slept.push(ms); t += ms; },
  };
}

/** What Node's fetch throws when the connection is reset. */
const reset = () =>
  Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) });

const rateLimited = () =>
  new Response(JSON.stringify({ message: "Slow down", policyName: "TEN_SECONDLY_ROLLING" }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": "30" },
  });

interface Rec {
  id: number;
  modified: string;
  contacts?: number[];
}

interface SentBody {
  after?: string;
  limit?: number;
  filterGroups?: { filters: { value: string }[] }[];
  inputs?: { id: string }[];
}

/** `count` invented records, one a minute from `start`, with ids from `firstId`. */
const series = (count: number, start: string, firstId: number, contacts?: (i: number) => number[]): Rec[] =>
  Array.from({ length: count }, (_, i) => ({
    id: firstId + i,
    modified: new Date(Date.parse(start) + i * 60_000).toISOString(),
    contacts: contacts?.(i),
  }));

/**
 * A HubSpot whose search pages like the real one: records modified at or after the filter's time, oldest first,
 * `limit` at a time from the `after` offset. Deals' contacts come from their records. `hook` answers first when it
 * returns a Response.
 */
function pagingHubSpot(data: Partial<Record<HubSpotObject, Rec[]>>, hook?: (path: string, body: SentBody) => Response | undefined) {
  const sent: { path: string; body: SentBody }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    const body = (init?.body ? JSON.parse(String(init.body)) : {}) as SentBody;
    sent.push({ path, body });
    const hooked = hook?.(path, body);
    if (hooked) return hooked;
    if (path === "/account-info/v3/details") return json({ portalId: 1234 });
    if (path === "/crm/v3/owners" || path === "/crm/v3/pipelines/deals") return json({ results: [] });
    const search = /^\/crm\/v3\/objects\/(\w+)\/search$/.exec(path);
    if (search) {
      const type = search[1] as HubSpotObject;
      const from = Number(body.filterGroups?.[0].filters[0].value);
      const matching = (data[type] ?? [])
        .filter((r) => Date.parse(r.modified) >= from)
        .sort((a, b) => Date.parse(a.modified) - Date.parse(b.modified) || a.id - b.id);
      const offset = Number(body.after ?? 0);
      const limit = body.limit ?? 200;
      const results = matching.slice(offset, offset + limit).map((r) => ({
        id: String(r.id),
        properties: { [MODIFIED[type]]: r.modified },
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: r.modified,
        archived: false,
      }));
      const more = offset + limit < matching.length;
      return json({ total: matching.length, results, ...(more ? { paging: { next: { after: String(offset + limit) } } } : {}) });
    }
    if (path === "/crm/v4/associations/deals/contacts/batch/read") {
      const byId = new Map((data.deals ?? []).map((r) => [String(r.id), r.contacts ?? []]));
      const results = (body.inputs ?? [])
        .filter(({ id }) => (byId.get(id) ?? []).length > 0)
        .map(({ id }) => ({ from: { id }, to: (byId.get(id) ?? []).map((toObjectId) => ({ toObjectId })) }));
      return json({ status: "COMPLETE", results });
    }
    return json({ message: "not found" }, 404);
  }) as unknown as typeof fetch;
  const searches = (type: HubSpotObject) => sent.filter((s) => s.path === `/crm/v3/objects/${type}/search`);
  return { fn, sent, searches };
}

/** Each test that runs a pass starts with no HubSpot watermarks, so earlier tests can't move its search window. */
const resetHubSpotState = () => db.query("delete from mirror.sync_state where source = 'hubspot'");

async function watermarkOf(type: HubSpotObject): Promise<string | null> {
  const w = await getWatermark(db, "hubspot", `object:${type}`);
  return w ? new Date(w).toISOString() : null;
}

async function lastRun() {
  const [run] = await db.query<{ status: string; note: string | null; error: string | null }>(
    "select status, note, error from mirror.sync_runs where source = 'hubspot' order by id desc limit 1",
  );
  return run;
}

const filterOf = (body: SentBody) => body.filterGroups?.[0].filters[0].value;

test("hubspot: only the reads the mirror makes are allowed", () => {
  assert.equal(isAllowedHubSpotRequest("GET", "/crm/v3/owners?limit=500"), true);
  assert.equal(isAllowedHubSpotRequest("POST", "/crm/v3/objects/deals/search"), true);
  assert.equal(isAllowedHubSpotRequest("POST", "/crm/v3/objects/deals"), false, "that creates a deal");
  assert.equal(isAllowedHubSpotRequest("PATCH", "/crm/v3/objects/deals/1"), false);
  assert.equal(isAllowedHubSpotRequest("DELETE", "/crm/v3/objects/contacts/1"), false);
  assert.equal(isAllowedHubSpotRequest("POST", "/crm/v4/associations/deals/contacts/batch/create"), false);
});

test("hubspot: the client refuses a write without sending it", async () => {
  const f = fakeHubSpot();
  const hubspot = createHubSpotClient({ token: "test-token", fetch: f.fn, sleep: noSleep });
  await assert.rejects(hubspot.post("/crm/v3/objects/deals", {}), /Refused/);
  assert.equal(f.sent.length, 0);
});

test("hubspot: a token for the wrong portal stops the pass before anything is read", async () => {
  const f = fakeHubSpot(9999);
  const r = await runHubSpotPass(db, createHubSpotClient({ token: "t", fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(r.status, "failed");
  assert.match(r.error ?? "", /9999/);
  assert.equal(f.sent.length, 1);
});

test("hubspot: owners, pipelines and changed objects land, past the 10,000 search cap", async () => {
  const f = fakeHubSpot();
  const r = await runHubSpotPass(db, createHubSpotClient({ token: "t", fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(r.status, "ok", r.error ?? "");

  const deals = await db.query<{ id: number; contacts: number[] | null }>(
    "select id, associations -> 'contacts' as contacts from mirror.hubspot_objects where object_type = 'deals' order by id",
  );
  // HubSpot listed no contacts for 1002, and its answer had no errors, so 1002 has none.
  assert.deepEqual(deals, [{ id: 1001, contacts: [501] }, { id: 1002, contacts: [] }]);

  const searches = f.sent.filter((s) => s.path === "/crm/v3/objects/deals/search");
  assert.equal(searches.length, 2);
  assert.equal(searches[1].body?.after, undefined, "restarted without a cursor");
  assert.equal(searches[1].body?.filterGroups[0].filters[0].value, String(Date.parse("2026-10-07T01:00:00Z")));

  const [owner] = await db.query<{ email: string }>("select email from mirror.hubspot_owners where id = 77");
  assert.equal(owner.email, "rep.a@example.com");
  const [state] = await db.query<{ w: Date }>("select watermark as w from mirror.sync_state where scope = 'object:deals'");
  assert.equal(new Date(state.w).toISOString(), "2026-10-07T02:00:00.000Z");
});

test("hubspot: past its deadline the client sends nothing and throws RunDeadlineError; a bad timeoutMs or deadline is refused when it is made", async () => {
  // The deadline already past, and exactly now; a read and a search.
  for (const deadline of [new Date(999_999), new Date(1_000_000)]) {
    const c = clock();
    const f = fakeHubSpot();
    const hubspot = createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: c.sleep, now: c.now, deadline });
    await assert.rejects(hubspot.get("/crm/v3/owners", { limit: "500" }), RunDeadlineError);
    await assert.rejects(hubspot.post("/crm/v3/objects/deals/search", { filterGroups: [] }), RunDeadlineError);
    assert.equal(f.sent.length, 0, "nothing is sent");
    assert.equal(hubspot.stats.calls, 0);
    assert.deepEqual(c.slept, []);
  }
  for (const bad of [0, -1, 1.5, 2_147_483_648, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => createHubSpotClient({ token: TOKEN, timeoutMs: bad }), RangeError, `timeoutMs ${bad}`);
  }
  assert.throws(() => createHubSpotClient({ token: TOKEN, deadline: new Date(Number.NaN) }), TypeError);
});

test("hubspot: a 429 whose Retry-After, or a search pace, would end past the deadline throws RunDeadlineError without sleeping", async () => {
  const tooLate = clock();
  const f = scripted([rateLimited, () => json({ results: [] })]);
  const stopped = createHubSpotClient({
    token: TOKEN, fetch: f.fn, sleep: tooLate.sleep, now: tooLate.now, deadline: new Date(tooLate.start + 10_000),
  });
  await assert.rejects(stopped.get("/crm/v3/owners"), RunDeadlineError);
  assert.deepEqual(tooLate.slept, [], "no sleep");
  assert.equal(f.sent.length, 1);

  // The same wait, when it ends before the deadline, is taken.
  const inTime = clock();
  const g = scripted([rateLimited, () => json({ results: [] })]);
  const carriedOn = createHubSpotClient({
    token: TOKEN, fetch: g.fn, sleep: inTime.sleep, now: inTime.now, deadline: new Date(inTime.start + 60_000),
  });
  assert.deepEqual(await carriedOn.get("/crm/v3/owners"), { results: [] });
  assert.deepEqual(inTime.slept, [30_000]);
  assert.equal(g.sent.length, 2);

  // Two searches in a row: the second waits 250 ms for the pace, which would end past a deadline 100 ms off.
  const pace = clock();
  const h = scripted([() => json({ results: [] }), () => json({ results: [] })]);
  const paced = createHubSpotClient({ token: TOKEN, fetch: h.fn, sleep: pace.sleep, now: pace.now, deadline: new Date(pace.start + 100) });
  await paced.post("/crm/v3/objects/deals/search", {});
  await assert.rejects(paced.post("/crm/v3/objects/deals/search", {}), (e: unknown) =>
    e instanceof RunDeadlineError && /the search pace/.test(e.message));
  assert.deepEqual(pace.slept, [], "no sleep");
  assert.equal(h.sent.length, 1);
});

test("hubspot: a fetch that rejects once is retried, then succeeds, as is a 2xx that isn't JSON; five failures end as unreachable", async () => {
  const c = clock();
  const f = scripted([() => { throw reset(); }, () => json({ results: [] })]);
  const hubspot = createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: c.sleep, now: c.now });
  assert.deepEqual(await hubspot.get("/crm/v3/owners"), { results: [] });
  assert.equal(f.sent.length, 2);
  assert.equal(hubspot.stats.calls, 2, "the retry is a second call");
  assert.deepEqual(c.slept, [1000]);
  const [first, second] = f.sent.map((s) => s.signal);
  assert.ok(first instanceof AbortSignal && second instanceof AbortSignal, "every attempt carries a timeout signal");
  assert.notEqual(first, second, "each attempt its own, so a retry isn't born timed out");

  const g = scripted([() => new Response("<html>Bad gateway</html>", { status: 200 }), () => json({ results: [] })]);
  const garbled = clock();
  assert.deepEqual(
    await createHubSpotClient({ token: TOKEN, fetch: g.fn, sleep: garbled.sleep, now: garbled.now }).get("/crm/v3/owners"),
    { results: [] },
  );
  assert.equal(g.sent.length, 2);
  assert.deepEqual(garbled.slept, [1000]);

  const h = scripted(Array.from({ length: 6 }, () => () => { throw reset(); }));
  const down = clock();
  await assert.rejects(
    createHubSpotClient({ token: TOKEN, fetch: h.fn, sleep: down.sleep, now: down.now }).get("/crm/v3/owners"),
    (e: unknown) =>
      e instanceof HubSpotError &&
      e.message === "HubSpot is unreachable: fetch failed (ECONNRESET)" &&
      e.cause instanceof TypeError &&
      e.cause.message === "fetch failed",
  );
  assert.equal(h.sent.length, 5, "five attempts in all");
  assert.deepEqual(down.slept, [1000, 2000, 4000, 8000]);
});

test("hubspot: a run cut during an object's second page keeps the first page's checkpoint, and the next run finishes the object", async () => {
  await resetHubSpotState();
  const deals: Rec[] = [{ id: 1003, modified: "2026-10-08T03:00:00.000Z", contacts: [502] }];
  const contacts = series(450, "2026-10-08T00:00:00Z", 100_000);
  const c = clock();
  const f = pagingHubSpot({ deals, contacts }, (path, body) => {
    // The first page of contacts arrives, and the run's time is up before the second is asked for.
    if (path === "/crm/v3/objects/contacts/search" && body.after === undefined) c.tick(60_000);
    return undefined;
  });
  const cut = createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: c.sleep, now: c.now, deadline: new Date(c.start + 60_000) });

  const first = await runHubSpotPass(db, cut, "1234", { trigger: "cli" });
  assert.equal(first.status, "partial");
  assert.equal(first.note, "stopped at the run's time limit; the next run continues from contacts' last stored page");
  assert.equal(first.error, null);
  assert.deepEqual(await lastRun(), { status: "partial", note: first.note, error: null });
  assert.equal(f.searches("contacts").length, 1, "the second page was never asked for");
  assert.equal(await watermarkOf("deals"), "2026-10-08T03:00:00.000Z", "the deals finished");
  assert.equal(await watermarkOf("contacts"), contacts[199].modified, "the contacts' checkpoint is page 1's newest");
  const [dealRow] = await db.query<{ contacts: number[] | null }>(
    "select associations -> 'contacts' as contacts from mirror.hubspot_objects where object_type = 'deals' and id = 1003",
  );
  assert.deepEqual(dealRow.contacts, [502]);

  const second = await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(second.status, "ok", second.error ?? "");
  const resumed = f.searches("contacts")[1];
  assert.equal(filterOf(resumed.body), String(Date.parse(contacts[199].modified) - 5 * 60_000), "5 minutes behind the checkpoint");
  assert.equal(resumed.body.after, undefined, "with no offset from the cut run");
  const [stored] = await db.query<{ n: number }>(
    "select count(*)::int as n from mirror.hubspot_objects where object_type = 'contacts' and id between 100000 and 100449",
  );
  assert.equal(stored.n, 450, "the next run finished the contacts");
  assert.equal(await watermarkOf("contacts"), contacts[449].modified);
});

test("hubspot: deals cut mid-load end with contacts for every stored deal once loading finishes", async () => {
  await resetHubSpotState();
  const deals = series(500, "2026-10-08T00:00:00Z", 200_000, (i) => [300_000 + i]);
  const c = clock();
  const f = pagingHubSpot({ deals }, (path, body) => {
    // The second page of deals arrives, and the run's time is up before its contacts are asked for.
    if (path === "/crm/v3/objects/deals/search" && body.after === "200") c.tick(60_000);
    return undefined;
  });
  const cut = createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: c.sleep, now: c.now, deadline: new Date(c.start + 60_000) });
  const withoutContacts = async () =>
    (await db.query<{ n: number; without: number }>(
      `select count(*)::int as n, (count(*) filter (where associations -> 'contacts' is null))::int as without
         from mirror.hubspot_objects where object_type = 'deals' and id between 200000 and 200499`,
    ))[0];

  const first = await runHubSpotPass(db, cut, "1234", { trigger: "cli" });
  assert.equal(first.status, "partial");
  assert.equal(first.note, "stopped at the run's time limit; the next run continues from deals' last stored page");
  assert.equal(await watermarkOf("deals"), deals[199].modified, "page 2's contacts weren't read, so its checkpoint wasn't written");
  assert.deepEqual(await withoutContacts(), { n: 400, without: 200 });

  const second = await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(second.status, "ok", second.error ?? "");
  assert.deepEqual(await withoutContacts(), { n: 500, without: 0 }, "every stored deal has its contacts");
  assert.equal(await watermarkOf("deals"), deals[499].modified);
});

test("hubspot: a resumed search whose first page ends before the stored watermark doesn't move it back", async () => {
  await resetHubSpotState();
  const mark = "2026-10-08T12:00:00.000Z";
  await setWatermark(db, "hubspot", "object:notes", new Date(mark));
  // Only notes from inside the 5-minute overlap: the newest is two minutes before the watermark.
  const notes = series(3, "2026-10-08T11:56:00Z", 400_000);
  const f = pagingHubSpot({ notes });
  const r = await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(r.status, "ok", r.error ?? "");
  assert.equal(filterOf(f.searches("notes")[0].body), String(Date.parse(mark) - 5 * 60_000));
  assert.equal(await watermarkOf("notes"), mark, "not moved back to 11:58");
  const [stored] = await db.query<{ n: number }>(
    "select count(*)::int as n from mirror.hubspot_objects where object_type = 'notes' and id between 400000 and 400002",
  );
  assert.equal(stored.n, 3);
});

test("hubspot: 9,800 objects on one modified time end that object partial after a few searches, and the next object still runs", async () => {
  await resetHubSpotState();
  const tie = "2026-10-08T05:00:00.000Z";
  const f = pagingHubSpot({ contacts: series(1, "2026-10-08T06:00:00Z", 510_000) }, (path) => {
    if (path !== "/crm/v3/objects/deals/search") return undefined;
    // Every page is the same moment, and HubSpot says the 9,800th result is next.
    return json({ total: 20_000, results: Array.from({ length: 200 }, (_, i) => deal(500_000 + i, tie)), paging: { next: { after: "9800" } } });
  });
  const r = await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(r.status, "partial");
  assert.equal(r.note, `deals: 9,800 or more objects share one modified time (${tie}); Launchpad can't page past them yet`);
  assert.equal(r.error, null);
  assert.ok(f.searches("deals").length <= 3, `${f.searches("deals").length} deal searches`);
  assert.equal(await watermarkOf("deals"), tie, "left at the tie");
  assert.equal(f.searches("contacts").length, 1, "the contacts still ran");
  assert.equal(await watermarkOf("contacts"), "2026-10-08T06:00:00.000Z");
});

test("hubspot: the 1,000-page guard ends that object partial, with a checkpoint the next run continues from", async () => {
  await resetHubSpotState();
  let n = 0;
  const f = pagingHubSpot({}, (path) => {
    if (path !== "/crm/v3/objects/notes/search") return undefined;
    n += 1;
    const t = new Date(Date.parse("2026-10-08T00:00:00Z") + n * 1000).toISOString();
    // One note a page, and always another page: past 1,000 pages without reaching the 9,800 restart.
    return json({ results: [{ id: String(600_000 + n), properties: { hs_lastmodifieddate: t }, updatedAt: t }], paging: { next: { after: String(n) } } });
  });
  const r = await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(r.status, "partial");
  assert.equal(r.note, "notes: stopped after 1,000 pages; the next run continues");
  assert.equal(n, 1000);
  assert.equal(await watermarkOf("notes"), "2026-10-08T00:16:40.000Z", "page 1,000's newest");
});

test("hubspot: one object's failure doesn't stop the others; the pass ends failed and names each", async () => {
  await resetHubSpotState();
  const deals = series(300, "2026-10-08T00:00:00Z", 700_000, (i) => [710_000 + i]);
  const meetings = series(2, "2026-10-08T00:00:00Z", 730_000);
  const notes = series(2, "2026-10-08T01:00:00Z", 740_000);
  const f = pagingHubSpot({ deals, meetings, notes }, (path, body) => {
    // The contacts of the second page of deals can't be read.
    if (path === "/crm/v4/associations/deals/contacts/batch/read" && body.inputs?.[0].id === "700200") return json({ message: "bad input" }, 400);
    // A token without the contacts scope.
    if (path === "/crm/v3/objects/contacts/search") return json({ message: "missing scopes" }, 403);
    return undefined;
  });
  const r = await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(r.status, "failed");
  assert.equal(r.error, "deals: HubSpot answered HTTP 400: bad input; contacts: HubSpot answered HTTP 403: missing scopes");
  assert.deepEqual(await lastRun(), { status: "failed", note: null, error: r.error });
  assert.equal(await watermarkOf("deals"), deals[199].modified, "the page whose contacts failed keeps no checkpoint");
  assert.equal(await watermarkOf("contacts"), null);
  assert.equal(await watermarkOf("meetings"), meetings[1].modified, "meetings still ran");
  assert.equal(await watermarkOf("notes"), notes[1].modified, "and notes");
});

test("hubspot: a 401 stops the whole pass as failed, and the daily limit as partial, at once and unretried", async () => {
  await resetHubSpotState();
  const unauthorised = pagingHubSpot({}, (path) =>
    path === "/crm/v3/objects/contacts/search" ? json({ message: "test-token-abc is expired" }, 401) : undefined);
  const r = await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: unauthorised.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(r.status, "failed");
  assert.equal(r.error, "contacts: HubSpot rejected the token (401): it may have been rotated or deactivated.");
  assert.equal(unauthorised.searches("contacts").length, 1, "not retried");
  assert.equal(unauthorised.searches("meetings").length, 0, "and nothing after it");

  await resetHubSpotState();
  const daily = pagingHubSpot({}, (path) =>
    path === "/crm/v3/objects/deals/search" ? json({ message: "You have reached your daily limit.", policyName: "DAILY" }, 429) : undefined);
  const d = await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: daily.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  // A spent quota is a stop, not a fault: the next run after the reset carries on.
  assert.equal(d.status, "partial");
  assert.equal(d.note, "deals: HubSpot's daily API limit is reached.");
  assert.equal(d.error, null);
  assert.deepEqual(await lastRun(), { status: "partial", note: d.note, error: null });
  assert.equal(daily.searches("deals").length, 1, "not retried");
  assert.equal(daily.searches("contacts").length, 0, "and nothing after it");

  // An object that failed before the limit was reached still makes the pass failed.
  await resetHubSpotState();
  const both = pagingHubSpot({ deals: series(1, "2026-10-08T00:00:00Z", 810_000) }, (path) => {
    if (path === "/crm/v4/associations/deals/contacts/batch/read") return json({ message: "bad input" }, 400);
    if (path === "/crm/v3/objects/contacts/search") return json({ message: "You have reached your daily limit.", policyName: "DAILY" }, 429);
    return undefined;
  });
  const b = await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: both.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(b.status, "failed");
  assert.equal(b.error, "deals: HubSpot answered HTTP 400: bad input");
  assert.equal(b.note, "contacts: HubSpot's daily API limit is reached.");
  assert.equal(both.searches("meetings").length, 0, "the limit still stopped the pass");
});

test("hubspot: a 5xx on every attempt ends as unreachable after five, and no message can quote the token", async () => {
  const c = clock();
  const f = scripted(Array.from({ length: 5 }, () => () => json({ message: "down" }, 503)));
  await assert.rejects(createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: c.sleep, now: c.now }).get("/crm/v3/owners"), (e: unknown) =>
    e instanceof HubSpotError && e.status === 503 && e.message === "HubSpot is unreachable: it answered HTTP 503 on all 5 attempts (down)");
  assert.equal(f.sent.length, 5);
  assert.deepEqual(c.slept, [1000, 2000, 4000, 8000]);

  // HubSpot's own message, or a path, that quotes the token: it is replaced before it reaches an error.
  const token = "test-token-abc";
  const g = scripted([() => json({ message: `This token is wrong: ${token}` }, 400)]);
  const hubspot = createHubSpotClient({ token, fetch: g.fn, sleep: noSleep });
  await assert.rejects(hubspot.get("/crm/v3/owners"), (e: unknown) =>
    e instanceof HubSpotError && e.message === "HubSpot answered HTTP 400: This token is wrong: [token]");
  await assert.rejects(hubspot.post(`/crm/v3/objects/deals?key=${token}`, {}), (e: unknown) =>
    e instanceof HubSpotError && /^Refused/.test(e.message) && e.message.includes("[token]") && !e.message.includes(token));
});

test("hubspot: a deal HubSpot lists no contacts for gets an empty list; one named in the answer's errors keeps what it had", async () => {
  await db.query(
    `insert into mirror.hubspot_objects (object_type, id, associations)
     values ('deals', 800001, '{"contacts": [1]}'), ('deals', 800002, '{"contacts": [2]}')`,
  );
  const contactsOf = async (id: number) =>
    (await db.query<{ contacts: number[] | null }>(
      "select associations -> 'contacts' as contacts from mirror.hubspot_objects where object_type = 'deals' and id = $1",
      [id],
    ))[0].contacts;

  await resetHubSpotState();
  const lost = pagingHubSpot({ deals: [{ id: 800001, modified: "2026-10-08T00:00:00.000Z" }] });
  assert.equal((await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: lost.fn, sleep: noSleep }), "1234", { trigger: "cli" })).status, "ok");
  assert.deepEqual(await contactsOf(800001), [], "no contacts listed and no errors: it has none");

  await resetHubSpotState();
  const errored = pagingHubSpot({ deals: [{ id: 800002, modified: "2026-10-08T00:00:00.000Z" }] }, (path) =>
    path === "/crm/v4/associations/deals/contacts/batch/read"
      ? json({
        status: "COMPLETE",
        results: [],
        errors: [{ status: "error", category: "OBJECT_NOT_FOUND", message: "Could not read 800002", context: { fromObjectId: ["800002"] } }],
      })
      : undefined);
  assert.equal((await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: errored.fn, sleep: noSleep }), "1234", { trigger: "cli" })).status, "ok");
  assert.deepEqual(await contactsOf(800002), [2], "named in the errors: left as it was");
});

test("hubspot: a search with a query string is paced like any other", async () => {
  const c = clock();
  const f = scripted([() => json({ results: [] }), () => json({ results: [] })]);
  const hubspot = createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: c.sleep, now: c.now });
  await hubspot.post("/crm/v3/objects/deals/search?archived=false", {});
  await hubspot.post("/crm/v3/objects/deals/search?archived=false", {});
  assert.equal(f.sent.length, 2);
  assert.deepEqual(c.slept, [250], "the second waited for the pace");
});

test("hubspot: a token with a line break, a NUL or a space is refused when the client is made, quoting none of it", () => {
  const f = fakeHubSpot();
  for (const token of ["test-token-abc\ndef", "test-token-abc\u0000def", "test-token-abc def"]) {
    assert.throws(
      () => createHubSpotClient({ token, fetch: f.fn, sleep: noSleep }),
      (e: unknown) =>
        e instanceof TypeError &&
        e.message === "HUBSPOT_TOKEN has a character a token can't have, such as a line break or a space. Copy it again." &&
        !e.message.includes("test-token-abc") &&
        !e.message.includes("def"),
      JSON.stringify(token),
    );
  }
  assert.equal(f.sent.length, 0, "nothing is sent");
  assert.doesNotThrow(() => createHubSpotClient({ token: "  test-token-abc\n", fetch: f.fn }), "whitespace around it is trimmed");
  assert.throws(() => createHubSpotClient({ token: "   ", fetch: f.fn }), (e: unknown) =>
    e instanceof TypeError && e.message === "HUBSPOT_TOKEN is empty");
});

test("hubspot: an association answer with no results list changes no deal's contacts", async () => {
  await db.query(`insert into mirror.hubspot_objects (object_type, id, associations) values ('deals', 800003, '{"contacts": [3]}')`);
  await resetHubSpotState();
  const f = pagingHubSpot({ deals: [{ id: 800003, modified: "2026-10-08T00:00:00.000Z" }] }, (path) =>
    path === "/crm/v4/associations/deals/contacts/batch/read" ? json({ status: "COMPLETE" }) : undefined);
  const r = await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(r.status, "ok", r.error ?? "");
  const [row] = await db.query<{ contacts: number[] | null }>(
    "select associations -> 'contacts' as contacts from mirror.hubspot_objects where object_type = 'deals' and id = 800003",
  );
  assert.deepEqual(row.contacts, [3], "an answer without a results list says nothing about the deal's contacts");
});

test("hubspot: a modified time that can't be read falls back to updatedAt for the checkpoint", async () => {
  await resetHubSpotState();
  const f = pagingHubSpot({}, (path) =>
    path === "/crm/v3/objects/notes/search"
      ? json({ results: [{ id: "900001", properties: { hs_lastmodifieddate: "not a date" }, updatedAt: "2026-10-08T09:00:00.000Z" }] })
      : undefined);
  const r = await runHubSpotPass(db, createHubSpotClient({ token: TOKEN, fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(r.status, "ok", r.error ?? "");
  assert.equal(await watermarkOf("notes"), "2026-10-08T09:00:00.000Z");
});
