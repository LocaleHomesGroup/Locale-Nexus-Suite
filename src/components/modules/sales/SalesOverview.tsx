"use client";

import { BadgePercent, CalendarDays, HardHat, ListChecks, ListTodo, MapPinned, Trophy, Wallet } from "lucide-react";
import { DashboardOverview } from "../overview/DashboardOverview";
import { BUILD_HOMES, SALES_WON_MTD, isOpenDeal, millionsFromK, openPipelineK } from "./data";
import { LAST_WEEK_FORECAST, SIGNED_THIS_WEEK } from "./week/data";
import { useSalesState } from "./sales-state";

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

/**
 * Sales › Overview. Deals, to-dos, tasks, lots and discounts come from the
 * Sales state, so moving a deal or approving a discount shows here at once.
 */
export function SalesOverview() {
  const { deals, todos, tasks, lots, discounts } = useSalesState();

  const open = deals.filter(isOpenDeal).length;
  const flagged = tasks.filter((t) => t.flag);
  const overdue = flagged.filter((t) => /overdue/i.test(t.due)).length;
  const signed = sum(SIGNED_THIS_WEEK);
  // Last week's forecast is what this week's form opens with (My week).
  const forecast = sum(LAST_WEEK_FORECAST);
  const nearing = BUILD_HOMES.filter((h) => h.pct >= 90);
  const openTodos = todos.filter((t) => !t.done).length;
  const count = (s: string) => lots.filter((l) => l.status === s).length;
  const requested = discounts.reduce((n, d) => n + d.discount, 0);

  return (
    <DashboardOverview
      title="Sales overview"
      description="Your pipeline, this week’s signings and the follow-ups that are due."
      headline={[
        { label: "Pipeline value", value: millionsFromK(openPipelineK(deals)), sub: `${open} open deals`, icon: Wallet, to: "sales:pipeline" },
        { label: "Sales won", value: SALES_WON_MTD, sub: "August to date", icon: Trophy, to: "sales:team" },
        { label: "Signed this week", value: `${signed} of ${forecast}`, sub: "against forecast", icon: CalendarDays, to: "sales:week" },
        {
          label: "Overdue tasks",
          value: flagged.length,
          sub: flagged.length ? `${overdue} overdue · ${flagged.length - overdue} due today` : "nothing overdue",
          icon: ListTodo,
          tone: flagged.length ? "pending" : "ok",
          to: "sales:team",
        },
      ]}
      moreLabel="More from each section"
      more={[
        {
          label: "Under construction",
          value: BUILD_HOMES.length,
          sub: nearing.length ? `key handover ${nearing[0].eta}` : "none near handover",
          icon: HardHat,
          to: "sales:build",
        },
        { label: "Open to-dos", value: openTodos, sub: "on My clients", icon: ListChecks, to: "sales:clients" },
        { label: "Lots available", value: count("available"), sub: `${count("hold")} on hold · ${count("sold")} sold`, icon: MapPinned, to: "sales:land" },
        {
          label: "Discounts to approve",
          value: discounts.length,
          sub: discounts.length ? `$${(requested / 1e3).toFixed(1)}k requested` : "none waiting",
          icon: BadgePercent,
          tone: discounts.length ? "pending" : "ok",
          to: "sales:team",
        },
      ]}
    />
  );
}
