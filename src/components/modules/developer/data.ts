/**
 * Developer portal — the static half of what a building company sees: its
 * designs and terms as Locale's consultants see them, and the match insights
 * from recorded consultations ("we also help the developers: this is your
 * weakness"). The live half (its Locale clients, their milestones, Locale's
 * invoices) comes from the shared store.
 *
 * The developer is Forma (`DEVELOPER`). Designs and prices are Forma's price
 * list v3 (sales/costing/data.ts); the price-list row is Operations' Pricing.
 */
import { DOUBLE_STOREY_LOADING, HOUSE_BASE_PRICE, type HouseDesign } from "@/components/modules/sales/costing/data";
import { PRICE_LISTS } from "@/components/modules/operations/pricing/data";
import { DEVELOPER } from "@/data/portal";

/** This developer's price list as Locale Operations holds it. */
export const PRICE_LIST = PRICE_LISTS.find((p) => p.builder === DEVELOPER) ?? PRICE_LISTS[0];

/* ── Designs and pricing ───────────────────────────────────────────────── */

export interface Design {
  name: HouseDesign;
  spec: string;
  size: string;
  /** Weeks from site start to keys. */
  weeks: number;
  /** House and land packages on Locale using this design. */
  packages: number;
  /** Times it was in a client's top four this quarter. */
  matched: number;
}

export const DESIGNS: Design[] = [
  { name: "The Aspen", spec: "4 bed · 2 bath · study", size: "192 sqm", weeks: 32, packages: 4, matched: 23 },
  { name: "The Sorrento", spec: "4 bed · 2 bath", size: "186 sqm", weeks: 30, packages: 3, matched: 9 },
  { name: "The Marlowe", spec: "4 bed · 2 bath · theatre", size: "210 sqm", weeks: 34, packages: 2, matched: 6 },
  { name: "The Halcyon", spec: "5 bed · 3 bath · activity", size: "254 sqm", weeks: 38, packages: 1, matched: 3 },
];

export const basePrice = (d: Design) => HOUSE_BASE_PRICE[d.name];
export { DOUBLE_STOREY_LOADING };

/* ── Terms and requirements ────────────────────────────────────────────── */

/**
 * "Every builder does things a little bit differently" — Forma's terms as
 * Locale's consultants see them, so a consultant who sells for five builders
 * never has to remember which one does what.
 */
export const TERMS: { label: string; value: string }[] = [
  { label: "Initial deposit", value: "$2,500 to hold, balance to 5% at contract" },
  { label: "Build time", value: "32 weeks from site start, single storey" },
  { label: "Price hold", value: "60 days from the date of quote" },
  { label: "Site works", value: "Fixed, up to a 1 m fall across the block" },
  { label: "Variations", value: "Free until prestart, then $350 an item" },
  { label: "Home indemnity insurance", value: "Issued at contract" },
  { label: "Maintenance period", value: "6 months after handover" },
];

/* ── Match insights (recorded consultations) ───────────────────────────── */

export const INSIGHTS_PERIOD = "Jul to Sep 2026";

/**
 * Every Locale consultation is recorded and scored against every builder's
 * packages. These are this developer's numbers from that scoring.
 */
export const MATCH_STATS = {
  /** Consultations scored across Locale. */
  consultations: 118,
  /** In the client's top four. */
  shortlisted: 41,
  /** The highest-scoring builder, so the consultant endorsed it. */
  rankedFirst: 17,
  /** The client chose this developer. */
  chosen: 14,
  avgScore: 84,
  marketAvg: 79,
};

/** This developer against the average of every builder on Locale, per match factor. */
export const FACTOR_SCORES: { factor: string; you: number; market: number }[] = [
  { factor: "Brief fit", you: 86, market: 80 },
  { factor: "Budget fit", you: 88, market: 81 },
  { factor: "Builder confidence", you: 90, market: 82 },
  { factor: "Build time", you: 71, market: 77 },
];

/** Where deals fall off between the shortlist and a signed contract. */
export const FUNNEL: { stage: string; count: number }[] = [
  { stage: "Shortlisted", count: 41 },
  { stage: "Presented to the client", count: 33 },
  { stage: "Chosen", count: 14 },
  { stage: "Contracts signed", count: 12 },
];

/** Why clients who saw this developer chose someone else, from the recordings. */
export const OBJECTIONS: { objection: string; said: string; count: number }[] = [
  { objection: "Build time", said: "32 weeks is longer than the 30 we were quoted elsewhere.", count: 8 },
  { objection: "Site costs", said: "Why aren't the site costs in the base price?", count: 5 },
  { objection: "Builder stability", said: "What happens if the builder goes under mid-build?", count: 3 },
  { objection: "Double storey", said: "Nothing double-storey under $650k.", count: 3 },
];

/** Where Locale's enquiries want to build this quarter, and this developer's packages there. */
export const DEMAND: { suburb: string; enquiries: number; packages: number }[] = [
  { suburb: "Baldivis", enquiries: 64, packages: 0 },
  { suburb: "Lakelands", enquiries: 48, packages: 4 },
  { suburb: "Yanchep", enquiries: 41, packages: 3 },
  { suburb: "Alkimos", enquiries: 33, packages: 2 },
  { suburb: "Wellard", enquiries: 27, packages: 1 },
];
