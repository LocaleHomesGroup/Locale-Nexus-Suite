import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MONDAY_API_VERSION,
  MondayCapReachedError,
  MondayDailyLimitError,
  MondayError,
  createMondayClient,
  isWriteOperation,
  withComplexity,
  type MondayLedger,
} from "./client";

function fakeFetch(responses: { status?: number; body: unknown; headers?: Record<string, string> }[]) {
  const sent: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("no fake response left");
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: next.headers });
  }) as unknown as typeof fetch;
  return { fn, sent };
}

function ledger(allow = true): MondayLedger & { claims: number; limitHits: number } {
  const l = {
    claims: 0,
    limitHits: 0,
    claim: async () => { l.claims += 1; return allow; },
    dailyLimitHit: async () => { l.limitHits += 1; },
  };
  return l;
}

const sleeps: number[] = [];
const sleep = async (ms: number) => { sleeps.push(ms); };
const complexity = (after = 9_000_000) => ({ complexity: { query: 1000, after, reset_in_x_seconds: 30 } });

test("monday client: spots a write in any spelling, but not the word inside a string", () => {
  assert.equal(isWriteOperation("mutation { create_item(board_id: 1, item_name: \"x\") { id } }"), true);
  assert.equal(isWriteOperation("  # a comment\n mutation Rename($id: ID!) { change_item_name(id: $id) { id } }"), true);
  assert.equal(isWriteOperation("subscription { x }"), true);
  assert.equal(isWriteOperation("query { boards(ids: [1]) { name } }"), false);
  assert.equal(isWriteOperation('{ items_page(query_params: { rules: [{ compare_value: ["mutation"] }] }) { cursor } }'), false);
  assert.equal(isWriteOperation("query { mutations_count }"), false);
});

test("monday client: refuses a write before touching the network or the budget", async () => {
  const f = fakeFetch([]);
  const l = ledger();
  const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep });
  await assert.rejects(monday.query("mutation { delete_item(item_id: 1) { id } }"), (e: unknown) =>
    e instanceof MondayError && e.code === "WRITE_REFUSED");
  assert.equal(f.sent.length, 0);
  assert.equal(l.claims, 0);
});

test("monday client: pins the version, adds complexity, and records it", async () => {
  const f = fakeFetch([{ body: { data: { boards: [{ id: "1" }], ...complexity() } } }]);
  const monday = createMondayClient({ token: "secret-token", ledger: ledger(), fetch: f.fn, sleep });
  const data = await monday.query<{ boards: { id: string }[] }>("query { boards(ids: [1]) { id } }");
  assert.equal(data.boards[0].id, "1");
  const headers = f.sent[0].init.headers as Record<string, string>;
  assert.equal(headers["API-Version"], MONDAY_API_VERSION);
  assert.equal(headers.Authorization, "secret-token");
  assert.match(String(f.sent[0].init.body), /complexity \{ query after reset_in_x_seconds \}/);
  assert.deepEqual(monday.stats.lastComplexity, { query: 1000, after: 9_000_000, resetInSeconds: 30 });
  assert.equal(monday.stats.calls, 1);
});

test("monday client: adds complexity to the operation's own selection", () => {
  assert.equal(
    withComplexity("query ($b: [ID!]) { boards(ids: $b) { id } }"),
    "query ($b: [ID!]) { complexity { query after reset_in_x_seconds }  boards(ids: $b) { id } }",
  );
  assert.equal(withComplexity("query { complexity { query } boards { id } }"), "query { complexity { query } boards { id } }");
});

test("monday client: stops at the day's cap without sending", async () => {
  const f = fakeFetch([]);
  const monday = createMondayClient({ token: "t", ledger: ledger(false), fetch: f.fn, sleep });
  await assert.rejects(monday.query("query { me { id } }"), MondayCapReachedError);
  assert.equal(f.sent.length, 0);
});

test("monday client: waits out a rate limit, then succeeds", async () => {
  sleeps.length = 0;
  const l = ledger();
  const f = fakeFetch([
    { status: 429, body: { errors: [{ message: "Budget exhausted", extensions: { code: "COMPLEXITY_BUDGET_EXHAUSTED", retry_in_seconds: 3 } }] } },
    { body: { data: { me: { id: "1" }, ...complexity() } } },
  ]);
  const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep });
  await monday.query("query { me { id } }");
  assert.deepEqual(sleeps, [3000]);
  assert.equal(l.claims, 2, "a retried request is a second call");
});

test("monday client: the daily limit stops cold, no retry, and is recorded for the rest of the day", async () => {
  const f = fakeFetch([{ status: 429, body: { errors: [{ message: "Daily limit exceeded", extensions: { code: "DAILY_LIMIT_EXCEEDED" } }] } }]);
  const l = ledger();
  const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep });
  await assert.rejects(monday.query("query { me { id } }"), MondayDailyLimitError);
  assert.equal(f.sent.length, 1);
  assert.equal(l.limitHits, 1, "the ledger refuses every call until 00:00 UTC");
});

