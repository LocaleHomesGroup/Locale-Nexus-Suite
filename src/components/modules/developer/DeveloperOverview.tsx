"use client";

import Link from "next/link";
import {
  FileSpreadsheet,
  Gauge,
  HardHat,
  Hourglass,
  MessageSquareWarning,
  Receipt,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { awaitingAcceptance, nextStep } from "@/data/journey";
import { DEVELOPER } from "@/data/portal";
import { useLaunchpad } from "@/state/launchpad-store";
import { usePortal } from "@/state/portal-store";
import { hrefForKey } from "@/components/shell/dashboards";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { DashboardOverview } from "../overview/DashboardOverview";
import { INSIGHTS_PERIOD, MATCH_STATS, OBJECTIONS, PRICE_LIST } from "./data";
import { STAGE_VIEW, useDeveloperJobs, type DeveloperJob } from "./parts";

/** The board's columns: the post-sale stages, in order. */
const COLUMNS = ["operations", "precon", "construction", "handover"] as const;

/**
 * Developer › Overview — the builder's side of the journey at a glance: its
 * Locale clients and what waits on it, how it ranks in Locale's recorded
 * consultations, and its price list and Locale's invoices. Then the board: every
 * Locale client by stage, so it can see who has the next move.
 */
export function DeveloperOverview() {
  const mine = useDeveloperJobs();
  const { invoices } = useLaunchpad();
  const { updates } = usePortal();
  const awaiting = mine.filter((d) => awaitingAcceptance(d.job));
  const building = mine.filter((d) => d.stage === "construction");
  const handedOver = mine.filter((d) => d.stage === "handover" || d.stage === "done");
  const sent = updates.filter((u) => u.builder === DEVELOPER);
  const owed = invoices.filter((i) => i.builder === DEVELOPER && i.status !== "Paid");
  const lost = OBJECTIONS.reduce((sum, o) => sum + o.count, 0);
  const top = OBJECTIONS[0];

  return (
    <DashboardOverview
      title={`${DEVELOPER} on Locale`}
      description="Your Locale clients from sale to keys, how your packages rank in Locale's consultations, and what Locale needs from you."
      headline={[
        {
          label: "Locale clients",
          value: mine.length,
          sub: `${building.length} building · ${handedOver.length} handed over`,
          icon: Users,
          to: "developer:clients",
        },
        {
          label: "Awaiting your acceptance",
          value: awaiting.length,
          sub: awaiting.length ? awaiting.map((d) => d.job.client).join(" · ") : "Every job accepted",
          icon: Hourglass,
          tone: awaiting.length ? "pending" : "ok",
          to: "developer:clients",
          query: awaiting.length ? { show: "awaiting" } : undefined,
        },
        {
          label: "Ranked top match",
          value: MATCH_STATS.rankedFirst,
          sub: `Chosen ${MATCH_STATS.chosen} times · ${INSIGHTS_PERIOD}`,
          icon: Sparkles,
          to: "developer:insights",
          sample: true,
        },
        {
          label: "Average match score",
          value: MATCH_STATS.avgScore,
          sub: `Locale average ${MATCH_STATS.marketAvg}`,
          icon: Gauge,
          to: "developer:insights",
          sample: true,
        },
      ]}
      moreLabel="More from each section"
      more={[
        {
          label: "In construction",
          value: building.length,
          sub: building.length ? building.map((d) => d.job.client).join(" · ") : "None on site",
          icon: HardHat,
          to: "developer:clients",
          query: { show: "construction" },
        },
        {
          label: "Updates sent",
          value: sent.length,
          sub: sent[0] ? `Latest: ${sent[0].milestone}, ${sent[0].when}` : "None yet",
          icon: Send,
          to: "developer:updates",
        },
        {
          label: "Price list",
          value: PRICE_LIST.version,
          sub: `${PRICE_LIST.status} · ${PRICE_LIST.changes} changes`,
          icon: FileSpreadsheet,
          to: "developer:products",
        },
        {
          label: "Locale invoices open",
          value: aud(owed.reduce((sum, i) => sum + i.amount, 0)),
          sub: `${owed.length} invoice${owed.length === 1 ? "" : "s"} · excl GST`,
          icon: Receipt,
          to: "developer:terms",
        },
        {
          label: "Top objection",
          value: top.objection,
          sub: `${top.count} of ${lost} lost deals`,
          icon: MessageSquareWarning,
          to: "developer:insights",
          sample: true,
        },
      ]}
    >
      <Reveal index={2}>
        <Card>
          <CardHeader>
            <CardTitle>Your Locale clients by stage</CardTitle>
            <CardMeta>{mine.length} clients</CardMeta>
            <CardDescription>
              Locale looks after the paperwork until the job is yours; from pre-construction, the next move is yours.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {COLUMNS.map((col) => {
                const view = STAGE_VIEW[col]!;
                const here = mine.filter((d) => d.stage === col || (col === "handover" && d.stage === "done"));
                return (
                  <section
                    key={col}
                    aria-label={view.label}
                    className="rounded-lg border border-hairline bg-canvas/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        {view.label}
                      </h3>
                      <span className="text-xs text-subtle-foreground tabular-nums">{here.length}</span>
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        view.withYou ? "font-medium text-tone-ink" : "text-subtle-foreground",
                      )}
                    >
                      {view.withYou ? "With you" : "With Locale"}
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {here.length ? (
                        here.map((d) => <ClientChip key={d.job.id} d={d} />)
                      ) : (
                        <li className="rounded-md border border-dashed border-border px-2.5 py-3 text-center text-xs text-subtle-foreground">
                          No clients here
                        </li>
                      )}
                    </ul>
                  </section>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </DashboardOverview>
  );
}

function ClientChip({ d }: { d: DeveloperJob }) {
  const next = nextStep(d.job);
  const waiting = awaitingAcceptance(d.job);
  return (
    <li>
      <Link
        href={hrefForKey("developer:clients", waiting ? { show: "awaiting" } : undefined)}
        className="block rounded-md border border-border bg-card px-2.5 py-2 transition-colors hover:border-tone-line hover:bg-tone-soft/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="block truncate text-[13px] font-medium">{d.job.client}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {d.lot.design} · {d.lot.suburb}
        </span>
        <span
          className={cn(
            "mt-1 block truncate text-xs",
            waiting ? "font-medium text-amber-800 dark:text-amber-300" : "text-subtle-foreground",
          )}
        >
          {waiting ? "Waiting for you to accept" : next ? `Next: ${next.name}` : "In maintenance"}
        </span>
      </Link>
    </li>
  );
}
