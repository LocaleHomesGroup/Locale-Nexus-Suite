import type { Db } from "../../db/types";
import type { MondayLedger } from "./client";

/**
 * Counts calls in mirror.api_calls (per source, per UTC day). Refuses past the cap,
 * and for the rest of the UTC day once Monday has said DAILY_LIMIT_EXCEEDED.
 */
export function dbLedger(db: Db, source: string, cap: number): MondayLedger {
  return {
    claim: async () =>
      (await db.query<{ ok: boolean }>("select mirror.record_api_call($1, 1, $2) as ok", [source, cap]))[0]?.ok === true,
    dailyLimitHit: async () => {
      await db.query("select mirror.record_daily_limit($1)", [source]);
    },
  };
}
