import type { LiveHold, LiveLot } from "@/data/live/types";
import type { Db } from "../db/types";

interface LotRow {
  id: string;
  lot_label: string;
  estate: string | null;
  developer: string | null;
  builder: string | null;
  land_price: number | null;
  package_price: number | null;
  package_design: string | null;
  area_sqm: number | null;
  frontage_m: number | null;
  zoning: string | null;
  title_status: LiveLot["titleStatus"];
  title_eta: string | null;
  rebate_note: string | null;
  sale_status: "available" | "sold";
  sold_by_name: string | null;
  sold_client: string | null;
  monday_item_id: number | null;
  removed: boolean;
  holds: LiveHold[];
}

/** Exclusive Land's lots and open holds. Settles lapsed holds first, so what's read is current. */
export async function loadLots(db: Db): Promise<LiveLot[]> {
  await db.query("select count(*) from launchpad.settle_land_holds()");
  const rows = await db.query<LotRow>(
    `select id::text as id, lot_label, estate, developer, builder,
            land_price::float8 as land_price, package_price::float8 as package_price, package_design,
            area_sqm::float8 as area_sqm, frontage_m::float8 as frontage_m, zoning, title_status,
            title_eta::text as title_eta, rebate_note, sale_status, sold_by_name, sold_client,
            monday_item_id, monday_removed_at is not null as removed, holds
     from launchpad.land_lot_board
     order by (sale_status = 'sold'), estate nulls last, lot_label`,
  );
  return rows.map((r) => ({
    id: r.id,
    lot: r.lot_label,
    estate: r.estate,
    developer: r.developer,
    builder: r.builder,
    landPrice: r.land_price,
    packagePrice: r.package_price,
    design: r.package_design,
    areaSqm: r.area_sqm,
    frontageM: r.frontage_m,
    zoning: r.zoning,
    titleStatus: r.title_status,
    titleEta: r.title_eta,
    rebate: r.rebate_note,
    saleStatus: r.sale_status,
    soldBy: r.sold_by_name,
    soldClient: r.sold_client,
    mondayItemId: r.monday_item_id,
    removedFromMonday: r.removed,
    holds: r.holds ?? [],
  }));
}