test("monday client: an ordinary GraphQL error isn't retried", async () => {
  const f = fakeFetch([{ body: { errors: [{ message: "Field 'nope' doesn't exist", extensions: { code: "undefinedField" } }] } }]);
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep });
  await assert.rejects(monday.query("query { nope }"), (e: unknown) => e instanceof MondayError && /nope/.test(e.message));
  assert.equal(f.sent.length, 1);
});

test("monday client: waits for the minute budget when the last answer left it low", async () => {
  sleeps.length = 0;
  const f = fakeFetch([
    { body: { data: { a: 1, complexity: { query: 1000, after: 500_000, reset_in_x_seconds: 7 } } } },
    { body: { data: { b: 2, ...complexity() } } },
  ]);
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep });
  await monday.query("query { a }");
  await monday.query("query { b }");
  assert.deepEqual(sleeps, [7000]);
});

// Imported here, below the brief's nine tests, so that the brief's own text stays exactly as it was.
import { MondayDeadlineError } from "./client";

// Beyond the brief's nine. The guard is all that stands between a typo and a write to Monday, so it must read
// a document the way GraphQL does: commas are whitespace, and strings and comments are found in one
// left-to-right pass (a quote in a comment opens no string; a # in a string starts no comment).

test("monday client: a comma after the keyword doesn't hide a write", () => {
  assert.equal(isWriteOperation("mutation,{ delete_item(item_id: 1) { id } }"), true);
  assert.equal(isWriteOperation("mutation,Rename { change_item_name(id: 1) { id } }"), true);
  assert.equal(isWriteOperation("subscription,{ x }"), true);
});

test("monday client: a quote inside a comment can't pair with a later quote to hide a write", () => {
  assert.equal(isWriteOperation('# "\nmutation { delete_item(item_id: 1) { id } } # "'), true);
  assert.equal(isWriteOperation('# """\nmutation { delete_item(item_id: 1) { id } }\n# """'), true);
  assert.equal(isWriteOperation('# it is "quoted\nmutation { delete_item(item_id: 1) { id } }\n# done"'), true);
});

test("monday client: a # inside a string starts no comment, and an escaped quote doesn't end the string", () => {
  assert.equal(isWriteOperation('{ a(x: "#") } mutation { delete_item(item_id: 1) { id } }'), true);
  assert.equal(isWriteOperation('{ a(x: "\\\\") } mutation { delete_item(item_id: 1) { id } }'), true);
  assert.equal(isWriteOperation('query { a(x: "say \\"mutation\\" now") { id } }'), false);
  assert.equal(isWriteOperation('query { a(x: "# mutation") { id } }'), false);
});

test("monday client: a comment ends at the line's end, however the line ends", () => {
  assert.equal(isWriteOperation("# note\nmutation { delete_item(item_id: 1) { id } }"), true);
  assert.equal(isWriteOperation("# note\r\nmutation { delete_item(item_id: 1) { id } }"), true);
  assert.equal(isWriteOperation("# note\rmutation { delete_item(item_id: 1) { id } }"), true);
});

test("monday client: a string stays on its line, so a stray quote doesn't hide the next line", () => {
  assert.equal(isWriteOperation('query { a(x: "oops) { id } }\nmutation { delete_item(item_id: 1) { id } }\n# "'), true);
});

test("monday client: an escaped triple quote is refused wherever it is, since parsers disagree on it", () => {
  assert.equal(isWriteOperation('"""desc \\""" more""" mutation { delete_item(item_id: 1) { id } } # """'), true);
  // No write in these by the spec's lexer, but a parser that doesn't read \""" as an escape sees one: refused.
  assert.equal(isWriteOperation('query { a(x: """ a "mutation" and a # subscription \\""" more """) { id } }'), true);
  assert.equal(isWriteOperation('query { a } # a comment with \\""" in it'), true);
});

// Fix round 1. Where a lenient parser reads a document differently from the spec, the guard refuses it rather than
// guess. Each of these three hides a mutation in a string or comment by the spec's lexer, and runs it in a lenient one.
const A1_RAW_NEWLINE_IN_A_STRING =
  'fragment F on Item { column_values(ids: ["abc\ndef"]) { id } } mutation { delete_item(item_id: 1) { ...F } } # "';
const A2_LONE_CR_ENDS_A_COMMENT = '# note\r""" \nmutation { delete_item(item_id: 1) { id } }\n# """';
const A3_ESCAPED_TRIPLE_QUOTE =
  'fragment F on Item { column_values(ids: ["""x\\"""""]) { id } } mutation { delete_item(item_id: 1) { ...F } } # """';

// Fix round 2. Spec GraphQL has no single-quoted strings, but a parser that accepts them reads a `"` inside one as
// plain text, so it can run what our lexer hides in a string or a comment. The first is the example from the review.
const S1_SINGLE_QUOTED_STRING = `query { a(x: '"') } mutation { delete_item(item_id: 1) { id } } # "`;
const S2_SINGLE_QUOTED_STRING_IN_A_FRAGMENT = `fragment F on Item { column_values(ids: ['"']) { id } } mutation { delete_item(item_id: 1) { ...F } } # "`;

test("monday client: refuses a raw newline in a string, which a lenient parser reads as one string", () => {
  assert.equal(isWriteOperation(A1_RAW_NEWLINE_IN_A_STRING), true);
});

