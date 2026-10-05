/**
 * CRM dash sync — static figures from the mockup (Reference/locale-launchpad 1.html).
 * Jobs, lot details, the audit log and the review queue live in the store; this
 * file holds the copy that never changes.
 */

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
