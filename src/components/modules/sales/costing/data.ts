/**
 * Rapid costing — the price-list rates the mockup's `pm` costs a job from.
 * Static prototype data (Forma price list v3, effective 1 August 2026).
 */

export const COSTING_BUILDERS = ["Forma", "Move Homes", "La Vida", "New Era", "New Choice"] as const;
export type CostingBuilder = (typeof COSTING_BUILDERS)[number];

/** Base price per house design (AUD). */
export const HOUSE_BASE_PRICE = {
  "The Aspen": 284900,
  "The Marlowe": 312400,
  "The Sorrento": 268750,
  "The Halcyon": 341600,
} as const;
export type HouseDesign = keyof typeof HOUSE_BASE_PRICE;
export const HOUSE_DESIGNS = Object.keys(HOUSE_BASE_PRICE) as HouseDesign[];

export const STOREYS = ["Single", "Double"] as const;
export type Storey = (typeof STOREYS)[number];
export const DOUBLE_STOREY_LOADING = 41200;

export const BAL_RATINGS = ["BAL-12.5", "BAL-19", "BAL-29", "BAL-40"] as const;
export type BalRating = (typeof BAL_RATINGS)[number];
export const BAL_ALLOWANCE: Record<BalRating, number> = {
  "BAL-12.5": 0,
  "BAL-19": 3950,
  "BAL-29": 9420,
  "BAL-40": 21600,
};

export const SLOPES = ["Level", "Slight fall", "Significant fall"] as const;
export type Slope = (typeof SLOPES)[number];
export const SLOPE_ALLOWANCE: Record<Slope, number> = {
  Level: 0,
  "Slight fall": 4800,
  "Significant fall": 14500,
};

export const COASTAL_ALLOWANCE = 6480;
export const NOISE_ALLOWANCE = 5120;
export const FINISHING_TOUCH_PROMO = 18000;

export const BUYER_TYPES = ["Retail", "Wholesale"] as const;
export type BuyerType = (typeof BUYER_TYPES)[number];

/** Commission before the discount comes off it (a quarter of the discount). */
export const COMMISSION_BASE: Record<BuyerType, number> = { Retail: 4800, Wholesale: 3200 };
export const COMMISSION_DISCOUNT_SHARE = 0.25;

/** Above this a discount needs a company contribution, so a sales manager must approve it. */
export const DISCOUNT_APPROVAL_THRESHOLD = 5000;

export const DEFAULT_LAND_PRICE = 268000;

/** The design-guidelines file Jarvis reads in the compliance check. */
export const GUIDELINES_FILE = "Seaside_Rise_DesignGuidelines.pdf";

/** How long Jarvis "reads" the documents (ms). */
export const JARVIS_READ_MS = 1600;
