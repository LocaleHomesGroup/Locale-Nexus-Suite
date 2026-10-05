/**
 * The client journey, as the first client-journey meeting describes it
 * (docs/Meeting1.md): enquiry → consultation → finance → house and land
 * package → sale → Locale operations → the builder's pre-construction →
 * construction → handover, "from inquiry all the way through to handover, and
 * when they get the keys".
 *
 * The first five stages happen before a job exists, so every job is past them.
 * The last four are read from the job's own milestones, so a milestone that
 * Operations syncs moves the client's journey (and the developer's view of it)
 * at once. Static prototype: nothing here is fetched.
 */
import type { Job, Milestone } from "./jobs";

export type JourneyStageId =
  "enquiry" | "consultation" | "finance" | "package" | "sale" | "operations" | "precon" | "construction" | "handover";

export type JourneyState = "done" | "current" | "upcoming";

/** Who looks after the client at a stage. `"builder"` is the job's own builder. */
type Owner = "Locale Homes" | "Your home sales consultant" | "Locale Financial" | "Locale Operations" | "builder";

export interface JourneyStageDef {
  id: JourneyStageId;
  label: string;
  /** A word or two, for a KPI figure or a table cell. */
  short: string;
  owner: Owner;
  /** What happens at this stage, in the client's words. */
  blurb: string;
  /** Where its steps live on the job (none before the sale). */
  from?: "precon" | "milestones";
  /** The job milestones that make up the stage, in order. */
  steps?: readonly string[];
}

export const JOURNEY: readonly JourneyStageDef[] = [
  {
    id: "enquiry",
    label: "Enquiry",
    short: "Enquiry",
    owner: "Locale Homes",
    blurb: "You told us where you are, what you want and where you want to be.",
  },
  {
    id: "consultation",
    label: "Consultation",
    short: "Consultation",
    owner: "Your home sales consultant",
    blurb: "Your consultant talked through your plans and what you can afford.",
  },
  {
    id: "finance",
    label: "Finance",
    short: "Finance",
    owner: "Locale Financial",
    blurb: "We worked out what you can borrow for a home loan.",
  },
  {
    id: "package",
    label: "House and land package",
    short: "Package",
    owner: "Your home sales consultant",
    blurb: "We split your budget between land and build, and matched builders to your brief.",
  },
  {
    id: "sale",
    label: "Sale",
    short: "Sale",
    owner: "Your home sales consultant",
    blurb: "You chose your package and signed.",
  },
  {
    id: "operations",
    label: "Locale operations",
    short: "Operations",
    owner: "Locale Operations",
    blurb: "Your builder accepts the job, then contracts, formal finance and land settlement.",
    from: "precon",
    steps: [
      "Builder Acceptance",
      "Compliance Sketch and Quote received",
      "Compliance Sketch and Quote approved",
      "Contracts Received",
      "Contracts Signed",
      "Formal Finance Approval",
      "Settlement Confirmation",
    ],
  },
  {
    id: "precon",
    label: "Builder pre-construction",
    short: "Pre-build",
    owner: "builder",
    blurb: "Your deposit, prestart selections and the building permit.",
    from: "precon",
    // Variations can come at any time, so they never hold the stage open.
    steps: ["Deposit Claim", "Prestart Meeting", "Build Permit Received"],
  },
  {
    id: "construction",
    label: "Construction",
    short: "Construction",
    owner: "builder",
    blurb: "From site start to practical completion.",
    from: "milestones",
    steps: ["Date to Site", "Slab Down", "Plate Height", "Roof Cover", "Lock Up", "Practical Completion"],
  },
  {
    id: "handover",
    label: "Handover",
    short: "Handover",
    owner: "builder",
    blurb: "Your keys, then the maintenance period.",
    from: "milestones",
    steps: ["Key Handover", "Maintenance"],
  },
];

export interface JourneyStage extends JourneyStageDef {
  state: JourneyState;
  /** The owner with the builder named: "Forma", "Locale Operations". */
  who: string;
  /** The stage's milestones from the job, in order. Empty before the sale. */
  milestones: Milestone[];
  /** When the stage finished: its last completed step (the sale: the sale date). "" if not yet. */
  date: string;
}

const started = (m: Milestone) => m.status === "done" || m.status === "prog" || m.status === "pendingDate";
const settled = (m: Milestone) => m.status === "done" || m.status === "na";

function stepsOf(job: Job, def: JourneyStageDef): Milestone[] {
  if (!def.from || !def.steps) return [];
  const list = def.from === "precon" ? job.precon : job.milestones;
  return def.steps.map((name) => list.find((m) => m.name === name)).filter((m): m is Milestone => Boolean(m));
}

/**
 * The journey for one job. The current stage is the furthest one with any
 * progress if it isn't finished, otherwise the one after it — so a job whose
 * builder started on site before a pre-construction step was ticked still
 * reads as "Construction", not stuck behind the paperwork. Before any
 * post-sale step has started, it is Locale operations.
 */
export function journeyFor(job: Job): JourneyStage[] {
  const stages = JOURNEY.map((def) => ({ def, milestones: stepsOf(job, def) }));
  const furthest = stages.reduce((at, s, i) => (s.milestones.some(started) ? i : at), -1);
  const opsAt = JOURNEY.findIndex((d) => d.id === "operations");
  let current: number;
  if (furthest < 0) current = opsAt;
  else {
    const s = stages[furthest];
    const finished = s.milestones.length > 0 && s.milestones.every(settled);
    current = finished ? furthest + 1 : furthest;
  }

  return stages.map(({ def, milestones }, i) => ({
    ...def,
    state: i < current ? "done" : i === current ? "current" : "upcoming",
    who: def.owner === "builder" ? job.builder : def.owner,
    milestones,
    date: def.id === "sale" ? job.saleWon : ([...milestones].reverse().find((m) => m.status === "done")?.date ?? ""),
  }));
}

/** The stage a job is at, or null once the whole journey is finished. */
export function currentStage(job: Job): JourneyStage | null {
  return journeyFor(job).find((s) => s.state === "current") ?? null;
}

/** The next thing to happen: the current stage's first step not yet settled. */
export function nextStep(job: Job): Milestone | null {
  return currentStage(job)?.milestones.find((m) => !settled(m)) ?? null;
}

/** Is the job waiting on its builder to accept it? (Builder Acceptance not done.) */
export function awaitingAcceptance(job: Job): boolean {
  const m = job.precon.find((p) => p.name === "Builder Acceptance");
  return Boolean(m && m.status !== "done");
}
