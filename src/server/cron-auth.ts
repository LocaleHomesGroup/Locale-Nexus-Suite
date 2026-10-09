import { timingSafeEqual } from "node:crypto";

/** Vercel cron (and pg_cron, if used) send "Authorization: Bearer <CRON_SECRET>". No secret, no entry. */
export function isCronAuthorized(header: string | null, secret: string | null): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
