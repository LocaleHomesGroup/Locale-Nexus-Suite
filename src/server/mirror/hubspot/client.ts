import { attemptTimeoutMs, checkDeadline, checkWait, checkedToken, clientLimits, failureReason } from "../limits";

/**
 * HubSpot's CRM API, read only. Every request is checked against an allowlist
 * of the reads the mirror makes, and nothing else is sent. Searches are paced
 * to stay under HubSpot's 5 a second, and rate limits are waited out, except
 * the daily one.
 *
 * Every request is cut off if HubSpot hasn't answered in full within
 * `timeoutMs` (30 s), and none outlasts the run's `deadline`: nothing is sent
 * at or after it, no wait (for the search pace or a retry) is started that
 * would end at or past it, and each attempt's timeout is capped by the time
 * left (see ../limits). A request that fails in transit, or a 2xx that isn't
 * JSON, is retried like a 5xx, five attempts in all. A 401 and the daily limit
 * are final.
 *
 * The token never reaches an error: one a header can't carry is refused when
 * the client is made, and any text that quotes it becomes "[token]".
 */
export const HUBSPOT_API = "https://api.hubapi.com";

const ALLOWED: { method: "GET" | "POST"; path: RegExp }[] = [
  { method: "GET", path: /^\/account-info\/v3\/details$/ },
  { method: "GET", path: /^\/crm\/v3\/owners\/?$/ },
  { method: "GET", path: /^\/crm\/v3\/pipelines\/deals$/ },
  // Search is a POST, and still only a read.
  { method: "POST", path: /^\/crm\/v3\/objects\/(deals|contacts|meetings|notes)\/search$/ },
  { method: "POST", path: /^\/crm\/v4\/associations\/(deals|meetings)\/(contacts|deals)\/batch\/read$/ },
];

/** The path without its query string: what the allowlist and the search pace both judge. */
const barePath = (path: string) => path.split("?")[0];

export function isAllowedHubSpotRequest(method: string, path: string): boolean {
  const bare = barePath(path);
  return ALLOWED.some((a) => a.method === method && a.path.test(bare));
}

export class HubSpotError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly policy: string | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "HubSpotError";
  }
}

export interface HubSpotClient {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  readonly stats: { calls: number };
}

const SEARCH_GAP_MS = 250;
/** The first attempt and four retries. */
const MAX_ATTEMPTS = 5;
const MAX_WAIT_MS = 30_000;
const backoff = (attempt: number) => Math.min(MAX_WAIT_MS, 1000 * 2 ** attempt);

export function createHubSpotClient(opts: {
  token: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** How long one request may take, answer included. Default 30 s; a whole number of milliseconds from 1 to 2,147,483,647. */
  timeoutMs?: number;
  /** The run's time limit. Reaching it throws RunDeadlineError. Without one, only timeoutMs applies. */
  deadline?: Date;
}): HubSpotClient {
  // Checked here, so that nothing is sent with a token fetch would quote in its error.
  const token = checkedToken(opts.token, "HUBSPOT_TOKEN");
  const fetchFn = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = opts.now ?? Date.now;
  // Checked here, so that building an attempt's AbortSignal can never throw once a call is under way.
  const { timeoutMs, deadline } = clientLimits(opts);
  const stats = { calls: 0 };
  let lastSearch = 0;

  /** Every HubSpotError is made here, with any copy of the token in its text replaced. */
  const fail = (message: string, status: number | null = null, policy: string | null = null, options?: ErrorOptions) =>
    new HubSpotError(message.split(token).join("[token]"), status, policy, options);

  async function wait(ms: number, what: string): Promise<void> {
    checkWait(ms, deadline, now, what);
    await sleep(ms);
  }

  /** A request that failed in transit, or a 2xx that couldn't be read: wait and go again, or give up as unreachable. */
  async function retryOrGiveUp(attempt: number, reason: string, cause: unknown): Promise<void> {
    if (attempt >= MAX_ATTEMPTS - 1) throw fail(`HubSpot is unreachable: ${reason}`, null, null, { cause });
    await wait(backoff(attempt), "the retry");
  }

  async function send<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    if (!isAllowedHubSpotRequest(method, path)) {
      throw fail(`Refused: ${method} ${path} isn't a read the mirror makes.`);
    }
    if (barePath(path).endsWith("/search")) {
      const pace = lastSearch + SEARCH_GAP_MS - now();
      if (pace > 0) await wait(pace, "the search pace");
      lastSearch = now();
    }
    for (let attempt = 0; ; attempt++) {
      checkDeadline(deadline, now);
      stats.calls += 1;
      let res: Response;
      let text = "";
      try {
        // A new signal for every attempt: its clock starts now, and it covers reading the answer as well as getting it.
        res = await fetchFn(`${HUBSPOT_API}${path}`, {
          method,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(attemptTimeoutMs(timeoutMs, deadline, now)),
        });
        if (res.ok) text = await res.text();
      } catch (e) {
        // No answer: a timeout, a reset, or a 2xx body cut off while it was read.
        await retryOrGiveUp(attempt, failureReason(e), e);
        continue;
      }
      if (res.ok) {
        try {
          return JSON.parse(text) as T;
        } catch (e) {
          await retryOrGiveUp(attempt, `its answer (HTTP ${res.status}) wasn't JSON`, e);
          continue;
        }
      }
      const err = (await res.json().catch(() => null)) as { message?: string; policyName?: string } | null;
      if (res.status === 401) throw fail("HubSpot rejected the token (401): it may have been rotated or deactivated.", 401);
      if (res.status === 429 && err?.policyName === "DAILY") throw fail("HubSpot's daily API limit is reached.", 429, "DAILY");
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt >= MAX_ATTEMPTS - 1 && res.status >= 500) {
        const said = err?.message ? ` (${err.message})` : "";
        throw fail(`HubSpot is unreachable: it answered HTTP ${res.status} on all ${MAX_ATTEMPTS} attempts${said}`, res.status);
      }
      if (!retryable || attempt >= MAX_ATTEMPTS - 1) {
        throw fail(`HubSpot answered HTTP ${res.status}: ${err?.message ?? ""}`.trim(), res.status);
      }
      const after = Number(res.headers.get("retry-after"));
      await wait(Number.isFinite(after) && after > 0 ? Math.min(MAX_WAIT_MS, after * 1000) : backoff(attempt), "the retry");
    }
  }

  return {
    get: <T>(path: string, params: Record<string, string> = {}) =>
      send<T>("GET", Object.keys(params).length > 0 ? `${path}?${new URLSearchParams(params)}` : path),
    post: <T>(path: string, body: unknown) => send<T>("POST", path, body),
    stats,
  };
}
