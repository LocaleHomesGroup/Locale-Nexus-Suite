import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { MarketingScreen } from "@/components/modules/marketing/MarketingScreen";

export const metadata: Metadata = { title: "Marketing" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <MarketingScreen />
    </Suspense>
  );
}
