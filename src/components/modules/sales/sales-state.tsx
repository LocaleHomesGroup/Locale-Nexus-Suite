"use client";

import * as React from "react";
import {
  ALL_PLANS,
  seedDeals,
  SEED_DISCOUNTS,
  SEED_LOTS,
  SEED_TEAM_TASKS,
  SEED_TODOS,
  type DiscountApproval,
  type LandLot,
  type PipelineDeal,
  type TeamTask,
  type Todo,
} from "./data";
import { LAST_WEEK_FORECAST, SCORECARD_BUILDERS, type ScorecardBuilder } from "./week/data";

/**
 * Sales' shared state: the deals, to-dos, tasks, lots, discounts and the
 * week's forecast behind both the Sales Manager dashboard (the team's view) and the
 * Sales Representative portal (one consultant's). The provider sits in the dashboard layout,
 * beside the Launchpad and portal stores, so a deal moved in one view is
 * moved in the other, and it all lasts until a reload, as jobs do.
 *
 * What differs between the two views (whose Sales, the rail re-click) isn't
 * state. Each screen says it with `SalesViewProvider`, below.
 */
type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

/** My week's forecast per builder, as typed: an empty box is "". */
export type WeekForecast = Record<ScorecardBuilder, string>;

const initialForecast = (): WeekForecast =>
  Object.fromEntries(SCORECARD_BUILDERS.map((b) => [b, String(LAST_WEEK_FORECAST[b])])) as WeekForecast;

/** The forecast's total. An empty box counts as 0. */
export const forecastTotal = (f: WeekForecast) => SCORECARD_BUILDERS.reduce((sum, b) => sum + (Number(f[b]) || 0), 0);

interface SalesState {
  deals: PipelineDeal[];
  setDeals: Setter<PipelineDeal[]>;
  todos: Todo[];
  setTodos: Setter<Todo[]>;
  plan: string;
  setPlan: Setter<string>;
  discounts: DiscountApproval[];
  setDiscounts: Setter<DiscountApproval[]>;
  tasks: TeamTask[];
  setTasks: Setter<TeamTask[]>;
  lots: LandLot[];
  setLots: Setter<LandLot[]>;
  weekForecast: WeekForecast;
  setWeekForecast: Setter<WeekForecast>;
  weekSubmitted: boolean;
  setWeekSubmitted: Setter<boolean>;
}

const Ctx = React.createContext<SalesState | null>(null);

export function SalesStateProvider({ children }: { children: React.ReactNode }) {
  const [deals, setDeals] = React.useState<PipelineDeal[]>(() => seedDeals(Date.now()));
  const [todos, setTodos] = React.useState<Todo[]>(SEED_TODOS);
  const [plan, setPlan] = React.useState<string>(ALL_PLANS);
  const [discounts, setDiscounts] = React.useState<DiscountApproval[]>(SEED_DISCOUNTS);
  const [tasks, setTasks] = React.useState<TeamTask[]>(SEED_TEAM_TASKS);
  const [lots, setLots] = React.useState<LandLot[]>(SEED_LOTS);
  const [weekForecast, setWeekForecast] = React.useState<WeekForecast>(initialForecast);
  const [weekSubmitted, setWeekSubmitted] = React.useState(false);

  const value = React.useMemo<SalesState>(
    () => ({
      deals,
      setDeals,
      todos,
      setTodos,
      plan,
      setPlan,
      discounts,
      setDiscounts,
      tasks,
      setTasks,
      lots,
      setLots,
      weekForecast,
      setWeekForecast,
      weekSubmitted,
      setWeekSubmitted,
    }),
    [deals, todos, plan, discounts, tasks, lots, weekForecast, weekSubmitted],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSalesState(): SalesState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useSalesState must be used inside <SalesStateProvider>");
  return v;
}

/* ── The view: whose Sales, and the rail re-click ──────────────────────── */

/** Whose Sales a screen shows: the whole team (the dashboard) or one rep (the portal). */
export type SalesScope = { kind: "team" } | { kind: "rep"; rep: string };

export const TEAM_SCOPE: SalesScope = { kind: "team" };

/** The rep a scope is limited to, or null for the team. */
export const scopeRep = (scope: SalesScope): string | null => (scope.kind === "rep" ? scope.rep : null);

interface SalesView {
  scope: SalesScope;
  /** Clicks on the rail item that is already showing. */
  reselect: number;
}

const ViewCtx = React.createContext<SalesView>({ scope: TEAM_SCOPE, reselect: 0 });

/**
 * Set by each screen around its panes. Pass a module-constant `scope`, so the
 * context doesn't change every render.
 *
 * `reselect` counts clicks on the rail item that is already active. The
 * mockup's tab setter always cleared the open deal submission (`f(null)`).
 * Switching sections does that by remounting the pane; a pane that wants the
 * re-click behaviour too watches `useSalesTabReselect()`.
 */
export function SalesViewProvider({
  scope,
  reselect,
  children,
}: {
  scope: SalesScope;
  reselect: number;
  children: React.ReactNode;
}) {
  const value = React.useMemo<SalesView>(() => ({ scope, reselect }), [scope, reselect]);
  return <ViewCtx.Provider value={value}>{children}</ViewCtx.Provider>;
}

/** The nearest screen's scope: the team outside any screen. */
export function useSalesScope(): SalesScope {
  return React.useContext(ViewCtx).scope;
}

/** Bumps each time the rail item already showing is clicked. 0 outside a Sales screen. */
export function useSalesTabReselect(): number {
  return React.useContext(ViewCtx).reselect;
}
