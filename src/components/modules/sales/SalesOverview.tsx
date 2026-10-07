"use client";

import { BadgePercent, CalendarDays, HardHat, ListTodo, MapPinned, Trophy, Users, Wallet } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { DashboardOverview } from "../overview/DashboardOverview";
import { BUILD_HOMES, FORECAST, SALES_WON_MTD, isOpenDeal, millionsFromK, openPipelineK } from "./data";
import { useSalesState } from "./sales-state";

/** The team scorecard's last week, over every rep and builder: [signed, forecast]. */
const LAST_WEEK_TEAM = FORECAST["Last week"]
  .flatMap(([, cells]) => cells)
  .reduce<[number, number]>(([s, f], [cs, cf]) => [s + cs, f + cf], [0, 0]);

/**
 * Sales › Overview: the team's figures. Deals, tasks, lots and discounts come
 * from the shared Sales store and clients from the Launchpad's jobs, so moving
 * a deal or approving a discount shows here at once. A consultant's own
 * figures are on the Sales Representative portal's Overview.
 */
export function SalesOverview() {
  const { jobs } = useLaunchpad();
  const { deals, tasks, lots, discounts } = useSalesState();

  const open = deals.filter(isOpenDeal).length;
  const flagged = tasks.filter((t) => t.flag);
  const overdue = flagged.filter((t) => /overdue/i.test(t.due)).length;
  const [signed, forecast] = LAST_WEEK_TEAM;
  const nearing = BUILD_HOMES.filter((h) => h.pct >= 90);
  const building = jobs.filter((j) => j.board === "construction").length;
  const count = (s: string) => lots.filter((l) => l.status === s).length;
  const requested = discounts.reduce((n, d) => n + d.discount, 0);

  return (
    <DashboardOverview
      title="Sales overview"
      description="The team's pipeline, sales and follow-ups."
      headline={[
        { label: "Pipeline value", value: millionsFromK(openPipelineK(deals)), sub: `${open} open deals`, icon: Wallet, to: "sales:pipeline" },
        { label: "Sales won", value: SALES_WON_MTD, sub: "August to date", icon: Trophy, to: "sales:team" },
        { label: "Signed last week", value: `${signed} of ${forecast}`, sub: "team scorecard", icon: CalendarDays, to: "sales:team" },
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
        { label: "All clients", value: jobs.length, sub: `${building} in construction`, icon: Users, to: "sales:clients" },
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
