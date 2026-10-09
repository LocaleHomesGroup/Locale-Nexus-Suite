import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFlags, flagValue, wholeNumberFlag } from "./cli-args";

test("flags: a value follows the flag, after a space or an equals sign; no flag means no value", () => {
  assert.equal(flagValue(["backfill", "--board", "test_sales"], "board"), "test_sales");
  assert.equal(flagValue(["backfill", "--board=test_sales"], "board"), "test_sales");
  assert.equal(flagValue(["backfill", "--max-calls", "5"], "board"), undefined);
  assert.equal(flagValue([], "board"), undefined);
});

test("flags: a flag with nothing after it is an error, never quietly 'not given'", () => {
  // Reading "--board" with no key as "no board" would turn a one-board trial into a run over every board.
  for (const args of [["--board"], ["backfill", "--board", "--max-calls", "5"], ["--board", ""], ["--board="]]) {
    assert.throws(() => flagValue(args, "board"), { message: "--board needs a value" }, JSON.stringify(args));
  }
});

test("flags: --max-calls, --max-files and the like take a positive whole number", () => {
  assert.equal(wholeNumberFlag(["backfill", "--max-calls", "50"], "max-calls"), 50);
  assert.equal(wholeNumberFlag(["files", "--max-files=7"], "max-files"), 7);
  assert.equal(wholeNumberFlag(["backfill"], "max-calls"), undefined);
  assert.equal(wholeNumberFlag(["--max-calls", "1"], "max-calls"), 1, "one is the smallest");
});

test("flags: zero, negatives, fractions, words and NaN never get through as a limit", () => {
  const bad = ["0", "-5", "1.5", "abc", "NaN", "Infinity", "1e3", "0x10", "+5", " 5", "5 ", "9007199254740993"];
  for (const value of bad) {
    assert.throws(
      () => wholeNumberFlag(["backfill", "--max-calls", value], "max-calls"),
      { message: `--max-calls must be a positive whole number, not "${value}"` },
      `--max-calls ${value}`,
    );
  }
  assert.throws(() => wholeNumberFlag(["files", "--max-files=-1"], "max-files"), { message: '--max-files must be a positive whole number, not "-1"' });
});

test("flags: a limit with no number after it is the missing-value error, not a silent no-limit", () => {
  assert.throws(() => wholeNumberFlag(["backfill", "--max-calls"], "max-calls"), { message: "--max-calls needs a value" });
  assert.throws(() => wholeNumberFlag(["backfill", "--max-calls", "--board", "x"], "max-calls"), { message: "--max-calls needs a value" });
});

test("commands: each takes only its own flags, and --max-calls works wherever Monday is called", () => {
  const takes: [string, string[]][] = [
    ["status", []],
    ["buckets", []],
    ["reps", []],
    ["discover", ["--workspace", "5", "--max-calls", "3"]],
    ["setup", ["--jerry-config", "monday.json", "--max-calls=3"]],
    ["backfill", ["--board", "test_sales", "--max-calls", "50"]],
    ["changes", ["--board=test_sales"]],
    ["safety", ["--max-calls", "5"]],
    ["sweep", []],
    ["files", ["--max-files", "10", "--max-calls", "5"]],
    ["hubspot", []],
  ];
  for (const [command, args] of takes) assert.doesNotThrow(() => checkFlags(command, args), `${command} ${args.join(" ")}`);
});

test("commands: a flag a command doesn't take is refused by name, however it is written", () => {
  const refused: [string, string[], string][] = [
    ["files", ["--board", "test_sales"], "--board"], // it would copy from every board
    ["backfill", ["--max-files", "5"], "--max-files"], // it would do nothing
    ["changes", ["--workspace", "1"], "--workspace"],
    ["sweep", ["--jerry-config", "monday.json"], "--jerry-config"],
    ["discover", ["--board=test_sales"], "--board"],
    ["setup", ["--max-files", "1"], "--max-files"],
    ["status", ["--max-calls", "5"], "--max-calls"],
    ["buckets", ["--max-calls", "5"], "--max-calls"],
    ["reps", ["--board", "test_sales"], "--board"],
    ["status", ["--nope"], "--nope"],
    ["hubspot", ["--max-calls", "5"], "--max-calls"], // HubSpot's pass has no call limit of its own, and takes no flags
    ["hubspot", ["--board=test_sales"], "--board"],
    ["files", ["--max-files", "5", "--board", "x"], "--board"], // an allowed flag first doesn't excuse the second
  ];
  for (const [command, args, flag] of refused) {
    assert.throws(() => checkFlags(command, args), { message: `${command} doesn't take ${flag}` }, `${command} ${args.join(" ")}`);
  }
});

test("commands: values and other words aren't flags, and a command the table doesn't list isn't checked", () => {
  assert.doesNotThrow(() => checkFlags("files", ["--max-files", "5", "extra", "-x"]));
  // A command added later brings its own flags, and an unknown one is refused by the script's switch, not here.
  assert.doesNotThrow(() => checkFlags("anything-new", ["--whatever"]));
  assert.doesNotThrow(() => checkFlags("constructor", ["--x"]), "a name on Object.prototype is not a command");
});
