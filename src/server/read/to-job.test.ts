import { test } from "node:test";
import assert from "node:assert/strict";
import { displayDate, milestoneStatus, toJob, type JobRow, type MilestoneRow } from "./to-job";

const row = (over: Partial<JobRow> = {}): JobRow => ({
  item_id: 1001,
  purpose: "construction",
  job_number: "12345",
  deal_name: "Test Client A",
  site_address: "Lot 1, 2 Test Street",
  site_suburb: "Testville",
  site_state: "WA",
  builder: "Test Builder",
  buyer_type: "Investor - Retail",
  block_titled: "No",
  title_due_date: "2026-09-30",
  sale_won_date: "2026-03-14",
  construction_stage: "Slab Down",
  hubspot_deal_id: 999,
  updated_at: "2026-10-07T03:00:00Z",
  rep: "Test Rep A",
  ...over,
});

const ms = (name: string, label: string | null, completed: string | null = null): MilestoneRow => ({
  job_item_id: 1001,
  name,
  status_label: label,
  due_date: null,
  date_completed: completed,
  monday_created_at: null,
});

test("to-job: dates read like the prototype's", () => {
  assert.equal(displayDate("2026-03-04"), "04 Mar 2026");
  assert.equal(displayDate(null), "");
  assert.equal(displayDate("soon"), "");
});

test("to-job: milestone labels map onto the prototype's statuses", () => {
  assert.equal(milestoneStatus("Done", "2026-10-01"), "done");
  assert.equal(milestoneStatus("Completed", null), "pendingDate", "done without a date is awaiting one");
  assert.equal(milestoneStatus("Working on it", null), "prog");
  assert.equal(milestoneStatus("Overdue", null), "prog");
  assert.equal(milestoneStatus("N/A", null), "na");
  assert.equal(milestoneStatus("Not Started", null), "open");
  assert.equal(milestoneStatus(null, null), "open");
  assert.equal(milestoneStatus("Incomplete", null), "open", "only a whole done label counts");
  assert.equal(milestoneStatus("Not complete", null), "open");
});

test("to-job: a Monday job becomes the prototype's Job", () => {
  const job = toJob(row(), [
    ms("Slab Down", "Done", "2026-10-01"),
    ms("Contracts Signed", "Done", "2026-04-02"),
    ms("Builder Acceptance", "Done", "2026-03-20"),
    ms("Date to Site", "Done", "2026-09-01"),
    ms("Some Monday-only step", "Not Started"),
  ]);
  assert.equal(job.id, 1001);
  assert.equal(job.jobNo, "12345");
  assert.equal(job.recordId, "999");
  assert.equal(job.client, "Test Client A");
  assert.equal(job.address, "Lot 1, 2 Test Street, Testville, WA");
  assert.equal(job.board, "construction");
  assert.equal(job.hsStage, "Slab Down");
  assert.equal(job.rep, "Test Rep A");
  assert.equal(job.saleWon, "14 Mar 2026");
  assert.equal(job.blockTitled, "Untitled");
  assert.equal(job.blockDue, "30 Sep 2026");
  assert.deepEqual(job.precon.map((m) => m.name), ["Builder Acceptance", "Contracts Signed", "Some Monday-only step"]);
  assert.deepEqual(job.milestones.map((m) => [m.name, m.status, m.date]), [
    ["Date to Site", "done", "01 Sep 2026"],
    ["Slab Down", "done", "01 Oct 2026"],
  ]);
});

test("to-job: steps outside the known order keep the order they were made in", () => {
  const made = (name: string, at: string): MilestoneRow => ({ ...ms(name, "Not Started"), monday_created_at: new Date(at) });
  // A Wednesday, then a Friday: sorted by time, not by the weekday's name.
  const job = toJob(row(), [made("Extra step B", "2026-10-09T00:00:00Z"), made("Extra step A", "2026-10-07T00:00:00Z")]);
  assert.deepEqual(job.precon.map((m) => m.name), ["Extra step A", "Extra step B"]);
});

test("to-job: the address doesn't repeat a suburb it already has, and a titled block has no due date", () => {
  const job = toJob(row({ site_address: "2 Test Street, Testville WA", block_titled: "Yes" }), []);
  assert.equal(job.address, "2 Test Street, Testville WA");
  assert.equal(job.blockTitled, "Titled");
  assert.equal(job.blockDue, "");
  assert.equal(toJob(row({ purpose: "sales", construction_stage: null }), []).hsStage, "Sale Won");
});

test("to-job: a suburb or state is already in the address only as a whole word in place", () => {
  const address = (site_address: string, site_suburb: string) => toJob(row({ site_address, site_suburb, site_state: "WA" }), []).address;
  assert.equal(address("Lot 361, 8 Camperdown Way", "Lakelands"), "Lot 361, 8 Camperdown Way, Lakelands, WA");
  assert.equal(address("1 Main Street, Swan View", "Swan View"), "1 Main Street, Swan View, WA");
  assert.equal(address("Lot 9, 10 Wellard Road", "Wellard"), "Lot 9, 10 Wellard Road, Wellard, WA");
  assert.equal(address("8 Camperdown Way, Lakelands WA 6180", "Lakelands"), "8 Camperdown Way, Lakelands WA 6180");
  assert.equal(address("Lot 5 Smith Rd, Lakelands WA6180", "Lakelands"), "Lot 5 Smith Rd, Lakelands WA6180", "a postcode run onto the state");
});

test("to-job: the source stamp is Perth's date", () => {
  // 4:30am on 8 Oct in Perth, still 7 Oct in UTC.
  assert.equal(toJob(row({ updated_at: "2026-10-07T20:30:00Z" }), []).lastSource, "Monday, 08 Oct 2026");
});
