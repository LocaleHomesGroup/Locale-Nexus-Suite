/**
 * npm run check:secrets          scan what is staged (the pre-commit hook)
 * npm run check:secrets -- --all scan every tracked file, and untracked ones that aren't ignored
 *
 * Fails when a token-shaped value is found, or when a file it should check can't be read.
 * Move a value to .env.local (git-ignored) and rotate anything that was ever committed:
 * deleting it doesn't un-publish it.
 */
import { scanRepo } from "../src/server/secret-files";

function main() {
  const r = scanRepo({ all: process.argv.includes("--all") });
  for (const f of r.unreadable) console.error(`${f}  couldn't be read, so it wasn't checked`);
  for (const f of r.findings) console.error(`${f.path}:${f.line}  ${f.name}`);
  if (r.findings.length > 0) {
    console.error(
      "\nToken-shaped values found. Move them to .env.local (git-ignored) and rotate any that were ever committed.",
    );
  }
  if (r.findings.length > 0 || r.unreadable.length > 0) process.exit(1);
  console.log(`check:secrets: ${r.scanned} file(s), nothing found`);
}

main();
