import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { EmployeeScreen } from "@/components/modules/employee/EmployeeScreen";

export const metadata: Metadata = { title: "Employee portal" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton tabs={false} />}>
      <EmployeeScreen />
    </Suspense>
  );
}
