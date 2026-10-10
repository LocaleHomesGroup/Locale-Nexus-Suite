import { checkedToken, failureReason } from "../limits";

/**
 * The only way this repo talks to Monday, and it only reads: query() refuses
 * any document containing a mutation or subscription before the network or the
 * call budget is touched. Every request:
 *   - pins API-Version 2026-10;
 *   - asks for `complexity` (free when bundled) and waits for the minute budget
 *     to reset when the last answer left it low;
 *   - is counted against the day's cap first (ledger.claim());
 *   - is cut off if Monday hasn't answered in full within `timeoutMs` (30 s);
 *   - never outlasts the run's `deadline`: nothing is claimed or sent at or after
 *     it, no wait is started that would end at or past it, and each attempt's
 *     timeout is capped by the time left;
 *   - is retried on rate limits, server errors, timeouts and answers that are
 *     cut off or aren't JSON, and stops cold on DAILY_LIMIT_EXCEEDED.
 */
export const MONDAY_API_URL = "https://api.monday.com/v2";
export const MONDAY_API_VERSION = "2026-10";

export interface MondayLedger {
  /** Counts one call before it is sent. False: the day's cap is reached, or Monday's limit was hit today, so don't send. */
  claim(): Promise<boolean>;
  /** Monday answered DAILY_LIMIT_EXCEEDED: refuse every claim until 00:00 UTC. */
  dailyLimitHit(): Promise<void>;
}

export interface Complexity {
  query: number;
  after: number;
  resetInSeconds: number;
}

export interface MondayClient {
  query<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
  readonly stats: { calls: number; complexity: number; lastComplexity: Complexity | null };
}

export class MondayError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
    readonly status: number | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MondayError";
  }
}

/** Monday refused: the account's daily limit is spent. Nothing more until 00:00 UTC. */
export class MondayDailyLimitError extends MondayError {}

/** Our own cap (MONDAY_DAILY_CALL_CAP) is reached. Nothing more until 00:00 UTC. */
export class MondayCapReachedError extends MondayError {}

/** The run's time limit was reached: the client sends nothing more, and the pass ends partial. */
export class MondayDeadlineError extends MondayError {}

export interface MondayClientOptions {
  token: string;
  ledger: MondayLedger;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  /**
   * How long one request may take, answer included, before it is abandoned and retried. Default 30 s. A whole
   * number of milliseconds from 1 to 2,147,483,647 (the longest a timer holds), checked when the client is made.
   */
  timeoutMs?: number;
  /**
   * The run's time limit. At or after it nothing is claimed or sent, a wait that would end at or past it is not
   * started, and each attempt's timeout is capped by the time left (but is at least a second). Reaching it throws
   * MondayDeadlineError. Without one, none of this applies.
   */
  deadline?: Date;
  /** The clock, in milliseconds since the epoch. For tests. Defaults to Date.now. */
  now?: () => number;
}

/**
 * Strings and comments, found in one left-to-right pass the way GraphQL reads them. Blanking one kind at a
 * time is unsafe: a quote inside a comment would pair with a later quote and hide a mutation between them.
 * A string stays on its line; a block string ends at the first triple quote that isn't escaped as \""".
 */
const STRINGS_AND_COMMENTS = /"""(?:\\"""|[\s\S])*?"""|"(?:\\.|[^"\\\n\r])*"|#[^\n\r]*/g;

/** The document with its strings and comments blanked out, at the same length so indexes still line up. */
function blankStringsAndComments(document: string): string {
  return document.replace(STRINGS_AND_COMMENTS, (found) => " ".repeat(found.length));
}

/**
 * Why the guard refuses a document, worded for "this document ...", or null when it allows it. A real mutation or
 * subscription is refused as one. The lexing above is the spec's, but a lenient parser may disagree about where a
 * string or a comment ends, and run what the spec calls part of one. So the guard fails closed, and also refuses
 * the syntax below, naming each rule that fired. Nothing we send needs any of it: user values reach Monday as JSON
 * variables, never inline in a document.
 *   - a `"` left once strings and comments are blanked: it opened no valid string, so a spec server rejects the
 *     document anyway (a raw newline in a string, an unterminated string);
 *   - a single quote (') anywhere: spec GraphQL has no single-quoted strings, and a lenient parser that accepts them
 *     could read a `"` inside one differently from our lexer, and so run what ours hides in a string or a comment;
 *   - an escaped triple quote (\"""): not every parser reads it as an escape;
 *   - a lone CR, or a VT, FF, NEL, LS or PS: lexers differ on where a comment ends.
 */
function refusalReason(document: string): string | null {
  const code = blankStringsAndComments(document);
  // The bare word, not just `mutation {`: GraphQL treats commas as whitespace, so `mutation,{ ... }` is a write too.
  if (/\b(?:mutation|subscription)\b/.test(code)) return "contains mutation or subscription";
  const syntax: string[] = [];
  if (code.includes('"')) syntax.push("a double quote that opens no string");
  if (document.includes("'")) syntax.push("a single quote");
  if (document.includes('\\"""')) syntax.push("an escaped triple quote");
  if (/\r(?!\n)/.test(document)) syntax.push("a lone CR");
  // (\p{Zl} and \p{Zp} are the line and paragraph separators, U+2028 and U+2029.)
  const lineBreak = /[\v\f\u0085\p{Zl}\p{Zp}]/u.exec(document)?.[0];
  if (lineBreak) {
    syntax.push(`a line break other than LF or CRLF, U+${lineBreak.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`);
  }
  return syntax.length > 0 ? `holds syntax the read-only guard refuses (${syntax.join("; ")})` : null;
}

