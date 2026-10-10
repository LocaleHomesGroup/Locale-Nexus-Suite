/**
 * Paging for the Operations job list. The slicing is `paginate()` (src/lib/paginate.ts); this holds what is
 * particular to this list: the page size, what sends it back to page one, and the line that says which jobs
 * the table is on.
 */

/**
 * Jobs on a page. The desktop table and the phone list both draw the page's rows, so a page is 50 rows of
 * each. 977 live jobs are 20 pages; a list of 50 or fewer is one page and shows no pager.
 */
export const JOBS_PAGE_SIZE = 50;

/**
 * Everything that narrows the list, as one string. When it changes (a search, a filter, a tile, whether from
 * a click or from a link) the list goes back to page one. JSON, so that no value can pass for another by
 * carrying the separator.
 */
export function narrowingKey({ tile, filters, query }: { tile: string; filters: readonly string[]; query: string }): string {
  return JSON.stringify([tile, filters, query]);
}

/**
 * "Showing 51 to 100 of 977 jobs matching these filters · Awaiting a job number." The range is words, not a
 * dash. `total` is the list the table pages: what the search, the filters and the tile left.
 */
export function rangeLine({
  from,
  to,
  total,
  hasFilters,
  tile,
}: {
  from: number;
  to: number;
  total: number;
  hasFilters: boolean;
  /** The label of the KPI tile that is on, or null for all jobs. */
  tile: string | null;
}): string {
  return `Showing ${from} to ${to} of ${total} job${total === 1 ? "" : "s"}${hasFilters ? " matching these filters" : ""}${tile ? ` · ${tile}` : ""}.`;
}
