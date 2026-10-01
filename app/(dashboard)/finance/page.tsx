import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { FinanceScreen } from "@/components/modules/finance/FinanceScreen";

export const metadata: Metadata = { title: "Finance" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton tabs={false} />}>
      <FinanceScreen />
    </Suspense>
  );
}
