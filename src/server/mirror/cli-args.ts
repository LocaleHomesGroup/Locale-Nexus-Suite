/**
 * The flags the CLI reads (cli-main.ts, run by scripts/mirror.ts). A flag is written `--name value` or `--name=value`. One with nothing after it
 * is refused: reading it as "not given" would quietly drop a limit the person asked for, and turn a trial run
 * over one board into a run over every board.
 */

/**
 * The flags each command takes. A command that isn't listed isn't checked here: the script's switch refuses an
 * unknown one, and a command added later brings its own flags. `--max-calls` is on every command that calls Monday.
 */
const COMMAND_FLAGS: Readonly<Record<string, readonly string[]>> = {
  status: [],
  buckets: [],
  reps: [],
  discover: ["workspace", "max-calls"],
  setup: ["jerry-config", "max-calls"],
  backfill: ["board", "max-calls"],
  changes: ["board", "max-calls"],
  safety: ["board", "max-calls"],
  sweep: ["board", "max-calls"],
  files: ["max-files", "max-calls"],
  hubspot: [],
};

/**
 * Refuses a flag the command doesn't take, by name. Left alone, `files --board x` would copy from every board and
 * `--max-files` on a pass would do nothing: a flag that is ignored is a limit or a scope that quietly isn't there.
 */
export function checkFlags(command: string, args: readonly string[]): void {
  // Own keys only: a "command" such as constructor mustn't find something on Object.prototype.
  if (!Object.hasOwn(COMMAND_FLAGS, command)) return;
  const takes = COMMAND_FLAGS[command];
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2).split("=")[0];
    if (!takes.includes(name)) throw new Error(`${command} doesn't take --${name}`);
  }
}

/** The value of `--name`, or undefined when the flag isn't there. Throws when the flag is there with no value. */
export function flagValue(args: readonly string[], name: string): string | undefined {
  const flag = `--${name}`;
  for (let i = 0; i < args.length; i++) {
    const given: string | null | undefined = args[i] === flag ? args[i + 1] : args[i].startsWith(`${flag}=`) ? args[i].slice(flag.length + 1) : null;
    if (given === null) continue;
    // Another flag in the value's place means the value was left out.
    if (given === undefined || given === "" || given.startsWith("--")) throw new Error(`${flag} needs a value`);
    return given;
  }
  return undefined;
}

/** `--name <n>` as a positive whole number, or undefined when the flag isn't there. Throws for 0, a negative, a fraction, NaN or anything but digits. */
export function wholeNumberFlag(args: readonly string[], name: string): number | undefined {
  const raw = flagValue(args, name);
  if (raw === undefined) return undefined;
  const n = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`--${name} must be a positive whole number, not "${raw}"`);
  return n;
}
