"use client";

import { Coins, Funnel, Receipt, Tag, Target, TrendingUp, Trophy, Wallet } from "lucide-react";
import { DashboardOverview } from "../overview/DashboardOverview";
import {
  CHANNELS,
  COMMISSION_PER_DEAL,
  TAG_COVERAGE,
  TAG_COVERAGE_FLOOR,
  TOTAL_LEADS,
  TOTAL_QUALIFIED,
  TOTAL_SPEND,
  TOTAL_WON,
  dollars,
  k1,
} from "./data";

/** Marketing › Overview — month to date, every figure from `./data`. */
export function MarketingOverview() {
  const returnOnSpend = (TOTAL_WON * COMMISSION_PER_DEAL) / TOTAL_SPEND;
  const belowFloor = TAG_COVERAGE.filter((t) => t.pct < TAG_COVERAGE_FLOOR);
  // The channel that wins a deal for the least spend.
  const best = [...CHANNELS].sort((a, b) => a.spend / a.won - b.spend / b.won)[0];

  return (
    <DashboardOverview
      title="Marketing overview"
      description="Month-to-date ad spend against the deals it brought in."
      headline={[
        { label: "Spend this month", value: k1(TOTAL_SPEND), sub: `across ${CHANNELS.length} channels`, icon: Wallet, to: "marketing:performance" },
        { label: "Deals won", value: TOTAL_WON, sub: `from ${TOTAL_LEADS} leads`, icon: Trophy, to: "marketing:performance" },
        {
          label: "Return on spend",
          value: `${returnOnSpend.toFixed(1)}x`,
          sub: `at $${(COMMISSION_PER_DEAL / 1e3).toFixed(1)}k a deal`,
          icon: TrendingUp,
          to: "marketing:performance",
        },
        {
          label: `Tags below ${TAG_COVERAGE_FLOOR}%`,
          value: belowFloor.length,
          sub: belowFloor.length ? belowFloor.map((t) => t.source).join(" · ") : "every source resolves",
          icon: Tag,
          tone: belowFloor.length ? "pending" : "ok",
          to: "marketing:attribution",
        },
      ]}
      moreLabel="More from each section"
      more={[
        { label: "Cost per lead", value: dollars(TOTAL_SPEND / TOTAL_LEADS), sub: "blended, all channels", icon: Coins, to: "marketing:channels" },
        {
          label: "Lead to qualified",
          value: `${Math.round((TOTAL_QUALIFIED / TOTAL_LEADS) * 100)}%`,
          sub: `${TOTAL_QUALIFIED} of ${TOTAL_LEADS} leads`,
          icon: Funnel,
          to: "marketing:channels",
        },
        { label: "Cost per deal", value: dollars(TOTAL_SPEND / TOTAL_WON), sub: "spend ÷ deals won", icon: Receipt, to: "marketing:performance" },
        {
          label: "Best channel",
          value: best.name,
          sub: `${dollars(best.spend / best.won)} a deal · ${best.won} won`,
          icon: Target,
          to: "marketing:channels",
        },
      ]}
    />
  );
}
