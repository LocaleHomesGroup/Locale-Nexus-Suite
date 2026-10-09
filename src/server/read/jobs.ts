import type { Job } from "@/data/jobs";
import type { Db } from "../db/types";
import { toJob, type JobRow, type MilestoneRow } from "./to-job";

/**
 * Live jobs for My clients, All clients and the Operations job list: the sales
 * and construction boards. Handed-over jobs stay in the mirror but out of the
 * screens, which keeps the page payload small.
 */
export async function loadJobs(db: Db): Promise<Job[]> {
  const rows = await db.query<JobRow>(
    `select j.item_id, j.purpose, j.job_number, j.deal_name, j.site_address, j.site_suburb, j.site_state,
            j.builder, j.buyer_type, j.block_titled, j.title_due_date::text as title_due_date,
            j.sale_won_date::text as sale_won_date, j.construction_stage, j.hubspot_deal_id, j.updated_at,
            coalesce(s.name, nullif(btrim(j.sales_rep), '')) as rep
     from launchpad.monday_jobs j
     left join launchpad.staff_aliases a on a.alias = lower(btrim(j.sales_rep))
     left join launchpad.staff s on s.id = a.staff_id
     where j.purpose in ('sales', 'construction')
     order by j.sale_won_date desc nulls last, j.item_id desc`,
  );
  if (rows.length === 0) return [];
  const milestones = await db.query<MilestoneRow>(
    `select m.job_item_id, m.name, m.status_label, m.due_date::text as due_date,
            m.date_completed::text as date_completed, m.monday_created_at
     from launchpad.monday_job_milestones m
     join launchpad.monday_jobs j on j.item_id = m.job_item_id and j.purpose in ('sales', 'construction')
     order by m.job_item_id, m.monday_created_at, m.item_id`,
  );
  const byJob = new Map<number, MilestoneRow[]>();
  for (const m of milestones) {
    const list = byJob.get(m.job_item_id) ?? [];
    list.push(m);
    byJob.set(m.job_item_id, list);
  }
  return rows.map((r) => toJob(r, byJob.get(r.item_id) ?? []));
}
