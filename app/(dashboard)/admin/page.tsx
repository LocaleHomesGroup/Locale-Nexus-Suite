import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { AdminScreen } from "@/components/modules/admin/AdminScreen";

export const metadata: Metadata = { title: "Admin" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <AdminScreen />
    </Suspense>
  );
}
