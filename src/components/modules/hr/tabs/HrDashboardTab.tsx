"use client";

import { ArrowRight, BriefcaseBusiness, Plane, UserPlus, Users } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { rowDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardRow, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { RateBar } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { ATTENDANCE_TODAY, DIVISIONS, HR_KPIS, ON_LEAVE_TODAY, type HrTab } from "../data";

/** HR › Dashboard — the mockup's "HR dashboard": four counts, divisions, today's leave and attendance. */
export function HrDashboardTab({ goTab }: { goTab: (tab: HrTab) => void }) {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="HR"
        title="HR dashboard"
        description="Mirrored from Horilla · live counts, leave and attendance at a glance."
      />

      <Reveal index={0}>
        <KpiGrid cols={4}>
          <KpiCard
            label="Total employees"
            value={HR_KPIS.totalEmployees}
            icon={Users}
            tone="haven"
            onClick={() => goTab("people")}
            hint="Across 4 divisions · tap to view"
          />
          <KpiCard
            label="On leave today"
            value={HR_KPIS.onLeaveToday}
            icon={Plane}
            tone="skyblue"
            onClick={() => goTab("leave")}
            hint="K. Ellery · tap to view leave"
          />
          <KpiCard
            label="New joiners this month"
            value={HR_KPIS.newJoiners}
            icon={UserPlus}
            tone="nectar"
            onClick={() => goTab("recruitment")}
            hint="Lane Dixon · tap to view"
          />
          <KpiCard
            label="Open positions"
            value={HR_KPIS.openPositions}
            icon={BriefcaseBusiness}
            tone="charcoal"
            onClick={() => goTab("recruitment")}
            hint="Homes · Financial · tap to view"
          />
        </KpiGrid>
      </Reveal>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Reveal index={1}>
          <Card>
            <CardHeader>
              <CardTitle>Employees by division</CardTitle>
              <CardMeta>{HR_KPIS.totalEmployees} people</CardMeta>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3 pt-1">
                {DIVISIONS.map((d, i) => (
                  <li key={d.name}>
                    <div className="mb-1.5 flex items-baseline gap-3 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {d.count}
                        <span className="ml-1.5 text-subtle-foreground">{d.share}%</span>
                      </span>
                    </div>
                    <RateBar
                      value={d.share / 100}
                      tone={i === 0 ? "haven" : "skyblue"}
                      height="h-[7px]"
                      delay={rowDelay(i, reduce, 0.09, 0.3)}
                      label={`${d.name}: ${d.count} of ${HR_KPIS.totalEmployees} employees (${d.share}%)`}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>

        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={2}>
            <Card>
              <CardHeader>
                <CardTitle>On leave today</CardTitle>
                <CardMeta>
                  <Button variant="link" size="xs" className="gap-1 text-[11px]" onClick={() => goTab("leave")}>
                    Leave <ArrowRight aria-hidden />
                  </Button>
                </CardMeta>
              </CardHeader>
              <CardContent className="flex items-center gap-2.5 text-[12.5px]">
                <Avatar name={ON_LEAVE_TODAY.name} tone="skyblue" size="sm" />
                <span className="min-w-0">{ON_LEAVE_TODAY.note}</span>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={3}>
            <Card>
              <CardHeader>
                <CardTitle>Attendance today</CardTitle>
                <CardMeta>
                  <Button variant="link" size="xs" className="gap-1 text-[11px]" onClick={() => goTab("attendance")}>
                    Attendance <ArrowRight aria-hidden />
                  </Button>
                </CardMeta>
              </CardHeader>
              <CardContent>
                {ATTENDANCE_TODAY.map((row) => (
                  <CardRow key={row.label} className="flex items-baseline py-2 text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span
                      className={cn(
                        "ml-auto font-semibold tabular-nums",
                        row.caution && "text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {row.value}
                    </span>
                  </CardRow>
                ))}
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
