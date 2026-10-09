/**
 * Server settings, read from process.env. Import only from server code
 * (src/server, app/api, server actions, scripts): nothing here is for the
 * browser. Every value is optional, so the prototype runs with no .env.
 */
export interface ServerEnv {
  launchpadEnv: "local" | "production";
  dbUrl: string | null;
  supabaseUrl: string | null;
  serviceRoleKey: string | null;
  mondayToken: string | null;
  /** A runaway-loop guard, not a budget (Kane, 8 Oct: going over 10,000 is fine). */
  mondayDailyCallCap: number;
  hubspotToken: string | null;
  hubspotPortalId: string | null;
  cronSecret: string | null;
}

const text = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null);

// Partial because Next's types make NODE_ENV required, and the tests pass only a few keys.
export function readServerEnv(env: Partial<NodeJS.ProcessEnv> = process.env): ServerEnv {
  const launchpadEnv = env.LAUNCHPAD_ENV?.trim() === "production" ? "production" : "local";
  const cap = Number(env.MONDAY_DAILY_CALL_CAP);
  return {
    launchpadEnv,
    dbUrl: text(env.SUPABASE_DB_URL),
    supabaseUrl: text(env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: text(env.SUPABASE_SERVICE_ROLE_KEY),
    mondayToken: text(env.MONDAY_API_TOKEN),
    mondayDailyCallCap:
      Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : launchpadEnv === "production" ? 5000 : 2000,
    hubspotToken: text(env.HUBSPOT_TOKEN),
    hubspotPortalId: text(env.HUBSPOT_PORTAL_ID),
    cronSecret: text(env.CRON_SECRET),
  };
}

/** True when a database is configured, so live loaders should run. */
export const hasDatabase = (env: ServerEnv = readServerEnv()): boolean => env.dbUrl !== null;
