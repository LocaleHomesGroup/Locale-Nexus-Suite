import type { RepOption } from "@/data/live/types";
import type { Db } from "../db/types";

/** Everyone in Sales, for the "Viewing as" picker and as the people who hold lots. */
export async function loadReps(db: Db): Promise<RepOption[]> {
  return db.query<RepOption>(
    `select id, name from launchpad.staff
     where department_id = 'sales' and status = 'active' and not vacant
     order by name`,
  );
}
