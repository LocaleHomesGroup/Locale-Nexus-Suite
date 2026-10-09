import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NO_DATABASE = "SUPABASE_DB_URL is not set. Put it in .env.local (see .env.example).";

/**
 * Runs a script as a real process with no database or service configured. Every setting is blank, which counts as unset,
 * and node is called directly, so `.env.local` isn't loaded (the npm script does that): nothing here can reach a
 * database or a service. `script` is the path node is given, in whatever form. Tests run from the repo root, as the
 * other tests' paths assume.
 */
function run(script: string, ...args: string[]) {
  const r = spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, SUPABASE_DB_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", MONDAY_API_TOKEN: "" },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr.trim() };
}
const mirror = (...args: string[]) => run("scripts/mirror.ts", ...args);

test("mirror script: a flag the command doesn't take is refused, and a valid command gets as far as the database check", () => {
  const refused = mirror("files", "--board", "test_sales");
  assert.deepEqual([refused.code, refused.stderr, refused.stdout], [1, "files doesn't take --board", ""]);

  // The same command with flags it takes goes as far as the database check, which is what the refusal stood in front of.
  const good = mirror("backfill", "--board", "test_sales", "--max-calls", "5");
  assert.deepEqual([good.code, good.stderr], [1, NO_DATABASE]);
});

test("mirror script: reached by a path with no .ts, or through a symlinked folder, it still runs: it never ends in silence", (t) => {
  // An entry that decided whether to run by comparing paths would exit 0 with no output here, and
  // `npm run mirror -- changes` printing nothing would read as a sync that worked.
  const bare = run("scripts/mirror", "status");
  assert.deepEqual([bare.code, bare.stderr, bare.stdout], [1, NO_DATABASE, ""], "a path with no .ts");

  const dir = mkdtempSync(join(tmpdir(), "lp-script-"));
  const link = join(dir, "linked");
  try {
    try {
      symlinkSync(join(process.cwd(), "scripts"), link, "junction");
    } catch {
      t.diagnostic("no symlink could be made here, so the symlinked-folder case wasn't run");
      return;
    }
    const linked = run(join(link, "mirror.ts"), "status");
    assert.deepEqual([linked.code, linked.stderr, linked.stdout], [1, NO_DATABASE, ""], "through a symlinked folder");
  } finally {
    // The link first, so that cleaning up can never reach through it into the real folder (the recursive removal below
    // treats a link as a link too, and the check after this block would catch it if it didn't).
    try {
      rmSync(link, { force: true });
    } catch {
      // already gone, or not removable on its own
    }
    rmSync(dir, { recursive: true, force: true });
  }
  assert.ok(existsSync(join(process.cwd(), "scripts", "mirror.ts")), "the real script is still there");
});
