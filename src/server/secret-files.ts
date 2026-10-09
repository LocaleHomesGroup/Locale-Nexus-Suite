/**
 * What `npm run check:secrets` scans: the staged files (the pre-commit hook), or with
 * `all`, every tracked file plus untracked ones that aren't git-ignored. Names are
 * listed NUL-separated (-z): otherwise git quotes a name with a non-ASCII character,
 * and a quoted name can't be read back.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scanText, type SecretFinding } from "../lib/secret-scan";

const BINARY = /\.(png|jpe?g|gif|ico|webp|svg|ttf|otf|woff2?|pdf|zip|xlsx|docx|mp4|wasm)$/i;

export interface RepoScan {
  /** Files read and scanned. */
  scanned: number;
  findings: SecretFinding[];
  /** Files that should have been scanned but couldn't be read. The check fails on these. */
  unreadable: string[];
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

const names = (out: string) => out.split("\0").filter((f) => f && !BINARY.test(f));

export function scanRepo(opts: { all: boolean; cwd?: string }): RepoScan {
  const cwd = opts.cwd ?? process.cwd();
  const files = opts.all
    ? names(git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd))
    : names(git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"], cwd));
  const result: RepoScan = { scanned: 0, findings: [], unreadable: [] };
  for (const file of files) {
    let text: string;
    try {
      // Staged mode reads what is about to be committed, not the working copy.
      text = opts.all ? readFileSync(join(cwd, file), "utf8") : git(["show", `:${file}`], cwd);
    } catch (e) {
      // A tracked file deleted from the working copy has nothing to scan. Anything else fails the check.
      if (opts.all && (e as NodeJS.ErrnoException).code === "ENOENT") continue;
      result.unreadable.push(file);
      continue;
    }
    result.scanned += 1;
    result.findings.push(...scanText(file, text));
  }
  return result;
}
