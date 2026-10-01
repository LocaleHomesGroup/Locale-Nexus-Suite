/**
 * Wealth — static data for the package generator (`vm`, app.js 11711–11874).
 *
 * Baldivis's figures are the mockup's. The mockup shows only Baldivis in the
 * suburb picker; Alkimos and Yanchep are added because the mockup's own
 * "Recent packages" were built for them. THEIR FIGURES ARE ILLUSTRATIVE
 * placeholders (gross yield = rent × 52 ÷ median), not market data.
 */

export interface SuburbStat {
  label: string;
  value: string;
}

export interface Suburb {
  id: "baldivis" | "alkimos" | "yanchep";
  /** Picker label — "Baldivis WA 6171". */
  label: string;
  name: string;
  /** The design the suburb's package is built on — "The Hartley". */
  design: string;
  stats: SuburbStat[];
}

export const SUBURBS: Suburb[] = [
  {
    id: "baldivis",
    label: "Baldivis WA 6171",
    name: "Baldivis",
    design: "The Hartley",
    stats: [
      { label: "Median house price", value: "$612,000" },
      { label: "12-month growth", value: "+8.4%" },
      { label: "Median rent", value: "$620 pw" },
      { label: "Gross yield", value: "5.3%" },
      { label: "Vacancy rate", value: "0.6%" },
      { label: "Population growth", value: "+2.9% pa" },
    ],
  },
  {
    id: "alkimos",
    label: "Alkimos WA 6038",
    name: "Alkimos",
    design: "The Coventry",
    stats: [
      { label: "Median house price", value: "$655,000" },
      { label: "12-month growth", value: "+9.1%" },
      { label: "Median rent", value: "$650 pw" },
      { label: "Gross yield", value: "5.2%" },
      { label: "Vacancy rate", value: "0.8%" },
      { label: "Population growth", value: "+6.4% pa" },
    ],
  },
  {
    id: "yanchep",
    label: "Yanchep WA 6035",
    name: "Yanchep",
    design: "The Sorrento",
    stats: [
      { label: "Median house price", value: "$598,000" },
      { label: "12-month growth", value: "+10.2%" },
      { label: "Median rent", value: "$610 pw" },
      { label: "Gross yield", value: "5.3%" },
      { label: "Vacancy rate", value: "0.7%" },
      { label: "Population growth", value: "+4.8% pa" },
    ],
  },
];

export interface WealthPackage {
  /** "Baldivis — The Hartley package". */
  title: string;
  when: string;
}

export const packageTitle = (s: Suburb) => `${s.name} — ${s.design} package`;

export const SEED_PACKAGES: WealthPackage[] = [
  { title: "Baldivis — The Hartley package", when: "Generated today" },
  { title: "Alkimos — The Coventry package", when: "Generated yesterday" },
  { title: "Yanchep — The Sorrento package", when: "Generated 31 Jul" },
];
