import type { Job, Milestone } from "@/data/jobs";
import type { Db } from "../db/types";
import { toListJob, toMilestones, type JobRow, type MilestoneRow } from "./to-job";

/**
 * The milestone rows both reads below take, for the jobs the screens show only. A list's summary and a
 * job's own milestones come from the same rows, so they agree.
 */
const MILESTONE_ROWS = `select m.job_item_id, m.name, m.status_label, m.due_date::text as due_date,
            m.date_completed::text as date_completed, m.monday_created_at
     from launchpad.monday_job_milestones m
     join launchpad.monday_jobs j on j.item_id = m.job_item_id and j.purpose in ('sales', 'construction')`;

/**
 * Live jobs for My clients, All clients and the Operations job list: the sales
 * and construction boards. Handed-over jobs stay in the mirror but out of the
 * screens, which keeps the page payload small.
 *
 * These are list jobs: each carries a `progress` summary in place of its milestones, because a page ships
 * every job in its HTML and the milestones were most of that. A job's own screen reads them with
 * loadJobMilestones.
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
  const milestones = await db.query<MilestoneRow>(`${MILESTONE_ROWS}
     order by m.job_item_id, m.monday_created_at, m.item_id`);
  const byJob = new Map<number, MilestoneRow[]>();
  for (const m of milestones) {
    const list = byJob.get(m.job_item_id) ?? [];
    list.push(m);
    byJob.set(m.job_item_id, list);
  }
  return rows.map((r) => toListJob(r, byJob.get(r.item_id) ?? []));
}

/**
 * One job's milestones, preconstruction and construction apart, for its own screen. The same rows and
 * mapping loadJobs summarises. A job that isn't on the list (or isn't there) has none.
 */
export async function loadJobMilestones(db: Db, itemId: number): Promise<{ precon: Milestone[]; milestones: Milestone[] }> {
  const rows = await db.query<MilestoneRow>(
    `${MILESTONE_ROWS}
     where m.job_item_id = $1
     order by m.monday_created_at, m.item_id`,
    [itemId],
  );
  return toMilestones(rows);
}
