import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { AccountsScreen } from "@/components/modules/accounts/AccountsScreen";

export const metadata: Metadata = { title: "Accounts" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <AccountsScreen />
    </Suspense>
  );
}
