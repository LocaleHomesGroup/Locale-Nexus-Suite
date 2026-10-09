"use client";

import * as React from "react";
import { BadgeDollarSign, BadgePercent, HardHat, ListTodo, MapPinned, Target, Trophy, Users, Wallet } from "lucide-react";
import { useJobs, useLiveData } from "@/state/live-data";
import { useNow } from "@/hooks/useNow";
import { aud } from "@/lib/utils";
import { RingGauge } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { SlidingTabs, type TabItem } from "@/components/ui/sliding-tabs";
import { DashboardOverview } from "../overview/DashboardOverview";
import { BUILD_HOMES, REPS, isOpenDeal, millionsFromK, openPipelineK } from "./data";
import { useSalesState } from "./sales-state";
import { viewLot } from "./land/live-lots";
import { commissionPipeline } from "./progress/progress";
import {
  previousLabel,
  standingLabel,
  standings,
  teamTotals,
  type RankBy,
  type StandingPeriod,
} from "./progress/standings";
import { TopCloser } from "./overview/TopCloser";
import { Leaderboard } from "./overview/Leaderboard";
import { TeamSalesChart } from "./overview/TeamSalesChart";
import { RepSpotlight } from "./overview/RepSpotlight";
import { kValue, paceWords, plural } from "./overview/format";

