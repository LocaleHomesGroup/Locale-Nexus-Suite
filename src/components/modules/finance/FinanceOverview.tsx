"use client";

import { CalendarCheck, CircleCheck, Database, HeartPulse, LogOut, Timer } from "lucide-react";
import { DashboardOverview } from "../overview/DashboardOverview";
import { HEALTH_CHECK_SAMPLE as S } from "./data";

/**
 * Finance › Overview. Every figure is a sample (see `./data`): the health check
 * has no reporting behind it yet, and the page says so.
 */
export function FinanceOverview() {
  return (
    <DashboardOverview
      title="Finance overview"
      description="How clients move through the Finance health check. These are sample figures until the form reports its own."
      headline={[
        { label: "Checks started", value: S.started, sub: "in August", icon: HeartPulse, to: "finance:health", sample: true },
        {
          label: "Checks completed",
          value: S.completed,
          sub: `${Math.round((S.completed / S.started) * 100)}% of those started`,
          icon: CircleCheck,
          to: "finance:health",
          sample: true,
        },
        {
          label: "Biggest drop-off",
          value: `Step ${S.dropOffStep}`,
          sub: `${S.dropOffName} · ${S.droppedThere} stopped here`,
          icon: LogOut,
          tone: "pending",
          to: "finance:health",
          sample: true,
        },
        {
          label: "Saved to Mercury",
          value: S.savedToMercury,
          sub: `${S.failedWrites} failed writes`,
          icon: Database,
          to: "finance:health",
          sample: true,
        },
      ]}
      moreLabel="More from the health check"
      more={[
        { label: "Time to complete", value: `${S.medianMinutes} min`, sub: "median, steps 1 to 5", icon: Timer, to: "finance:health", sample: true },
        { label: "Broker follow-ups", value: S.brokerFollowUps, sub: "booked from checks", icon: CalendarCheck, to: "finance:health", sample: true },
      ]}
    />
  );
}
