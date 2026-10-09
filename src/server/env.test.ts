import { test } from "node:test";
import assert from "node:assert/strict";
import { hasDatabase, readServerEnv } from "./env";

test("env: everything is optional, and blank counts as unset", () => {
  const env = readServerEnv({ SUPABASE_DB_URL: "  ", MONDAY_API_TOKEN: "" });
  assert.equal(env.launchpadEnv, "local");
  assert.equal(env.dbUrl, null);
  assert.equal(env.mondayToken, null);
  assert.equal(hasDatabase(env), false);
});

test("env: the Monday cap defaults by environment and takes an override", () => {
  assert.equal(readServerEnv({}).mondayDailyCallCap, 2000);
  assert.equal(readServerEnv({ LAUNCHPAD_ENV: "production" }).mondayDailyCallCap, 5000);
  assert.equal(readServerEnv({ MONDAY_DAILY_CALL_CAP: "750" }).mondayDailyCallCap, 750);
  assert.equal(readServerEnv({ MONDAY_DAILY_CALL_CAP: "nope" }).mondayDailyCallCap, 2000);
});

test("env: a set database URL means live loaders run", () => {
  const env = readServerEnv({ SUPABASE_DB_URL: "postgres://example" });
  assert.equal(hasDatabase(env), true);
});
