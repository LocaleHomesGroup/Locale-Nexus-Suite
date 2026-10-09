import { perthClock, perthDate, perthDay } from "@/lib/perth-time";

/**
 * Where a live screen's data is up to, as a person would say it: "10:42am" when
 * Monday's last sync was on the day of the read (in Perth), otherwise
 * "11:59pm on Thu 8 Oct", so a stalled mirror can't pass for current.
 * It compares against `readAt`, the loader's read time, not the browser's clock,
 * so the server and the browser print the same text.
 */
export function asOfLabel(asOf: string, readAt: string): string {
  const clock = perthClock(asOf);
  return perthDay(asOf) === perthDay(readAt) ? clock : `${clock} on ${perthDate(asOf)}`;
}
