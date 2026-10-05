import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { ClientScreen } from "@/components/modules/client/ClientScreen";

export const metadata: Metadata = { title: "Client portal" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton tabs={false} />}>
      <ClientScreen />
    </Suspense>
  );
}
