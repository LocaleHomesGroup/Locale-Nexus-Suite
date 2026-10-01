import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { OperationsScreen } from "@/components/modules/operations/OperationsScreen";

export const metadata: Metadata = { title: "Operations" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <OperationsScreen />
    </Suspense>
  );
}
