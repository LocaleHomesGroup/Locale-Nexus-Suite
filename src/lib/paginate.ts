/**
 * One page of a list, ten a page unless told otherwise. The page is clamped,
 * so a filter that shrinks the list never leaves you on a page that's gone.
 * `from` and `to` are the 1-based range a footer shows ("11–20 of 23").
 */
export interface PageSlice<T> {
  rows: T[];
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
}

export function paginate<T>(items: readonly T[], page: number, size = 10): PageSlice<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(0, page), pages - 1);
  const start = current * size;
  const rows = items.slice(start, start + size);
  return { rows, page: current, pages, from: total ? start + 1 : 0, to: start + rows.length, total };
}
