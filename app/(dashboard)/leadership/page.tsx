import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { LeadershipScreen } from "@/components/modules/leadership/LeadershipScreen";

export const metadata: Metadata = { title: "Leadership" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <LeadershipScreen />
    </Suspense>
  );
}
