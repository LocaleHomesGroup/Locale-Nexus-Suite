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
 * matches the screen, and a store change (a conflict resolved, a portal update
 * accepted) changes the answer. "How do I…" answers restate what the screen
 * itself says and does. Nothing is invented.
 */
import type { ModuleId } from "@/state/launchpad-store";
import type { Job, SubmissionDoc } from "@/data/jobs";
import { BUILDER_CHECKLISTS } from "@/data/jobs";
import type { AppNotification, PortalUpdate } from "@/data/seed";
import { aud } from "@/lib/utils";
import { ANNOUNCEMENTS, CELEBRATIONS, COMING_UP } from "@/components/modules/home/data";
import { buildMyDay } from "@/components/modules/home/my-day";
import { PRICE_LISTS, MODELS_TRACKED } from "@/components/modules/operations/pricing/data";
import {
  SEED_DEALS,
  PIPELINE_STAGES,
  SALES_WON_QTD,
  SEED_LOTS,
  SEED_DISCOUNTS,
  HOLD_QUEUE_MAX,
} from "@/components/modules/sales/data";
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
import { PROJECTS, BOARD } from "@/components/modules/projects/data";
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
 * user acts on screen: the Launchpad store (jobs, portal inbox, submission,
 * Accounts' invoices and claims) plus HR's shared leave queue. An item inside
 * its undo window keeps its pending status until the window closes.
 */
export interface JarvisContext {
  jobs: Job[];
  notifications: AppNotification[];
  portalUpdates: PortalUpdate[];
  submissionDocs: SubmissionDoc[];
  submissionStatus: string;
  leave: LeaveRequest[];
  invoices: BuilderInvoice[];
  claims: ExpenseClaim[];
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
    greeting: "I'm watching CRM Dash Sync, the portal inbox and builder pricing.",
    faqs: [
      { group: "CRM Dash Sync", question: "Which jobs have sync conflicts?", keys: ["conflict", "out of sync", "disagree"], answer: conflictAnswer },
      {
        group: "CRM Dash Sync",
        question: "What's waiting in the portal inbox?",
        keys: ["portal", "inbox", "builder portal", "email parse"],
        answer: (ctx) =>
          ctx.portalUpdates.length === 0
            ? { text: "The portal inbox is clear — nothing is waiting for a human.", source: "Automated sources · live" }
            : {
                text: `${plural(ctx.portalUpdates.length, "update")} waiting — nothing syncs until a human approves:`,
                bullets: ctx.portalUpdates.map(
                  (u) => `${u.jobNo || "No job no"} · ${u.client} (${u.builder}) — ${u.milestone}, ${u.date}. From ${u.source}.`,
                ),
                actions: [{ label: "Review the inbox", href: "/operations" }],
                source: "Automated sources · live",
              },
      },
      {
        group: "CRM Dash Sync",
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
        group: "CRM Dash Sync",
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
        group: "CRM Dash Sync",
        question: "How do I bulk update builder dates?",
        keys: ["bulk", "csv", "import", "many"],
        answer: () => ({
          text: "Use Bulk update on CRM Dash Sync and drop in the builder's CSV. Rows are matched by job number; applying writes each update to Launchpad, then Monday and HubSpot, and every row appears in the sync trail. Skipped rows are reported for follow-up.",
          actions: [{ label: "Open CRM Dash Sync", href: "/operations" }],
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
      "On Operations I can answer about sync conflicts, the portal inbox, how milestones sync, bulk updates, the Nguyen submission, builder price lists and the Doc formatter.",
  },

  sales: {
    subtitle: "Pipeline, clients and land",
    greeting: "Ask me about your pipeline, land holds or the team's numbers.",
    faqs: [
      {
        group: "Pipeline",
        question: "What's in my pipeline?",
        keys: ["pipeline", "deals", "stage", "appointment"],
        answer: () => ({
          text: `${plural(SEED_DEALS.length, "deal")} across the pipeline:`,
          bullets: PIPELINE_STAGES.map((stage) => {
            const deals = SEED_DEALS.filter((d) => d.stage === stage);
            return `${stage}: ${deals.length ? deals.map((d) => `${d.client} (${d.suburb}, ${d.value})`).join(", ") : "none"}.`;
          }),
          actions: [{ label: "Open Pipeline", href: "/sales" }],
        }),
      },
      {
        group: "Pipeline",
        question: "What happens when a deal is won?",
        keys: ["won", "sale won", "move a deal", "next stage"],
        answer: () => ({
          text: "Open the deal card and move it to the next stage. When it reaches Sale won, the job is created in CRM Dash Sync automatically — Operations picks it up from there.",
          actions: [{ label: "Open Pipeline", href: "/sales" }],
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
        group: "My Deal Submissions",
        question: "Where is my deal submission?",
        keys: ["submission", "nguyen", "upload"],
        answer: (ctx) => submissionAnswer(ctx, "/sales?tab=submissions"),
      },
      {
        group: "My Deal Submissions",
        question: "Which documents does Forma need?",
        keys: ["documents", "forma", "checklist", "what do i need"],
        answer: () => ({
          text: "Forma's required documents:",
          bullets: BUILDER_CHECKLISTS.Forma.filter((d) => d.req).map((d) => `${d.name} (${d.cat}).`),
          actions: [{ label: "Start a submission", href: "/sales?tab=submissions" }],
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
      ...USING("Sales"),
    ],
    fallback:
      "On Sales I can answer about your pipeline, what happens when a deal is won, discounts, your deal submission and its documents, land holds and the quarter's leaders.",
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
            actions: [{ label: "Open Performance", href: "/marketing" }],
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
          actions: [{ label: "Open the health check", href: "/finance" }],
        }),
      },
      {
        group: "Health check",
        question: "What's asked about income?",
        keys: ["income", "employment", "salary", "step 2"],
        answer: () => ({
          text: "Step 2 of 5 covers income and employment: the employment type and annual income. Income is required before the client can continue.",
          actions: [{ label: "Open step 2", href: "/finance" }],
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
              actions: [{ label: "Open Builder invoicing", href: "/accounts" }],
            };
          }
          const total = drafts.reduce((s, i) => s + i.amount, 0);
          return {
            text: `${plural(drafts.length, "draft invoice")} worth ${aud(total)} + GST ${drafts.length === 1 ? "is" : "are"} waiting:`,
            bullets: drafts.map((i) => `${i.id} · ${i.job} ${i.client}: ${i.builder}, ${i.stage}, ${aud(i.amount)} + GST.`),
            actions: [{ label: "Open Builder invoicing", href: "/accounts" }],
            source: "Xero drafts",
          };
        },
      },
      {
        group: "Builder invoicing",
        question: "How are builder invoices raised?",
        keys: ["raised", "how", "schedule", "automatic"],
        answer: () => ({
          text: "Stage completions in CRM Dash raise a draft invoice against each builder's schedule. Nothing reaches a builder until it's approved here — Approve sends it from Xero.",
          actions: [{ label: "Open Builder invoicing", href: "/accounts" }],
        }),
      },
      {
        group: "Builder invoicing",
        question: "How much have we invoiced this month?",
        keys: ["invoiced", "this month", "revenue", "forecast"],
        answer: (ctx) => ({
          text: `${aud(invoicedThisMonth(ctx.invoices))} invoiced so far this month (excl GST), with ${aud(FORECAST_NEXT_MONTH)} forecast for next month.`,
          actions: [{ label: "Open Builder invoicing", href: "/accounts" }],
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
          return { text: `${s.label}:`, bullets: s.stats.map((st) => `${st.label}: ${st.value}.`), actions: [{ label: "Open the generator", href: "/wealth" }] };
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
          actions: [{ label: "Generate one", href: "/wealth" }],
        }),
      },
      {
        group: "Packages",
        question: "How do I make a package?",
        keys: ["make", "create", "generate a", "how"],
        answer: () => ({
          text: "Pick the suburb — its property data loads automatically — then press Generate package. It's added to Recent packages; no more hand-typed brochures.",
          actions: [{ label: "Open the generator", href: "/wealth" }],
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
          actions: [{ label: "Open Employees", href: "/hr?tab=people" }],
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
              return `${r.name}: ${r.type.toLowerCase()}, ${r.when} (${r.length}). Balance after: ${formatDays(balanceAfter(r))}; ${cover}.`;
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

  projects: {
    subtitle: "Internal builds and delivery",
    greeting: "I can tell you where each internal build is at.",
    faqs: [
      {
        group: "Project board",
        question: "What's in build right now?",
        keys: ["build", "project", "status", "progress"],
        answer: () => ({ text: `${plural(PROJECTS.length, "project")} on the board:`, bullets: PROJECTS.map((p) => `${p.name} — ${p.state}, ${p.progress}% (${p.owner}).`) }),
      },
      {
        group: "Project board",
        question: "What's closest to done?",
        keys: ["closest", "done", "finish", "ship", "deploy"],
        answer: () => {
          const top = [...PROJECTS].sort((a, b) => b.progress - a.progress)[0];
          return { text: `${top.name} is furthest along at ${top.progress}% — ${top.state.toLowerCase()}, owned by ${top.owner}.` };
        },
      },
      {
        group: "Project board",
        question: "What's on the to-do list?",
        keys: ["to do", "todo", "next", "board", "in progress"],
        answer: () => ({ text: "The project board:", bullets: BOARD.map((c) => `${c.column}: ${c.items.join("; ")}.`) }),
      },
      ...USING("Projects"),
    ],
    fallback: "On Projects I can answer about what's in build, what's closest to done and what's on the board.",
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
          actions: [{ label: "Open it", href: "/knowledge?q=Deal%20submission%20checklist" }],
        }),
      },
      {
        group: "Finding documents",
        question: "How do milestones sync to HubSpot?",
        keys: ["milestone", "sync", "hubspot", "monday"],
        answer: () => ({
          text: "See “How milestones sync to HubSpot and Monday” in Systems reference — new this month.",
          actions: [{ label: "Open it", href: "/knowledge?q=How%20milestones%20sync" }],
        }),
      },
      {
        group: "Finding documents",
        question: "How do I request leave?",
        keys: ["leave", "holiday", "time off"],
        answer: () => ({
          text: "The SOP is “Leave request and approval”, in SOPs and processes.",
          actions: [
            { label: "Read the SOP", href: "/knowledge?q=Leave%20request" },
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
            actions: [{ label: "Open the dashboard", href: "/leadership" }],
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
            actions: [{ label: "Open the help desk", href: "/it" }],
          };
        },
      },
      {
        group: "Help desk",
        question: "How do I raise a ticket?",
        keys: ["raise", "new ticket", "log", "report a problem"],
        answer: () => ({
          text: "Use “New ticket” on the IT help desk: pick a category and priority, describe what's happening, and submit. It appears in Open and recent tickets straight away.",
          actions: [{ label: "Raise a ticket", href: "/it" }],
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
};

/**
 * The three questions each dashboard's FAQ offers — the most specific to that
 * dashboard (Kane, 2026-09-30: "only 3 per dashboard"). The rest of each brief
 * still answers TYPED questions; only these three are offered as buttons and as
 * follow-ups. The tuple type holds the count at exactly three.
 */
export const FEATURED: Record<ModuleId, readonly [string, string, string]> = {
  home: ["What needs me today?", "Are any jobs out of sync?", "What's coming up this fortnight?"],
  operations: ["Which jobs have sync conflicts?", "What's waiting in the portal inbox?", "Where is the Nguyen submission up to?"],
  sales: ["What's in my pipeline?", "Which lots can I hold?", "Where is my deal submission?"],
  marketing: ["What's our cost per deal?", "Which channel converts best?", "Can we trust the attribution?"],
  finance: ["What does the health check do?", "What's asked about income?", "Where do the answers go?"],
  accounts: ["Which invoices are waiting for approval?", "What does cash flow look like?", "Any expense claims to approve?"],
  wealth: ["What's the median price in Baldivis?", "Which suburb has the best yield?", "What packages were made recently?"],
  hr: ["Which leave requests need approval?", "Who's away or not in yet?", "Which roles are we hiring for?"],
  projects: ["What's in build right now?", "What's closest to done?", "What's on the to-do list?"],
  knowledge: ["Where's the deal submission checklist?", "How do I request leave?", "What's new this month?"],
  leadership: ["How are sales tracking this month?", "What does cash look like next month?", "Any sync risk I should know about?"],
  it: ["What tickets are open?", "How do I raise a ticket?", "How do I report a phishing email?"],
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