test("monday client: refuses a lone CR, where parsers disagree about where a comment ends", () => {
  assert.equal(isWriteOperation(A2_LONE_CR_ENDS_A_COMMENT), true);
});

test("monday client: refuses an escaped triple quote that a lenient parser reads as the end of the block string", () => {
  assert.equal(isWriteOperation(A3_ESCAPED_TRIPLE_QUOTE), true);
});

test("monday client: each fail-closed rule refuses on its own, with no write in the document", () => {
  assert.equal(isWriteOperation('query { a(x: "never closed) { id } }'), true, "a quote left over after strings and comments");
  assert.equal(isWriteOperation("query { a }\r"), true, "a lone CR");
  assert.equal(isWriteOperation("query { a }\rquery { b }"), true, "a lone CR between two lines");
  for (const lineBreak of [String.fromCharCode(0x2028), String.fromCharCode(0x2029), "\u0085", "\v", "\f"]) {
    const hex = lineBreak.charCodeAt(0).toString(16).padStart(4, "0");
    assert.equal(isWriteOperation(`# note${lineBreak}query { a }`), true, `U+${hex} ends a comment in some lexers`);
  }
});

test("monday client: still allows an ordinary query: CRLF line ends, quotes and # inside strings and comments, block strings", () => {
  assert.equal(isWriteOperation("query {\r\n  boards(ids: [1]) {\r\n    id\r\n  }\r\n}"), false);
  assert.equal(isWriteOperation('# it is "fine"\r\nquery { a(x: "say \\"hi\\" # not a comment") { id } }'), false);
  assert.equal(isWriteOperation('query { a(x: """ a "quoted" word, and a # hash """) { id } }'), false);
  assert.equal(isWriteOperation('query { a(x: "") { id } }'), false);
  assert.equal(
    isWriteOperation(
      'query ($b: [ID!], $n: Int!) { boards(ids: $b) { items_page(limit: $n, query_params: { rules: [{ column_id: "status", compare_value: ["A", "B"], operator: any_of }] }) { cursor items { id } } } }',
    ),
    false,
  );
});

test("monday client: refuses a single quote anywhere, since a parser that reads single-quoted strings sees another document", () => {
  assert.equal(isWriteOperation(S1_SINGLE_QUOTED_STRING), true);
  assert.equal(isWriteOperation(S2_SINGLE_QUOTED_STRING_IN_A_FRAGMENT), true);
  // On its own, with no write in the document: a single quote is refused wherever it sits.
  assert.equal(isWriteOperation(`query { a(x: 'text') { id } }`), true, "a single-quoted string");
  assert.equal(isWriteOperation(`query { a(x: "it's") { id } }`), true, "inside a double-quoted string");
  assert.equal(isWriteOperation(`query { a } # it's a comment`), true, "inside a comment");
  assert.equal(isWriteOperation(`query { a(x: """it's""") { id } }`), true, "inside a block string");
});

test("monday client: refuses the lenient-parser documents before the network or the budget", async () => {
  for (const document of [
    A1_RAW_NEWLINE_IN_A_STRING,
    A2_LONE_CR_ENDS_A_COMMENT,
    A3_ESCAPED_TRIPLE_QUOTE,
    S1_SINGLE_QUOTED_STRING,
  ]) {
    const f = fakeFetch([]);
    const l = ledger();
    const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep });
    await assert.rejects(monday.query(document), (e: unknown) => e instanceof MondayError && e.code === "WRITE_REFUSED");
    assert.equal(f.sent.length, 0);
    assert.equal(l.claims, 0);
  }
});

test("monday client: the words in a comment, or inside longer names, aren't writes", () => {
  assert.equal(isWriteOperation("query { a } # no mutation or subscription here"), false);
  assert.equal(isWriteOperation("query { subscribers { id } mutations_count my_subscription }"), false);
});

test("monday client: refuses a write that hides in a comment or behind a comma, before the network or the budget", async () => {
  for (const document of [
    "mutation,{ delete_item(item_id: 1) { id } }",
    '# "\nmutation { delete_item(item_id: 1) { id } } # "',
    "subscription,{ x }",
  ]) {
    const f = fakeFetch([]);
    const l = ledger();
    const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep });
    await assert.rejects(monday.query(document), (e: unknown) => e instanceof MondayError && e.code === "WRITE_REFUSED");
    assert.equal(f.sent.length, 0);
    assert.equal(l.claims, 0);
  }
});

test("monday client: complexity goes into the operation, not into a comment or string before it", () => {
  assert.equal(
    withComplexity("# the { items }\nquery { boards { id } }"),
    "# the { items }\nquery { complexity { query after reset_in_x_seconds }  boards { id } }",
  );
  assert.equal(
    withComplexity('query ($s: String = "{") { boards { id } }'),
    'query ($s: String = "{") { complexity { query after reset_in_x_seconds }  boards { id } }',
  );
  assert.equal(
    withComplexity("# complexity { query }\nquery { boards { id } }"),
    "# complexity { query }\nquery { complexity { query after reset_in_x_seconds }  boards { id } }",
  );
  // The guard refuses a lone CR, but withComplexity still reads a comment as the spec does: it ends at the CR.
  assert.equal(
    withComplexity("# the { items\rquery { boards { id } }"),
    "# the { items\rquery { complexity { query after reset_in_x_seconds }  boards { id } }",
  );
});

