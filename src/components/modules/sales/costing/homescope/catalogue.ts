import raw from "./catalogue.json";
import { ORG_SEED, orgDepartmentOf } from "@/components/modules/hr/data";
import type { HsBuilder, HsModel, HsRange, HsRate } from "@/data/homescope";

/**
 * HomeScope's price boards, as the estimator reads them from Monday: builders,
 * their models and spec-range prices, elevations, site costs, delayed-title
 * allowance rules, BAL / coastal / noise rates, colour schemes, the variation
 * catalogue and each model's bolt-ons.
 *
 * `catalogue.json` is the fallback: a snapshot of four builders (Forma, LaVida,
 * New Choice, Move) taken from HomeScope on 6 October 2026, used when nothing
 * has been imported from Monday (see catalogue-context.tsx). The live boards
 * change, so nothing quoted here is binding until it is checked against the
 * builder's current list.
 */

export type {
  HsAllowanceRule,
  HsBoltOn,
  HsBuilder,
  HsColour,
  HsElevation,
  HsImage,
  HsModel,
  HsPriced,
  HsRange,
  HsRate,
  HsSiteCost,
  HsVariation,
} from "@/data/homescope";

export const CATALOGUE = raw as unknown as { snapshot: string; builders: HsBuilder[] };

/** The builder with this name in a catalogue's builders, or null. */
export const builderIn = (builders: HsBuilder[], name: string | null) => builders.find((b) => b.name === name) ?? null;

/** The colour option that means "choose colours at pre-start" (every builder has one). */
export const PRE_START = "Pre-Start";

/* ── The steps ─────────────────────────────────────────────────────────── */

