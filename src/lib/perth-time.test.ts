import { test } from "node:test";
import assert from "node:assert/strict";
import { MONTHS, perthDate, perthDay } from "./perth-time";

// The host's timezone is set in-process, because Node on Windows honours a startup TZ= only for UTC. UTC is
// the usual server; New York is west of it, where a local-time getter used on a UTC date would read the day
// before. The offsets are minutes west of UTC on 8 Oct 2026. They show the zone took, so a host that ignored
// the setting can't let a case pass for the wrong reason.
const HOST_ZONES = [
  ["UTC", 0],
  ["America/New_York", 240],
] as const;

/** Registers `body` as one test per host zone, with the zone set while it runs and put back after. */
function inHostZones(name: string, body: () => void): void {
  for (const [zone, minutesWest] of HOST_ZONES) {
    test(`${name} (host in ${zone})`, () => {
      const before = process.env.TZ;
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      process.env.TZ = zone;
      try {
        assert.equal(new Date("2026-10-08T12:00:00Z").getTimezoneOffset(), minutesWest, `the host is in ${zone}`);
        body();
      } finally {
        // Deleting TZ doesn't bring the system's zone back on Windows, so set the one the host resolved to.
        process.env.TZ = before ?? resolved;
      }
    });
  }
}

inHostZones("perth date: June, July and September read Jun, Jul and Sep, not the runtime's 'June', 'July' and 'Sept'", () => {
  assert.equal(perthDate("2026-06-15T02:00:00Z"), "Mon 15 Jun");
  assert.equal(perthDate("2026-07-04T02:00:00Z"), "Sat 4 Jul");
  assert.equal(perthDate("2026-09-10T02:00:00Z"), "Thu 10 Sep");
});

inHostZones("perth date: every month and every weekday comes from the fixed tables", () => {
  // The 1st of each month of 2026 at noon in Perth (04:00 UTC). The weekdays were worked out from
  // Thursday 8 Oct 2026 and checked against Zeller's congruence; together they use all seven.
  const firsts = [
    "Thu 1 Jan", "Sun 1 Feb", "Sun 1 Mar", "Wed 1 Apr", "Fri 1 May", "Mon 1 Jun",
    "Wed 1 Jul", "Sat 1 Aug", "Tue 1 Sep", "Thu 1 Oct", "Sun 1 Nov", "Tue 1 Dec",
  ];
  firsts.forEach((want, i) => assert.equal(perthDate(Date.UTC(2026, i, 1, 4)), want));
  // And perthDay's text for the same instants: the one-digit months January to September read as two digits.
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  months.forEach((mm, i) => assert.equal(perthDay(Date.UTC(2026, i, 1, 4)), `2026-${mm}-01`));
  // Perth's midnight into the 1st: 16:00 UTC on the last day of February is already March in Perth.
  assert.equal(perthDay("2026-02-28T15:59:00Z"), "2026-02-28");
  assert.equal(perthDay("2026-02-28T16:00:00Z"), "2026-03-01");
  assert.equal(perthDate("2026-02-28T15:59:00Z"), "Sat 28 Feb");
  assert.equal(perthDate("2026-02-28T16:00:00Z"), "Sun 1 Mar");
  assert.equal(MONTHS.length, 12);
});

inHostZones("perth date: Perth's midnight, not UTC's, changes the day", () => {
  assert.equal(perthDate("2026-10-08T15:59:00Z"), "Thu 8 Oct");
  assert.equal(perthDate("2026-10-08T16:00:00Z"), "Fri 9 Oct");
  // perthDay and perthDate read the same year, month and day, so pin perthDay's text here too.
  assert.equal(perthDay("2026-10-08T15:59:00Z"), "2026-10-08");
  assert.equal(perthDay("2026-10-08T16:00:00Z"), "2026-10-09");
});

inHostZones("perth date: it takes a number, a Date or a string, and rolls over a year and a leap day", () => {
  assert.equal(perthDate(Date.parse("2026-10-08T16:00:00Z")), "Fri 9 Oct");
  assert.equal(perthDate(new Date("2026-12-31T16:00:00Z")), "Fri 1 Jan"); // 1 Jan 2027 in Perth
  assert.equal(perthDate("2028-02-29T02:00:00Z"), "Tue 29 Feb");
  // perthDay's text for the same kinds of input, either side of Perth's year and leap-day midnights.
  assert.equal(perthDay(Date.parse("2026-10-08T16:00:00Z")), "2026-10-09");
  assert.equal(perthDay(new Date("2026-12-31T15:59:00Z")), "2026-12-31");
  assert.equal(perthDay(new Date("2026-12-31T16:00:00Z")), "2027-01-01");
  assert.equal(perthDay("2028-02-28T16:00:00Z"), "2028-02-29");
  assert.equal(perthDay("2028-02-29T02:00:00Z"), "2028-02-29");
});

/** Runs `fn` with one member of Intl.DateTimeFormat.prototype replaced, and puts the original back whatever happens. */
function replacing<T>(key: "format" | "formatToParts", replacement: PropertyDescriptor, fn: () => T): T {
  const proto = Intl.DateTimeFormat.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, key)!;
  Object.defineProperty(proto, key, { ...original, ...replacement });
  try {
    return fn();
  } finally {
    Object.defineProperty(proto, key, original);
  }
}

// [instant, perthDay, perthDate]: one-digit parts, either side of Perth's midnight, a year roll and a leap day.
const SAMPLES: [instant: string, day: string, date: string][] = [
  ["2026-03-04T02:00:00Z", "2026-03-04", "Wed 4 Mar"],
  ["2026-10-08T15:59:00Z", "2026-10-08", "Thu 8 Oct"],
  ["2026-10-08T16:00:00Z", "2026-10-09", "Fri 9 Oct"],
  ["2026-12-31T16:00:00Z", "2027-01-01", "Fri 1 Jan"],
  ["2028-02-29T02:00:00Z", "2028-02-29", "Tue 29 Feb"],
];
const readSamples = (): string[][] => SAMPLES.map(([instant]) => [perthDay(instant), perthDate(instant)]);
const wanted = SAMPLES.map(([, day, date]) => [day, date]);

test("perth time: the day doesn't depend on the runtime's date pattern", () => {
  const realParts = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "formatToParts")!.value;
  // The real parts, reordered month/day/year with "/" between them: the shape a non-ISO pattern gives.
  const monthFirst = (self: Intl.DateTimeFormat, date?: Date | number): Intl.DateTimeFormatPart[] => {
    const parts: Intl.DateTimeFormatPart[] = realParts.call(self, date);
    const part = (type: string) => parts.find((p) => p.type === type)!;
    const slash = { type: "literal", value: "/" } as const;
    return [part("month"), slash, part("day"), slash, part("year")];
  };
  const formatToParts = {
    value(this: Intl.DateTimeFormat, date?: Date | number) {
      return monthFirst(this, date);
    },
  };
  // format() agrees with it, as it would in a runtime with that pattern: code that reads its whole text gets "10/09/2026".
  const format = {
    get(this: Intl.DateTimeFormat) {
      return (date?: Date | number) => monthFirst(this, date).map((p) => p.value).join("");
    },
  };
  const got = replacing("formatToParts", formatToParts, () => replacing("format", format, readSamples));
  assert.deepEqual(got, wanted);
});

test("perth time: it reads the formatter's parts, never its whole text", () => {
  const throws = {
    get(): never {
      throw new Error("format() was read");
    },
  };
  const got = replacing("format", throws, readSamples);
  assert.deepEqual(got, wanted);
});
