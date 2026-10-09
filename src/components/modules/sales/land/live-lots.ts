import type { LiveHold, LiveLot } from "@/data/live/types";
import { MONTHS, perthClock, perthDate, perthDay } from "@/lib/perth-time";
import type { LandLot } from "../data";

/** "11:42am today", "8:00am tomorrow", "10:00am on Sat 10 Oct". */
export function formatHoldExpiry(expiresAt: string, now: number): string {
  const t = Date.parse(expiresAt);
  const day = perthDay(t);
  const when = day === perthDay(now) ? "today" : day === perthDay(now + 86_400_000) ? "tomorrow" : `on ${perthDate(t)}`;
  return `${perthClock(t)} ${when}`;
}

const thousands = (n: number) => `$${Math.round(n / 1000)}k`;
const plain = (n: number) => String(Number(n));

export function lotPrice(lot: LiveLot): string {
  if (lot.packagePrice) return `Package ${thousands(lot.packagePrice)}${lot.design ? ` · ${lot.design}` : ""}`;
  if (lot.landPrice) return `Land ${thousands(lot.landPrice)}`;
  return "Price on request";
}

export function lotSpecs(lot: LiveLot): string {
  return [
    lot.areaSqm ? `${plain(lot.areaSqm)} sqm` : null,
    lot.frontageM ? `${plain(lot.frontageM)}m frontage` : null,
    lot.zoning,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function lotTitled(lot: LiveLot): string {
  if (lot.titleStatus === "titled") return "Titled";
  // A delay outranks the ETA it may have broken.
  if (lot.titleStatus === "delayed") return "Title delayed";
  if (lot.titleEta && /^\d{4}-\d{2}-\d{2}/.test(lot.titleEta)) {
    const [, m, d] = lot.titleEta.split("-").map(Number);
    return `Title ETA ${d} ${MONTHS[m - 1]}`;
  }
  if (lot.titleStatus === "untitled") return "Untitled";
  return "";
}

const holderOf = (h: LiveHold) => (h.client ? `${h.name} for ${h.client}` : h.name);

/**
 * A live lot as the Exclusive Land screen draws it, for one viewer: the same
 * LandLot shape the sample data uses, so the cards don't change. Times are
 * Perth's, wherever the code runs.
 */
export function viewLot(lot: LiveLot, viewerId: string | null, now: number): LandLot {
  const sold = lot.saleStatus === "sold";
  // A started hold past its expiry has lapsed, even before the settle ends it, and so
  // has one whose expiry can't be read. The holds that never started keep their
  // places: the next settle starts the first.
  const holds = lot.holds.filter((h) => !(h.startedAt !== null && h.expiresAt !== null && !(Date.parse(h.expiresAt) > now)));
  const active = sold ? undefined : holds.find((h) => h.startedAt !== null);
  const position = viewerId ? holds.findIndex((h) => h.staffId === viewerId) : -1;
  const queued = !sold && position >= 0 && holds[position] !== active;
  return {
    id: lot.id,
    lot: lot.lot,
    estate: lot.estate ?? "",
    builder: lot.builder ?? "Any builder",
    status: sold ? "sold" : active ? "hold" : "available",
    price: lotPrice(lot),
    specs: lotSpecs(lot),
    titled: lotTitled(lot),
    note: lot.rebate ?? undefined,
    holder: sold ? (lot.soldBy ?? undefined) : active ? holderOf(active) : undefined,
    expires: active?.expiresAt ? `Hold expires ${formatHoldExpiry(active.expiresAt, now)}` : undefined,
    queue: !sold && holds.length > 0 ? holds.length : undefined,
    mine: Boolean(active && active.staffId === viewerId),
    queuedAt: queued ? position + 1 : undefined,
  };
}
