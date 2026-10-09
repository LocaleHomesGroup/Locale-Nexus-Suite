import type { Db } from "./types";

/** "test-rep-a" → "Test Rep A". */
const titleOf = (id: string) =>
  id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** Inserts one invented staff member. Tests only: never a real person. */
export async function addStaff(
  db: Db,
  id: string,
  opts: { name?: string | null; department?: string; reportsTo?: string | null; email?: string | null } = {},
): Promise<void> {
  const name = opts.name === undefined ? titleOf(id) : opts.name;
  await db.query(
    `insert into launchpad.staff (id, name, role, department_id, reports_to, work_email, vacant)
     values ($1, $2, 'Test role', $3, $4, $5, $6)`,
    [id, name, opts.department ?? "sales", opts.reportsTo ?? null, opts.email ?? null, name === null],
  );
}
