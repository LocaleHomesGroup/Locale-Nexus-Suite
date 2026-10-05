"use client";

import { AlertTriangle, Building2, DollarSign, LifeBuoy, Megaphone, ShieldCheck, TrendingUp, Users, Wallet } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { DashboardOverview } from "../overview/DashboardOverview";
import { needsSync } from "../operations/jobs/filters";
import { jobRef } from "../operations/review/review";
import { invoicedThisMonth } from "../accounts/data";
import { COMMISSION_PER_DEAL, TOTAL_SPEND, TOTAL_WON, k1 } from "../marketing/data";
import { SALES_WON_MTD, SEED_DEALS, millionsFromK, openPipelineK } from "../sales/data";
import { HR_KPIS } from "../hr/data";
import { TICKET_SEED } from "../it/data";
import { SEED_PACKAGES } from "../wealth/data";

/**
 * Leadership › Overview — the company pulse: one figure from each dashboard,
 * each card opening that dashboard's Overview and wearing its sub-brand
 * (Sales in Haven, Accounts in Nectar, Wealth in Sky Blue). Jobs and invoices
 * are live from the store; the rest are each dashboard's own data. Business
 * dashboard and Custom dashboard sit under it in the rail, unchanged.
 */
export function LeadershipOverview() {
  const { jobs, invoices } = useLaunchpad();
  const conflicts = jobs.filter(needsSync);
  const openTickets = TICKET_SEED.filter((t) => t.status !== "Resolved");
  const urgent = openTickets.filter((t) => t.priority === "High").length;
  const openDeals = SEED_DEALS.filter((d) => d.stage !== "Sale won").length;
  const packages = SEED_PACKAGES.filter((p) => p.thisMonth).length;

  return (
    <DashboardOverview
      title="Leadership overview"
      description="One figure from each part of the business. Each card opens its dashboard."
      headline={[
        { label: "Sales this month", value: SALES_WON_MTD, sub: "Sales · August to date", icon: TrendingUp, tone: "haven", to: "sales:overview" },
        {
          label: "Invoiced this month",
          value: `$${Math.round(invoicedThisMonth(invoices) / 1000)}k`,
          sub: "Accounts · excl GST",
          icon: DollarSign,
          tone: "nectar",
          to: "accounts:overview",
        },
        {
          label: "Return on spend",
          value: `${((TOTAL_WON * COMMISSION_PER_DEAL) / TOTAL_SPEND).toFixed(1)}x`,
          sub: `Marketing · ${k1(TOTAL_SPEND)} spent`,
          icon: Megaphone,
          tone: "charcoal",
          to: "marketing:overview",
        },
        {
          label: "Sync needs attention",
          value: conflicts.length,
          sub: conflicts.length ? `Operations · job ${jobRef(conflicts[0])}` : "Operations · all in step",
          icon: conflicts.length ? AlertTriangle : ShieldCheck,
          tone: "ok",
          alert: conflicts.length > 0,
          to: "operations:overview",
        },
      ]}
      moreLabel="Across the business"
      more={[
        {
          label: "Pipeline value",
          value: millionsFromK(openPipelineK(SEED_DEALS)),
          sub: `Sales · ${openDeals} open deals`,
          icon: Wallet,
          tone: "haven",
          to: "sales:overview",
        },
        {
          label: "Headcount",
          value: HR_KPIS.totalEmployees,
          sub: `HR · ${HR_KPIS.openPositions} roles open`,
          icon: Users,
          tone: "charcoal",
          to: "hr:overview",
        },
        {
          label: "Open IT tickets",
          value: openTickets.length,
          sub: `IT · ${urgent} high priority`,
          icon: LifeBuoy,
          tone: "charcoal",
          to: "it:overview",
        },
        {
          label: "Wealth packages",
          value: packages,
          sub: "Wealth · this month",
          icon: Building2,
          tone: "skyblue",
          to: "wealth:overview",
        },
      ]}
    />
  );
}
