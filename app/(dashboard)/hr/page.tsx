import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { HrScreen } from "@/components/modules/hr/HrScreen";

export const metadata: Metadata = { title: "HR" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <HrScreen />
    </Suspense>
  );
}
