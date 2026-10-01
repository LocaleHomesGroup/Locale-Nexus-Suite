/**
 * Operations → Pricing — the builder price lists published from Doc formatter.
 * Static prototype data, verbatim from the mockup (`um`).
 */

export type PriceListStatus = "Published" | "In review" | "Awaiting PDF";

export interface BuilderPriceList {
  builder: string;
  version: string;
  /** "—" when the builder has not sent this month's PDF yet. */
  received: string;
  /** Rates changed against the previous list; 0 = none recorded yet. */
  changes: number;
  status: PriceListStatus;
}

export const PRICE_LISTS: BuilderPriceList[] = [
  { builder: "Move Homes", version: "Aug 2026", received: "1 Aug", changes: 14, status: "Published" },
  { builder: "Forma", version: "Aug 2026", received: "2 Aug", changes: 9, status: "Published" },
  { builder: "La Vida", version: "Aug 2026", received: "3 Aug", changes: 22, status: "In review" },
  { builder: "New Choice", version: "Jul 2026", received: "—", changes: 0, status: "Awaiting PDF" },
  { builder: "New Era", version: "Jul 2026", received: "—", changes: 0, status: "Awaiting PDF" },
];

/** Model rows on the Monday Models board (the mockup's "Models tracked"). */
export const MODELS_TRACKED = 312;