/** True when the guard refuses a document: it contains a mutation or subscription, or syntax a lenient parser could read as one. */
export function isWriteOperation(document: string): boolean {
  return refusalReason(document) !== null;
}

/**
 * Adds `complexity { ... }` to the operation's top-level selection, unless it asks already. That selection set
 * is the first `{` outside strings, comments and parentheses, so an object in a variable default or a directive
 * argument doesn't count. Keep fragment definitions after the operation.
 */
export function withComplexity(document: string): string {
  const code = blankStringsAndComments(document);
  if (/\bcomplexity\s*\{/.test(code)) return document;
  let depth = 0;
  for (let at = 0; at < code.length; at++) {
    if (code[at] === "(") depth += 1;
    else if (code[at] === ")") depth -= 1;
    else if (code[at] === "{" && depth === 0) {
      return `${document.slice(0, at + 1)} complexity { query after reset_in_x_seconds } ${document.slice(at + 1)}`;
    }
  }
  return document;
}

interface MondayBody {
  data?: Record<string, unknown> & { complexity?: { query: number; after: number; reset_in_x_seconds: number } };
  errors?: { message?: string; extensions?: { code?: string; retry_in_seconds?: number } }[];
  error_code?: string;
  error_message?: string;
  retry_in_seconds?: number;
}

function firstError(body: MondayBody | null): { code: string | null; message: string; retryIn: number | null } | null {
  if (!body) return null;
  const e = body.errors?.[0];
  if (e) return { code: e.extensions?.code ?? null, message: e.message ?? "Monday error", retryIn: e.extensions?.retry_in_seconds ?? null };
  if (body.error_code || body.error_message) {
    return { code: body.error_code ?? null, message: body.error_message ?? body.error_code ?? "Monday error", retryIn: body.retry_in_seconds ?? null };
  }
  return null;
}

const RETRYABLE = new Set([
  "COMPLEXITY_BUDGET_EXHAUSTED",
  "ComplexityException",
  "RATE_LIMIT_EXCEEDED",
  "RateLimitExceeded",
  "IP_RATE_LIMIT_EXCEEDED",
  "CONCURRENCY_LIMIT_EXCEEDED",
  "maxConcurrencyExceeded",
  "INTERNAL_SERVER_ERROR",
]);
const MAX_WAIT_MS = 65_000;
/** An attempt near the deadline still gets this long, so the last call has a fair chance (and can overrun by about this much). */
const MIN_ATTEMPT_MS = 1_000;
/** The longest delay a timer holds. Above it Node sets AbortSignal.timeout to 1 ms, so every request would time out at once. */
const MAX_TIMEOUT_MS = 2_147_483_647;
/** Below this many points left in the minute, wait for the reset before the next request. */
const LOW_BUDGET = 1_000_000;
const backoff = (attempt: number) => Math.min(MAX_WAIT_MS, 1000 * 2 ** attempt);

export function createMondayClient(opts: MondayClientOptions): MondayClient {
  const fetchFn = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxRetries = opts.maxRetries ?? 4;
  // A line break, a NUL or a space in the token would make fetch throw an error that quotes it: refuse it here instead.
  // What is sent is the checked token, trimmed.
  const token = checkedToken(opts.token, "MONDAY_API_TOKEN");
  /** Every error this client throws is made here, with any copy of the token in its text replaced, as the HubSpot client does. */
  const fail = <E extends MondayError>(
    Kind: new (message: string, code?: string | null, status?: number | null, options?: ErrorOptions) => E,
    message: string,
    code: string | null = null,
    status: number | null = null,
    options?: ErrorOptions,
  ): E => new Kind(message.split(token).join("[token]"), code, status, options);
  // Checked once, here, so that building an attempt's AbortSignal can never throw after a call has been claimed.
  if (opts.timeoutMs !== undefined && opts.timeoutMs !== null) {
    if (typeof opts.timeoutMs !== "number") {
      throw new TypeError(`timeoutMs must be a number of milliseconds, not ${typeof opts.timeoutMs}`);
    }
    if (!Number.isInteger(opts.timeoutMs) || opts.timeoutMs < 1 || opts.timeoutMs > MAX_TIMEOUT_MS) {
      throw new RangeError(`timeoutMs must be a whole number of milliseconds from 1 to ${MAX_TIMEOUT_MS}, not ${opts.timeoutMs}`);
    }
  }
  if (opts.deadline !== undefined && opts.deadline !== null) {
    if (!(opts.deadline instanceof Date) || !Number.isFinite(opts.deadline.getTime())) {
      throw new TypeError("deadline must be a valid Date");
    }
  }
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const deadlineMs = opts.deadline?.getTime();
  const now = opts.now ?? Date.now;
  const stats: MondayClient["stats"] = { calls: 0, complexity: 0, lastComplexity: null };

  /** Throws once the run's time limit is reached. Called before every claim, so nothing is counted or sent after it. */
  function checkDeadline(): void {
    if (deadlineMs !== undefined && now() >= deadlineMs) {
      throw fail(MondayDeadlineError, "The run's time limit was reached, so Monday is not called again.", "DEADLINE");
    }
  }

  /**
   * Sleeps for `ms`, unless the wait would end at or past the deadline: then it throws instead. Nothing could be sent
   * once the wait was over, and a pass that ends partial is logged, where one killed at the platform's limit is not.
   */
  async function wait(ms: number, what: string): Promise<void> {
    if (deadlineMs !== undefined && now() + ms >= deadlineMs) {
      throw fail(
        MondayDeadlineError,
        `The run's time limit was reached: waiting ${Math.ceil(ms / 1000)} s for ${what} would end past it.`,
        "DEADLINE",
      );
    }
    await sleep(ms);
  }

  /** One attempt may take timeoutMs, or the time left before the deadline if that is less, but at least a second. */
  function attemptTimeoutMs(): number {
    if (deadlineMs === undefined) return timeoutMs;
    return Math.min(timeoutMs, Math.max(MIN_ATTEMPT_MS, Math.ceil(deadlineMs - now())));
  }

  /** A request that failed in transit (no answer, a timeout, an answer cut off or garbled): wait and go again, or give up as NETWORK once the retries are spent. */
  async function retryOrGiveUp(attempt: number, reason: string, cause?: unknown): Promise<void> {
    if (attempt >= maxRetries) {
      throw fail(MondayError, `Monday is unreachable: ${reason}`, "NETWORK", null, cause === undefined ? undefined : { cause });
    }
    await wait(backoff(attempt), "the backoff");
  }

  async function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
    const refusal = refusalReason(document);
    if (refusal !== null) {
      throw fail(MondayError, `Refused: the mirror only reads Monday, and this document ${refusal}.`, "WRITE_REFUSED");
    }
    const body = JSON.stringify({ query: withComplexity(document), variables });
    for (let attempt = 0; ; attempt++) {
      const last = stats.lastComplexity;
      if (last && last.after < LOW_BUDGET && last.resetInSeconds > 0) {
        await wait(Math.min(MAX_WAIT_MS, last.resetInSeconds * 1000), "the minute budget to reset");
        stats.lastComplexity = null;
      }
      checkDeadline();
      if (!(await opts.ledger.claim())) {
        throw fail(
          MondayCapReachedError,
          "No Monday calls left today: the call cap is reached, or Monday's daily limit was hit. The mirror waits for 00:00 UTC.",
          "CAP_REACHED",
        );
      }
      stats.calls += 1;

      // A new signal for every attempt: its clock starts now, and it covers reading the answer as well as getting it.
      const signal = AbortSignal.timeout(attemptTimeoutMs());
      let res: Response;
      let text: string;
      try {
        res = await fetchFn(MONDAY_API_URL, {
          method: "POST",
          headers: { Authorization: token, "Content-Type": "application/json", "API-Version": MONDAY_API_VERSION },
          body,
          signal,
        });
        text = await res.text();
      } catch (e) {
        await retryOrGiveUp(attempt, failureReason(e), e);
        continue;
      }

      let json: MondayBody | null = null;
      try {
        json = JSON.parse(text) as MondayBody | null;
      } catch {
        // Not JSON. On an error status the status decides, below; a 2xx that isn't JSON is a broken answer, so it is
        // retried like a dropped connection.
        if (res.ok) {
          await retryOrGiveUp(attempt, `its answer (HTTP ${res.status}) wasn't JSON`);
          continue;
        }
      }
      const err = firstError(json);
      if (res.ok && json?.data && !err) {
        const c = json.data.complexity;
        if (c) {
          stats.lastComplexity = { query: c.query, after: c.after, resetInSeconds: c.reset_in_x_seconds };
          stats.complexity += c.query;
        }
        return json.data as T;
      }

      const code = err?.code ?? null;
      const message = err?.message ?? `Monday answered HTTP ${res.status}`;
      if (code === "DAILY_LIMIT_EXCEEDED" || /daily limit/i.test(message)) {
        await opts.ledger.dailyLimitHit();
        throw fail(MondayDailyLimitError, message, "DAILY_LIMIT_EXCEEDED", res.status);
      }
      const retryable = res.status === 429 || res.status >= 500 || (code !== null && RETRYABLE.has(code));
      if (!retryable || attempt >= maxRetries) throw fail(MondayError, message, code, res.status);
      const header = Number(res.headers.get("retry-after"));
      const waitSeconds = err?.retryIn ?? (Number.isFinite(header) && header > 0 ? header : null);
      await wait(waitSeconds !== null ? Math.min(MAX_WAIT_MS, waitSeconds * 1000) : backoff(attempt), "the retry");
    }
  }

  return { query, stats };
}
