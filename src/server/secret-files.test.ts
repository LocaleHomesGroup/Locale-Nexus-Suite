import { after, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanRepo } from "./secret-files";

// Invented, and built at runtime so this file doesn't trip the scanner itself.
const fakeHubstaff = "hsoat_" + "TestOnlyNotAToken1234";

const dirs: string[] = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const git = (dir: string, ...args: string[]) =>
  execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "lp-secret-files-"));
  dirs.push(dir);
  git(dir, "init", "-q");
  return dir;
}

test("secret files: a staged file whose name git would quote is still read and checked", () => {
  const dir = repo();
  const quoted = "Kane’s notes.txt"; // a curly apostrophe, which git quotes unless names are listed with -z
  writeFileSync(join(dir, quoted), `token ${fakeHubstaff}\n`);
  writeFileSync(join(dir, "clean.txt"), "nothing here\n");
  git(dir, "add", ".");
  assert.match(git(dir, "-c", "core.quotepath=true", "ls-files"), /^"/m, "git does quote this name without -z");
  const r = scanRepo({ all: false, cwd: dir });
  assert.equal(r.scanned, 2);
  assert.deepEqual(r.unreadable, []);
  assert.deepEqual(r.findings.map((f) => [f.path, f.name]), [[quoted, "Hubstaff organization token"]]);
});

test("secret files: --all checks untracked files too, but not ignored ones", () => {
  const dir = repo();
  writeFileSync(join(dir, ".gitignore"), "*.local\n");
  writeFileSync(join(dir, "new.txt"), `token ${fakeHubstaff}\n`);
  writeFileSync(join(dir, "secrets.local"), `token ${fakeHubstaff}\n`);
  const r = scanRepo({ all: true, cwd: dir });
  assert.deepEqual(r.findings.map((f) => f.path), ["new.txt"]);
  assert.equal(r.scanned, 2, ".gitignore and new.txt");
});

test("secret files: a staged entry that can't be read fails the check instead of being skipped", () => {
  const dir = repo();
  // A gitlink (a submodule pointer) has no content `git show` can print.
  git(dir, "update-index", "--add", "--cacheinfo", `160000,${"1".repeat(40)},sub`);
  const r = scanRepo({ all: false, cwd: dir });
  assert.deepEqual(r.unreadable, ["sub"]);
  assert.equal(r.scanned, 0);
});
