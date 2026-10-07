/**
 * Jarvis's FAQ — one per dashboard.
 *
 * Jarvis is the Launchpad's assistant (the name the prototype already uses:
 * Leadership's "Ask Jarvis", Knowledge's "Ask Jarvis a question", Rapid
 * costing's compliance check). The bubble is HRIS's Penny AI pattern with the
 * Locale "L" in place of Penny's heart.
 *
 * Each dashboard has its own FAQ, grouped into the same sections as its rail.
 * The HRIS rule for Penny's FAQ applies here too: **every question offered must
 * be answerable** — a question with nothing behind it cannot be added. The
 * browser test (`scratchpad/pw/jarvis.mjs`) clicks every entry and fails on a
 * fallback reply.
 *
 * Static prototype: there is no model. Figures are computed from the SAME data
 * the dashboard draws — its data file or the live store — so Jarvis always
 * matches the screen, and a store change (a conflict resolved, a held change
 * released) changes the answer. "How do I…" answers restate what the screen
 * itself says and does. Nothing is invented.
 */
import type { ModuleId } from "@/state/launchpad-store";
import type { Job, SubmissionDoc } from "@/data/jobs";
import { BUILDER_CHECKLISTS, BUILDER_CLAIMS } from "@/data/jobs";
import type { AppNotification, ReviewItem } from "@/data/seed";
import { aud } from "@/lib/utils";
import { ANNOUNCEMENTS, CELEBRATIONS, COMING_UP } from "@/components/modules/home/data";
import { buildMyDay } from "@/components/modules/home/my-day";
import { PRICE_LISTS, MODELS_TRACKED } from "@/components/modules/operations/pricing/data";
import {
  CURRENT_REP,
  PIPELINE_STAGES,
  SALES_WON_QTD,
  SEED_LOTS,
  SEED_DISCOUNTS,
  HOLD_QUEUE_MAX,
  isOpenDeal,
  type PipelineDeal,
} from "@/components/modules/sales/data";
import { COMMISSION_PER_SALE, MONTH_TARGET, QUARTER_TARGET, STALE_DAYS } from "@/components/modules/sales/progress/data";
import {
  commissionEarned,
  commissionPipeline,
  staleDeals,
  wonSoFar,
  wonThisSession,
  wonVsTarget,
  type TargetProgress,
} from "@/components/modules/sales/progress/progress";
import { RECORD_PERIODS, commissionRecord, periodLabel, saleDates } from "@/components/modules/sales/progress/commission";
import { DISCOUNT_APPROVAL_THRESHOLD, COMMISSION_BASE } from "@/components/modules/sales/costing/data";
import {
  CHANNELS,
  TOTAL_SPEND,
  TOTAL_WON,
  TAG_COVERAGE,
  TAG_COVERAGE_FLOOR,
  NIGHTLY_CHECKS,
} from "@/components/modules/marketing/data";
import {
  invoicedThisMonth,
  FORECAST_NEXT_MONTH,
  CASHFLOW,
  EXPENSES_THIS_MONTH,
  AVG_APPROVAL_TIME,
  type BuilderInvoice,
  type ExpenseClaim,
} from "@/components/modules/accounts/data";
import { SUBURBS, SEED_PACKAGES } from "@/components/modules/wealth/data";
import {
  HR_KPIS,
  DIVISIONS,
  ON_LEAVE_TODAY,
  LEAVE_BALANCES,
  balanceAfter,
  formatDays,
  othersOff,
  type LeaveRequest,
  OPEN_ROLES,
  ONBOARDING,
  ASSETS,
  ATTENDANCE,
} from "@/components/modules/hr/data";
import { PROJECTS as TICKET_PROJECTS, dashboardName, formatTicketNo, seatName, type Ticket } from "@/components/modules/tickets/data";
import { ageLabel, openByDashboard, projectProgress, ticketStats } from "@/components/modules/tickets/logic";
import { CATEGORIES, MATERIALS } from "@/components/modules/knowledge/data";
import {
  OVERVIEW_KPIS,
  SALES_BY_MONTH,
  BUILDS_BY_BUILDER,
  PIPELINE_BY_STAGE,
  JARVIS_ANSWERS,
  JARVIS_SUGGESTIONS,
} from "@/components/modules/leadership/data";
import { TICKET_SEED } from "@/components/modules/it/data";
import { awaitingAcceptance, currentStage, journeyFor, nextStep } from "@/data/journey";
import { CLIENT_JOB_ID, DEVELOPER } from "@/data/portal";
import {
  BORROWING_CAPACITY,
  BUILD_CONTRACT,
  CLIENT_DOCS,
  MATCHES,
  PACKAGE_SPLIT,
  PACKAGE_TOTAL,
  PROGRESS_PAYMENTS,
  matchScore,
} from "@/components/modules/client/data";
import { DEMAND, OBJECTIONS } from "@/components/modules/developer/data";
import { masterList, orgDepartment, orgDepartmentOf, type OrgPerson } from "@/components/modules/hr/data";
import {
  CURRENCY,
  EMPLOYEE_ID,
  GOES_BY,
  INVOICE_APPROVER,
  LATEST_WEEK,
  RATES,
  dayMonth,
  formatHours,
  invoiceTotals,
  money,
  paymentComplete,
  weekLabel,
  weekPay,
  type StaffInvoice,
} from "@/components/modules/employee/data";

import { PAYEE_IDS, PAY_RUN, personOf, type RunSummary } from "@/components/modules/accounting/data";
import { php, rateText } from "@/components/modules/accounting/fx";
import type { PayRunView } from "@/components/modules/accounting/payrun-store";
import { billsFor } from "@/components/modules/employee/parts";
import { ROLE_BY_KEY, directory, pageOf } from "@/components/modules/admin/data";
import { liveOf, type AdminState } from "@/components/modules/admin/admin-store";

export interface JarvisAction {
  label: string;
  href: string;
}

export interface JarvisAnswer {
  text: string;
  bullets?: string[];
  actions?: JarvisAction[];
  /** Where the figures came from — shown as a small caption. */
  source?: string;
}

/**
 * Live values the answers read, so a figure Jarvis quotes stays true after the
 * user acts on screen: the Launchpad store (jobs, review queue, submission,
 * Accounts' invoices and claims) plus HR's shared leave queue. An item inside
 * its undo window keeps its pending status until the window closes.
 */
export interface JarvisContext {
  jobs: Job[];
  notifications: AppNotification[];
  reviewItems: ReviewItem[];
  submissionDocs: SubmissionDoc[];
  submissionStatus: string;
  leave: LeaveRequest[];
  invoices: BuilderInvoice[];
  claims: ExpenseClaim[];
  /** The Employee portal's invoices (its invoice store). */
  staffInvoices: StaffInvoice[];
  /** HR's live org chart. */
  people: OrgPerson[];
  /** Accounting's pay run and its summary, with the Employee portal's invoices folded in. */
  payRun: { view: PayRunView; run: RunSummary };
  /** Admin's roles, section access and sign-outs. */
  admin: AdminState;
  /** The Tickets board (its store), archived tickets included. */
  tickets: Ticket[];
  /** Sales' live deals (the shared Sales store): the dashboard's board and the portal's. */
  deals: PipelineDeal[];
}

export interface Faq {
  /** FAQ section — matches the dashboard's rail sections. */
  group: string;
  /** The question, exactly as sent when tapped. */
  question: string;
  /** Lower-case fragments; any hit routes a typed question here. */
  keys: string[];
  answer: (ctx: JarvisContext) => JarvisAnswer;
}

