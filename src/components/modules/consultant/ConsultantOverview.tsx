"use client";

import { BadgeDollarSign, CalendarDays, FileCheck2, HardHat, ListChecks, ListTodo, Trophy, Wallet } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { aud } from "@/lib/utils";
import { useGreeting } from "@/hooks/useGreeting";
import { DashboardOverview } from "../overview/DashboardOverview";
import { CURRENT_REP, isOpenDeal, millionsFromK, openPipelineK } from "../sales/data";
import { SIGNED_THIS_WEEK } from "../sales/week/data";
import { forecastTotal, useSalesState } from "../sales/sales-state";
import { MONTH_TARGET } from "../sales/progress/data";
import { commissionPipeline, wonSoFar, wonVsTarget } from "../sales/progress/progress";
import { useChangesRequested } from "./use-changes-requested";

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Sales Representative portal › Overview: one consultant's figures, each card a link to the
 * section it comes from. Deals, tasks, to-dos and the week's forecast come
 * from the shared Sales store, so a deal moved on either board shows here at
 * once.
 */
export function ConsultantOverview() {
  const rep = CURRENT_REP;
  const greeting = useGreeting();
  const { jobs } = useLaunchpad();
  const { deals, todos, tasks, weekForecast } = useSalesState();
  const changes = useChangesRequested();

  const mine = deals.filter((d) => d.rep === rep);
  const open = mine.filter(isOpenDeal).length;
  const month = wonVsTarget(wonSoFar(deals, rep).month, MONTH_TARGET);
  const flagged = tasks.filter((t) => t.rep === rep && t.flag);
  const overdue = flagged.filter((t) => /overdue/i.test(t.due)).length;
  const myJobs = jobs.filter((j) => j.rep === rep);
  const building = myJobs.filter((j) => j.board === "construction").length;
  const openTodos = todos.filter((t) => !t.done).length;

  const waiting = [
    overdue ? `${plural(overdue, "task")} ${overdue === 1 ? "is" : "are"} overdue.` : null,
    changes ? `${plural(changes, "submission")} came back with changes.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <DashboardOverview
      title={`${greeting}, ${rep}.`}
      description={waiting || "You're all caught up."}
      headline={[
        { label: "My pipeline", value: millionsFromK(openPipelineK(mine)), sub: plural(open, "open deal"), icon: Wallet, to: "consultant:pipeline" },
        {
          label: "Won this month",
          value: `${month.won} of ${MONTH_TARGET}`,
          sub: month.hit ? "target hit" : "against target",
          icon: Trophy,
          tone: month.hit ? "ok" : undefined,
          to: "consultant:progress",
        },
        {
          label: "Signed this week",
          value: `${sum(SIGNED_THIS_WEEK)} of ${forecastTotal(weekForecast)}`,
          sub: "against forecast",
          icon: CalendarDays,
          to: "consultant:week",
        },
        {
          label: "My overdue tasks",
          value: flagged.length,
          sub: flagged.length ? `${overdue} overdue · ${flagged.length - overdue} due today` : "nothing overdue",
          icon: ListTodo,
          tone: flagged.length ? "pending" : "ok",
          to: "consultant:clients",
        },
      ]}
      moreLabel="More from each section"
      more={[
        { label: "Under construction", value: building, sub: `${myJobs.length - building} in preconstruction`, icon: HardHat, to: "consultant:clients" },
        { label: "Open to-dos", value: openTodos, sub: "on My clients", icon: ListChecks, to: "consultant:clients" },
        {
          label: "Changes requested",
          value: changes,
          sub: changes ? "Ops sent back" : "none waiting",
          icon: FileCheck2,
          tone: changes ? "pending" : "ok",
          to: "consultant:submissions",
        },
        {
          label: "Commission pipeline",
          value: aud(commissionPipeline(deals, rep)),
          sub: "flat rate until Alison's formula",
          icon: BadgeDollarSign,
          sample: true,
          to: "consultant:progress",
        },
      ]}
    />
  );
}
