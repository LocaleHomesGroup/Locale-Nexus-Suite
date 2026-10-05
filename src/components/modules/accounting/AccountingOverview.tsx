"use client";

import { ArrowRightLeft, Banknote, FileText, Send, TrendingUp, UserX, Users, Wallet } from "lucide-react";
import { dayMonth, invoiceTotals, money, paymentComplete } from "@/components/modules/employee/data";
import { DashboardOverview } from "../overview/DashboardOverview";
import { phpWhole, rateText } from "./fx";
import { PAYEE_IDS, PAY_RUN, personOf } from "./data";
import { useRun } from "./payrun-store";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Accounting › Overview. Read from the pay run's store, so approving an
 * invoice, setting the rate or dispatching moves these cards, and an invoice
 * sent from the Employee portal shows up as one to review.
 */
export function AccountingOverview() {
  const { view, run } = useRun();
  const last = view.runs[0];
  const recent = view.runs.slice(0, 5);
  const pendingAud = run.pending.reduce((n, i) => n + invoiceTotals(i.lines).total, 0);
  const approvedAud = run.approved.reduce((n, i) => n + invoiceTotals(i.lines).total, 0);
  const paidTotal = view.runs.reduce((n, r) => n + r.php, 0);
  const first = view.runs[view.runs.length - 1];
  const noMethod = PAYEE_IDS.filter((id) => !paymentComplete(view.methods[id] ?? null));
  const avg = recent.reduce((n, r) => n + r.rate, 0) / Math.max(1, recent.length);

  return (
    <DashboardOverview
      title="Accounting overview"
      description="Staff invoices waiting on you, this pay run's rate, and what's been paid."
      headline={[
        {
          label: "Invoices to review",
          value: run.pending.length,
          sub: run.pending.length ? `${money(pendingAud)} waiting` : "every invoice decided",
          icon: FileText,
          tone: run.pending.length ? "pending" : "ok",
          to: "accounting:payrun",
        },
        {
          label: "Ready to pay",
          value: money(approvedAud),
          sub: run.approved.length ? `${plural(run.approved.length, "approved invoice")}` : "nothing approved yet",
          icon: Wallet,
          tone: "charcoal",
          to: "accounting:payrun",
        },
        {
          label: "This run's rate",
          value: view.rate != null ? rateText(view.rate) : "Not set",
          sub: view.rate != null ? "pesos per A$1" : last ? `last run ${rateText(last.rate)}` : "set it to start",
          icon: ArrowRightLeft,
          tone: view.rate != null ? "tone" : "pending",
          to: "accounting:payrun",
        },
        last
          ? {
              label: "Last pay run",
              value: phpWhole(last.php),
              sub: `${dayMonth(last.on)} · ${plural(last.payees, "person", "people")}`,
              icon: Send,
              tone: "ok",
              to: "accounting:history",
            }
          : { label: "Last pay run", value: "—", sub: "none yet", icon: Send, to: "accounting:history" },
      ]}
      moreLabel="More from each section"
      more={[
        {
          label: first ? `Paid since ${dayMonth(first.on)}` : "Paid so far",
          value: phpWhole(paidTotal),
          sub: plural(view.runs.length, PAY_RUN.toLowerCase()),
          icon: Banknote,
          to: "accounting:history",
        },
        { label: "Average rate", value: rateText(avg), sub: `last ${plural(recent.length, "run")}`, icon: TrendingUp, to: "accounting:history" },
        { label: "Paid by invoice", value: PAYEE_IDS.length, sub: "Locale's offshore team", icon: Users, tone: "charcoal", to: "accounting:payrun" },
        {
          label: "No payment method",
          value: noMethod.length,
          sub: noMethod.length ? noMethod.map((id) => personOf(id).name.split(" ")[0]).join(", ") : "everyone can be paid",
          icon: UserX,
          tone: noMethod.length ? "problem" : "ok",
          to: "accounting:payrun",
        },
      ]}
    />
  );
}
