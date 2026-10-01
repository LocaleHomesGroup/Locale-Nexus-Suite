"use client";

import { Boxes, CircleCheck, Eye, FileCheck2, FileText, Hourglass, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Reveal } from "@/components/ui/reveal";
import { MODELS_TRACKED, PRICE_LISTS, type PriceListStatus } from "./data";

/**
 * Operations → Pricing (mockup `um`). Every list here was extracted and checked
 * in Doc formatter, then published. Read-only: publishing happens in Doc
 * formatter → Price changes.
 */

const STATUS: Record<PriceListStatus, { tone: PillTone; icon: typeof CircleCheck }> = {
  Published: { tone: "ok", icon: CircleCheck },
  "In review": { tone: "pending", icon: Eye },
  "Awaiting PDF": { tone: "neutral", icon: Hourglass },
};

export function PricingTab() {
  const published = PRICE_LISTS.filter((p) => p.status === "Published");
  const changesThisMonth = PRICE_LISTS.reduce((sum, p) => sum + p.changes, 0);
  const listsWithChanges = PRICE_LISTS.filter((p) => p.changes > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Pricing"
        description="Every list here was extracted and checked in Doc formatter, then published. Publishing writes the Monday Models board, generates the branded PDF, updates Rapid costing and emails the change report to Sean."
        actions={
          <Pill tone="neutral" icon={FileText}>
            Published from Doc formatter
          </Pill>
        }
      />

      <Reveal index={0}>
        <KpiGrid cols={3}>
          <KpiCard
            label="Price lists current"
            value={`${published.length} of ${PRICE_LISTS.length}`}
            sub={published.map((p) => p.builder).join(" · ")}
            icon={FileCheck2}
            tone="haven"
          />
          <KpiCard
            label="Price changes this month"
            value={changesThisMonth}
            sub={`across ${listsWithChanges} lists`}
            icon={TrendingUp}
            tone="skyblue"
          />
          <KpiCard
            label="Models tracked"
            value={MODELS_TRACKED}
            sub="on the Monday Models board"
            icon={Boxes}
            tone="charcoal"
          />
        </KpiGrid>
      </Reveal>

      <Reveal index={1}>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-hairline pb-3">
            <CardTitle>Monthly builder pricing</CardTitle>
            <CardMeta className="text-xs text-muted-foreground">
              Source file, change report and published PDF for each month
            </CardMeta>
          </CardHeader>
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                <TableHead className="pl-5">Builder</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Changes</TableHead>
                <TableHead className="pr-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PRICE_LISTS.map((p) => {
                const s = STATUS[p.status];
                return (
                  <TableRow key={p.builder}>
                    <TableCell className="pl-5 font-medium">{p.builder}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{p.version}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {p.received === "—" ? <Dash /> : p.received}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {p.changes ? p.changes : <Dash />}
                    </TableCell>
                    <TableCell className="pr-5">
                      <Pill tone={s.tone} variant="caps" icon={s.icon}>
                        {p.status}
                      </Pill>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </Reveal>
    </div>
  );
}