test("monday client: complexity goes into the operation's selection set, past an object in a variable default or a directive", () => {
  assert.equal(
    withComplexity("query ($qp: ItemsQuery = { rules: [] }) { items_page(query_params: $qp) { cursor } }"),
    "query ($qp: ItemsQuery = { rules: [] }) { complexity { query after reset_in_x_seconds }  items_page(query_params: $qp) { cursor } }",
  );
  assert.equal(
    withComplexity("query Q @tag(info: { a: 1 }) { boards { id } }"),
    "query Q @tag(info: { a: 1 }) { complexity { query after reset_in_x_seconds }  boards { id } }",
  );
  // A block string that holds an escaped triple quote and braces reads as one string, so none of its braces count.
  assert.equal(
    withComplexity('"""A { \\""" { description """ query { boards { id } }'),
    '"""A { \\""" { description """ query { complexity { query after reset_in_x_seconds }  boards { id } }',
  );
});

// Beyond the brief too: the call budget and the retries, which its tests only touch at the edges.

test("monday client: counts each call before sending it", async () => {
  const events: string[] = [];
  const counting: MondayLedger = { claim: async () => { events.push("claim"); return true; }, dailyLimitHit: async () => {} };
  const send = (async () => {
    events.push("send");
    return new Response(JSON.stringify({ data: { me: { id: "1" }, ...complexity() } }));
  }) as unknown as typeof fetch;
  const monday = createMondayClient({ token: "t", ledger: counting, fetch: send, sleep });
  await monday.query("query { me { id } }");
  assert.deepEqual(events, ["claim", "send"]);
});

test("monday client: if the ledger can't count a call, nothing is sent", async () => {
  const f = fakeFetch([]);
  const broken: MondayLedger = { claim: async () => { throw new Error("database unreachable"); }, dailyLimitHit: async () => {} };
  const monday = createMondayClient({ token: "t", ledger: broken, fetch: f.fn, sleep });
  await assert.rejects(monday.query("query { me { id } }"), /database unreachable/);
  assert.equal(f.sent.length, 0);
});

test("monday client: gives up after its retries, with every attempt counted and backed off", async () => {
  sleeps.length = 0;
  const l = ledger();
  const f = fakeFetch([{ status: 503, body: {} }, { status: 503, body: {} }, { status: 503, body: {} }]);
  const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep, maxRetries: 2 });
  await assert.rejects(monday.query("query { me { id } }"), (e: unknown) => e instanceof MondayError && e.status === 503);
  assert.equal(f.sent.length, 3);
  assert.equal(l.claims, 3);
  assert.deepEqual(sleeps, [1000, 2000]);
});

test("monday client: retries a dropped connection, then says Monday is unreachable", async () => {
  sleeps.length = 0;
  const l = ledger();
  let tries = 0;
  const down = (async () => { tries += 1; throw new Error("socket hang up"); }) as unknown as typeof fetch;
  const monday = createMondayClient({ token: "t", ledger: l, fetch: down, sleep, maxRetries: 1 });
  // The error's own message isn't fetch's, so only its name is repeated (a message could quote a token).
  await assert.rejects(monday.query("query { me { id } }"), (e: unknown) =>
    e instanceof MondayError && e.code === "NETWORK" && e.message === "Monday is unreachable: Error");
  assert.equal(tries, 2);
  assert.equal(l.claims, 2);
  assert.deepEqual(sleeps, [1000]);
});

test("monday client: waits for Retry-After when a rate limit comes with no error body", async () => {
  sleeps.length = 0;
  const f = fakeFetch([
    { status: 429, body: {}, headers: { "retry-after": "5" } },
    { body: { data: { me: { id: "1" }, ...complexity() } } },
  ]);
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep });
  await monday.query("query { me { id } }");
  assert.deepEqual(sleeps, [5000]);
});

// Fix round 1: a request that hangs, an answer that is cut off or isn't JSON, why a network failure happened, and
// the retry branches the earlier tests don't reach.

/** A fetch that does what each step says, one per request: return a Response, or throw. Records what it was sent. */
function scripted(steps: ((init: RequestInit) => Response | Promise<Response>)[]) {
  const sent: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    const step = steps.shift();
    if (!step) throw new Error("no scripted step left");
    return step(init);
  }) as unknown as typeof fetch;
  return { fn, sent };
}
const jsonResponse = (body: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });
const answer = () => jsonResponse({ data: { me: { id: "1" }, ...complexity() } });
const timeoutError = () => new DOMException("The operation was aborted due to timeout", "TimeoutError");
/** What Node's fetch throws when the connection is cut mid-body: "terminated", caused by a socket error. */
const terminated = () =>
  Object.assign(new TypeError("terminated"), { cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }) });
/** A 200 whose body fails part-way, as when the connection is cut or the timeout fires while it is read. */
const cutOff = () => new Response(new ReadableStream({ start: (c) => c.error(terminated()) }), { status: 200 });
const notJson = (status = 200) => new Response("<html>Bad gateway</html>", { status });

