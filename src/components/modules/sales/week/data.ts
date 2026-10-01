/**
 * My week — the rep's weekly scorecard (mockup `cm`). Signed deals come from
 * the CRM; the forecast is the only thing the rep types. Static prototype data
 * for the week ending Sun 9 August 2026.
 */

/** Builders on the scorecard, in the order the mockup lists them. */
export const SCORECARD_BUILDERS = [
  "Move Homes",
  "Forma",
  "Endeavour",
  "101 Residential",
  "New Choice",
  "New Era",
  "Select",
] as const;
export type ScorecardBuilder = (typeof SCORECARD_BUILDERS)[number];

/** Deals moved to Sale Won between Monday and Sunday, per builder (from HubSpot). */
export const SIGNED_THIS_WEEK: Record<ScorecardBuilder, number> = {
  "Move Homes": 2,
  Forma: 1,
  Endeavour: 0,
  "101 Residential": 0,
  "New Choice": 1,
  "New Era": 0,
  Select: 0,
};

/** Last week's forecast, pre-filled into this week's form. */
export const LAST_WEEK_FORECAST: Record<ScorecardBuilder, number> = {
  "Move Homes": 3,
  Forma: 2,
  Endeavour: 0,
  "101 Residential": 1,
  "New Choice": 1,
  "New Era": 0,
  Select: 0,
};

/** Last week's result, for the accuracy note. */
export const LAST_WEEK = { forecast: 6, signed: 5 } as const;
