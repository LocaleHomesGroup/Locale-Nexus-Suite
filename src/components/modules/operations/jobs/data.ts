/**
 * CRM Dash Sync — static figures from the mockup (Reference/locale-launchpad 1.html).
 * Jobs, lot details, the audit log and the portal inbox live in the store; this
 * file holds the copy that never changes.
 */

export type SourceHealth = "connected" | "building" | "manual";

/** Builder portal adapters shown on the Automated sources card. */
export const AUTOMATED_SOURCES: { builder: string; status: string; health: SourceHealth }[] = [
  { builder: "Forma", status: "Connected · polled 6:04am · 3 updates", health: "connected" },
  { builder: "Move Homes", status: "Connected · polled 6:10am · no changes", health: "connected" },
  { builder: "La Vida", status: "Adapter in build", health: "building" },
  { builder: "New Choice", status: "Manual · email and CSV", health: "manual" },
  { builder: "New Era", status: "Manual · email and CSV", health: "manual" },
];

/** The recent-runs log under the sources. */
export const SOURCE_LOG: { when: string; text: string }[] = [
  {
    when: "6:04am",
    text: "Forma portal · job 25431: Lock Up confirmed 24 Jul — applied, synced to Monday and HubSpot",
  },
  { when: "6:04am", text: "Forma portal · 42 jobs checked, 3 changes found, 0 conflicts" },
  { when: "Yesterday", text: "CSV import · 11 block titled dates applied via bulk update" },
];

/** Rows in the sample bulk-update file. */
export const BULK_FILE = "builder-dates-aug.csv";
export const BULK_ROWS: { jobNo: string; milestone: string; date: string; match: "ok" | "miss" }[] = [
  { jobNo: "25431", milestone: "Practical Completion", date: "04 Aug 2026", match: "ok" },
  { jobNo: "25211", milestone: "Plate Height", date: "01 Aug 2026", match: "ok" },
  { jobNo: "2401099X", milestone: "Key Handover", date: "03 Aug 2026", match: "miss" },
];

/** Document slots on the job page. `uploaded` = already on file in the mockup. */
export const DOCUMENT_SLOTS: { label: string; slug: string; uploaded: boolean }[] = [
  { label: "Contract", slug: "Contract", uploaded: true },
  { label: "Deposit receipt", slug: "DepositReceipt", uploaded: true },
  { label: "Finance approval", slug: "FinanceApproval", uploaded: true },
  { label: "Settlement titles", slug: "SettlementTitles", uploaded: false },
  { label: "Deposit claim", slug: "DepositClaim", uploaded: false },
];

/** "HubSpot deal" etc. are read-only mirrors; the phone is masked in the mockup. */
export const CLIENT_PHONE = "04xx xxx 214";

/** Default dates the mockup pre-fills in its editors. */
export const DEFAULT_BUILDER_DATE = "5 August 2026";
export const DEFAULT_SITE_START = "11 August 2026";

/** Where a milestone update came from — recorded with the edit. */
export const UPDATE_SOURCES = ["Broker email", "Vendor portal", "Phone call"] as const;
export type UpdateSource = (typeof UPDATE_SOURCES)[number];

/** Builders whose job numbers follow the builder's own format. */
export const BUILDER_FORMAT_JOB_NO = ["New Choice", "New Era"];