export interface DashboardBrief {
  subtitle: string;
  greeting: string;
  faqs: Faq[];
  fallback: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ── Answers shared by more than one dashboard ─────────────────────────── */

function conflictAnswer(ctx: JarvisContext): JarvisAnswer {
  const conflicts = ctx.jobs.filter((j) => j.sync === "conflict");
  if (conflicts.length === 0) {
    return { text: "No sync conflicts right now — HubSpot and Monday agree on every mirrored job.", source: "CRM Dash Sync · live" };
  }
  return {
    text: `${plural(conflicts.length, "job")} ${conflicts.length === 1 ? "has" : "have"} a sync conflict that needs a human:`,
    bullets: conflicts.map((j) =>
      j.conflict
        ? `${j.jobNo} · ${j.client} — ${j.conflict.field}: HubSpot says “${j.conflict.hub}”, Monday says “${j.conflict.monday}”.`
        : `${j.jobNo} · ${j.client}`,
    ),
    actions: conflicts.map((j) => ({ label: `Resolve ${j.jobNo}`, href: `/operations/jobs/${j.id}` })),
    source: "CRM Dash Sync · live",
  };
}

function submissionAnswer(ctx: JarvisContext, href: string): JarvisAnswer {
  const docs = ctx.submissionDocs;
  const missing = docs.filter((d) => d.req && !d.file);
  const verified = docs.filter((d) => d.state === "verified").length;
  const fix = docs.filter((d) => d.state === "fix");
  const status =
    ctx.submissionStatus === "approved"
      ? "approved by Ops"
      : ctx.submissionStatus === "changes"
        ? "back with the rep — Ops asked for changes"
        : ctx.submissionStatus === "review"
          ? "in Ops review"
          : "still a draft with the rep";
  return {
    text: `The Nguyen submission is ${status}. ${verified} of ${docs.length} documents are verified.`,
    bullets: [
      missing.length
        ? `${plural(missing.length, "required document")} not uploaded yet: ${missing.map((d) => d.name).join("; ")}.`
        : "Every required document is uploaded.",
      ...(fix.length ? [`Sent back for fixes: ${fix.map((d) => d.name).join("; ")}.`] : []),
    ],
    actions: [{ label: "Open the submission", href }],
    source: "Deal submission · live",
  };
}

/** Leadership's own Jarvis answers (Custom dashboard), matched the mockup's way: first key hit wins. */
function leadershipJarvis(question: string): string {
  const q = question.toLowerCase();
  return JARVIS_ANSWERS.find((a) => a.keys.some((k) => q.includes(k)))?.answer ?? "";
}

/* ── "Using Launchpad" — the same few how-tos on every dashboard ───────── */

const USING = (dashLabel: string): Faq[] => [
  {
    group: "Using Launchpad",
    question: "How do I switch dashboards?",
    keys: ["switch", "dashboard", "other dashboard", "change view"],
    answer: () => ({
      text: `Use “Switch view” in the sidebar, under the ${dashLabel} sections. Each dashboard keeps its own sections in the sidebar and its own questions here.`,
    }),
  },
  {
    group: "Using Launchpad",
    question: "How do I collapse the sidebar?",
    keys: ["collapse", "sidebar", "hide menu", "ctrl"],
    answer: () => ({
      text: "Pull the round tab on the sidebar's edge, or press Ctrl+B (⌘B on a Mac). Icons stay visible, and your choice is remembered.",
    }),
  },
];

/* ── The portals: their own switcher, their own how-to ─────────────────── */

const PORTAL_USING = (portal: string): Faq[] => [
  {
    group: "Using the portal",
    question: "How do I switch views?",
    keys: ["switch", "view", "client portal", "developer portal", "employee portal", "sales representative", "sales portal", "back to launchpad"],
    answer: () => ({
      text: `Use “Switch view” in the sidebar. The portals have their own: Client, Developer, Employee and Sales Representative, plus “Back to Launchpad” for the staff dashboards. You're in the ${portal}.`,
    }),
  },
];

/** The previewed client's job, live. */
function clientJob(ctx: JarvisContext): Job | undefined {
  return ctx.jobs.find((j) => j.id === CLIENT_JOB_ID);
}

const doneDates = (job: Job) =>
  new Map([...job.precon, ...job.milestones].filter((m) => m.status === "done").map((m) => [m.name, m.date]));

const NO_JOB: JarvisAnswer = { text: "I can't find your job right now." };

/* ── Per-dashboard FAQs ────────────────────────────────────────────────── */

export const JARVIS: Record<ModuleId, DashboardBrief> = {
  home: {
    subtitle: "Your day across Launchpad",
    greeting: "G'day Shannan — here's what I can pull together for today.",
    faqs: [
      {
        group: "Today",
        question: "What needs me today?",
        keys: ["today", "need", "my day", "to do", "todo", "waiting"],
        // The same list as Home's My day card, built from the same live data.
        answer: (ctx) => {
          const items = buildMyDay(ctx);
          if (items.length === 0) {
            return {
              text: "Nothing needs you today. Conflicts, approvals and reviews land in My day as they arrive.",
              source: "My day · live",
            };
          }
          return {
            text: `${plural(items.length, "thing")} ${items.length === 1 ? "needs" : "need"} you today:`,
            bullets: items.map(
              (i) => `${i.urgent ? "Due today: " : ""}${i.title}. ${i.detail}${i.figure ? ` (${i.figure})` : ""}.`,
            ),
            actions: items.slice(0, 3).map((i) => ({ label: i.action, href: i.href })),
            source: "My day · live",
          };
        },
      },
      { group: "Today", question: "Are any jobs out of sync?", keys: ["sync", "conflict", "hubspot", "monday", "out of"], answer: conflictAnswer },
      {
        group: "Company",
        question: "What's pinned in announcements?",
        keys: ["announce", "news", "pinned", "price list"],
        answer: () => ({
          text: "Latest announcements:",
          bullets: ANNOUNCEMENTS.map((a) => `${a.pinned ? "Pinned · " : ""}${a.title} (${a.meta}) — ${a.body}`),
        }),
      },
      {
        group: "Company",
        question: "What's coming up this fortnight?",
        keys: ["coming", "event", "calendar", "training", "fortnight"],
        answer: () => ({ text: "Here's what's on the calendar:", bullets: COMING_UP.map((e) => `${e.title} — ${e.when} · ${e.where}.`) }),
      },
      {
        group: "Company",
        question: "Who's celebrating?",
        keys: ["celebrat", "birthday", "anniversary", "starter", "new start"],
        answer: () => ({ text: "Celebrations this week:", bullets: CELEBRATIONS.map((c) => `${c.name} — ${c.note}.`) }),
      },
      ...USING("Home"),
    ],
    fallback:
      "On Home I can tell you what needs you today, whether any jobs are out of sync, what's in announcements, what's coming up and who's celebrating. Switch dashboards for their own FAQ.",
  },

  operations: {
    subtitle: "Jobs, syncs and builder pricing",
    greeting: "I'm watching CRM dash sync, the review queue and builder pricing.",
    faqs: [
      { group: "CRM dash sync", question: "Which jobs have sync conflicts?", keys: ["conflict", "out of sync", "disagree"], answer: conflictAnswer },
      {
        group: "Review queue",
        question: "What's waiting in the review queue?",
        keys: ["review", "queue", "held", "regression", "release", "waiting"],
        answer: (ctx) => {
          const waiting = ctx.reviewItems.filter((i) => i.status === "pending");
          return waiting.length === 0
            ? {
                text: "The review queue is clear — no change to a money milestone is waiting on a person.",
                source: "Review queue · live",
              }
            : {
                text: `${plural(waiting.length, "change")} held — nothing reaches Monday or HubSpot until a person releases it:`,
                bullets: waiting.map((i) => `${i.summary}. Queued ${i.queuedAt} by ${i.queuedBy}.`),
                actions: [{ label: "Open the review queue", href: "/operations?tab=review" }],
                source: "Review queue · live",
              };
        },
      },
      {
        group: "CRM dash sync",
        question: "Which jobs are still syncing?",
        keys: ["syncing", "pending", "still"],
        answer: (ctx) => {
          const pending = ctx.jobs.filter((j) => j.sync === "pending");
          return pending.length === 0
            ? { text: "Nothing is mid-sync — every job has landed in HubSpot and Monday.", source: "CRM Dash Sync · live" }
            : {
                text: `${plural(pending.length, "job")} still syncing:`,
                bullets: pending.map((j) => `${j.jobNo || "No job no"} · ${j.client} — last update: ${j.lastSource}.`),
                actions: pending.map((j) => ({ label: `Open ${j.jobNo || j.client}`, href: `/operations/jobs/${j.id}` })),
                source: "CRM Dash Sync · live",
              };
        },
      },
      {
        group: "CRM dash sync",
        question: "How does a milestone sync?",
        keys: ["how", "milestone", "sync work", "flow"],
        answer: () => ({
          text: "Saved to Launchpad first, then pushed to each connected system:",
          bullets: [
            "Launchpad — the change is saved instantly.",
            "Monday — the milestone subitem is set to Completed and its Date Completed filled.",
            "HubSpot — the date property is set and the deal stage moves forward (it never moves back).",
            "Xero — if the builder bills at that milestone, a draft invoice is raised for Accounts to approve.",
          ],
          actions: [{ label: "Open a job", href: "/operations/jobs/1" }],
        }),
      },
      {
        group: "CRM dash sync",
        question: "How do I bulk update builder dates?",
        keys: ["bulk", "csv", "import", "many", "portal", "inbound", "upload"],
        answer: () => ({
          text: "Bulk upload and builder-portal polling aren't built yet — Inbound capture shows where they're going. You'll upload the builder's file or forward their weekly email, Launchpad matches each line to a job, and you approve the ones that are right. Until then, open the job and mark each milestone.",
          actions: [
            { label: "See Inbound capture", href: "/operations?tab=jobs&view=inbound" },
            { label: "Open CRM dash sync", href: "/operations?tab=jobs" },
          ],
        }),
      },
      {
        group: "Audit log",
        question: "Where do I see who changed a job?",
        keys: ["audit", "who changed", "history", "log"],
        answer: () => ({
          text: "In the Audit log: every write Launchpad has made — who did it, what changed, and which systems it went to — newest first. Filter it to milestones, job details, regressions or sync. Each job's page shows its own share, with a link to the full log.",
          actions: [{ label: "Open the audit log", href: "/operations?tab=audit" }],
        }),
      },
      {
        group: "Submission review",
        question: "Where is the Nguyen submission up to?",
        keys: ["nguyen", "submission", "documents"],
        answer: (ctx) => submissionAnswer(ctx, "/operations?tab=submissions"),
      },
      {
        group: "Submission review",
        question: "How do I send a document back to the rep?",
        keys: ["send back", "fix", "reject", "return"],
        answer: () => ({
          text: "Open the submission, choose the document and use Request fix with a reason. The rep sees it straight away in My Deal Submissions as a red row; Approve unlocks once every uploaded document is verified.",
          actions: [{ label: "Open Submission review", href: "/operations?tab=submissions" }],
        }),
      },
      {
        group: "Pricing",
        question: "Which builder price lists are current?",
        keys: ["price list", "pricing", "current", "pdf"],
        answer: () => {
          const published = PRICE_LISTS.filter((p) => p.status === "Published");
          return {
            text: `${published.length} of ${PRICE_LISTS.length} builder price lists are current (${published.map((p) => p.builder).join(", ")}). ${MODELS_TRACKED} models are tracked on the Monday Models board.`,
            bullets: PRICE_LISTS.filter((p) => p.status !== "Published").map(
              (p) => `${p.builder} — ${p.status.toLowerCase()}${p.received !== "—" ? `, received ${p.received}` : ""}.`,
            ),
            actions: [{ label: "Open Pricing", href: "/operations?tab=pricing" }],
          };
        },
      },
      {
        group: "Doc formatter",
        question: "How does the Doc formatter work?",
        keys: ["formatter", "extract", "format", "upload"],
        answer: () => ({
          text: "Upload a raw price list or data export and choose the template to format it into. Every extracted value is scored, so you only check what the app was unsure about. Confirming hands over to Price changes, where the change report goes to Sean and the list is published to Pricing.",
          actions: [{ label: "Start a new job", href: "/operations?tab=formatter" }],
        }),
      },
      ...USING("Operations"),
    ],
    fallback:
      "On Operations I can answer about sync conflicts, the review queue, the audit log, how milestones sync, bulk updates, the Nguyen submission, builder price lists and the Doc formatter.",
  },

  sales: {
    subtitle: "The team's pipeline, clients and land",
    greeting: "Ask me about the pipeline, land holds or the team's numbers.",
    faqs: [
      {
        group: "Pipeline",
        question: "What's in the pipeline?",
        keys: ["pipeline", "deals", "stage", "appointment"],
        answer: (ctx) => ({
          text: `${plural(ctx.deals.filter((d) => !d.lost).length, "deal")} across the pipeline:`,
          bullets: PIPELINE_STAGES.map((stage) => {
            const deals = ctx.deals.filter((d) => d.stage === stage && !d.lost);
            return `${stage}: ${deals.length ? deals.map((d) => `${d.client} (${d.suburb}, ${d.value})`).join(", ") : "none"}.`;
          }),
          actions: [{ label: "Open Pipeline", href: "/sales?tab=pipeline" }],
        }),
      },
      {
        group: "Pipeline",
        question: "What happens when a deal is won?",
        keys: ["won", "sale won", "move a deal", "next stage"],
        answer: () => ({
          text: "Drag the deal card to the next column, or open it and change its stage. When it reaches Sale won, the job is created in CRM Dash Sync automatically — Operations picks it up from there.",
          actions: [{ label: "Open Pipeline", href: "/sales?tab=pipeline" }],
        }),
      },
      {
        group: "Rapid costing",
        question: "When does a discount need approval?",
        keys: ["discount", "approval", "discretion", "threshold"],
        answer: () => ({
          text: `Discounts up to ${aud(DISCOUNT_APPROVAL_THRESHOLD)} are within your discretion. Anything above that needs a manager — send it from Rapid costing with “Send for manager approval”.`,
          bullets: [`Commission base: ${aud(COMMISSION_BASE.Retail)} retail, ${aud(COMMISSION_BASE.Wholesale)} wholesale.`],
          actions: [{ label: "Open Rapid costing", href: "/sales?tab=costing" }],
        }),
      },
      {
        group: "Exclusive land",
        question: "Which lots can I hold?",
        keys: ["lot", "land", "estate", "available"],
        answer: () => {
          const open = SEED_LOTS.filter((l) => l.status === "available");
          return {
            text: open.length ? `${plural(open.length, "exclusive lot")} available to hold:` : "No exclusive lots are free to hold right now.",
            bullets: open.map((l) => `${l.lot}, ${l.estate} — ${l.price} · ${l.specs} · ${l.titled}.`),
            actions: [{ label: "Open Exclusive land", href: "/sales?tab=land" }],
          };
        },
      },
      {
        group: "Exclusive land",
        question: "How do land holds work?",
        keys: ["hold", "queue", "24"],
        answer: () => ({
          text: `A hold reserves the lot for 24 hours. If it's already held you can join the queue — up to ${HOLD_QUEUE_MAX} holds per lot, the current holder included.`,
          actions: [{ label: "Open Exclusive land", href: "/sales?tab=land" }],
        }),
      },
      {
        group: "Team",
        question: "Who's leading sales this quarter?",
        keys: ["leading", "top", "leader", "quarter", "rank"],
        answer: () => ({
          text: `${SALES_WON_QTD[0][0]} is leading the quarter:`,
          bullets: SALES_WON_QTD.map(([rep, n, value], i) => `${i + 1}. ${rep} — ${plural(n, "sale")}, ${value}.`),
          actions: [{ label: "Open Team", href: "/sales?tab=team" }],
        }),
      },
      {
        group: "Team",
        question: "Any discounts waiting for approval?",
        keys: ["waiting", "pending discount", "approve"],
        answer: () => ({
          text: `${plural(SEED_DISCOUNTS.length, "discount")} waiting for a manager:`,
          bullets: SEED_DISCOUNTS.map(
            (d) => `${d.client} · ${d.plan} — ${aud(d.discount)} discount (${aud(d.contribution)} from commission), raised by ${d.rep}.`,
          ),
          actions: [{ label: "Open Team", href: "/sales?tab=team" }],
        }),
      },
      ...USING("Sales Manager"),
    ],
    fallback:
      "On the Sales Manager dashboard I can answer about the team's pipeline, what happens when a deal is won, discounts, land holds, the quarter's leaders and discounts waiting for approval.",
  },

  marketing: {
    subtitle: "Spend, channels and attribution",
    greeting: "I can break down spend and deals by channel.",
    faqs: [
      {
        group: "Performance",
        question: "What's our cost per deal?",
        keys: ["cost per", "cost", "cpa", "cheap", "expensive"],
        answer: () => {
          const ranked = [...CHANNELS].sort((a, b) => a.spend / a.won - b.spend / b.won);
          return {
            text: `Blended cost per deal is ${aud(TOTAL_SPEND / TOTAL_WON)} across ${CHANNELS.length} channels.`,
            bullets: [
              `Cheapest: ${ranked[0].name} at ${aud(ranked[0].spend / ranked[0].won)} a deal.`,
              `Most expensive: ${ranked[ranked.length - 1].name} at ${aud(ranked[ranked.length - 1].spend / ranked[ranked.length - 1].won)} a deal.`,
            ],
            actions: [{ label: "Open Performance", href: "/marketing?tab=performance" }],
          };
        },
      },
      {
        group: "Performance",
        question: "Where are we spending most?",
        keys: ["spend", "spending", "budget", "most"],
        answer: () => {
          const ranked = [...CHANNELS].sort((a, b) => b.spend - a.spend);
          return {
            text: `Total spend is ${aud(TOTAL_SPEND)}. ${ranked[0].name} takes the most:`,
            bullets: ranked.map((c) => `${c.name}: ${aud(c.spend)} (${Math.round((c.spend / TOTAL_SPEND) * 100)}%).`),
          };
        },
      },
      {
        group: "Channels",
        question: "Which channel converts best?",
        keys: ["convert", "conversion", "best channel"],
        answer: () => {
          const ranked = [...CHANNELS].sort((a, b) => b.won / b.leads - a.won / a.leads);
          return {
            text: `${ranked[0].name} converts best — ${((ranked[0].won / ranked[0].leads) * 100).toFixed(1)}% of leads become deals.`,
            bullets: ranked.map((c) => `${c.name}: ${((c.won / c.leads) * 100).toFixed(1)}% (${c.won} won from ${c.leads} leads).`),
            actions: [{ label: "Open Channels", href: "/marketing?tab=channels" }],
          };
        },
      },
      {
        group: "Attribution",
        question: "Can we trust the attribution?",
        keys: ["attribution", "trust", "tag", "utm", "tracking"],
        answer: () => {
          const low = TAG_COVERAGE.filter((t) => t.pct < TAG_COVERAGE_FLOOR);
          return {
            text: low.length
              ? `Mostly — but ${low.map((t) => t.source).join(" and ")} ${low.length === 1 ? "is" : "are"} under the ${TAG_COVERAGE_FLOOR}% tag-coverage floor, so those channels under-report.`
              : `Yes — every source is above the ${TAG_COVERAGE_FLOOR}% tag-coverage floor.`,
            bullets: TAG_COVERAGE.map((t) => `${t.source}: ${t.pct}% tagged.`),
            actions: [{ label: "Open Attribution", href: "/marketing?tab=attribution" }],
          };
        },
      },
      {
        group: "Attribution",
        question: "What does Launchpad check nightly?",
        keys: ["nightly", "check", "audit", "data quality"],
        answer: () => ({
          text: "Every night Launchpad checks the marketing data for gaps:",
          bullets: NIGHTLY_CHECKS.map((c) => `${c.check} — ${c.found}.`),
          actions: [{ label: "Open Attribution", href: "/marketing?tab=attribution" }],
        }),
      },
      ...USING("Marketing"),
    ],
    fallback: "On Marketing I can answer about cost per deal, where spend goes, conversion by channel, attribution and the nightly data checks.",
  },

  finance: {
    subtitle: "Client finance health checks",
    greeting: "I can walk you through the finance health check.",
    faqs: [
      {
        group: "Health check",
        question: "What does the health check do?",
        keys: ["health check", "what does", "form"],
        answer: () => ({
          text: "It's the client-facing finance health check. It replaces the WordPress form and writes each answer straight to Mercury, five steps in all.",
          actions: [{ label: "Open the health check", href: "/finance?tab=health" }],
        }),
      },
      {
        group: "Health check",
        question: "What's asked about income?",
        keys: ["income", "employment", "salary", "step 2"],
        answer: () => ({
          text: "Step 2 of 5 covers income and employment: the employment type and annual income. Income is required before the client can continue.",
          actions: [{ label: "Open step 2", href: "/finance?tab=health" }],
        }),
      },
      {
        group: "Mercury",
        question: "Where do the answers go?",
        keys: ["mercury", "where", "saved", "stored"],
        answer: () => ({ text: "Straight to Mercury — each step is saved as the client continues, so nothing waits on a broker to re-key it." }),
      },
      ...USING("Finance"),
    ],
    fallback: "On Finance I can explain the health check, what step 2 asks and where answers are saved.",
  },

  accounts: {
    subtitle: "Invoicing, expenses and reports",
    greeting: "Ask me about drafts waiting, cash or expense claims.",
    faqs: [
      {
        group: "Builder invoicing",
        question: "Which invoices are waiting for approval?",
        keys: ["invoice", "draft", "builder billing"],
        answer: (ctx) => {
          const drafts = ctx.invoices.filter((i) => i.status === "Draft");
          if (drafts.length === 0) {
            return {
              text: "No draft invoices are waiting. Everything raised has been approved.",
              actions: [{ label: "Open Builder invoicing", href: "/accounts?tab=invoicing" }],
            };
          }
          const total = drafts.reduce((s, i) => s + i.amount, 0);
          return {
            text: `${plural(drafts.length, "draft invoice")} worth ${aud(total)} + GST ${drafts.length === 1 ? "is" : "are"} waiting:`,
            bullets: drafts.map((i) => `${i.id} · ${i.job} ${i.client}: ${i.builder}, ${i.stage}, ${aud(i.amount)} + GST.`),
            actions: [{ label: "Open Builder invoicing", href: "/accounts?tab=invoicing" }],
            source: "Xero drafts",
          };
        },
      },
      {
        group: "Builder invoicing",
        question: "How are builder invoices raised?",
        keys: ["raised", "how", "schedule", "automatic"],
        answer: () => ({
          text: "Stage completions in CRM dash sync raise a draft invoice against each builder's schedule. Nothing reaches a builder until it's approved here — Approve sends it from Xero.",
          actions: [{ label: "Open Builder invoicing", href: "/accounts?tab=invoicing" }],
        }),
      },
      {
        group: "Builder invoicing",
        question: "How much have we invoiced this month?",
        keys: ["invoiced", "this month", "revenue", "forecast"],
        answer: (ctx) => ({
          text: `${aud(invoicedThisMonth(ctx.invoices))} invoiced so far this month (excl GST), with ${aud(FORECAST_NEXT_MONTH)} forecast for next month.`,
          actions: [{ label: "Open Builder invoicing", href: "/accounts?tab=invoicing" }],
        }),
      },
      {
        group: "Reports",
        question: "What does cash flow look like?",
        keys: ["cash", "cashflow", "cash flow", "projected"],
        answer: () => ({
          text: "Projected receipts for the next three months:",
          bullets: CASHFLOW.map(
            (m) => `${m.month}: $${m.projectedK}k — ${m.split[0]}% finance approval, ${m.split[1]}% land settlement, ${m.split[2]}% slab and later.`,
          ),
          actions: [{ label: "Open Reports", href: "/accounts?tab=reports" }],
        }),
      },
      {
        group: "Expenses",
        question: "Any expense claims to approve?",
        keys: ["expense", "claim", "receipt", "reimburse"],
        answer: (ctx) => {
          const waiting = ctx.claims.filter((c) => c.status === "Awaiting approval");
          if (waiting.length === 0) {
            return {
              text: `No expense claims are waiting (${EXPENSES_THIS_MONTH} claimed this month).`,
              actions: [{ label: "Open Expenses", href: "/accounts?tab=expenses" }],
            };
          }
          return {
            text: `${plural(waiting.length, "claim")} awaiting approval (${EXPENSES_THIS_MONTH} claimed this month):`,
            bullets: waiting.map((c) => `${c.claim} · ${c.staff} — ${aud(c.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, coded ${c.code}.`),
            actions: [{ label: "Open Expenses", href: "/accounts?tab=expenses" }],
          };
        },
      },
      {
        group: "Expenses",
        question: "How long do approvals take?",
        keys: ["how long", "approval time", "turnaround"],
        answer: () => ({ text: `Expense claims are approved in ${AVG_APPROVAL_TIME} on average, and coded to Xero on approval.` }),
      },
      ...USING("Accounts"),
    ],
    fallback: "On Accounts I can answer about draft invoices, how they're raised, what's been invoiced, cash flow and expense claims.",
  },

  accounting: {
    subtitle: "Staff invoices, the pay run and what's been paid",
    greeting: "Ask me which invoices are waiting on you, what rate this pay run uses, or who can't be paid.",
    faqs: [
      {
        group: "Pay run",
        question: "Which invoices are waiting on me?",
        keys: ["waiting", "pending", "review", "approve", "to decide", "invoice"],
        answer: ({ payRun: { run } }) => {
          const pending = run.pending;
          if (!pending.length) {
            return {
              text: run.approved.length
                ? `Nothing to review. ${plural(run.approved.length, "approved invoice")} ${run.approved.length === 1 ? "is" : "are"} ready to pay.`
                : "Nothing to review: every invoice that's reached Accounting has been decided.",
              actions: [{ label: `Open ${PAY_RUN}`, href: "/accounting?tab=payrun" }],
            };
          }
          const total = pending.reduce((n, i) => n + invoiceTotals(i.lines).total, 0);
          return {
            text: `${plural(pending.length, "invoice")} worth ${money(total)} ${pending.length === 1 ? "is" : "are"} waiting for a decision:`,
            bullets: pending.map((i) => `${personOf(i.employeeId).name}: ${i.number}, ${money(invoiceTotals(i.lines).total)}, ${billsFor(i).toLowerCase()}.`),
            actions: [{ label: `Open ${PAY_RUN}`, href: "/accounting?tab=payrun" }],
            source: "Accounting · live",
          };
        },
      },
      {
        group: "Pay run",
        question: "What rate is this pay run using?",
        keys: ["rate", "php", "peso", "exchange", "fx", "aud to php", "conversion"],
        answer: ({ payRun: { view, run } }) => {
          const last = view.runs[0];
          const recent = view.runs.slice(0, 5).map((r) => `${dayMonth(r.on)}: ${rateText(r.rate)} per A$1.`);
          if (view.rate == null) {
            return {
              text: `No rate is set for this run yet.${last ? ` The last run, on ${dayMonth(last.on)}, used ${rateText(last.rate)} per A$1.` : ""} Set it on the Rate step first.`,
              bullets: recent,
              actions: [{ label: "Set the rate", href: "/accounting?tab=payrun" }],
              source: "Accounting · live",
            };
          }
          return {
            text: `This run converts at ${rateText(view.rate)} per A$1.${run.pay.length ? ` At that rate it pays ${php(run.php)} for ${money(run.aud)} invoiced.` : ""} Recent runs:`,
            bullets: recent,
            actions: [{ label: `Open ${PAY_RUN}`, href: "/accounting?tab=payrun" }],
            source: "Accounting · live",
          };
        },
      },
      {
        group: "Pay run",
        question: "Who can't be paid this run?",
        keys: ["can't be paid", "cannot be paid", "held", "hold", "payment method", "blocked", "missing"],
        answer: ({ payRun: { view, run } }) => {
          const noMethod = PAYEE_IDS.filter((id) => !paymentComplete(view.methods[id] ?? null));
          const held = run.held;
          if (!held.length && !noMethod.length) {
            return {
              text: "Everyone can be paid: each person has a payment method on file and no one is held.",
              actions: [{ label: "Open Validation", href: "/accounting?tab=payrun" }],
            };
          }
          return {
            text: held.length
              ? `${plural(held.length, "person", "people")} ${held.length === 1 ? "is" : "are"} held from this run:`
              : "No one with approved invoices is held, but some people can't be paid until they add a payment method:",
            bullets: [
              ...held.map((h) => `${personOf(h.employeeId).name}: ${h.reason}.`),
              ...noMethod
                .filter((id) => !held.some((h) => h.employeeId === id))
                .map((id) => `${personOf(id).name}: no payment method on file yet.`),
            ],
            actions: [{ label: "Open Validation", href: "/accounting?tab=payrun" }],
            source: "Accounting · live",
          };
        },
      },
      {
        group: "Pay run",
        question: "How does the pay run work?",
        keys: ["how", "steps", "wizard", "work", "dispatch", "process"],
        answer: () => ({
          text: `The ${PAY_RUN} is HRIS's Payroll Wizard cut to four steps:`,
          bullets: [
            "Rate: set today's AUD to PHP rate. Every run starts without one.",
            "Invoices: approve or reject each staff invoice. Pending ones wait for the next run.",
            "Validation: a pre-flight, then a review per person. No payment method holds someone, and you can hold anyone else.",
            "Dispatch: pays everyone cleared at the run's rate, with 6 seconds to undo. Each invoice then shows as Paid in the Employee portal.",
          ],
          actions: [{ label: `Open ${PAY_RUN}`, href: "/accounting?tab=payrun" }],
        }),
      },
      {
        group: "Pay history",
        question: "What did the last pay run pay?",
        keys: ["last run", "last pay", "paid", "history", "previous"],
        answer: ({ payRun: { view } }) => {
          const last = view.runs[0];
          if (!last) return { text: "No pay run has gone yet.", actions: [{ label: "Open Pay history", href: "/accounting?tab=history" }] };
          return {
            text: `The last run, on ${dayMonth(last.on)}, paid ${php(last.php)} to ${plural(last.payees, "person", "people")}: ${money(last.aud)} invoiced at ${rateText(last.rate)} per A$1.`,
            bullets: [
              `${plural(last.invoiceIds.length, "invoice")} paid by ${last.by}.`,
              ...(last.held.length ? [`Held: ${last.held.map((h) => personOf(h.employeeId).name).join(", ")}.`] : []),
              ...(last.skipped ? [`${plural(last.skipped, "pending invoice")} left for the next run.`] : []),
            ],
            actions: [{ label: "Open Pay history", href: "/accounting?tab=history" }],
            source: "Accounting · live",
          };
        },
      },
      ...USING("Accounting"),
    ],
    fallback:
      "In Accounting I can list invoices waiting on you, tell you this pay run's rate, say who can't be paid and why, explain the pay run's steps, and sum up the last run.",
  },

  wealth: {
    subtitle: "Suburb data and packages",
    greeting: "I can compare suburbs and find recent packages.",
    faqs: [
      {
        group: "Suburbs",
        question: "What's the median price in Baldivis?",
        keys: ["median", "price", "baldivis", "house price"],
        answer: () => {
          const s = SUBURBS[0];
          return { text: `${s.label}:`, bullets: s.stats.map((st) => `${st.label}: ${st.value}.`), actions: [{ label: "Open the generator", href: "/wealth?tab=generator" }] };
        },
      },
      {
        group: "Suburbs",
        question: "Which suburb has the best yield?",
        keys: ["yield", "best", "compare", "return"],
        answer: () => {
          const yieldOf = (s: (typeof SUBURBS)[number]) =>
            parseFloat((s.stats.find((st) => /yield/i.test(st.label))?.value ?? "0").replace(/[^0-9.]/g, ""));
          const ranked = [...SUBURBS].sort((a, b) => yieldOf(b) - yieldOf(a));
          return {
            text: `${ranked[0].name} has the best gross yield of the suburbs on file:`,
            bullets: ranked.map((s) => `${s.label}: ${s.stats.find((st) => /yield/i.test(st.label))?.value ?? "—"} gross yield.`),
          };
        },
      },
      {
        group: "Packages",
        question: "What packages were made recently?",
        keys: ["package", "recent", "generated", "brochure"],
        answer: () => ({
          text: "Recent packages:",
          bullets: SEED_PACKAGES.map((p) => `${p.title} — ${p.when.toLowerCase()}.`),
          actions: [{ label: "Generate one", href: "/wealth?tab=generator" }],
        }),
      },
      {
        group: "Packages",
        question: "How do I make a package?",
        keys: ["make", "create", "generate a", "how"],
        answer: () => ({
          text: "Pick the suburb — its property data loads automatically — then press Generate package. It's added to Recent packages; no more hand-typed brochures.",
          actions: [{ label: "Open the generator", href: "/wealth?tab=generator" }],
        }),
      },
      ...USING("Wealth"),
    ],
    fallback: "On Wealth I can give suburb figures, compare yields, list recent packages and explain how to make one.",
  },

  hr: {
    subtitle: "People, leave and recruitment",
    greeting: "Ask me who's in, who's away or what's open.",
    faqs: [
      {
        group: "Dashboard",
        question: "How many people work here?",
        keys: ["how many", "headcount", "employees", "staff", "division"],
        answer: () => ({
          text: `${HR_KPIS.totalEmployees} people across ${DIVISIONS.length} divisions:`,
          bullets: DIVISIONS.map((d) => `${d.name}: ${d.count} (${d.share}%).`),
          actions: [{ label: "Open the Global Master List", href: "/hr?tab=people" }],
        }),
      },
      {
        group: "Attendance",
        question: "Who's away or not in yet?",
        keys: ["away", "on leave today", "not in", "absent", "attendance", "clocked"],
        answer: () => {
          const late = ATTENDANCE.filter((a) => a.status === "Not yet in").map((a) => a.name);
          return {
            text: `${ON_LEAVE_TODAY.note}.`,
            bullets: [
              ...(late.length ? [`Not yet in: ${late.join(", ")}.`] : []),
              ...ATTENDANCE.filter((a) => a.status === "WFH").map((a) => `${a.name} is working from home.`),
            ],
            actions: [{ label: "Open Attendance", href: "/hr?tab=attendance" }],
          };
        },
      },
      {
        group: "Leave",
        question: "Which leave requests need approval?",
        keys: ["leave request", "approve", "pending leave", "leave"],
        // Reads the live queue HR › Leave decides from, so it changes the moment a decision lands.
        answer: (ctx) => {
          const pending = ctx.leave.filter((r) => r.status === "Pending");
          if (pending.length === 0) {
            return {
              text: "No leave requests are waiting. You're all caught up.",
              actions: [{ label: "Open Leave", href: "/hr?tab=leave" }],
              source: "Horilla · live",
            };
          }
          return {
            text: `${plural(pending.length, "leave request")} waiting for approval:`,
            bullets: pending.map((r) => {
              const off = othersOff(r, ctx.leave);
              const cover = off.length ? `${plural(off.length, "other")} off then` : "no one else off then";
              const after = balanceAfter(r);
              const balance = after === null ? "No balance to draw on" : `Balance after: ${formatDays(after)}`;
              return `${r.name}: ${r.type.toLowerCase()}, ${r.when} (${r.length}). ${balance}; ${cover}.`;
            }),
            actions: [{ label: "Open Leave", href: "/hr?tab=leave" }],
            source: "Horilla · live",
          };
        },
      },
      {
        group: "Leave",
        question: "How much leave do I have?",
        keys: ["balance", "how much leave", "annual leave", "days left"],
        answer: () => ({
          text: "Your balances:",
          bullets: LEAVE_BALANCES.map((b) => `${b.label}: ${b.value}.`),
          actions: [{ label: "Open Leave", href: "/hr?tab=leave" }],
        }),
      },
      {
        group: "Recruitment",
        question: "Which roles are we hiring for?",
        keys: ["hiring", "role", "recruit", "position", "vacanc", "candidate"],
        answer: () => ({
          text: `${plural(HR_KPIS.openPositions, "open position")}:`,
          bullets: OPEN_ROLES.map((r) => `${r.role} (hiring manager ${r.manager}) — ${r.stages.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(", ")}.`),
          actions: [{ label: "Open Recruitment", href: "/hr?tab=recruitment" }],
        }),
      },
      {
        group: "Recruitment",
        question: "How is the new starter's onboarding going?",
        keys: ["onboarding", "new starter", "lane", "dixon"],
        answer: () => ({
          text: `${ONBOARDING.name} (${ONBOARDING.detail}) has finished ${ONBOARDING.done} of ${ONBOARDING.total} onboarding tasks.`,
          bullets: [`${ONBOARDING.remaining}.`],
          actions: [{ label: "Open Recruitment", href: "/hr?tab=recruitment" }],
        }),
      },
      {
        group: "Assets",
        question: "Is any equipment out of action?",
        keys: ["asset", "laptop", "equipment", "repair", "phone"],
        answer: () => {
          const repair = ASSETS.filter((a) => a.status === "In repair");
          const free = ASSETS.filter((a) => a.status === "Available");
          return {
            text: repair.length ? `${plural(repair.length, "asset")} in repair:` : "Nothing is in repair.",
            bullets: [
              ...repair.map((a) => `${a.name} (${a.tag})${a.assignedTo ? ` — assigned to ${a.assignedTo}` : ""}.`),
              ...(free.length ? [`Available to issue: ${free.map((a) => `${a.name} (${a.tag})`).join(", ")}.`] : []),
            ],
            actions: [{ label: "Open Assets", href: "/hr?tab=assets" }],
          };
        },
      },
      ...USING("HR"),
    ],
    fallback: "On HR I can answer about headcount, who's away, leave waiting for approval, your balances, open roles, onboarding and equipment.",
  },

  knowledge: {
    subtitle: "Procedures and builder guides",
    greeting: "Ask me how something's done — I'll find the document.",
    faqs: [
      {
        group: "Finding documents",
        question: "Where's the deal submission checklist?",
        keys: ["submission", "checklist", "deal"],
        answer: () => ({
          text: "It's in Builder guides: “Deal submission checklist — all builders”, updated 6 Aug.",
          actions: [{ label: "Open it", href: "/knowledge?cat=builders&q=Deal%20submission%20checklist" }],
        }),
      },
      {
        group: "Finding documents",
        question: "How do milestones sync to HubSpot?",
        keys: ["milestone", "sync", "hubspot", "monday"],
        answer: () => ({
          text: "See “How milestones sync to HubSpot and Monday” in Systems reference — new this month.",
          actions: [{ label: "Open it", href: "/knowledge?cat=systems&q=How%20milestones%20sync" }],
        }),
      },
      {
        group: "Finding documents",
        question: "How do I request leave?",
        keys: ["leave", "holiday", "time off"],
        answer: () => ({
          text: "The SOP is “Leave request and approval”, in SOPs and processes.",
          actions: [
            { label: "Read the SOP", href: "/knowledge?cat=sops&q=Leave%20request" },
            { label: "Go to HR › Leave", href: "/hr?tab=leave" },
          ],
        }),
      },
      {
        group: "Library",
        question: "What's new this month?",
        keys: ["new", "latest", "recent", "updated"],
        answer: () => {
          const fresh = CATEGORIES.flatMap((c) => MATERIALS[c.name].filter((m) => m.meta === "New").map((m) => `${m.title} (${c.name}).`));
          return { text: fresh.length ? "New material:" : "Nothing new this month.", bullets: fresh };
        },
      },
      {
        group: "Library",
        question: "How big is the library?",
        keys: ["how many", "categories", "library", "size"],
        answer: () => ({
          text: `${CATEGORIES.reduce((s, c) => s + c.count, 0)} materials across ${CATEGORIES.length} categories:`,
          bullets: CATEGORIES.map((c) => `${c.name}: ${c.count}.`),
        }),
      },
      {
        group: "Library",
        question: "How do I add material?",
        keys: ["add", "upload material", "contribute"],
        answer: () => ({
          text: "Use Add material on the Knowledge base: give it a title, an optional file, the category and the format. It lands at the top of its category marked New.",
          actions: [{ label: "Open Knowledge", href: "/knowledge" }],
        }),
      },
      ...USING("Knowledge"),
    ],
    fallback: "On Knowledge I can find documents, tell you what's new, size up the library and explain how to add material.",
  },

  leadership: {
    subtitle: "Business performance",
    greeting: "Ask me about sales, builds, pipeline or cash.",
    faqs: [
      {
        group: "Business dashboard",
        question: "How are sales tracking this month?",
        keys: ["sales", "tracking", "won"],
        answer: () => {
          const full = SALES_BY_MONTH.filter((m) => !m.partial);
          const best = [...full].sort((a, b) => b.value - a.value)[0];
          return {
            text: `${plural(OVERVIEW_KPIS.salesThisMonth, "sale")} so far in August (month to date). ${best.month} was the best full month with ${best.value}.`,
            bullets: SALES_BY_MONTH.map((m) => `${m.month}: ${m.value}${m.partial ? " (month to date)" : ""}.`),
            actions: [{ label: "Open the dashboard", href: "/leadership?tab=business" }],
          };
        },
      },
      {
        group: "Business dashboard",
        question: "Which builder has the most active builds?",
        keys: ["builder", "active build", "builds", "construction"],
        answer: () => ({
          text: `${BUILDS_BY_BUILDER[0].builder} has the most, ${BUILDS_BY_BUILDER[0].pct}% of ${OVERVIEW_KPIS.activeBuilds} active builds.`,
          bullets: BUILDS_BY_BUILDER.map((b) => `${b.builder}: ${b.pct}% (≈${Math.round((b.pct / 100) * OVERVIEW_KPIS.activeBuilds)}).`),
        }),
      },
      {
        group: "Business dashboard",
        question: "What's in the pipeline by stage?",
        keys: ["pipeline", "stage", "value"],
        answer: () => ({ text: "Pipeline value by stage:", bullets: PIPELINE_BY_STAGE.map((p) => `${p.stage}: ${p.value} (${p.share}%).`) }),
      },
      {
        group: "Business dashboard",
        question: "How long does a build take?",
        keys: ["how long", "site to keys", "days", "duration"],
        answer: () => ({
          text: `${OVERVIEW_KPIS.avgDaysSiteToKeys} days on average from Date to Site to Key Handover, with ${OVERVIEW_KPIS.handoversYtd} handovers since 1 January.`,
        }),
      },
      // The Custom dashboard's own Jarvis answers, reused verbatim so the
      // bubble and the page speak with one voice.
      ...[...JARVIS_SUGGESTIONS, "What's our average commission per deal?", "Which rep is performing best?"].map(
        (question): Faq => ({
          group: "Custom dashboard",
          question,
          keys: JARVIS_ANSWERS.find((a) => a.answer === leadershipJarvis(question))?.keys ?? [],
          answer: () => ({
            text: leadershipJarvis(question),
            actions: [{ label: "Build it into a dashboard", href: "/leadership?tab=custom" }],
          }),
        }),
      ),
      ...USING("Leadership"),
    ],
    fallback:
      "Jarvis can answer from anything mirrored in Launchpad: deals, milestones, invoices, marketing spend and people. Try asking about cash forecast, channel cost per deal, rep performance or sync risk.",
  },

  it: {
    subtitle: "Help desk and systems",
    greeting: "Something not working? I can check tickets or point you to help.",
    faqs: [
      {
        group: "Help desk",
        question: "What tickets are open?",
        keys: ["ticket", "open", "help desk", "issue"],
        answer: () => {
          const open = TICKET_SEED.filter((t) => t.status !== "Resolved");
          return {
            text: open.length ? `${plural(open.length, "ticket")} still open:` : "No open tickets.",
            bullets: open.map((t) => `#${t.id} ${t.title} — ${t.status}, ${t.priority.toLowerCase()} priority (${t.requester}).`),
            actions: [{ label: "Open the help desk", href: "/it?tab=helpdesk" }],
          };
        },
      },
      {
        group: "Help desk",
        question: "How do I raise a ticket?",
        keys: ["raise", "new ticket", "log", "report a problem"],
        answer: () => ({
          text: "Use “New ticket” on the IT help desk: pick a category and priority, describe what's happening, and submit. It appears in Open and recent tickets straight away.",
          actions: [{ label: "Raise a ticket", href: "/it?tab=helpdesk" }],
        }),
      },
      {
        group: "Security",
        question: "How do I report a phishing email?",
        keys: ["phish", "scam", "suspicious", "email"],
        answer: () => ({
          text: "Don't click anything. Forward it to support@localegroup.au — this month's phishing simulation is running, so check sender addresses carefully.",
        }),
      },
      ...USING("IT"),
    ],
    fallback: "On IT I can list open tickets and explain how to raise one or report phishing.",
  },
  tickets: {
    subtitle: "Improvements and projects",
    greeting: "I can tell you which dashboards have open tickets, how the projects are going, and how to raise one.",
    faqs: [
      {
        group: "Board",
        question: "Which dashboards have open tickets?",
        keys: ["which dashboard", "open tickets", "dashboards have", "most tickets", "where are"],
        answer: (ctx) => {
          const rows = openByDashboard(ctx.tickets);
          if (!rows.length) return { text: "No dashboard has an open ticket right now.", source: "Tickets board · live" };
          const open = rows.reduce((n, r) => n + r.count, 0);
          return {
            text: `${plural(open, "open ticket")} across ${plural(rows.length, "dashboard")}, most first:`,
            bullets: rows.map((r) => `${dashboardName(r.dashboard)}: ${r.count}.`),
            actions: rows.slice(0, 2).map((r) => ({ label: `Open ${dashboardName(r.dashboard)}'s tickets`, href: `/tickets?tab=board&dash=${r.dashboard}` })),
            source: "Tickets board · live",
          };
        },
      },
      {
        group: "Projects",
        question: "How are the projects going?",
        keys: ["project", "progress", "how far", "closest", "build"],
        answer: (ctx) => ({
          text: `${plural(TICKET_PROJECTS.length, "project")}, each counted from its tickets:`,
          bullets: TICKET_PROJECTS.map((p) => {
            const pr = projectProgress(p, ctx.tickets);
            return pr.total
              ? `${p.name} — ${pr.done} of ${pr.total} done (${pr.pct}%), ${p.state.toLowerCase()}, ${seatName(p.owner)}.`
              : `${p.name} — no tickets yet, ${p.state.toLowerCase()}, ${seatName(p.owner)}.`;
          }),
          actions: [{ label: "Open Projects", href: "/tickets?tab=projects" }],
          source: "Tickets board · live",
        }),
      },
      {
        group: "Raising",
        question: "How do I raise a ticket?",
        keys: ["raise", "new ticket", "suggest", "improvement", "request a change", "feedback"],
        answer: () => ({
          text: "Press “Suggest an improvement” under Feedback in any dashboard's sidebar. It opens a new ticket with that dashboard already picked, without leaving the page. On the board, “New ticket” does the same. It lands in To Do, assigned to Jan Kane Reroma unless you pick someone else.",
          actions: [{ label: "Open the board", href: "/tickets?tab=board" }],
        }),
      },
      {
        group: "Board",
        question: "What's the oldest open ticket?",
        keys: ["oldest", "longest", "waiting longest", "stale"],
        answer: (ctx) => {
          const oldest = ticketStats(ctx.tickets, Date.now()).oldestOpen;
          if (!oldest) return { text: "Nothing is open.", source: "Tickets board · live" };
          return {
            text: `${formatTicketNo(oldest.no)} “${oldest.title}” has been open ${ageLabel(oldest.createdAt)}, on ${dashboardName(oldest.dashboard)}, assigned to ${seatName(oldest.assignee) ?? "nobody"}.`,
            actions: [{ label: `Open ${formatTicketNo(oldest.no)}`, href: `/tickets?tab=board&ticket=${oldest.no}` }],
            source: "Tickets board · live",
          };
        },
      },
      ...USING("Tickets"),
    ],
    fallback: "On Tickets I can list which dashboards have open tickets, how each project is going, the oldest open ticket, and how to raise one.",
  },
  admin: {
    subtitle: "Roles and the master list",
    greeting: "I can tell you who's online, who holds which dashboard, and who doesn't have one yet.",
    faqs: [
      {
        group: "Global Master List",
        question: "Who's online right now?",
        keys: ["online", "who's on", "logged in", "active now", "signed in"],
        answer: (ctx) => {
          const now = Date.now();
          const on = directory(masterList(ctx.people), ctx.admin.offRoster)
            .map((p) => ({ p, live: liveOf(p, ctx.admin, now) }))
            .filter((x) => x.live.state !== "offline");
          if (!on.length) return { text: "Nobody is online right now.", source: "Global Master List · sample" };
          return {
            text: `${plural(on.length, "person", "people")} online:`,
            bullets: on.map(({ p, live }) => {
              const page = live.at ? pageOf(live.at) : null;
              return `${p.name}${page ? ` — ${page.dashboard.title} · ${page.section}` : ""}${live.state === "inactive" ? " (tab in the background)" : ""}.`;
            }),
            actions: [{ label: "Open the Global Master List", href: "/admin?tab=people&view=online" }],
            source: "Global Master List · sample",
          };
        },
      },
      {
        group: "Roles & permissions",
        question: "Who has admin access?",
        keys: ["admin access", "admins", "full access", "who is admin", "superuser"],
        answer: (ctx) => {
          const admins = directory(masterList(ctx.people), ctx.admin.offRoster).filter((p) =>
            (ctx.admin.grants[p.key] ?? []).includes("admin"),
          );
          return {
            text: admins.length
              ? `${plural(admins.length, "person", "people")} ${admins.length === 1 ? "holds" : "hold"} Admin, which unlocks every dashboard:`
              : "Nobody holds Admin right now.",
            bullets: admins.map((p) => `${p.name}${p.row ? `, ${p.row.role}` : " (off-roster)"}.`),
            actions: [{ label: "Open Roles & permissions", href: "/admin?tab=roles&role=admin" }],
            source: "Roles & permissions · live",
          };
        },
      },
      {
        group: "Roles & permissions",
        question: "Who doesn't have a dashboard yet?",
        keys: ["no dashboard", "no role", "no access", "without a role", "without access"],
        answer: (ctx) => {
          const none = directory(masterList(ctx.people), ctx.admin.offRoster).filter(
            (p) => p.row && (ctx.admin.grants[p.key] ?? []).length === 0,
          );
          if (!none.length) {
            return { text: "Everyone on the master list holds at least one dashboard.", source: "Roles & permissions · live" };
          }
          return {
            text: `${plural(none.length, "person", "people")} on the master list ${none.length === 1 ? "has" : "have"} no dashboard yet, so Home is all they can open:`,
            bullets: none.map((p) => (p.email ? `${p.name}, ${p.row!.role}.` : `${p.name}, ${p.row!.role} — no email yet, so nothing can be granted.`)),
            actions: [{ label: "Open Roles & permissions", href: "/admin?tab=roles" }],
            source: "Roles & permissions · live",
          };
        },
      },
      {
        group: "Roles & permissions",
        question: "How do I give someone a dashboard?",
        keys: ["give", "grant", "assign", "provision", "permission"],
        answer: () => ({
          text: `Open Roles & permissions, pick the person and press Assign on the dashboard's role. A grant starts every section on Edit; narrow any section to View or Hidden in the grid underneath. Revoking signs them out so it takes effect. ${ROLE_BY_KEY.admin.label} unlocks everything, so it asks first.`,
          actions: [{ label: "Open Roles & permissions", href: "/admin?tab=roles" }],
        }),
      },
      ...USING("Admin"),
    ],
    fallback: "On Admin I can list who's online, who holds Admin, and who has no dashboard yet.",
  },
  client: {
    subtitle: "Your home journey",
    greeting: "Hi — I can tell you where your build is up to, how your budget splits and why your builder was recommended.",
    faqs: [
      {
        group: "Your build",
        question: "Where is my build up to?",
        keys: ["build", "up to", "progress", "stage", "where"],
        answer: (ctx) => {
          const job = clientJob(ctx);
          if (!job) return NO_JOB;
          const stage = currentStage(job);
          const done = job.milestones.filter((m) => m.status === "done");
          const last = done[done.length - 1];
          const next = nextStep(job);
          return {
            text: stage ? `You're at ${stage.label.toLowerCase()}, with ${stage.who}.` : "Your journey is complete. Welcome home.",
            bullets: [
              last ? `Last milestone: ${last.name}, ${last.date}.` : "Your builder hasn't started on site yet.",
              ...(next ? [`Next: ${next.name}.`] : []),
              `${done.length} of 8 build milestones reached.`,
            ],
            actions: [{ label: "Open My build", href: "/client?tab=build" }],
            source: "Your job · live",
          };
        },
      },
      {
        group: "Your build",
        question: "What happens before handover?",
        keys: ["handover", "keys", "before", "left"],
        answer: (ctx) => {
          const job = clientJob(ctx);
          if (!job) return NO_JOB;
          const left = journeyFor(job)
            .filter((s) => s.id === "construction" || s.id === "handover")
            .flatMap((s) => s.milestones)
            .filter((m) => m.status !== "done" && m.status !== "na");
          return {
            text: left.length ? `${plural(left.length, "milestone")} to go:` : "Nothing left: you have your keys.",
            bullets: left.map((m) => m.name),
            actions: [{ label: "Open My build", href: "/client?tab=build" }],
            source: "Your job · live",
          };
        },
      },
      {
        group: "Finance",
        question: "How does our budget split?",
        keys: ["budget", "split", "borrow", "afford", "package", "cost", "price"],
        answer: () => ({
          text: `You can borrow ${aud(BORROWING_CAPACITY)}. Your package is ${aud(PACKAGE_TOTAL)}, ${aud(BORROWING_CAPACITY - PACKAGE_TOTAL)} under that:`,
          bullets: Object.values(PACKAGE_SPLIT).map((p) => `${p.label}: ${aud(p.amount)} (${p.detail}).`),
          actions: [{ label: "Open Finance", href: "/client?tab=finance" }],
        }),
      },
      {
        group: "Finance",
        question: "What have we paid so far?",
        keys: ["paid", "payment", "progress payment", "deposit"],
        answer: (ctx) => {
          const job = clientJob(ctx);
          if (!job) return NO_JOB;
          const done = doneDates(job);
          const paid = PROGRESS_PAYMENTS.filter((p) => done.has(p.milestone));
          const total = paid.reduce((sum, p) => sum + (BUILD_CONTRACT * p.pct) / 100, 0);
          return {
            text: `${aud(total)} of your ${aud(BUILD_CONTRACT)} build contract has been paid to ${job.builder}, in ${plural(paid.length, "progress payment")}.`,
            bullets: paid.map((p) => `${p.stage}: ${aud((BUILD_CONTRACT * p.pct) / 100)}, ${done.get(p.milestone)}.`),
            actions: [{ label: "Open Finance", href: "/client?tab=finance" }],
            source: "Your job · live",
          };
        },
      },
      {
        group: "My options",
        question: "Why was our builder recommended?",
        keys: ["recommend", "why", "match", "score", "options", "builder"],
        answer: () => {
          const ranked = [...MATCHES].sort((a, b) => matchScore(b) - matchScore(a));
          const top = ranked[0];
          return {
            text: `${top.design} by ${top.builder} scored ${matchScore(top)}, the best match for your brief. ${top.why}`,
            bullets: ranked.map((m) => `${m.builder}, ${m.design}: ${matchScore(m)} · ${aud(m.land + m.build)} · ${m.weeks} weeks.`),
            actions: [{ label: "Open My options", href: "/client?tab=options" }],
          };
        },
      },
      {
        group: "Documents",
        question: "Which documents are still to come?",
        keys: ["document", "contract", "paper", "pdf"],
        answer: (ctx) => {
          const job = clientJob(ctx);
          if (!job) return NO_JOB;
          const done = doneDates(job);
          const later = CLIENT_DOCS.filter((d) => d.after && !done.has(d.after));
          return {
            text: later.length ? `${plural(later.length, "document")} still to come:` : "Every document is here.",
            bullets: later.map((d) => `${d.name}, at ${d.after}.`),
            actions: [{ label: "Open Documents", href: "/client?tab=documents" }],
            source: "Your job · live",
          };
        },
      },
      {
        group: "Messages",
        question: "How do I contact my team?",
        keys: ["contact", "message", "call", "consultant", "talk", "ask"],
        answer: (ctx) => {
          const job = clientJob(ctx);
          return {
            text: `Send a message in Messages. It goes to everyone on your build at once${job ? `: ${job.rep}, Locale Operations and ${job.builder}` : ""}.`,
            actions: [{ label: "Open Messages", href: "/client?tab=messages" }],
          };
        },
      },
      ...PORTAL_USING("Client portal"),
    ],
    fallback:
      "In the Client portal I can tell you where your build is up to, what's left before handover, how your budget splits, what you've paid, why your builder was recommended and which documents are still to come.",
  },
  developer: {
    subtitle: "Your Locale clients and rankings",
    greeting: `Hi ${DEVELOPER}, ask me which jobs are waiting on you, why clients pick other builders, or what Locale needs with a sale.`,
    faqs: [
      {
        group: "Locale clients",
        question: "Which jobs are waiting on us?",
        keys: ["waiting", "accept", "acceptance", "new job", "on us"],
        answer: (ctx) => {
          const waiting = ctx.jobs.filter((j) => j.builder === DEVELOPER && awaitingAcceptance(j));
          return {
            text: waiting.length
              ? `${plural(waiting.length, "new Locale sale")} ${waiting.length === 1 ? "is" : "are"} waiting for you to accept:`
              : "Nothing is waiting on you: every Locale sale is accepted.",
            bullets: waiting.map((j) => `${j.client}, sold ${j.saleWon} by ${j.rep}.`),
            actions: [{ label: "Open Locale clients", href: "/developer?tab=clients&show=awaiting" }],
            source: "Locale jobs · live",
          };
        },
      },
      {
        group: "Locale clients",
        question: "Who's in construction?",
        keys: ["construction", "on site", "building"],
        answer: (ctx) => {
          const onSite = ctx.jobs.filter((j) => j.builder === DEVELOPER && currentStage(j)?.id === "construction");
          return {
            text: onSite.length ? `${plural(onSite.length, "Locale client")} on site:` : "No Locale clients on site right now.",
            bullets: onSite.map((j) => `${j.client}, next: ${nextStep(j)?.name ?? "Practical Completion"}.`),
            actions: [{ label: "Send a site update", href: "/developer?tab=updates" }],
            source: "Locale jobs · live",
          };
        },
      },
      {
        group: "Match insights",
        question: "Why do clients pick another builder?",
        keys: ["why", "lose", "lost", "objection", "another builder", "weakness"],
        answer: () => {
          const lost = OBJECTIONS.reduce((sum, o) => sum + o.count, 0);
          return {
            text: `In ${lost} recorded consultations where you were shown and not chosen, these came up:`,
            bullets: OBJECTIONS.map((o) => `${o.objection} (${o.count}): “${o.said}”`),
            actions: [{ label: "Open Match insights", href: "/developer?tab=insights" }],
            source: "Sample figures · recording isn't live yet",
          };
        },
      },
      {
        group: "Match insights",
        question: "Where should we add packages?",
        keys: ["suburb", "demand", "add", "baldivis"],
        answer: () => {
          const gaps = DEMAND.filter((d) => d.packages === 0);
          return {
            text: gaps.length
              ? `Locale clients want ${gaps.map((g) => g.suburb).join(" and ")}, and you have no package there.`
              : "You have packages in every suburb Locale clients ask for.",
            bullets: DEMAND.map((d) => `${d.suburb}: ${d.enquiries} enquiries, ${plural(d.packages, "package")} of yours.`),
            actions: [{ label: "Open Match insights", href: "/developer?tab=insights" }],
            source: "Sample figures",
          };
        },
      },
      {
        group: "Terms",
        question: "What does Locale need with a sale?",
        keys: ["need", "checklist", "submission", "documents", "requirements"],
        answer: () => {
          const list = BUILDER_CHECKLISTS[DEVELOPER] ?? [];
          return {
            text: `Your deal-submission checklist has ${plural(list.filter((c) => c.req).length, "required document")}:`,
            bullets: list.map((c) => `${c.cat} · ${c.name}${c.req ? "" : " (if it applies)"}.`),
            actions: [{ label: "Open Terms and requirements", href: "/developer?tab=terms" }],
          };
        },
      },
      {
        group: "Terms",
        question: "What are Locale's fees?",
        keys: ["fee", "invoice", "claim", "charge"],
        answer: (ctx) => {
          const open = ctx.invoices.filter((i) => i.builder === DEVELOPER && i.status !== "Paid");
          return {
            text: "Locale invoices you when a client reaches each milestone (excl GST):",
            bullets: [
              ...Object.entries(BUILDER_CLAIMS[DEVELOPER] ?? {}).map(([m, a]) => `${m}: ${aud(a)}.`),
              open.length
                ? `${plural(open.length, "invoice")} open: ${open.map((i) => `${i.id} ${aud(i.amount)}`).join(", ")}.`
                : "No invoices open.",
            ],
            actions: [{ label: "Open Terms and requirements", href: "/developer?tab=terms" }],
            source: "Accounts · live",
          };
        },
      },
      ...PORTAL_USING("Developer portal"),
    ],
    fallback:
      "In the Developer portal I can list jobs waiting on you and clients on site, explain why clients pick another builder and where to add packages, and tell you what Locale needs with a sale and what it charges.",
  },
  employee: {
    subtitle: "Your pay, invoices and department",
    greeting: `Hi ${GOES_BY}, ask me what this week pays, what your rates are, where your invoices are up to, or who's in your department.`,
    faqs: [
      {
        group: "Pay",
        question: "What's my pay this week?",
        keys: ["pay", "earn", "salary", "this week", "take-home", "how much"],
        answer: (ctx) => {
          const pay = weekPay(LATEST_WEEK);
          const inv = ctx.staffInvoices.find((i) => i.week === LATEST_WEEK.start);
          return {
            text: `For the week of ${weekLabel(LATEST_WEEK.start)} you worked ${formatHours(pay.hours)}, which comes to ${money(pay.total)} at your rates:`,
            bullets: [
              `Regular: ${formatHours(pay.regularHours)} at ${money(RATES.regular)}/h, ${money(pay.regular)}.`,
              pay.overtimeHours
                ? `Overtime: ${formatHours(pay.overtimeHours)} at ${money(RATES.overtime)}/h, ${money(pay.overtime)}.`
                : "No overtime this week.",
              inv
                ? `Invoiced as ${inv.number}: ${inv.decision ?? "with Accounts for review"}.`
                : "Not invoiced yet. Send it to get paid.",
            ],
            actions: inv
              ? [{ label: "Open invoice history", href: "/employee?tab=invoices&view=history" }]
              : [{ label: "Invoice this week", href: `/employee?tab=invoices&week=${LATEST_WEEK.start}` }],
            source: "Sample figures · time tracking isn't connected yet",
          };
        },
      },
      {
        group: "Pay",
        question: "What are my current rates?",
        keys: ["rate", "rates", "hourly", "overtime", "per hour"],
        answer: () => ({
          text: "Locale pays you by the hour, and you invoice it weekly:",
          bullets: [
            `Regular: ${money(RATES.regular)}/h, up to ${RATES.overtimeAfter}h in a pay week.`,
            `Overtime: ${money(RATES.overtime)}/h for every hour after that.`,
            `Pay weeks run Sunday to Saturday, billed in ${CURRENCY}.`,
          ],
          actions: [{ label: "Open Profile", href: "/employee?tab=profile" }],
          source: "Sample figures",
        }),
      },
      {
        group: "Invoices",
        question: "Which invoices are with Accounts?",
        keys: ["invoice", "pending", "accounts", "approved", "review", "waiting"],
        answer: (ctx) => {
          const pending = ctx.staffInvoices.filter((i) => i.status === "pending");
          return {
            text: pending.length
              ? `${plural(pending.length, "invoice")} ${pending.length === 1 ? "is" : "are"} with Accounts. ${INVOICE_APPROVER} reviews them:`
              : "Nothing is with Accounts: every invoice you've sent has been decided.",
            bullets: pending.map(
              (i) => `${i.number}, ${money(invoiceTotals(i.lines).total)}${i.week ? `, week of ${weekLabel(i.week)}` : ""}.`,
            ),
            actions: [{ label: "Open invoice history", href: "/employee?tab=invoices&view=history" }],
          };
        },
      },
      {
        group: "Invoices",
        question: "How do I send an invoice?",
        keys: ["send", "create", "new invoice", "bill", "how do i invoice"],
        answer: () => ({
          text: "Open Invoices › New invoice and pick the pay week it bills. Its hours fill the lines at your rates and your Profile fills in the sender. Check it, then Send to Accounts. You get six seconds to undo, and you can retract it from History while it's still pending.",
          actions: [{ label: "New invoice", href: "/employee?tab=invoices" }],
        }),
      },
      {
        group: "Department",
        question: "Who's in my department?",
        keys: ["department", "team", "who", "colleague", "head", "manager"],
        answer: (ctx) => {
          const deptId = orgDepartmentOf(ctx.people, EMPLOYEE_ID);
          const dept = orgDepartment(deptId);
          const members = masterList(ctx.people).filter((r) => r.department === deptId);
          return {
            text: `${dept.name} has ${plural(members.length, "person", "people")}:`,
            bullets: members.map(
              (m) => `${m.name}${m.id === EMPLOYEE_ID ? " (you)" : ""}, ${m.role}${m.id === dept.headId ? ". Heads the department." : "."}`,
            ),
            actions: [{ label: "Open Department", href: "/employee?tab=department" }],
            source: "HR's org chart · live",
          };
        },
      },
      ...PORTAL_USING("Employee portal"),
    ],
    fallback:
      "In the Employee portal I can tell you this week's pay and your rates, which invoices are with Accounts, how to send one, and who's in your department.",
  },
  consultant: {
    subtitle: "Your pipeline, clients and progress",
    greeting: `Hi ${CURRENT_REP}, ask me how you're tracking against target, which of your deals have gone stale, or what your commission pipeline is.`,
    faqs: [
      {
        group: "My progress",
        question: "How am I tracking against target?",
        keys: ["target", "tracking", "on track", "how am i going", "how am i doing", "won this"],
        answer: (ctx) => {
          const won = wonSoFar(ctx.deals, CURRENT_REP);
          const month = wonVsTarget(won.month, MONTH_TARGET);
          const quarter = wonVsTarget(won.quarter, QUARTER_TARGET);
          const line = (label: string, p: TargetProgress) =>
            `${label}: ${p.won} of ${p.target}${p.hit ? ", target hit" : `, ${plural(p.target - p.won, "sale")} to go`}.`;
          return {
            text: month.hit && quarter.hit ? "You're on target for the month and the quarter:" : "Here's where you are against target:",
            bullets: [line("This month (August to date)", month), line("This quarter", quarter)],
            actions: [{ label: "Open My progress", href: "/consultant?tab=progress" }],
            source: "HubSpot · sample targets until Sean sets them",
          };
        },
      },
      {
        group: "My progress",
        question: "Which of my deals have gone stale?",
        keys: ["stale", "stuck", "sitting", "old deal", "14 days", "haven't moved"],
        answer: (ctx) => {
          const stale = staleDeals(ctx.deals, CURRENT_REP, Date.now());
          return {
            text: stale.length
              ? `${plural(stale.length, "deal")} ${stale.length === 1 ? "has" : "have"} sat in ${stale.length === 1 ? "its" : "their"} stage ${STALE_DAYS} days or more:`
              : `Nothing stale. Every one of your open deals moved in the last ${STALE_DAYS} days.`,
            bullets: stale.map(
              ({ deal, days }) =>
                `${deal.client} (${deal.suburb}, ${deal.value}): ${days} days in ${deal.stage}. Next step: ${deal.nextStep || "none set"}.`,
            ),
            actions: [{ label: "Open My pipeline", href: "/consultant?tab=pipeline" }],
            source: "HubSpot deals · live",
          };
        },
      },
      {
        group: "My progress",
        question: "What's my commission pipeline?",
        keys: ["commission", "earn", "earned", "money"],
        answer: (ctx) => {
          const open = ctx.deals.filter((d) => d.rep === CURRENT_REP && isOpenDeal(d)).length;
          const quarter = wonSoFar(ctx.deals, CURRENT_REP).quarter;
          return {
            text: `${aud(commissionPipeline(ctx.deals, CURRENT_REP))} across ${plural(open, "open deal")}, and ${aud(commissionEarned(quarter))} earned on ${plural(quarter, "sale")} this quarter.`,
            bullets: [`Both at a flat ${aud(COMMISSION_PER_SALE)} a sale until Alison Carter confirms the commission formula.`],
            actions: [{ label: "Open My progress", href: "/consultant?tab=progress" }],
            source: "Placeholder rate",
          };
        },
      },
      {
        group: "My progress",
        question: "What's my highest commission?",
        keys: ["highest commission", "highest", "personal best", "record", "best day", "best week", "best month", "best year"],
        answer: (ctx) => {
          const dates = saleDates(CURRENT_REP, wonThisSession(ctx.deals, CURRENT_REP));
          const now = { day: "Today", week: "This week", month: "This month", year: "This year" } as const;
          const bullets = RECORD_PERIODS.flatMap((p) => {
            const r = commissionRecord(dates, p);
            if (!r) return [];
            const chase =
              r.status === "new" ? "a new record" : r.status === "matched" ? "level with it" : `${aud(r.gap)} to match it`;
            return [
              `Best ${p}: ${aud(r.best.amount)}, ${periodLabel(r.best.key, p)} (${plural(r.best.sales, "sale")}). ${now[p]}: ${aud(r.current.amount)}, ${chase}.`,
            ];
          });
          return {
            text: bullets.length ? "Your highest commission, and where you are now:" : "No sales yet. Your first one sets your first record.",
            bullets,
            actions: [{ label: "Open Overview", href: "/consultant" }],
            source: `Sample history · flat ${aud(COMMISSION_PER_SALE)} a sale`,
          };
        },
      },
      {
        group: "My pipeline",
        question: "What's in my pipeline?",
        keys: ["pipeline", "deals", "stage", "appointment"],
        answer: (ctx) => {
          const mine = ctx.deals.filter((d) => d.rep === CURRENT_REP && !d.lost);
          return {
            text: `${plural(mine.filter(isOpenDeal).length, "open deal")} in your pipeline:`,
            bullets: PIPELINE_STAGES.map((stage) => {
              const deals = mine.filter((d) => d.stage === stage);
              return `${stage}: ${deals.length ? deals.map((d) => `${d.client} (${d.suburb}, ${d.value})`).join(", ") : "none"}.`;
            }),
            actions: [{ label: "Open My pipeline", href: "/consultant?tab=pipeline" }],
            source: "HubSpot deals · live",
          };
        },
      },
      {
        group: "My Deal Submissions",
        question: "Where is my deal submission?",
        keys: ["submission", "nguyen", "upload"],
        answer: (ctx) => submissionAnswer(ctx, "/consultant?tab=submissions"),
      },
      {
        group: "My Deal Submissions",
        question: "Which documents does Forma need?",
        keys: ["documents", "forma", "checklist", "what do i need"],
        answer: () => ({
          text: "Forma's required documents:",
          bullets: BUILDER_CHECKLISTS.Forma.filter((d) => d.req).map((d) => `${d.name} (${d.cat}).`),
          actions: [{ label: "Start a submission", href: "/consultant?tab=submissions" }],
        }),
      },
      ...PORTAL_USING("Sales Representative portal"),
    ],
    fallback:
      "In the Sales Representative portal I can tell you how you're tracking against target, which of your deals have gone stale, your commission pipeline, what's in your pipeline, and where your deal submission is up to.",
  },
};

/**
 * The three questions each dashboard's FAQ offers — the most specific to that
 * dashboard (Kane, 2026-09-30: "only 3 per dashboard"). The rest of each brief
 * still answers TYPED questions; only these three are offered as buttons and as
 * follow-ups. The tuple type holds the count at exactly three.
 */
export const FEATURED: Record<ModuleId, readonly [string, string, string]> = {
  home: ["What needs me today?", "Are any jobs out of sync?", "What's coming up this fortnight?"],
  operations: ["Which jobs have sync conflicts?", "What's waiting in the review queue?", "Where is the Nguyen submission up to?"],
  sales: ["What's in the pipeline?", "Which lots can I hold?", "Who's leading sales this quarter?"],
  marketing: ["What's our cost per deal?", "Which channel converts best?", "Can we trust the attribution?"],
  finance: ["What does the health check do?", "What's asked about income?", "Where do the answers go?"],
  accounts: ["Which invoices are waiting for approval?", "What does cash flow look like?", "Any expense claims to approve?"],
  accounting: ["Which invoices are waiting on me?", "What rate is this pay run using?", "Who can't be paid this run?"],
  wealth: ["What's the median price in Baldivis?", "Which suburb has the best yield?", "What packages were made recently?"],
  hr: ["Which leave requests need approval?", "Who's away or not in yet?", "Which roles are we hiring for?"],
  knowledge: ["Where's the deal submission checklist?", "How do I request leave?", "What's new this month?"],
  leadership: ["How are sales tracking this month?", "What does cash look like next month?", "Any sync risk I should know about?"],
  it: ["What tickets are open?", "How do I raise a ticket?", "How do I report a phishing email?"],
  tickets: ["Which dashboards have open tickets?", "How are the projects going?", "How do I raise a ticket?"],
  admin: ["Who's online right now?", "Who has admin access?", "Who doesn't have a dashboard yet?"],
  client: ["Where is my build up to?", "How does our budget split?", "Why was our builder recommended?"],
  developer: ["Which jobs are waiting on us?", "Why do clients pick another builder?", "What does Locale need with a sale?"],
  employee: ["What's my pay this week?", "What are my current rates?", "Who's in my department?"],
  consultant: ["How am I tracking against target?", "Which of my deals have gone stale?", "What's my commission pipeline?"],
};

/** A dashboard's three FAQ entries. Throws if a featured question has no answer behind it. */
export function featuredFor(id: ModuleId): Faq[] {
  return FEATURED[id].map((q) => {
    const f = JARVIS[id].faqs.find((x) => x.question === q);
    if (!f) throw new Error(`Jarvis FAQ: "${q}" is featured on ${id} but has no answer`);
    return f;
  });
}

/** Follow-ups after an answer: the dashboard's other featured questions not yet asked. */
export function relatedTo(id: ModuleId, question: string, asked: Set<string>): string[] {
  return FEATURED[id].filter((q) => q !== question && !asked.has(q));
}

/**
 * Route a question to an FAQ: the exact question first, otherwise the entry
 * whose matching keyword is the most specific (longest) — so "how much leave
 * do I have" reaches the balances, not the first entry that mentions leave.
 */
export function answerFor(brief: DashboardBrief, question: string, ctx: JarvisContext): { answer: JarvisAnswer; matched?: string } {
  const q = question.toLowerCase().trim();
  let hit = brief.faqs.find((f) => f.question.toLowerCase() === q);
  if (!hit) {
    let best = 0;
    for (const f of brief.faqs) {
      const len = Math.max(0, ...f.keys.filter((k) => q.includes(k)).map((k) => k.length));
      if (len > best) {
        best = len;
        hit = f;
      }
    }
  }
  return hit ? { answer: hit.answer(ctx), matched: hit.question } : { answer: { text: brief.fallback } };
}
