import { jobProgress, type Job } from "@/data/jobs";

/**
 * What narrows the CRM dash sync list: four filters that decide which jobs
 * the tiles count, and the tile that decides which of those the table shows.
 * All five live in the URL (`?builder=Forma&filter=awaiting`), so a filtered
 * view is a link someone else can open.
 */

export type TileFilter = "all" | "awaiting" | "attention" | "sync";
export const TILE_FILTERS = ["all", "awaiting", "attention", "sync"] as const;

export const FILTER_LABEL: Record<TileFilter, string> = {
  all: "All jobs",
  awaiting: "Awaiting a job number",
  attention: "Completed without a builder date",
  sync: "Sync needs attention",
};

/** The builder hasn't issued a job number yet. */
export const isAwaiting = (j: Job) => !j.jobNo.trim();

/**
 * The builder says a milestone is done and no date is on file. Nothing moves in
 * HubSpot or raises an invoice until there is one (job 25501's Slab Down). A live
 * list job carries that as a summary rather than its milestones; jobProgress reads either.
 */
export const needsBuilderDate = (j: Job) => jobProgress(j).needsDate;

/** Monday and Launchpad disagree, so the job can't sync until a person settles it. */
export const needsSync = (j: Job) => j.sync === "conflict";

export const TILE_MATCH: Record<TileFilter, (j: Job) => boolean> = {
  all: () => true,
  awaiting: isAwaiting,
  attention: needsBuilderDate,
  sync: needsSync,
};

/**
 * Builder, sales rep, brand and division. What Operations calls the brand is
 * the Locale business that sold the job (Homes, Wealth); the division is the
 * state it is built in.
 */
export const DIMENSIONS = ["builder", "rep", "brand", "region"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type JobFilters = Record<Dimension, string>;

export const DIMENSION_LABEL: Record<Dimension, string> = {
  builder: "Builder",
  rep: "Sales rep",
  brand: "Brand",
  region: "Division",
};

export const DIMENSION_ALL: Record<Dimension, string> = {
  builder: "All builders",
  rep: "All reps",
  brand: "All brands",
  region: "All divisions",
};

const STATE = /\b(WA|VIC|QLD|NSW|SA|NT|ACT|TAS)\s+\d{4}$/;

export function facet(job: Job, d: Dimension): string {
  switch (d) {
    case "builder":
      return job.builder;
    case "rep":
      return job.rep;
    // Every job mirrored in the prototype is on a Locale Homes board.
    case "brand":
      return "Homes";
    case "region":
      return STATE.exec(job.address)?.[1] ?? "";
  }
}

export interface FilterOption {
  value: string;
  count: number;
}

/** The values one filter can take, with how many jobs carry each, A to Z. */
export function filterOptions(jobs: Job[], d: Dimension): FilterOption[] {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    const v = facet(j, d);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
}

/** Search reads the job number, the client and the address. */
export function matchesSearch(job: Job, q: string): boolean {
  return !q || `${job.jobNo} ${job.client} ${job.address}`.toLowerCase().includes(q);
}
