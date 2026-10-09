"use client";

import * as React from "react";
import { LayoutGrid, type LucideIcon } from "lucide-react";
import { hrefForKey } from "@/components/shell/dashboards";
import { PageHeader, SectionLabel } from "@/components/ui/page";
import { KpiCard, KpiGrid, type KpiTone } from "@/components/ui/kpi-card";
import { Reveal } from "@/components/ui/reveal";

/**
 * A dashboard's Overview — the page every dashboard after Home opens on, and
 * the first item in its rail. Four headline KPI cards, then a row of smaller
 * ones from the rest of its sections; any panels the dashboard keeps under its
 * figures (HR's divisions and org chart) go in `children`.
 *
 * Every card is a link to the rail item its figure comes from, named by key
 * (`to: "sales:pipeline"`), so a card can't point at a section the rail
 * doesn't have. Another dashboard's key opens that dashboard (Leadership).
 *
 * Figures are computed from the same data or store the section reads, so a
 * card and the page it opens agree. A figure nothing records yet is `sample`,
 * and its supporting line says so.
 *
 * A dashboard whose Overview is about something in particular (Sales: who's
 * closing) puts those panels in `panels`, between the headline and the
 * smaller cards, and a filter over them in `actions`.
 */
export interface OverviewKpi {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  icon: LucideIcon;
  tone?: KpiTone;
  /** Rose, for something that needs a decision. It pulses as it arrives, then rests. */
  alert?: boolean;
  /** The rail item the card opens, by key: "sales:pipeline", "hr:overview". */
  to: string;
  /** Extra query for the destination, e.g. CRM dash sync's tile filter. */
  query?: Record<string, string>;
  /** Nothing records this figure yet: the value is a placeholder. */
  sample?: boolean;
  /** A small visual at the card's right edge: a progress ring beside a target. */
  aside?: React.ReactNode;
}

const MORE_COLS = { 2: 2, 3: 3, 4: 4, 5: 5 } as const;

export function DashboardOverview({
  title,
  description,
  actions,
  headline,
  panels,
  more,
  moreLabel,
  children,
}: {
  title: string;
  description: React.ReactNode;
  /** Beside the heading: a filter over the headline and `panels` (Sales' period). */
  actions?: React.ReactNode;
  /** The four figures the dashboard is about. */
  headline: OverviewKpi[];
  /** What the Overview is about, straight under the headline. Each panel brings its own Reveal. */
  panels?: React.ReactNode;
  /** Two to five more, from the rest of its sections. */
  more: OverviewKpi[];
  /** Section label over `more`: "More from each section". */
  moreLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} actions={actions} />

      <Reveal index={0}>
        <KpiGrid cols={4}>
          {headline.map((k) => (
            <OverviewCard key={k.label} kpi={k} />
          ))}
        </KpiGrid>
      </Reveal>

      {panels}

      <Reveal index={panels ? 3 : 1} className="flex flex-col gap-3">
        <SectionLabel icon={LayoutGrid}>{moreLabel}</SectionLabel>
        <KpiGrid cols={MORE_COLS[more.length as keyof typeof MORE_COLS] ?? 4}>
          {more.map((k) => (
            <OverviewCard key={k.label} kpi={k} size="sm" />
          ))}
        </KpiGrid>
      </Reveal>

      {children}
    </div>
  );
}

function OverviewCard({ kpi, size = "md" }: { kpi: OverviewKpi; size?: "md" | "sm" }) {
  return (
    <KpiCard
      label={kpi.label}
      value={kpi.value}
      sub={kpi.sample ? <>Sample · {kpi.sub}</> : kpi.sub}
      icon={kpi.icon}
      tone={kpi.tone}
      alert={kpi.alert}
      pulse={kpi.alert}
      aside={kpi.aside}
      size={size}
      // Labels are whole phrases ("Discounts to approve"): on a phone they wrap rather than lose their end.
      wrapLabel
      href={hrefForKey(kpi.to, kpi.query)}
    />
  );
}
