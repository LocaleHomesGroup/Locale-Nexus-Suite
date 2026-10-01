/**
 * My day — the things waiting on Shannan today, built from the same live data
 * the destination screens draw. Home's lead card and Jarvis's "What needs me
 * today?" both call `buildMyDay`, so the two can never disagree, and an item
 * drops off the moment its source is dealt with (a conflict resolved, leave
 * approved, the submission approved).
 *
 * Only a sync conflict is `urgent`: it is a real problem with a decision due
 * today. Everything else is a to-do, not an alarm.
 */
import { AlertTriangle, CalendarDays, ClipboardCheck, FileText, Receipt, type LucideIcon } from "lucide-react";
import type { Job, SubmissionDoc } from "@/data/jobs";
import type { ModuleId } from "@/state/launchpad-store";
import { aud } from "@/lib/utils";
import type { BuilderInvoice, ExpenseClaim } from "@/components/modules/accounts/data";
import type { LeaveRequest } from "@/components/modules/hr/data";

export interface MyDayItem {
  id: string;
  module: ModuleId;
  /** Where the row lands, as the rail names it. */
  where: string;
  title: string;
  detail: string;
  /** A money figure, shown in the foreground beside the detail. */
  figure?: string;
  /** Short verb for a Jarvis action button: "Approve leave". */
  action: string;
  href: string;
  icon: LucideIcon;
  /** A real problem that needs a decision today. The only kind of item that may alarm. */
  urgent?: boolean;
}

export interface MyDaySources {
  jobs: Job[];
  leave: LeaveRequest[];
  submissionDocs: SubmissionDoc[];
  submissionStatus: string;
  /** From the Launchpad store, decided in Accounts. In-window items keep their pending status. */
  invoices: BuilderInvoice[];
  claims: ExpenseClaim[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const cents = (n: number) => aud(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildMyDay(src: MyDaySources): MyDayItem[] {
  const items: MyDayItem[] = [];

  for (const j of src.jobs.filter((x) => x.sync === "conflict")) {
    items.push({
      id: `conflict-${j.id}`,
      module: "operations",
      where: "Operations",
      title: `Resolve the sync conflict on job ${j.jobNo}`,
      detail: j.conflict
        ? `${j.client} · ${j.conflict.field}: HubSpot and Monday disagree`
        : `${j.client} · ${j.builder}`,
      action: `Resolve ${j.jobNo}`,
      href: `/operations/jobs/${j.id}`,
      icon: AlertTriangle,
      urgent: true,
    });
  }

  const leave = src.leave.filter((r) => r.status === "Pending");
  if (leave.length) {
    items.push({
      id: "leave",
      module: "hr",
      where: "HR › Leave",
      title: leave.length === 1 ? `Approve leave for ${leave[0].name}` : `Approve ${leave.length} leave requests`,
      detail: leave.map((r) => `${r.name}, ${r.type.toLowerCase()} ${r.when}`).join(" · "),
      action: "Approve leave",
      href: "/hr?tab=leave",
      icon: CalendarDays,
    });
  }

  const claims = src.claims.filter((c) => c.status === "Awaiting approval");
  if (claims.length) {
    items.push({
      id: "claims",
      module: "accounts",
      where: "Accounts › Expenses",
      title: `Approve ${plural(claims.length, "expense claim")}`,
      detail: claims.map((c) => c.staff).join(", "),
      figure: cents(claims.reduce((s, c) => s + c.amount, 0)),
      action: "Expense claims",
      href: "/accounts?tab=expenses",
      icon: Receipt,
    });
  }

  if (src.submissionStatus !== "approved") {
    const missing = src.submissionDocs.filter((d) => d.req && !d.file).length;
    const fixes = src.submissionDocs.filter((d) => d.state === "fix").length;
    items.push({
      id: "submission",
      module: "operations",
      where: "Operations › Submission review",
      title: "Ops review: the Nguyen submission",
      detail: missing
        ? `${plural(missing, "required document")} still outstanding`
        : fixes
          ? `${plural(fixes, "document")} back with the rep for fixes`
          : "Every required document is in, ready to verify",
      action: "Open the submission",
      href: "/operations?tab=submissions",
      icon: ClipboardCheck,
    });
  }

  const drafts = src.invoices.filter((i) => i.status === "Draft");
  if (drafts.length) {
    items.push({
      id: "invoices",
      module: "accounts",
      where: "Accounts › Builder invoicing",
      title: `Approve ${plural(drafts.length, "draft invoice")}`,
      detail: `Builder billing: ${[...new Set(drafts.map((i) => i.builder))].join(", ")}`,
      figure: `${aud(drafts.reduce((s, i) => s + i.amount, 0))} + GST`,
      action: "Draft invoices",
      href: "/accounts?tab=invoicing",
      icon: FileText,
    });
  }

  return items;
}
