import {
  EMPLOYEE_RECORDS,
  ORG_DEPARTMENTS,
  ORG_SEED,
  orgDepartmentOf,
  type OrgDepartmentId,
  type OrgPerson,
} from "@/components/modules/hr/data";
import type { Db } from "./types";

/**
 * Today's chart departments to the roster's (the Employee Master Roster spec,
 * section 3): "AI & Growth" is Information Technology, "Accounts" is Accounting.
 * It covers every chart department by type: a new one fails to compile here
 * instead of its people being filed under Leadership.
 */
const DEPARTMENT_OF: Record<OrgDepartmentId, string> = {
  leadership: "leadership",
  finance: "finance",
  sales: "sales",
  marketing: "marketing",
  accounts: "accounting",
  ai: "it",
};

export interface StaffSeedRow {
  id: string;
  name: string | null;
  preferred_name: string | null;
  role: string;
  brand: string | null;
  department_id: string;
  reports_to: string | null;
  link: string | null;
  team: string | null;
  note: string | null;
  work_email: string | null;
  start_date: string | null;
  status: "active" | "pending";
  vacant: boolean;
}

/** One row per seat on the org chart. Work fields only: no personal emails or numbers. */
export function staffSeedRows(people: OrgPerson[] = ORG_SEED): StaffSeedRow[] {
  return people.map((p) => {
    const record = EMPLOYEE_RECORDS[p.id];
    return {
      id: p.id,
      name: p.name,
      preferred_name: record?.preferredName ?? null,
      role: p.role,
      brand: p.brands?.[0] ?? null,
      department_id: DEPARTMENT_OF[orgDepartmentOf(people, p.id)],
      reports_to: p.managerId,
      link: p.link ?? null,
      team: p.team ?? null,
      note: p.note ?? null,
      work_email: record?.workEmail ?? null,
      start_date: record?.commenced ?? null,
      status: p.name === null ? "pending" : "active",
      vacant: p.name === null,
    };
  });
}

export function departmentHeads(): { id: string; head: string }[] {
  return ORG_DEPARTMENTS.map((d) => ({ id: DEPARTMENT_OF[d.id], head: d.headId }));
}

/**
 * Writes the rows. A row already owned by the roster or edited by hand
 * (source <> 'org_seed') is left alone, and so is one that already matches the
 * chart: `written` counts the rows added or changed, an identical re-run writes
 * none and leaves updated_at alone, and a row changed by hand that is still
 * 'org_seed' is put back as the chart has it.
 *
 * Department heads are fill-only: one is set where the department has none and
 * the head's row exists, so a re-run never resets a head someone changed. A head
 * changed in the chart won't reach the database on a re-seed. That is fine for a
 * one-time loader: the roster takes over from here.
 */
export async function seedStaff(db: Db, rows: StaffSeedRow[]): Promise<{ written: number; heads: number }> {
  return db.transaction(async (tx) => {
    const written = await tx.query<{ id: string }>(
      `insert into launchpad.staff as s (
         id, name, preferred_name, role, brand, department_id, reports_to, link, team, note,
         work_email, start_date, status, vacant, source
       )
       select x.id, x.name, x.preferred_name, x.role, x.brand, x.department_id, x.reports_to, x.link,
              x.team, x.note, x.work_email, x.start_date, x.status, x.vacant, 'org_seed'
       from jsonb_to_recordset($1::jsonb) as x(
         id text, name text, preferred_name text, role text, brand text, department_id text,
         reports_to text, link text, team text, note text, work_email text, start_date date,
         status text, vacant boolean
       )
       on conflict (id) do update set
         name = excluded.name,
         preferred_name = excluded.preferred_name,
         role = excluded.role,
         brand = excluded.brand,
         department_id = excluded.department_id,
         reports_to = excluded.reports_to,
         link = excluded.link,
         team = excluded.team,
         note = excluded.note,
         work_email = excluded.work_email,
         start_date = excluded.start_date,
         status = excluded.status,
         vacant = excluded.vacant
       where s.source = 'org_seed'
         and (s.name, s.preferred_name, s.role, s.brand, s.department_id, s.reports_to, s.link, s.team,
              s.note, s.work_email, s.start_date, s.status, s.vacant)
             is distinct from
             (excluded.name, excluded.preferred_name, excluded.role, excluded.brand, excluded.department_id,
              excluded.reports_to, excluded.link, excluded.team, excluded.note, excluded.work_email,
              excluded.start_date, excluded.status, excluded.vacant)
       returning s.id`,
      [JSON.stringify(rows)],
    );
    const heads = await tx.query<{ id: string }>(
      `update launchpad.departments d set head_staff_id = x.head
       from jsonb_to_recordset($1::jsonb) as x(id text, head text)
       where d.id = x.id and d.head_staff_id is null
         and exists (select 1 from launchpad.staff s where s.id = x.head)
       returning d.id`,
      [JSON.stringify(departmentHeads())],
    );
    return { written: written.length, heads: heads.length };
  });
}
