/**
 * What a failure says, in a route's log line or a run's failed result: the error's message, or else its code, or else
 * its string form. Never the error itself, whose stack and fields can hold more than its message. (Node's failures to
 * connect to a host with several addresses are AggregateErrors with no message and a code such as ECONNREFUSED: a
 * database outage would otherwise be a blank line.)
 */
export function messageOf(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  const code = typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return typeof code === "string" && code ? code : String(e);
}
