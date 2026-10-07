import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { ConsultantScreen } from "@/components/modules/consultant/ConsultantScreen";

export const metadata: Metadata = { title: "Sales portal" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton tabs={false} />}>
      <ConsultantScreen />
    </Suspense>
  );
}
