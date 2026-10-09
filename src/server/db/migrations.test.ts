import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checksum, planMigrations, readMigrations, type MigrationFile } from "./migrations";

const file = (version: string, sql: string): MigrationFile => ({ version, name: `m${version}`, sql, checksum: checksum(sql) });

test("migrations: reads only well-named .sql files, in version order", () => {
  const dir = mkdtempSync(join(tmpdir(), "lp-migrations-"));
  writeFileSync(join(dir, "20261008000200_second.sql"), "select 2;");
  writeFileSync(join(dir, "20261008000100_first.sql"), "select 1;");
  writeFileSync(join(dir, "notes.md"), "not a migration");
  writeFileSync(join(dir, "2026_bad.sql"), "select 0;");
  const files = readMigrations(dir);
  assert.deepEqual(files.map((f) => f.version), ["20261008000100", "20261008000200"]);
  assert.equal(files[0].name, "first");
});

test("migrations: two files with the same version are refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "lp-migrations-"));
  writeFileSync(join(dir, "20261008000100_first.sql"), "select 1;");
  writeFileSync(join(dir, "20261008000100_second.sql"), "select 2;");
  assert.throws(() => readMigrations(dir), /two migrations share version 20261008000100: first and second/);
});

test("migrations: checksums ignore Windows line endings", () => {
  assert.equal(checksum("select 1;\r\nselect 2;\r\n"), checksum("select 1;\nselect 2;\n"));
});

test("migrations: plans pending, changed and unknown versions", () => {
  const files = [file("1", "a"), file("2", "b"), file("3", "c")];
  const plan = planMigrations(files, [
    { version: "1", checksum: checksum("a") },
    { version: "2", checksum: checksum("edited") },
    { version: "9", checksum: "x" },
  ]);
  assert.deepEqual(plan.pending.map((f) => f.version), ["3"]);
  assert.deepEqual(plan.changed.map((f) => f.version), ["2"]);
  assert.deepEqual(plan.unknown, ["9"]);
});
