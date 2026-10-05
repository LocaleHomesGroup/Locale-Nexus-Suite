"use client";

import { ArrowRight, CalendarClock, CalendarDays, CircleAlert, Clock, ListChecks, Target, UserPlus, Users } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { rowDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardMeta, CardRow, CardTitle } from "@/components/ui/card";
import { RateBar } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { DashboardOverview } from "../../overview/DashboardOverview";
import {
  ATTENDANCE_TODAY,
  ATTENDANCE_TO_VALIDATE,
  DIVISIONS,
  HR_KPIS,
  OKRS,
  OKR_ON_TRACK_AT,
  ONBOARDING,
  ON_LEAVE_TODAY,
  OPEN_ROLES,
  personTone,
  type HrTab,
} from "../data";
import { useLeave } from "../leave-store";
import { OrgChartCard } from "../OrgChart";

/**
 * HR › Overview (the mockup's "HR dashboard"): the KPI cards every dashboard
 * opens on, then divisions, today's leave and attendance, and the group's org
 * chart, where HR can add someone under any department. The leave queue is
 * live (`leave-store`), so a decision on Leave moves its card here.
 */
export function HrOverviewTab({ goTab }: { goTab: (tab: HrTab) => void }) {
  const reduce = useReducedMotion();
  const { requests } = useLeave();
  const pending = requests.filter((r) => r.status === "Pending").length;
  const [clockedIn, wfh] = ATTENDANCE_TODAY;
  const applicants = OPEN_ROLES.reduce((n, r) => n + (r.stages.find((s) => s.label === "Applied")?.count ?? 0), 0);
  const offers = OPEN_ROLES.reduce((n, r) => n + (r.stages.find((s) => s.label === "Offer")?.count ?? 0), 0);
  const onTrack = OKRS.filter((o) => o.score >= OKR_ON_TRACK_AT).length;
  const tasksLeft = ONBOARDING.total - ONBOARDING.done;

  return (
    <DashboardOverview
      title="HR overview"
      description="Mirrored from Horilla · live counts, leave and attendance at a glance."
      headline={[
        { label: "Headcount", value: HR_KPIS.totalEmployees, sub: `across ${DIVISIONS.length} divisions`, icon: Users, to: "hr:people" },
        {
          label: "On leave today",
          value: HR_KPIS.onLeaveToday,
          sub: `${ON_LEAVE_TODAY.name} · ${ON_LEAVE_TODAY.note.split(" · ").pop()}`,
          icon: CalendarDays,
          to: "hr:leave",
        },
        {
          label: "Leave to approve",
          value: pending,
          sub: pending ? "requests waiting" : "all requests decided",
          icon: CalendarClock,
          tone: pending ? "pending" : "ok",
          to: "hr:leave",
        },
        {
          label: "Open positions",
          value: HR_KPIS.openPositions,
          sub: `${applicants} applicants · ${offers} offer${offers === 1 ? "" : "s"}`,
          icon: UserPlus,
          to: "hr:recruitment",
        },
      ]}
      moreLabel="More from each section"
      more={[
        { label: "Clocked in", value: clockedIn.value, sub: `${wfh.value} working from home`, icon: Clock, to: "hr:attendance" },
        {
          label: "Records to validate",
          value: ATTENDANCE_TO_VALIDATE,
          sub: "before July payroll",
          icon: CircleAlert,
          tone: ATTENDANCE_TO_VALIDATE ? "pending" : "ok",
          to: "hr:attendance",
        },
        { label: "OKRs on track", value: `${onTrack} of ${OKRS.length}`, sub: `Q3 score ${OKR_ON_TRACK_AT} or more`, icon: Target, to: "hr:performance" },
        {
          label: "Onboarding",
          value: `${ONBOARDING.done} of ${ONBOARDING.total}`,
          sub: `${ONBOARDING.name} · ${tasksLeft} task${tasksLeft === 1 ? "" : "s"} left`,
          icon: ListChecks,
          to: "hr:recruitment",
        },
      ]}
    >
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Reveal index={2}>
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
                      tone={i === 0 ? "tone" : "neutral"}
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
          <Reveal index={3}>
            <Card>
              <CardHeader>
                <CardTitle>On leave today</CardTitle>
                <CardMeta>
                  <Button variant="link" size="xs" className="gap-1 text-xs" onClick={() => goTab("leave")}>
                    Leave <ArrowRight aria-hidden />
                  </Button>
                </CardMeta>
              </CardHeader>
              <CardContent className="flex items-center gap-2.5 text-[13px]">
                <Avatar name={ON_LEAVE_TODAY.name} tone={personTone(ON_LEAVE_TODAY.name)} size="sm" />
                <span className="min-w-0">{ON_LEAVE_TODAY.note}</span>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={4}>
            <Card>
              <CardHeader>
                <CardTitle>Attendance today</CardTitle>
                <CardMeta>
                  <Button variant="link" size="xs" className="gap-1 text-xs" onClick={() => goTab("attendance")}>
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

      <Reveal index={5}>
        <OrgChartCard />
      </Reveal>
    </DashboardOverview>
  );
}
