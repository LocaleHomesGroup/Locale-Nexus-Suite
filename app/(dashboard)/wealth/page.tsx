import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { WealthScreen } from "@/components/modules/wealth/WealthScreen";

export const metadata: Metadata = { title: "Wealth" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton tabs={false} />}>
      <WealthScreen />
    </Suspense>
  );
}
