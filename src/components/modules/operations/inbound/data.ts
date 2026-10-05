/**
 * Inbound capture — the sample rows in the preview of the finished screen.
 * Invented, as in the Launchpad build: nothing on that page reads a job.
 */

export type SampleUpdateState = "ready" | "needs-date" | "duplicate";

/** What a builder's weekly file would turn into. */
export const SAMPLE_UPDATES: {
  job: string;
  client: string;
  milestone: string;
  date: string | null;
  state: SampleUpdateState;
}[] = [
  { job: "99012", client: "Kowalczyk", milestone: "Slab down", date: "18 August 2026", state: "ready" },
  { job: "99004", client: "Okonkwo", milestone: "Roof cover", date: "19 August 2026", state: "ready" },
  { job: "25431", client: "Iverach", milestone: "Plate height", date: null, state: "needs-date" },
  { job: "99008", client: "Pemberton", milestone: "Lock up", date: "21 August 2026", state: "ready" },
  { job: "99015", client: "Delacroix", milestone: "Practical completion", date: "22 August 2026", state: "duplicate" },
];

/** What polling the builders' portals would bring back. */
export const SAMPLE_PORTAL: { job: string; client: string; change: string; detail: string }[] = [
  { job: "99013", client: "Attaway", change: "Site start recorded", detail: "Would move this job to construction" },
  { job: "99009", client: "Vandenberg", change: "Slab down completed", detail: "3 new photos" },
  { job: "2401022R", client: "Raman", change: "Plate height completed", detail: "1 new document" },
];
