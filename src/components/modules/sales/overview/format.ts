import { millionsFromK } from "../data";

/** "1 sale", "3 sales". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A contract value in $k: 1260 → "$1.26m", 616 → "$616k". */
export const kValue = (k: number) => (k >= 1000 ? millionsFromK(k) : `$${Math.round(k)}k`);

/** +2 → "2 more than", 0 → "level with", −1 → "1 fewer than": a pace against the same point last period. */
export const paceWords = (delta: number) =>
  delta > 0 ? `${delta} more than` : delta < 0 ? `${-delta} fewer than` : "level with";