/** HomeScope's eleven steps, then the quote PDF Launchpad adds. */
export const STEPS = [
  { id: "client", label: "Client details", short: "Client" },
  { id: "builder", label: "Builder selection", short: "Builder" },
  { id: "model", label: "Model selection", short: "Model" },
  { id: "range", label: "Spec range", short: "Spec range" },
  { id: "elevation", label: "Front elevation", short: "Elevation" },
  { id: "siteCosts", label: "Site costs", short: "Site costs" },
  { id: "siteVariations", label: "Site costs variations", short: "Site variations" },
  { id: "colour", label: "Colour scheme", short: "Colour" },
  { id: "pricing", label: "Pricing", short: "Pricing" },
  { id: "variations", label: "Variations", short: "Variations" },
  { id: "summary", label: "Summary", short: "Summary" },
  { id: "pdf", label: "Quote PDF", short: "Quote PDF" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];
export const stepIndex = (id: StepId) => STEPS.findIndex((s) => s.id === id);

/* ── Who and for whom ──────────────────────────────────────────────────── */

/**
 * The staff picker: HomeScope lists Monday's agreements staff. Here it is the
 * Sales department on HR's org chart, people only (vacant seats left out).
 */
export const STAFF: string[] = ORG_SEED.filter((p) => p.name && orgDepartmentOf(ORG_SEED, p.id) === "sales")
  .map((p) => p.name as string)
  .sort((a, b) => a.localeCompare(b));

export interface HubspotContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/**
 * HomeScope's "Search HubSpot contacts". Sample contacts named for the clients
 * on Sales' Pipeline; the emails and numbers are placeholders.
 */
export const HUBSPOT_CONTACTS: HubspotContact[] = [
  { firstName: "Sophie", lastName: "Whitmore", email: "sophie.whitmore@example.com", phone: "0412 330 418" },
  { firstName: "Aaron", lastName: "Whitmore", email: "aaron.whitmore@example.com", phone: "0412 330 419" },
  { firstName: "Nadeesha", lastName: "Perera", email: "n.perera@example.com", phone: "0433 905 112" },
  { firstName: "Grace", lastName: "Callahan", email: "grace.callahan@example.com", phone: "0401 774 260" },
  { firstName: "Femi", lastName: "Osei", email: "femi.osei@example.com", phone: "0450 218 937" },
  { firstName: "Ruth", lastName: "Osei", email: "ruth.osei@example.com", phone: "0450 218 938" },
  { firstName: "Hieu", lastName: "Tran", email: "hieu.tran@example.com", phone: "0422 641 095" },
  { firstName: "Liza", lastName: "Mallillin", email: "liza.mallillin@example.com", phone: "0478 112 563" },
  { firstName: "Maya", lastName: "Haddad", email: "maya.haddad@example.com", phone: "0409 357 820" },
];

/* ── Reading the boards ────────────────────────────────────────────────── */

export interface BlockFilter {
  corner: boolean;
  min: number | null;
  max: number | null;
}

/**
 * The designs a block suits, as HomeScope searches the models board: a corner
 * block lists the corner designs; otherwise "to suit block" must sit inside
 * whichever bounds are set. Largest frontage first, unless only a minimum was
 * given.
 */
export function modelsForBlock(builder: HsBuilder, block: BlockFilter): HsModel[] {
  const fits = builder.models.filter((m) => {
    if (block.corner) return m.corner;
    if (m.frontage == null) return false;
    if (block.min != null && m.frontage < block.min) return false;
    if (block.max != null && m.frontage > block.max) return false;
    return true;
  });
  const asc = !block.corner && block.min != null && block.max == null;
  return [...fits].sort((a, b) => {
    const fa = a.frontage ?? (asc ? Infinity : -Infinity);
    const fb = b.frontage ?? (asc ? Infinity : -Infinity);
    return asc ? fa - fb : fb - fa;
  });
}

export interface ModelGroup {
  frontage: number | null;
  label: string;
  bestFit: boolean;
  models: HsModel[];
}

/** HomeScope's frontage groups: "Best fit 15m frontage" when the bounds name one frontage, else "Suits …". */
export function groupByFrontage(models: HsModel[], block: BlockFilter): ModelGroup[] {
  const one = block.min ?? block.max;
  const exact = one != null && one === (block.max ?? block.min) ? one : null;
  const groups: ModelGroup[] = [];
  for (const m of models) {
    let g = groups.find((x) => x.frontage === m.frontage);
    if (!g) {
      const bestFit = exact != null && m.frontage === exact;
      g = {
        frontage: m.frontage,
        bestFit,
        label: m.frontage == null ? "Other designs" : `${bestFit ? "Best fit" : "Suits"} ${m.frontage}m frontage`,
        models: [],
      };
      groups.push(g);
    }
    g.models.push(m);
  }
  return groups;
}

/** Spec ranges grouped by level, lowest level first. */
export function rangesByLevel(builder: HsBuilder): { level: string; ranges: HsRange[] }[] {
  const levels = new Map<string, { level: string; position: number; ranges: HsRange[] }>();
  for (const r of builder.ranges) {
    const l = levels.get(r.level) ?? { level: r.level, position: r.position, ranges: [] };
    l.ranges.push(r);
    levels.set(r.level, l);
  }
  return [...levels.values()].sort((a, b) => a.position - b.position);
}

/** Does this builder price BAL, coastal or noise by total floor area? */
export const areaBanded = (b: HsBuilder) => [...b.bal, ...b.coastal, ...b.noise].some((r) => r.area != null);

/** The floor-area bands a builder's rates are set for, smallest first. */
export const floorAreas = (b: HsBuilder) =>
  [...new Set([...b.bal, ...b.coastal, ...b.noise].map((r) => r.area).filter((a): a is number => a != null))].sort(
    (x, y) => x - y,
  );

/** The rates that apply: all of them, or only the chosen band's for an area-banded builder. */
export const ratesFor = (rates: HsRate[], area: number | null) =>
  rates.some((r) => r.area != null) ? rates.filter((r) => r.area === area) : rates;

/** Variation areas in board order, matched without regard to case as HomeScope groups them. */
export function variationAreas(b: HsBuilder): string[] {
  const seen = new Map<string, string>();
  for (const v of b.variations) if (!seen.has(v.area.toLowerCase())) seen.set(v.area.toLowerCase(), v.area);
  return [...seen.values()];
}

export const variationsIn = (b: HsBuilder, area: string) =>
  b.variations.filter((v) => v.area.toLowerCase() === area.toLowerCase());

export const boltOnsFor = (b: HsBuilder, model: string | null) =>
  model ? (Object.entries(b.boltOns).find(([m]) => m.toLowerCase() === model.toLowerCase())?.[1] ?? []) : [];
