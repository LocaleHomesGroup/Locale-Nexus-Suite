import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { TicketsScreen } from "@/components/modules/tickets/TicketsScreen";

export const metadata: Metadata = { title: "Tickets" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <TicketsScreen />
    </Suspense>
  );
}
