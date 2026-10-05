/**
 * IT help desk — static data from the mockup (`zm`). The mockup's form shows a
 * single category ("Access and permissions"); the rest of the list is what a
 * working select needs, named after the tickets already on the desk.
 */

export type TicketPriority = "Low" | "Medium" | "High";
export type TicketStatus = "Open" | "In progress" | "Resolved";

export interface Ticket {
  id: number;
  title: string;
  requester: string;
  priority: TicketPriority;
  status: TicketStatus;
}

export const TICKET_SEED: Ticket[] = [
  { id: 214, title: "SharePoint access — Pricing library", requester: "S. Hart", priority: "High", status: "In progress" },
  { id: 213, title: "Teams call quality — display home", requester: "K. Ellery", priority: "Medium", status: "In progress" },
  { id: 211, title: "New starter setup — broker support", requester: "L. Dixon", priority: "Medium", status: "Resolved" },
  { id: 209, title: "Password reset — Xero", requester: "D. Cruz", priority: "Low", status: "Resolved" },
];

export const TICKET_CATEGORIES = [
  "Access and permissions",
  "Passwords and sign-in",
  "Calls and Teams",
  "Laptops and devices",
  "Software and apps",
  "New starter setup",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const PRIORITIES: TicketPriority[] = ["Low", "Medium", "High"];

/** Who is raising tickets from this Launchpad session (the signed-in user in the mockup). */
export const REQUESTER = "S. Hart";

/**
 * IT › Overview — SAMPLE FIGURES. The help desk doesn't record when a ticket
 * closes, and nothing tracks who has finished the phishing module, so these
 * placeholders stand in until something does. The cards that use them say
 * "Sample". Replace them with real counts; don't build on them.
 */
export const IT_SAMPLE = {
  medianResolve: "1.4 days",
  phishingDone: 18,
  /** Everyone required to take it this year: the group's headcount. */
  phishingDue: 23,
} as const;
