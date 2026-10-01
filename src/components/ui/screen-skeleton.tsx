import { PageContainer } from "./page";
import { Skeleton } from "./states";

/**
 * Suspense fallback for a module screen — shaped like what arrives (tab strip,
 * heading, KPI row, two panels) so the real screen lands in place instead of
 * pushing content down (HRIS § 12.3). Shown in the static HTML until the
 * client reads `?tab=` and renders.
 */
export function ScreenSkeleton({ tabs = true }: { tabs?: boolean }) {
  return (
    <PageContainer aria-busy="true" aria-label="Loading">
      {tabs ? (
        <div className="flex gap-2 border-b border-border pb-2.5">
          {["w-[72px]", "w-24", "w-[84px]", "w-16"].map((w) => (
            <Skeleton key={w} className={`h-4 ${w}`} />
          ))}
        </div>
      ) : null}
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-3.5 w-[28rem] max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-6 w-14" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
