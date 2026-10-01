import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { KnowledgeScreen } from "@/components/modules/knowledge/KnowledgeScreen";

export const metadata: Metadata = { title: "Knowledge" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton tabs={false} />}>
      <KnowledgeScreen />
    </Suspense>
  );
}