const PERIODS: TabItem<StandingPeriod>[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

/** Anyone but `not`, at random. */
const drawRep = (not: string | null) => {
  const pool = REPS.filter((r) => r !== not);
  return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * Sales Manager › Overview: who's closing and what it's worth. A period
 * (month, quarter or year to date) drives the team's four headline figures,
 * the Top closer and the leaderboard. Under them, the team's sales by month
 * and the Rep spotlight: a rep drawn at random on each visit, shuffled from
 * the card or chosen from the board, whom the chart picks out too. Then the
 * smaller cards from the rest of Sales.
 *
 * Deals, tasks and discounts come from the shared Sales store, so a deal moved
 * to Sale won re-ranks the board at once. Clients and lots come from the same
 * place as All clients and Exclusive Land: the live database when one is
 * connected (holds judged as Exclusive Land judges them), the sample stores
 * otherwise. Sales history, targets and the commission rate are
 * placeholders (sales/progress/data.ts). A consultant's own figures are on the
 * Sales Representative portal's Overview.
 */
export function SalesOverview() {
  const { jobs } = useJobs();
  const { deals, tasks, lots: sampleLots, discounts } = useSalesState();
  const live = useLiveData();
  // Null until mount; until then, holds are judged as of the database read (Ruling T15-b).
  const now = useNow(30_000);
  const lots = React.useMemo(
    () => (live ? live.lots.map((l) => viewLot(l, null, now ?? Date.parse(live.readAt))) : sampleLots),
    [live, now, sampleLots],
  );

  const [period, setPeriod] = React.useState<StandingPeriod>("month");
  const [by, setBy] = React.useState<RankBy>("sales");
  // Drawn in the browser, after hydration: a draw on the server wouldn't match the client's.
  const [spotlight, setSpotlight] = React.useState<string | null>(null);
  React.useEffect(() => setSpotlight(drawRep(null)), []);

  const bySales = React.useMemo(() => standings(deals, period, "sales"), [deals, period]);
  const board = React.useMemo(() => (by === "sales" ? bySales : standings(deals, period, "value")), [by, bySales, deals, period]);
  const team = teamTotals(bySales, period);
  const label = standingLabel(period);
  const previous = previousLabel(period);
  const toGo = Math.max(0, team.target.target - team.target.won);

  const open = deals.filter(isOpenDeal).length;
  const flagged = tasks.filter((t) => t.flag);
  const overdue = flagged.filter((t) => /overdue/i.test(t.due)).length;
  const nearing = BUILD_HOMES.filter((h) => h.pct >= 90);
  const building = jobs.filter((j) => j.board === "construction").length;
  const count = (s: string) => lots.filter((l) => l.status === s).length;
  const requested = discounts.reduce((n, d) => n + d.discount, 0);
  const inPlay = REPS.reduce((n, rep) => n + commissionPipeline(deals, rep), 0);

  return (
    <DashboardOverview
      title="Sales overview"
      description={`Who's closing deals, what they're worth, and how each rep is tracking. ${label} to date.`}
      actions={<SlidingTabs value={period} onChange={setPeriod} items={PERIODS} ariaLabel="Period" />}
      headline={[
        {
          label: "Sales won",
          value: team.sales,
          sub: `${paceWords(team.sales - team.before)} this point ${previous}`,
          icon: Trophy,
          to: "sales:team",
        },
        {
          label: "Contract value",
          value: kValue(team.valueK),
          sub: team.sales ? `avg ${kValue(team.valueK / team.sales)} a sale` : "no sales yet",
          icon: BadgeDollarSign,
          to: "sales:team",
        },
        {
          label: "Team target",
          value: team.target.target ? `${team.target.won} of ${team.target.target}` : team.target.won,
          sub: team.target.hit
            ? "Target hit. Nice work."
            : team.target.target
              ? `${plural(toGo, "sale")} to go in ${label}`
              : "no yearly target set",
          icon: team.target.hit ? Trophy : Target,
          tone: team.target.hit ? "ok" : undefined,
          aside:
            team.target.ratio === null ? null : (
              <RingGauge value={team.target.ratio} size={46} stroke={5} tone={team.target.hit ? "ok" : "tone"}>
                <span className="text-xs">{Math.round(team.target.ratio * 100)}%</span>
              </RingGauge>
            ),
          to: "sales:team",
        },
        {
          label: "Open pipeline",
          value: millionsFromK(openPipelineK(deals)),
          sub: `${plural(open, "open deal")} · ${aud(inPlay)} commission`,
          icon: Wallet,
          to: "sales:pipeline",
        },
      ]}
      panels={
        <>
          <Reveal index={1} className="grid gap-5 xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
            <TopCloser rows={bySales} label={label} spotlight={spotlight} onSpotlight={setSpotlight} />
            <Leaderboard
              rows={board}
              by={by}
              onBy={setBy}
              label={label}
              previous={previous}
              spotlight={spotlight}
              onSpotlight={setSpotlight}
            />
          </Reveal>
          <Reveal index={2} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            <TeamSalesChart deals={deals} focus={spotlight} />
            <RepSpotlight
              rep={spotlight}
              deals={deals}
              tasks={tasks}
              period={period}
              onShuffle={() => setSpotlight((rep) => drawRep(rep))}
            />
          </Reveal>
        </>
      }
      moreLabel="More from each section"
      more={[
        {
          label: "Overdue tasks",
          value: flagged.length,
          sub: flagged.length ? `${overdue} overdue · ${flagged.length - overdue} due today` : "nothing overdue",
          icon: ListTodo,
          tone: flagged.length ? "pending" : "ok",
          to: "sales:team",
        },
        {
          label: "Discounts to approve",
          value: discounts.length,
          sub: discounts.length ? `$${(requested / 1e3).toFixed(1)}k requested` : "none waiting",
          icon: BadgePercent,
          tone: discounts.length ? "pending" : "ok",
          to: "sales:team",
        },
        {
          label: "Under construction",
          value: BUILD_HOMES.length,
          sub: nearing.length ? `key handover ${nearing[0].eta}` : "none near handover",
          icon: HardHat,
          to: "sales:build",
        },
        { label: "All clients", value: jobs.length, sub: `${building} in construction`, icon: Users, to: "sales:clients" },
        { label: "Lots available", value: count("available"), sub: `${count("hold")} on hold · ${count("sold")} sold`, icon: MapPinned, to: "sales:land" },
      ]}
    />
  );
}
