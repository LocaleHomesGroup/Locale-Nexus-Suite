import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { AccountingScreen } from "@/components/modules/accounting/AccountingScreen";

export const metadata: Metadata = { title: "Accounting" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <AccountingScreen />
    </Suspense>
  );
}
