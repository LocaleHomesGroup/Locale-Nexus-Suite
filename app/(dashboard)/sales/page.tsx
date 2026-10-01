import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { SalesScreen } from "@/components/modules/sales/SalesScreen";

export const metadata: Metadata = { title: "Sales" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <SalesScreen />
    </Suspense>
  );
}
