import { aud } from "@/lib/utils";
import { siteVariationLines, ruleText, type Pricing } from "./pricing";
import { clientName, colourLabel, type Estimate, type PdfOptions } from "./store";

/**
 * The quote as a document: what the PDF prints and the Quote PDF step's
 * preview shows, worked out once so the two can never disagree.
 */
export interface QuoteDoc {
  no: string;
  date: string;
  validUntil: string;
  preparedBy: string;
  client: string;
  address: string;
  clientRows: [string, string][];
  homeRows: [string, string][];
  price: { label: string; amount: number; sign: "" | "+" | "−"; note?: string }[];
  final: number;
  includes: string[];
  siteLines: { label: string; amount: number; note?: string }[] | null;
  /** How the delayed-title allowance was worked out, when there is one. */
  titleNote: string | null;
  lines: { description: string; type: "Charge" | "Credit"; boltOn: boolean; pricing: string; qty: number; amount: number }[] | null;
  notes: string;
  nextSteps: { intro: string; bullets: string[] };
  disclaimer: string;
  fileName: string;
}

/** Whole dollars, or cents when a quantity left some ("$228", "$1,312.50"). */
export const money = (n: number) => {
  const whole = Number.isInteger(Math.round(n * 100) / 100);
  return aud(n, { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
};

const longDate = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
const isoDate = (iso: string) => longDate(new Date(`${iso}T00:00:00`));
const m2 = (n: number | null) => (n == null ? "" : `${n.toLocaleString("en-AU")} m²`);

/** HomeScope's Summary "Next Steps", word for word. */
export const NEXT_STEPS = {
  intro:
    "Thank you for using our estimate tool! Our team will review your selections and provide you with a detailed estimate within 2-3 business days.",
  bullets: [
    "You'll receive an email confirmation shortly",
    "Our design team will prepare your custom estimate",
    "We'll schedule a consultation to discuss your project",
  ],
};

export function frontageText(e: Estimate): string {
  if (e.corner) return "Corner block";
  if (e.min != null && e.max != null) return e.min === e.max ? `${e.min}m` : `${e.min}m to ${e.max}m`;
  if (e.max != null) return `Up to ${e.max}m`;
  if (e.min != null) return `${e.min}m or wider`;
  return "Not set";
}

export function modelMeta(p: Pricing): string {
  const m = p.model;
  if (!m) return "";
  return [m.beds ? `${m.beds} bed` : null, m.baths ? `${m.baths} bath` : null, m.totalArea ? m2(m.totalArea) : null]
    .filter(Boolean)
    .join(" · ");
}

export function quoteDoc(e: Estimate, p: Pricing, opts: PdfOptions, no: string, now = new Date()): QuoteDoc {
  const valid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + opts.validDays);
  const client = clientName(e);
  const people = e.contacts.filter((c) => c.firstName || c.lastName);

  const clientRows: [string, string][] = [
    ...people.flatMap((c, i): [string, string][] => [
      [people.length > 1 ? `Client ${i + 1}` : "Name", `${c.firstName} ${c.lastName}`.trim()],
      ["Email", c.email],
      ...(c.phone ? [["Phone", c.phone] as [string, string]] : []),
    ]),
    ["Site address", e.address],
    ["Total lot size", m2(e.lotSize)],
    ["Frontage", frontageText(e)],
  ];

  const homeRows: [string, string][] = [
    ["Builder", p.builder?.name ?? ""],
    ["Model", [p.model?.name, modelMeta(p)].filter(Boolean).join(" · ")],
    ["Spec range", p.range ? `${p.range.name} (${p.range.level})` : ""],
    ["Front elevation", e.elevation ?? ""],
    ["Colour scheme", colourLabel(e)],
    ["Site cost option", p.siteCostLabel],
  ];

  const price: QuoteDoc["price"] = [
    {
      label: "Base build price",
      amount: p.displayedBase,
      sign: "",
      note: p.bundled > 0 ? `Includes the ${aud(p.bundled)} delayed-title allowance` : e.baseOverride != null ? "Adjusted by your consultant" : undefined,
    },
    { label: `Site costs (${e.siteCost.kind === "option" ? "fixed" : "provisional sum"})`, amount: p.siteCost, sign: "+" },
    { label: "Site cost variations", amount: p.siteVariations, sign: "+" },
  ];
  if (p.charge > 0 || p.credit === 0) price.push({ label: "Variations charge", amount: p.charge, sign: "+" });
  if (p.credit > 0) price.push({ label: "Variations credit", amount: p.credit, sign: "−" });

  const includes = [
    `${p.builder?.name ?? ""} – ${p.model?.name ?? ""}`,
    `${p.range?.name ?? ""} specification range`,
    `${e.elevation ?? ""} front elevation`,
    ...(p.elevationPrice ? [`Elevation upgrade ${aud(p.elevationPrice)}`] : []),
    ...(p.colourPrice ? [`Colour scheme ${aud(p.colourPrice)}`] : []),
  ];

  const a = p.allowance;
  const titleNote =
    a.amount > 0 && a.rule && e.title.eta
      ? `Title ETA ${isoDate(e.title.eta)}: ${a.months} months to title, ${a.hold}-month price hold, so ${a.delay} month${a.delay === 1 ? "" : "s"} at ${ruleText(a.rule, Boolean(p.builder?.allowanceOnPrelim), aud)}.`
      : null;

  const builderName = p.builder?.name ?? "the builder";
  return {
    no,
    date: longDate(now),
    validUntil: longDate(valid),
    preparedBy: e.staff ?? "Locale Homes",
    client,
    address: e.address,
    clientRows: clientRows.filter(([, v]) => v),
    homeRows: homeRows.filter(([, v]) => v),
    price,
    final: p.final,
    includes,
    siteLines: opts.siteBreakdown ? siteVariationLines(e, p) : null,
    titleNote: opts.siteBreakdown ? titleNote : null,
    lines: opts.itemised
      ? e.lines.map((l) => ({
          description: l.description,
          type: l.inclusion === "include" ? "Charge" : "Credit",
          boltOn: l.source === "boltOn",
          pricing: l.pricing === "provisional" ? "Provisional" : "Fixed",
          qty: l.qty,
          amount: l.amount,
        }))
      : null,
    notes: opts.notes.trim(),
    nextSteps: NEXT_STEPS,
    disclaimer: `Estimate only, not a contract. Prices are indicative until confirmed against ${builderName}'s current price list, and this estimate is valid until ${longDate(valid)}.`,
    fileName: `${no} ${client}.pdf`.replace(/[\\/:*?"<>|]/g, ""),
  };
}