test("monday client: a request that times out is retried, then succeeds", async () => {
  sleeps.length = 0;
  const l = ledger();
  const f = scripted([() => { throw timeoutError(); }, answer]);
  const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep });
  await monday.query("query { me { id } }");
  assert.equal(f.sent.length, 2);
  assert.equal(l.claims, 2, "the retry is a second call");
  assert.deepEqual(sleeps, [1000]);
});

test("monday client: a 200 whose body can't be read is retried like a dropped connection", async () => {
  sleeps.length = 0;
  const l = ledger();
  const f = scripted([cutOff, answer]);
  const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep });
  await monday.query("query { me { id } }");
  assert.equal(f.sent.length, 2);
  assert.equal(l.claims, 2);
  assert.deepEqual(sleeps, [1000]);
});

test("monday client: a body that can't be read on any attempt ends as a network failure", async () => {
  sleeps.length = 0;
  const f = scripted([cutOff, cutOff]);
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep, maxRetries: 1 });
  await assert.rejects(monday.query("query { me { id } }"), (e: unknown) =>
    e instanceof MondayError && e.code === "NETWORK" && /terminated/.test(e.message));
  assert.equal(f.sent.length, 2);
  assert.deepEqual(sleeps, [1000]);
});

test("monday client: every request carries its own AbortSignal, so a retry isn't born timed out", async () => {
  const f = scripted([() => { throw timeoutError(); }, answer]);
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep });
  await monday.query("query { me { id } }");
  const [first, second] = f.sent.map((s) => s.init.signal);
  assert.ok(first instanceof AbortSignal);
  assert.ok(second instanceof AbortSignal);
  assert.notEqual(first, second);
});

test("monday client: the request timeout is 30 s unless timeoutMs says otherwise", async (t) => {
  const asked: number[] = [];
  const real = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, "timeout", (ms: number) => { asked.push(ms); return real(ms); });
  const f = scripted([answer, answer]);
  await createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep }).query("query { me { id } }");
  await createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep, timeoutMs: 1234 }).query("query { me { id } }");
  assert.deepEqual(asked, [30_000, 1234]);
});

test("monday client: a request that outlives timeoutMs is aborted by its signal, then retried", async () => {
  sleeps.length = 0;
  const hangs = (init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
  const f = scripted([hangs, answer]);
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep, timeoutMs: 20 });
  // If the signal never fires, fail in two seconds rather than wait out the 30 s default.
  let giveUp: ReturnType<typeof setTimeout> | undefined;
  const never = new Promise<never>((_resolve, reject) => {
    giveUp = setTimeout(() => reject(new Error("the request was never aborted")), 2000);
  });
  try {
    await Promise.race([monday.query("query { me { id } }"), never]);
  } finally {
    clearTimeout(giveUp);
  }
  assert.equal(f.sent.length, 2);
  assert.deepEqual(sleeps, [1000]);
});

test("monday client: a network failure says why, and keeps the original error as its cause", async () => {
  const wrapped = (code: string, message: string) =>
    Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(message), { code }) });
  const cases: [string, unknown, RegExp][] = [
    ["a reset connection", wrapped("ECONNRESET", "read ECONNRESET"), /^Monday is unreachable: fetch failed \(ECONNRESET\)$/],
    ["an unknown host", wrapped("ENOTFOUND", "getaddrinfo ENOTFOUND host.example"), /^Monday is unreachable: fetch failed \(ENOTFOUND\)$/],
    ["a cut-off body", terminated(), /^Monday is unreachable: terminated \(UND_ERR_SOCKET\)$/],
    ["a timeout, whose own numeric code is not shown", timeoutError(), /^Monday is unreachable: The operation was aborted due to timeout \(TimeoutError\)$/],
    ["a message that isn't fetch's own, which isn't repeated", new Error("socket hang up"), /^Monday is unreachable: Error$/],
  ];
  for (const [what, failure, message] of cases) {
    const f = scripted([() => { throw failure; }]);
    const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep, maxRetries: 0 });
    await assert.rejects(
      monday.query("query { me { id } }"),
      (e: unknown) => e instanceof MondayError && e.code === "NETWORK" && message.test(e.message) && e.cause === failure,
      what,
    );
  }
});

test("monday client: a 2xx answer that isn't JSON is retried, then reported as a network failure", async () => {
  sleeps.length = 0;
  const retried = scripted([() => notJson(), answer]);
  await createMondayClient({ token: "t", ledger: ledger(), fetch: retried.fn, sleep }).query("query { me { id } }");
  assert.equal(retried.sent.length, 2);
  assert.deepEqual(sleeps, [1000]);

  const l = ledger();
  const stuck = scripted([() => notJson(), () => notJson()]);
  await assert.rejects(
    createMondayClient({ token: "t", ledger: l, fetch: stuck.fn, sleep, maxRetries: 1 }).query("query { me { id } }"),
    (e: unknown) => e instanceof MondayError && e.code === "NETWORK" && /wasn't JSON/.test(e.message),
  );
  assert.equal(stuck.sent.length, 2);
  assert.equal(l.claims, 2);
});

