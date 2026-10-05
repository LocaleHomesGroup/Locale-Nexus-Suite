import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { DeveloperScreen } from "@/components/modules/developer/DeveloperScreen";

export const metadata: Metadata = { title: "Developer portal" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton tabs={false} />}>
      <DeveloperScreen />
    </Suspense>
  );
}
