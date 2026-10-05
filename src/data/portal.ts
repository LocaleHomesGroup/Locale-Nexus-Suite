/**
 * Shared portal data — who the Client and Developer portals preview, and the
 * thread between them: the builder's site updates and the client's messages.
 * Both portals read it through the portal store (src/state/portal-store.tsx),
 * so an update Forma posts in the Developer portal is in the client's portal
 * the moment it is sent. Static prototype data: nothing here is fetched.
 */

/** The prototype's "today", the same date Operations stamps (operations/jobs/data.ts). */
export const PORTAL_TODAY = "05 Aug 2026";

/**
 * The client the Client portal previews: job 25431 in the shared jobs, R. de
 * Thierry and J. Kumar, building The Aspen with Forma at Seaside Rise. Their
 * consultant is A. Mercer, whose Sales "My clients" to-do is to send them a
 * progress update — the gap the portal closes.
 */
export const CLIENT_JOB_ID = 1;

/** The developer the Developer portal previews — the builder Locale sells most for. */
export const DEVELOPER = "Forma";

/** A site update the builder sends its client, shown in the client's My build. */
export interface BuildUpdate {
  id: string;
  jobId: number;
  builder: string;
  milestone: string;
  note: string;
  when: string;
  /** Site photos attached. */
  photos: number;
  /** Sent in this session (from the Developer portal). */
  fresh?: boolean;
}

/** Newest first. */
export const SEED_UPDATES: BuildUpdate[] = [
  {
    id: "u-25431-lockup",
    jobId: 1,
    builder: "Forma",
    milestone: "Lock Up",
    note: "Windows and external doors are in and the house is locked up. Plastering starts next week, then cabinetry.",
    when: "24 Jul 2026",
    photos: 4,
  },
  {
    id: "u-25211-slab",
    jobId: 2,
    builder: "Forma",
    milestone: "Slab Down",
    note: "Slab poured and cured. The bricklayers are booked to start once the plumber signs off.",
    when: "22 Jun 2026",
    photos: 2,
  },
  {
    id: "u-25431-roof",
    jobId: 1,
    builder: "Forma",
    milestone: "Roof Cover",
    note: "Roof tiles are on and the gutters and downpipes are fitted. Electrical rough-in is under way.",
    when: "12 Jun 2026",
    photos: 3,
  },
  {
    id: "u-25431-plate",
    jobId: 1,
    builder: "Forma",
    milestone: "Plate Height",
    note: "Brickwork is up to plate height. Roof trusses arrive next week.",
    when: "29 Apr 2026",
    photos: 2,
  },
];

export type Sender = "you" | "consultant" | "operations" | "builder";

/** One message in a client's thread — everyone on their build in one place. */
export interface PortalMessage {
  id: string;
  jobId: number;
  from: Sender;
  name: string;
  body: string;
  when: string;
}

/** Oldest first, as a thread reads. */
export const SEED_MESSAGES: PortalMessage[] = [
  {
    id: "m-25431-1",
    jobId: 1,
    from: "operations",
    name: "Locale Operations",
    body: "Your land has settled and Forma has your building permit. Next stop: site start.",
    when: "11 Feb 2026",
  },
  {
    id: "m-25431-2",
    jobId: 1,
    from: "you",
    name: "You",
    body: "Great news! Do we need to do anything before the slab goes down?",
    when: "11 Feb 2026",
  },
  {
    id: "m-25431-3",
    jobId: 1,
    from: "consultant",
    name: "A. Mercer",
    body: "Nothing from you. Forma sends photos at each stage and they land in My build, so you'll see every step.",
    when: "12 Feb 2026",
  },
  {
    id: "m-25431-4",
    jobId: 1,
    from: "builder",
    name: "Forma",
    body: "Lock Up update: windows and external doors are in and the house is locked up. Photos are in My build.",
    when: "24 Jul 2026",
  },
  {
    id: "m-25431-5",
    jobId: 1,
    from: "consultant",
    name: "A. Mercer",
    body: "Lock up is done! Forma expects practical completion in late September. I'll book your pre-handover walk-through as soon as they confirm a date.",
    when: "26 Jul 2026",
  },
];

/** Messages the client hasn't opened yet. */
export const SEED_UNREAD: string[] = ["m-25431-5"];