test("monday client: a body that is JSON but not Monday's shape still isn't retried", async () => {
  const f = scripted([() => jsonResponse({ unexpected: true })]);
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep });
  await assert.rejects(monday.query("query { me { id } }"), (e: unknown) =>
    e instanceof MondayError && e.code === null && e.status === 200 && /HTTP 200/.test(e.message));
  assert.equal(f.sent.length, 1);
});

test("monday client: a non-JSON answer on an error status is judged by its status", async () => {
  sleeps.length = 0;
  const gateway = scripted([() => notJson(502), answer]);
  await createMondayClient({ token: "t", ledger: ledger(), fetch: gateway.fn, sleep }).query("query { me { id } }");
  assert.equal(gateway.sent.length, 2, "a 502 page is retried");
  assert.deepEqual(sleeps, [1000]);

  const forbidden = scripted([() => notJson(403)]);
  await assert.rejects(
    createMondayClient({ token: "t", ledger: ledger(), fetch: forbidden.fn, sleep }).query("query { me { id } }"),
    (e: unknown) => e instanceof MondayError && e.status === 403 && e.code === null,
  );
  assert.equal(forbidden.sent.length, 1, "a 403 page is not");
});

test("monday client: retry_in_seconds from the error wins over the Retry-After header", async () => {
  sleeps.length = 0;
  const f = fakeFetch([
    {
      status: 429,
      body: { errors: [{ message: "Slow down", extensions: { code: "RATE_LIMIT_EXCEEDED", retry_in_seconds: 2 } }] },
      headers: { "retry-after": "9" },
    },
    { body: { data: { me: { id: "1" }, ...complexity() } } },
  ]);
  await createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep }).query("query { me { id } }");
  assert.deepEqual(sleeps, [2000]);
});

test("monday client: the wait for the minute budget is capped at 65 s", async () => {
  sleeps.length = 0;
  const f = fakeFetch([
    { body: { data: { a: 1, complexity: { query: 1000, after: 500_000, reset_in_x_seconds: 600 } } } },
    { body: { data: { b: 2, ...complexity() } } },
  ]);
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep });
  await monday.query("query { a }");
  await monday.query("query { b }");
  assert.deepEqual(sleeps, [65_000]);
});

test("monday client: a retry wait is capped at 65 s, whether Monday names it in the error or in Retry-After", async () => {
  sleeps.length = 0;
  const f = fakeFetch([
    { status: 429, body: { errors: [{ message: "Slow down", extensions: { code: "RATE_LIMIT_EXCEEDED", retry_in_seconds: 600 } }] } },
    { status: 429, body: {}, headers: { "retry-after": "600" } },
    { body: { data: { me: { id: "1" }, ...complexity() } } },
  ]);
  await createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep }).query("query { me { id } }");
  assert.deepEqual(sleeps, [65_000, 65_000]);
});

test("monday client: the backoff doubles from 1 s and stops growing at 65 s", async () => {
  sleeps.length = 0;
  const f = fakeFetch(Array.from({ length: 9 }, () => ({ status: 503, body: {} })));
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep, maxRetries: 8 });
  await assert.rejects(monday.query("query { me { id } }"), (e: unknown) => e instanceof MondayError && e.status === 503);
  assert.deepEqual(sleeps, [1000, 2000, 4000, 8000, 16_000, 32_000, 64_000, 65_000]);
});

test("monday client: the older error body, { error_code, error_message, retry_in_seconds }, is read too", async () => {
  sleeps.length = 0;
  const retried = fakeFetch([
    { body: { error_code: "ComplexityException", error_message: "Query is too complex", retry_in_seconds: 4 } },
    { body: { data: { me: { id: "1" }, ...complexity() } } },
  ]);
  await createMondayClient({ token: "t", ledger: ledger(), fetch: retried.fn, sleep }).query("query { me { id } }");
  assert.deepEqual(sleeps, [4000]);

  const refused = fakeFetch([{ body: { error_code: "InvalidUserIdException", error_message: "No such user" } }]);
  await assert.rejects(
    createMondayClient({ token: "t", ledger: ledger(), fetch: refused.fn, sleep }).query("query { me { id } }"),
    (e: unknown) => e instanceof MondayError && e.code === "InvalidUserIdException" && e.message === "No such user",
  );
  assert.equal(refused.sent.length, 1);
});

test("monday client: a daily limit is recognised from its message alone, with no error code", async () => {
  for (const body of [{ errors: [{ message: "Daily limit exceeded for this account" }] }, { error_message: "Daily limit exceeded" }]) {
    const f = fakeFetch([{ status: 429, body }]);
    const l = ledger();
    const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep });
    await assert.rejects(monday.query("query { me { id } }"), MondayDailyLimitError);
    assert.equal(f.sent.length, 1, "no retry");
    assert.equal(l.limitHits, 1, "and it is recorded for the rest of the day");
  }
});

// Fix round 3: the run's time limit, timeoutMs checked once, and refusals that say which rule fired.

/** A clock the test moves by hand. Its sleep moves it too, so a wait that is taken shows in the time. */
function clock(start = 1_000_000) {
  let t = start;
  return {
    start,
    now: () => t,
    sleep: async (ms: number) => { sleeps.push(ms); t += ms; },
  };
}

