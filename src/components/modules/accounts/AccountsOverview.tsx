"use client";

import { BadgeDollarSign, ChartColumn, ChartPie, Coins, Receipt, Timer, TrendingUp, Wallet } from "lucide-react";
import { aud } from "@/lib/utils";
import { useLaunchpad } from "@/state/launchpad-store";
import { DashboardOverview } from "../overview/DashboardOverview";
import {
  AVG_APPROVAL_TIME,
  CASHFLOW,
  COMMISSION_BY_STAGE,
  COMMISSION_YTD,
  EXPENSES_THIS_MONTH,
  FORECAST_NEXT_MONTH,
  cents,
  invoicedThisMonth,
} from "./data";

/**
 * Accounts › Overview. Invoices and claims are read from the store, so an
 * approval in Builder invoicing or Expenses moves these cards too (an item in
 * its undo window still counts as waiting: nothing has been sent).
 */
export function AccountsOverview() {
  const { invoices, claims } = useLaunchpad();

  const drafts = invoices.filter((i) => i.status === "Draft");
  const waiting = claims.filter((c) => c.status === "Awaiting approval");
  const cashflowK = CASHFLOW.reduce((n, m) => n + m.projectedK, 0);
  const [top] = COMMISSION_BY_STAGE;
  const span = `${CASHFLOW[0].month.split(" ")[0]} to ${CASHFLOW[CASHFLOW.length - 1].month.split(" ")[0]}`;

  return (
    <DashboardOverview
      title="Accounts overview"
      description="Builder invoices, commission and expense claims waiting on you."
      headline={[
        {
          label: "Drafts to approve",
          value: drafts.length,
          sub: drafts.length ? `${aud(drafts.reduce((n, i) => n + i.amount, 0))} excl GST` : "all invoices approved",
          icon: Receipt,
          tone: drafts.length ? "pending" : "ok",
          to: "accounts:invoicing",
        },
        { label: "Invoiced this month", value: aud(invoicedThisMonth(invoices)), sub: "excl GST", icon: BadgeDollarSign, tone: "charcoal", to: "accounts:invoicing" },
        { label: "Forecast next month", value: aud(FORECAST_NEXT_MONTH), sub: "excl GST", icon: TrendingUp, to: "accounts:invoicing" },
        {
          label: "Claims to approve",
          value: waiting.length,
          sub: waiting.length ? `${cents(waiting.reduce((n, c) => n + c.amount, 0))} to review` : "all claims reviewed",
          icon: Wallet,
          tone: waiting.length ? "pending" : "ok",
          to: "accounts:expenses",
        },
      ]}
      moreLabel="More from each section"
      more={[
        { label: "Commission YTD", value: COMMISSION_YTD, sub: `${Math.round(top.pct)}% at ${top.stage}`, icon: ChartPie, to: "accounts:reports" },
        { label: "Cashflow, 3 months", value: `$${(cashflowK / 1000).toFixed(2)}m`, sub: `${span}, projected`, icon: ChartColumn, to: "accounts:reports" },
        { label: "Expenses this month", value: EXPENSES_THIS_MONTH, sub: "claimed in August", icon: Coins, tone: "charcoal", to: "accounts:expenses" },
        { label: "Avg approval time", value: AVG_APPROVAL_TIME, sub: "submitted to approved", icon: Timer, to: "accounts:expenses" },
      ]}
    />
  );
}
