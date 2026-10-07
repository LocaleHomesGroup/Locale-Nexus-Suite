import { PRE_START, builderByName, ratesFor, type HsAllowanceRule, type HsBuilder, type HsModel, type HsRange } from "./catalogue";
import type { Estimate } from "./store";

/**
 * HomeScope's price maths, line for line, as pure functions of an estimate:
 *
 *   final = base (+ an allowance bundled into it) + site cost
 *         + site cost variations + variation charges − variation credits
 *
 * The base is the model's price in the chosen range plus the elevation's and
 * colour scheme's (or the rep's edited figure). Site cost variations are the
 * delayed-title allowance, BAL, coastal and noise rates and any custom items.
 */

/* ── Months to title ───────────────────────────────────────────────────── */

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function addMonths(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

/** Fractional months from one date to another, as moment's `diff(…, "months", true)` counts them. */
export function monthsBetween(fromIso: string, toIso: string): number {
  const from = parse(fromIso);
  const to = parse(toIso);
  const whole = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  const anchor = addMonths(from, whole);
  const t = to.getTime() - anchor.getTime();
  const span = t < 0 ? anchor.getTime() - addMonths(from, whole - 1).getTime() : addMonths(from, whole + 1).getTime() - anchor.getTime();
  return whole + t / span;
}

/** Whole months to title: any part month counts as a month (HomeScope rounds to 3 places first). */
export function monthsToTitle(todayIso: string, etaIso: string): number {
  const exact = Number(monthsBetween(todayIso, etaIso).toFixed(3));
  return Math.floor(exact) + (exact % 1 > 0 ? 1 : 0);
}

/** The rule whose due period covers this many months: "Up to 3", "Between 3-6", "More than 6". */
export function ruleFor(rules: HsAllowanceRule[], months: number): HsAllowanceRule | null {
  for (const r of rules) {
    const due = r.due.toLowerCase().replace("months", "").trim();
    if (due.startsWith("up to") && months <= parseInt(due.replace("up to", ""), 10)) return r;
    if (due.startsWith("between")) {
      const [lo, hi] = due.replace("between", "").split("-").map((x) => parseInt(x, 10));
      if (months >= lo && months <= hi) return r;
    }
    if (due.startsWith("more than") && months >= parseInt(due.replace("more than", ""), 10)) return r;
  }
  return null;
}

/** HomeScope's computeAllowancePrice: fixed per month, percent per month, or one cumulative percentage. */
export function allowancePrice(rule: HsAllowanceRule, calcBase: number, delayMonths: number): number {
  const type = rule.type.toLowerCase();
  let price = 0;
  if (type.includes("cumulative")) price = ((rule.value + rule.monthlyStep * (delayMonths - 1)) / 100) * calcBase + rule.initial;
  else if (type.includes("percent")) price = (rule.value / 100) * calcBase * delayMonths + rule.initial;
  else if (type.includes("price")) price = rule.value * delayMonths + rule.initial;
  return Math.round(price);
}

/** How a rule reads on screen: "$1,500 / month", "1.5% of base price", "2.5% of base price + 0.5% per additional month". */
export function ruleText(rule: HsAllowanceRule, onPrelim: boolean, money: (n: number) => string): string {
  const type = rule.type.toLowerCase();
  const base = onPrelim ? "preliminary contract" : "base price";
  if (type.includes("cumulative"))
    return `${rule.value}% of ${base}${rule.monthlyStep > 0 ? ` + ${rule.monthlyStep}% per additional month` : ""}`;
  if (type.includes("percent")) return `${rule.value}% of ${base} / month`;
  return `${money(rule.value)} / month`;
}

/* ── The estimate's figures ────────────────────────────────────────────── */

export interface TitleAllowance {
  months: number;
  hold: number;
  delay: number;
  rule: HsAllowanceRule | null;
  /** 0 when titles land inside the price hold. */
  amount: number;
}

export interface Pricing {
  builder: HsBuilder | null;
  model: HsModel | null;
  range: HsRange | null;
  /** The model's price in the chosen range. */
  modelPrice: number;
  elevationPrice: number;
  colourPrice: number;
  /** Model + elevation + colour, or the rep's edited figure. */
  base: number;
  /** The allowance folded into the base (LaVida), else 0. */
  bundled: number;
  /** What the price box shows as Base Build Price. */
  displayedBase: number;
  siteCost: number;
  siteCostLabel: string;
  allowance: TitleAllowance;
  bal: number;
  coastal: number;
  noise: number;
  others: number;
  /** Allowance (unless bundled) + BAL + coastal + noise + custom items. */
  siteVariations: number;
  charge: number;
  credit: number;
  /** Before variations: Step 9's figure. */
  beforeVariations: number;
  final: number;
}

const rateOf = (b: HsBuilder | null, list: "bal" | "coastal" | "noise", name: string | null, area: number | null) =>
  b && name ? (ratesFor(b[list], area).find((r) => r.name === name)?.price ?? 0) : 0;

export function price(e: Estimate): Pricing {
  const builder = builderByName(e.builder);
  const model = builder?.models.find((m) => m.name === e.model) ?? null;
  const range = builder?.ranges.find((r) => r.name === e.range) ?? null;
  const modelPrice = model && range ? (model.prices[range.column] ?? 0) : 0;
  const elevationPrice = builder?.elevations.find((s) => s.name === e.elevation)?.price ?? 0;
  const colourName = e.colourMode === "prestart" ? PRE_START : e.colour;
  const colourPrice = builder?.colours.find((c) => c.name === colourName)?.price ?? 0;
  const base = e.baseOverride ?? modelPrice + elevationPrice + colourPrice;

  const option = e.siteCost.kind === "option" ? builder?.siteCosts[e.siteCost.index] : null;
  const siteCost = e.siteCost.kind === "option" ? (option?.price ?? 0) : e.siteCost.amount;
  const siteCostLabel = e.siteCost.kind === "option" ? (option?.name ?? "No site cost option") : "Provisional Sum Siteworks";

  const bal = rateOf(builder, "bal", e.bal, e.floorArea);
  const coastal = rateOf(builder, "coastal", e.coastal, e.floorArea);
  const noise = rateOf(builder, "noise", e.noise, e.floorArea);
  const others = e.others.reduce((n, o) => n + o.price, 0);
  const charge = e.lines.filter((l) => l.inclusion === "include").reduce((n, l) => n + l.amount, 0);
  const credit = e.lines.filter((l) => l.inclusion === "exclude").reduce((n, l) => n + l.amount, 0);

  const hold = builder?.allowances[0]?.holdMonths ?? 0;
  const months = e.title.eta ? monthsToTitle(e.title.today, e.title.eta) : 0;
  const delay = months > hold ? months - hold : 0;
  const rule = builder && months > 0 ? ruleFor(builder.allowances, months) : null;
  // New Choice works the allowance on the preliminary contract, everyone else on the base.
  const calcBase = builder?.allowanceOnPrelim ? base + siteCost + bal + coastal + noise + others + (charge - credit) : base;
  const allowanceAmount = rule && delay > 0 ? allowancePrice(rule, calcBase, delay) : 0;
  const allowance: TitleAllowance = { months, hold, delay, rule, amount: allowanceAmount };

  const bundled = builder?.bundleAllowance ? allowanceAmount : 0;
  const displayedBase = base + bundled;
  const siteVariations = (builder?.bundleAllowance ? 0 : allowanceAmount) + bal + coastal + noise + others;
  const beforeVariations = displayedBase + siteCost + siteVariations;

  return {
    builder,
    model,
    range,
    modelPrice,
    elevationPrice,
    colourPrice,
    base,
    bundled,
    displayedBase,
    siteCost,
    siteCostLabel,
    allowance,
    bal,
    coastal,
    noise,
    others,
    siteVariations,
    charge,
    credit,
    beforeVariations,
    final: beforeVariations + charge - credit,
  };
}

/** The site cost variations as lines, for the Pricing step, the Summary and the PDF. */
export function siteVariationLines(e: Estimate, p: Pricing): { label: string; amount: number; note?: string }[] {
  const lines: { label: string; amount: number; note?: string }[] = [];
  if (p.allowance.amount > 0)
    lines.push({
      label: "Title Allowance",
      amount: p.allowance.amount,
      note: p.builder?.bundleAllowance ? "Included in the base build price" : undefined,
    });
  if (e.bal) lines.push({ label: `BAL Rating (${e.bal})`, amount: p.bal });
  if (e.coastal) lines.push({ label: `Coastal Distance (${e.coastal})`, amount: p.coastal });
  if (e.noise) lines.push({ label: `Noise Package (${e.noise})`, amount: p.noise });
  for (const o of e.others) lines.push({ label: o.title || "Other", amount: o.price });
  return lines;
}
