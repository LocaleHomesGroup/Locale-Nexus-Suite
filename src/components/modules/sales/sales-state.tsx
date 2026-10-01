"use client";

import * as React from "react";
import {
  ALL_PLANS,
  SEED_DEALS,
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

/**
 * Sales' module-private state. In the mockup this lived on the Sales component
 * itself (`gm`), so a filter or a ticked to-do survived switching between Sales
 * tabs but reset when you left the module. The provider sits in SalesScreen,
 * above TabPanels, which gives the same lifetime: tabs remount, this does not.
 *
 * `reselect` counts clicks on the tab that is already active. The mockup's tab
 * setter always cleared the open deal submission (`f(null)`); switching tabs
 * does that here by remounting the pane, and a tab that wants the re-click
 * behaviour too can watch `useSalesTabReselect()`.
 */
type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

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
  reselect: number;
}

const Ctx = React.createContext<SalesState | null>(null);

export function SalesStateProvider({ reselect, children }: { reselect: number; children: React.ReactNode }) {
  const [deals, setDeals] = React.useState<PipelineDeal[]>(SEED_DEALS);
  const [todos, setTodos] = React.useState<Todo[]>(SEED_TODOS);
  const [plan, setPlan] = React.useState<string>(ALL_PLANS);
  const [discounts, setDiscounts] = React.useState<DiscountApproval[]>(SEED_DISCOUNTS);
  const [tasks, setTasks] = React.useState<TeamTask[]>(SEED_TEAM_TASKS);
  const [lots, setLots] = React.useState<LandLot[]>(SEED_LOTS);

  const value = React.useMemo<SalesState>(
    () => ({ deals, setDeals, todos, setTodos, plan, setPlan, discounts, setDiscounts, tasks, setTasks, lots, setLots, reselect }),
    [deals, todos, plan, discounts, tasks, lots, reselect],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSalesState(): SalesState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useSalesState must be used inside <SalesStateProvider>");
  return v;
}

/**
 * Bumps each time the rep clicks the Sales tab that is already open. Returns 0
 * outside the Sales screen, so it is safe to call from any pane.
 */
export function useSalesTabReselect(): number {
  return React.useContext(Ctx)?.reselect ?? 0;
}