test("monday client: a deadline that has passed stops the call before it is claimed or sent", async () => {
  for (const deadline of [new Date(999_999), new Date(1_000_000)]) {
    const c = clock(); // 1_000_000: the deadline is already past, and exactly now
    const f = scripted([answer]);
    const l = ledger();
    const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep: c.sleep, now: c.now, deadline });
    await assert.rejects(monday.query("query { me { id } }"), (e: unknown) =>
      e instanceof MondayDeadlineError && e instanceof MondayError && e.code === "DEADLINE");
    assert.equal(f.sent.length, 0, "nothing is sent");
    assert.equal(l.claims, 0, "nothing is claimed");
    assert.equal(monday.stats.calls, 0);
  }
});

test("monday client: a rate limit whose wait would end past the deadline is not waited for", async () => {
  sleeps.length = 0;
  const c = clock();
  const l = ledger();
  const f = fakeFetch([
    { status: 429, body: { errors: [{ message: "Slow down", extensions: { code: "RATE_LIMIT_EXCEEDED", retry_in_seconds: 30 } }] } },
    { body: { data: { me: { id: "1" }, ...complexity() } } },
  ]);
  const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep: c.sleep, now: c.now, deadline: new Date(c.start + 10_000) });
  await assert.rejects(monday.query("query { me { id } }"), MondayDeadlineError);
  assert.deepEqual(sleeps, [], "no sleep");
  assert.equal(f.sent.length, 1);
  assert.equal(l.claims, 1);
});

test("monday client: a minute budget that resets after the deadline is not waited for", async () => {
  sleeps.length = 0;
  const c = clock();
  const l = ledger();
  const f = fakeFetch([
    { body: { data: { a: 1, complexity: { query: 1000, after: 500_000, reset_in_x_seconds: 30 } } } },
    { body: { data: { b: 2, ...complexity() } } },
  ]);
  const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep: c.sleep, now: c.now, deadline: new Date(c.start + 10_000) });
  await monday.query("query { a }");
  await assert.rejects(monday.query("query { b }"), MondayDeadlineError);
  assert.deepEqual(sleeps, [], "no sleep");
  assert.equal(f.sent.length, 1);
  assert.equal(l.claims, 1);
});

test("monday client: a backoff that would end at or past the deadline is not waited for, one that ends before it is", async () => {
  sleeps.length = 0;
  const atTheDeadline = clock();
  const l = ledger();
  const f = scripted([() => { throw timeoutError(); }, answer]);
  // The first backoff is 1000 ms: it would end exactly at the deadline, when nothing more can be sent.
  const stopped = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep: atTheDeadline.sleep, now: atTheDeadline.now, deadline: new Date(atTheDeadline.start + 1000) });
  await assert.rejects(stopped.query("query { me { id } }"), MondayDeadlineError);
  assert.deepEqual(sleeps, []);
  assert.equal(f.sent.length, 1);
  assert.equal(l.claims, 1);

  const beforeTheDeadline = clock();
  const g = scripted([() => { throw timeoutError(); }, answer]);
  const carriedOn = createMondayClient({ token: "t", ledger: ledger(), fetch: g.fn, sleep: beforeTheDeadline.sleep, now: beforeTheDeadline.now, deadline: new Date(beforeTheDeadline.start + 1001) });
  await carriedOn.query("query { me { id } }");
  assert.deepEqual(sleeps, [1000]);
  assert.equal(g.sent.length, 2);
});

test("monday client: each attempt's timeout is capped by the deadline, but never below one second", async (t) => {
  const asked: number[] = [];
  const real = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, "timeout", (ms: number) => { asked.push(ms); return real(ms); });
  const cases: { left: number; timeoutMs?: number; nowOffset?: number; want: number; why: string }[] = [
    { left: 10_000, want: 10_000, why: "the time left, when that is less than timeoutMs" },
    { left: 100_000, want: 30_000, why: "timeoutMs, when the deadline is further off" },
    { left: 200, want: 1000, why: "one second at least, when the deadline is nearly here" },
    { left: 200, timeoutMs: 400, want: 400, why: "a timeoutMs shorter than that is not raised" },
    { left: 10_000, nowOffset: 0.5, want: 10_000, why: "a whole number of milliseconds, even from a clock that isn't one" },
  ];
  for (const k of cases) {
    const c = clock();
    const f = scripted([answer]);
    const monday = createMondayClient({
      token: "t",
      ledger: ledger(),
      fetch: f.fn,
      sleep: c.sleep,
      now: () => c.now() + (k.nowOffset ?? 0),
      deadline: new Date(c.start + k.left),
      ...(k.timeoutMs === undefined ? {} : { timeoutMs: k.timeoutMs }),
    });
    asked.length = 0;
    await monday.query("query { me { id } }");
    assert.deepEqual(asked, [k.want], k.why);
  }
});

