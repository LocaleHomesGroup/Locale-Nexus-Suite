import type { HsBuilder } from "@/data/homescope";

const SECTIONS = ["models", "ranges", "elevations", "siteCosts", "allowances", "bal", "coastal", "noise", "colours", "variations"] as const;

/** Fields only an import has, so catalogue.json can't match them. A variation's description is a real field, so it stays. */
const IMPORT_ONLY = ["image", "description", "costType", "blockType", "notes", "logo"];

/** The row without the import-only fields, keys in a fixed order so two equal rows print the same. */
function plain(v: unknown, keep: string[] = []): unknown {
  if (Array.isArray(v)) return v.map((x) => plain(x, keep));
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k]) => !IMPORT_ONLY.includes(k) || keep.includes(k))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, plain(x, keep)]),
    );
  }
  return v;
}

const show = (v: unknown) => {
  const t = JSON.stringify(v) ?? "undefined";
  return t.length > 120 ? `${t.slice(0, 117)}...` : t;
};

/** The first row that differs between two lists, as words. Null when they're equal. */
function firstDifference(name: string, was: unknown[], now: unknown[]): string | null {
  const counts = was.length === now.length ? "" : `${name} ${was.length} -> ${now.length}`;
  for (let i = 0; i < Math.max(was.length, now.length); i++) {
    if (JSON.stringify(was[i]) !== JSON.stringify(now[i])) {
      const row = `${name} row ${i} differs: ${show(was[i])} vs ${show(now[i])}`;
      return counts ? `${counts}, ${row}` : row;
    }
  }
  return counts || null;
}

/** A builder's sections as lists of plain rows, bolt-ons as one row per design (sorted by design). */
function rowsOf(b: HsBuilder): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const k of SECTIONS) out[k] = plain(b[k], k === "variations" ? ["description"] : []) as unknown[];
  out.boltOns = Object.keys(b.boltOns)
    .sort()
    .map((design) => ({ design, items: plain(b.boltOns[design], ["description"]) }));
  return out;
}

/**
 * How an import differs from catalogue.json, builder by builder, for the dry run's
 * --compare-snapshot. Every section is compared row by row, in order, by value, after
 * dropping the fields only an import has. The first row that differs is shown per
 * section. Prices can have moved since 6 October for good reason: this is a check, not a test.
 */
export function compareWithSnapshot(imported: HsBuilder[], snapshot: HsBuilder[]): string[] {
  const lines: string[] = [];
  for (const s of snapshot) {
    const b = imported.find((x) => x.name === s.name);
    if (!b) {
      lines.push(`${s.name}: in the snapshot, not on Monday`);
      continue;
    }
    const was = rowsOf(s);
    const now = rowsOf(b);
    const diffs = Object.keys(was).flatMap((k) => firstDifference(k, was[k], now[k]) ?? []);
    lines.push(`${s.name}: ${diffs.length ? diffs.join("; ") : "matches the snapshot"}`);
  }
  for (const b of imported) if (!snapshot.some((s) => s.name === b.name)) lines.push(`${b.name}: new, ${b.models.length} designs`);
  return lines;
}
