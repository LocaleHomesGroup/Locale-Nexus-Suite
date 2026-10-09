/**
 * What the HubSpot and Monday clients share:
 *   - the run's time limit (RunDeadlineError, checkDeadline, checkWait, attemptTimeoutMs). A cron route gives each
 *     run a deadline. The client then starts no request and no wait past it, and caps each attempt's timeout by the
 *     time left, so the pass ends partial before the host stops the function;
 *   - the checks on a client's options (clientLimits);
 *   - the failure reasons that are safe to show (failureReason);
 *   - the token-shape check (checkedToken).
 * The HubSpot client uses all of it. The Monday client keeps its own time-limit rules (Task 9) and uses the last two.
 */

/** The run's time limit was reached: nothing more is sent, and the pass ends partial. */
export class RunDeadlineError extends Error {
  constructor(message = "The run's time limit was reached, so nothing more is sent.") {
    super(message);
    this.name = "RunDeadlineError";
  }
}

/** Throws once the deadline has passed. Call before every request. */
export function checkDeadline(deadline: Date | undefined, now: () => number): void {
  if (deadline && now() >= deadline.getTime()) throw new RunDeadlineError();
}

/** Throws instead of starting a wait that would end at or past the deadline. */
export function checkWait(ms: number, deadline: Date | undefined, now: () => number, what: string): void {
  if (deadline && now() + ms >= deadline.getTime()) {
    throw new RunDeadlineError(`The run's time limit was reached: waiting ${Math.ceil(ms / 1000)} s for ${what} would end past it.`);
  }
}

/** One attempt may take timeoutMs, or the time left before the deadline if that is less, but at least a second. */
export function attemptTimeoutMs(timeoutMs: number, deadline: Date | undefined, now: () => number): number {
  if (!deadline) return timeoutMs;
  return Math.min(timeoutMs, Math.max(1_000, Math.ceil(deadline.getTime() - now())));
}

/** The longest delay a timer holds. Above it Node sets AbortSignal.timeout to 1 ms, so every request would time out at once. */
export const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * A client's timeoutMs (default 30 s) and deadline, checked once, when the client is made, so that building an
 * attempt's AbortSignal can never throw later. timeoutMs must be a whole number of milliseconds from 1 to
 * MAX_TIMEOUT_MS (RangeError otherwise), and a deadline a valid Date (TypeError otherwise).
 */
export function clientLimits(opts: { timeoutMs?: number; deadline?: Date }): { timeoutMs: number; deadline: Date | undefined } {
  const { timeoutMs = 30_000, deadline } = opts;
  if (typeof timeoutMs !== "number" || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new RangeError(`timeoutMs must be a whole number of milliseconds from 1 to ${MAX_TIMEOUT_MS}, not ${String(timeoutMs)}`);
  }
  if (deadline !== undefined && !(deadline instanceof Date && Number.isFinite(deadline.getTime()))) {
    throw new TypeError("deadline must be a valid Date");
  }
  return { timeoutMs, deadline };
}

/**
 * Why a request failed, for the "unreachable" message, in the HubSpot and Monday clients. Only fetch's own failures
 * are repeated: "fetch failed" and "terminated" with their cause's code (ECONNRESET, ENOTFOUND, UND_ERR_SOCKET, ...),
 * and a timeout or an abort with its name. Any other error gives only its name, and its code when that is a string,
 * never its message: fetch's error for a bad header value quotes the whole value, token and all. A DOMException's own
 * `code` is an old number (23 for a timeout), so only a string code counts.
 */
export function failureReason(e: unknown): string {
  const err = (typeof e === "object" && e !== null ? e : {}) as {
    message?: unknown;
    name?: unknown;
    code?: unknown;
    cause?: { code?: unknown } | null;
  };
  const message = typeof err.message === "string" ? err.message : "";
  const name = typeof err.name === "string" && err.name ? err.name : "Error";
  const code = [err.cause?.code, err.code].find((c): c is string => typeof c === "string" && c !== "");
  if (message === "fetch failed" || message === "terminated") return code ? `${message} (${code})` : message;
  if (name === "TimeoutError" || name === "AbortError") return message ? `${message} (${name})` : name;
  return code ? `${name} (${code})` : name;
}

/** Printable ASCII with no space: all a token holds, and all a header value of one can. */
const TOKEN_SHAPE = /^[\x21-\x7e]+$/;

/**
 * A client's token, trimmed and checked once, when the client is made. An empty one says so. One with a line break, a
 * NUL or a space would make fetch throw an error that quotes the header, token and all, so it is refused here, with a
 * message that quotes none of it. `setting` names where it came from, such as HUBSPOT_TOKEN.
 */
export function checkedToken(token: string, setting: string): string {
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (trimmed === "") throw new TypeError(`${setting} is empty`);
  if (!TOKEN_SHAPE.test(trimmed)) {
    throw new TypeError(`${setting} has a character a token can't have, such as a line break or a space. Copy it again.`);
  }
  return trimmed;
}
