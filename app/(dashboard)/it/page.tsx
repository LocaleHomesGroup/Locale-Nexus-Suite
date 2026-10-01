import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { ItScreen } from "@/components/modules/it/ItScreen";

export const metadata: Metadata = { title: "IT" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton tabs={false} />}>
      <ItScreen />
    </Suspense>
  );
}
