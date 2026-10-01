import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { ProjectsScreen } from "@/components/modules/projects/ProjectsScreen";

export const metadata: Metadata = { title: "Projects" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton tabs={false} />}>
      <ProjectsScreen />
    </Suspense>
  );
}