test("monday client: a wait that fits before the deadline is taken, and the next attempt gets only the time that is left", async (t) => {
  sleeps.length = 0;
  const asked: number[] = [];
  const real = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, "timeout", (ms: number) => { asked.push(ms); return real(ms); });
  const c = clock();
  const f = fakeFetch([
    { status: 429, body: { errors: [{ message: "Slow down", extensions: { code: "RATE_LIMIT_EXCEEDED", retry_in_seconds: 3 } }] } },
    { body: { data: { me: { id: "1" }, ...complexity() } } },
  ]);
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep: c.sleep, now: c.now, deadline: new Date(c.start + 12_000) });
  await monday.query("query { me { id } }");
  assert.deepEqual(sleeps, [3000]);
  assert.deepEqual(asked, [12_000, 9000]);
});

test("monday client: timeoutMs is checked once, when the client is made", () => {
  const make = (timeoutMs: unknown) => () => createMondayClient({ token: "t", ledger: ledger(), timeoutMs: timeoutMs as number });
  // Not whole, not positive, not a number, or more than a timer can hold (above that, Node sets it to 1 ms).
  for (const bad of [1.5, -1, 0, NaN, Infinity, 2 ** 31]) {
    assert.throws(make(bad), (e: unknown) => e instanceof RangeError && /timeoutMs/.test(e.message), `timeoutMs ${bad}`);
  }
  for (const bad of ["30000", {}, true]) {
    assert.throws(make(bad), (e: unknown) => e instanceof TypeError && /timeoutMs/.test(e.message), `timeoutMs ${String(bad)}`);
  }
  for (const fine of [1, 30_000, 2 ** 31 - 1]) assert.doesNotThrow(make(fine), `timeoutMs ${fine}`);
});

test("monday client: a deadline that isn't a valid Date is refused when the client is made", () => {
  for (const bad of [new Date(NaN), 1_000_000, "soon"]) {
    assert.throws(
      () => createMondayClient({ token: "t", ledger: ledger(), deadline: bad as unknown as Date }),
      (e: unknown) => e instanceof TypeError && /deadline/.test(e.message),
      `deadline ${String(bad)}`,
    );
  }
});

test("monday client: a token with a line break, a NUL or a space is refused when the client is made, quoting none of it", () => {
  const f = scripted([]);
  for (const token of ["test-token-abc\ndef", "test-token-abc\u0000def", "test-token-abc def"]) {
    assert.throws(
      () => createMondayClient({ token, ledger: ledger(), fetch: f.fn, sleep }),
      (e: unknown) =>
        e instanceof TypeError &&
        e.message === "MONDAY_API_TOKEN has a character a token can't have, such as a line break or a space. Copy it again." &&
        !e.message.includes("test-token-abc") &&
        !e.message.includes("def"),
      JSON.stringify(token),
    );
  }
  assert.equal(f.sent.length, 0, "nothing is sent");
});

/** The error a document is refused with. */
async function refusalOf(document: string): Promise<MondayError> {
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: scripted([]).fn, sleep });
  try {
    await monday.query(document);
  } catch (e) {
    return e as MondayError;
  }
  throw new Error(`the document was not refused: ${JSON.stringify(document)}`);
}

test("monday client: a refusal says a mutation or subscription was found, when one was", async () => {
  const e = await refusalOf("mutation { delete_item(item_id: 1) { id } }");
  assert.equal(e.code, "WRITE_REFUSED");
  assert.match(e.message, /this document contains mutation or subscription/);
  assert.doesNotMatch(e.message, /holds syntax/);
  // A real write is what it says, even when the document also holds syntax the guard refuses.
  const both = await refusalOf(`subscription { x } # it's`);
  assert.equal(both.code, "WRITE_REFUSED");
  assert.match(both.message, /contains mutation or subscription/);
  assert.doesNotMatch(both.message, /holds syntax/);
});

test("monday client: a refusal for syntax the guard won't accept names the rule, under the same code", async () => {
  const cases: [string, string, RegExp][] = [
    ["a single quote", `query { a(x: 'text') { id } }`, /this document holds syntax the read-only guard refuses \(a single quote\)\./],
    ["a lone CR", "query { a }\r", /holds syntax the read-only guard refuses \(a lone CR\)\./],
    ["a double quote that opens no string", `query { a(x: "never closed) { id } }`, /refuses \(a double quote that opens no string\)\./],
    ["an escaped triple quote", `query { a } # \\""" in a comment`, /refuses \(an escaped triple quote\)\./],
  ];
  for (const [rule, document, message] of cases) {
    const e = await refusalOf(document);
    assert.equal(e.code, "WRITE_REFUSED", rule);
    assert.match(e.message, message, rule);
    assert.doesNotMatch(e.message, /contains mutation or subscription/, rule);
  }
  // The other line breaks (LS, PS, NEL, VT, FF) are named by their code point, four hex digits.
  for (const [code, hex] of [[0x2028, "2028"], [0x2029, "2029"], [0x85, "0085"], [0x0b, "000B"], [0x0c, "000C"]] as const) {
    const e = await refusalOf(`# note${String.fromCharCode(code)}query { a }`);
    assert.equal(e.code, "WRITE_REFUSED", `U+${hex}`);
    assert.match(e.message, new RegExp(`refuses \\(a line break other than LF or CRLF, U\\+${hex}\\)\\.$`), `U+${hex}`);
  }
  // Two rules at once are both named.
  const two = await refusalOf(`query { a(x: 'text') { id } }\r`);
  assert.match(two.message, /refuses \(a single quote; a lone CR\)\./);
});
