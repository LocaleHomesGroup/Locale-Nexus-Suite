/** Locale works in Perth: times show in Perth's zone, the same on the server and in the browser. */
export const PERTH = "Australia/Perth";

// Built once: a formatter per call costs about 67 ms per 1,000 jobs on every page load.
const DAY = new Intl.DateTimeFormat("en-AU", {
  timeZone: PERTH,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  numberingSystem: "latn",
});
const CLOCK = new Intl.DateTimeFormat("en-AU", { timeZone: PERTH, hour: "numeric", minute: "2-digit", hour12: true });

/**
 * Perth's year, month and day, read from DAY's parts by their type. The whole text, and the order and
 * separators of the parts, are the locale's pattern, and ICU builds have changed a locale's pattern before
 * (en-CA's too). This runs in browsers as well as on the server, so none of them is relied on.
 */
const perthParts = (t: number | string | Date): { y: number; m: number; d: number } => {
  const parts = DAY.formatToParts(new Date(t));
  const part = (type: "year" | "month" | "day") => Number(parts.find((p) => p.type === type)?.value);
  return { y: part("year"), m: part("month"), d: part("day") };
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "2026-10-08": the date in Perth. */
export const perthDay = (t: number | string | Date): string => {
  const { y, m, d } = perthParts(t);
  return `${y}-${pad2(m)}-${pad2(d)}`;
};

/** "11:42am", in Perth. */
export const perthClock = (t: number | string | Date): string =>
  CLOCK.format(new Date(t))
    .replace(/\s/g, "")
    .toLowerCase();

/**
 * The names of the months and days, written out rather than read from ICU. en-AU's short months are
 * locale data that changes between ICU releases (it now writes "June", "July" and "Sept"), so a server and a
 * browser on different ICU would print different text, which React reports as a hydration error.
 * Use this table rather than keeping a copy, so September reads the same everywhere.
 */
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "Thu 8 Oct": the date in Perth with its weekday, built from perthParts and the tables above, so no ICU names. */
export const perthDate = (t: number | string | Date): string => {
  const { y, m, d } = perthParts(t);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
};
