"use client";

import dynamic from "next/dynamic";
import { useTabParam } from "@/hooks/useTabParam";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { Skeleton } from "@/components/ui/states";
import { RapidCosting } from "./RapidCosting";

/**
 * HomeScope carries its price boards, so it loads on its own the first time
 * it opens. It is client-only: the estimate lives in a module store and the
 * dates it starts with are the browser's.
 */
const HomeScope = dynamic(() => import("./homescope/HomeScope"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading HomeScope">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Skeleton className="h-[420px]" />
        <Skeleton className="h-[260px]" />
      </div>
    </div>
  ),
});

/** The two views, in `?view=` — nested under Rapid costing in the Sales rail. */
const VIEWS = ["calculator", "homescope"] as const;

/**
 * Sales › Rapid costing: the in-the-room Calculator, and HomeScope, the full
 * step-by-step estimator that ends in the client's quote PDF.
 */
export function Costing() {
  const [view, , dir] = useTabParam(VIEWS, "calculator", "view");
  return (
    <TabPanels value={view} dir={dir}>
      {view === "homescope" ? <HomeScope /> : <RapidCosting />}
    </TabPanels>
  );
}
