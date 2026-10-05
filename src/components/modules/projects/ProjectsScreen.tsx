"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { useTabParam } from "@/hooks/useTabParam";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { Card } from "@/components/ui/card";
import { Pill, type PillTone } from "@/components/ui/pill";
import { RateBar } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { BOARD, PROJECTS, type ProjectState } from "./data";
import { ProjectsOverview } from "./ProjectsOverview";

/**
 * Projects — the mockup's `bm` (no tabs): one card per internal build with its
 * owner, state and progress, then the three-column board. Read-only.
 * The mockup's `lh-tilt` hover becomes HRIS's -translate-y-0.5 card lift.
 */
const STATE_TONE: Record<ProjectState, PillTone> = {
  "In build": "tone",
  Validation: "pending",
  Deploying: "haven",
};

const TABS = ["overview", "board"] as const;

/** Projects — an Overview (the default) and the Project board, in the rail (`?tab=`). */
export function ProjectsScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "overview" ? <ProjectsOverview /> : <ProjectBoard />}
      </TabPanels>
    </PageContainer>
  );
}

function ProjectBoard() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Every internal build, its owner and its state — one glance."
      />

      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROJECTS.map((p, i) => (
            <Reveal key={p.name} index={i}>
              <Card className="flex h-full flex-col px-4 py-3.5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <h2 className="min-h-8 text-[13px] leading-snug font-medium">{p.name}</h2>
                <div className="mt-1 mb-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Avatar name={p.owner} size="xs" />
                  <span>{p.owner}</span>
                  <Pill tone={STATE_TONE[p.state]} variant="caps" className="ml-auto">
                    {p.state}
                  </Pill>
                </div>
                <RateBar
                  value={p.progress / 100}
                  tone="haven"
                  height="h-[7px]"
                  delay={Math.min(i * 0.06, 0.3)}
                  label={`${p.name}: ${p.progress}% complete`}
                  className="mt-auto"
                />
                <p className="mt-1 text-xs text-subtle-foreground tabular-nums">
                  <CountUp value={`${p.progress}%`} />
                </p>
              </Card>
            </Reveal>
          ))}
        </div>

        <div className="grid items-start gap-3 md:grid-cols-3">
          {BOARD.map((col, ci) => (
            <Reveal key={col.column} index={PROJECTS.length + ci}>
              <section
                aria-label={`${col.column}, ${col.items.length} items`}
                className="rounded-xl border border-border bg-canvas px-2.5 pt-2.5 pb-3 dark:bg-white/[0.02]"
              >
                <h2 className="mb-2 px-0.5 text-xs font-semibold">
                  {col.column} <span className="font-normal text-subtle-foreground tabular-nums">{col.items.length}</span>
                </h2>
                <ul className="flex flex-col gap-1.5">
                  {col.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-xs transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      {col.column === "Done" ? (
                        <Check className="mt-px size-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Done" />
                      ) : null}
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
