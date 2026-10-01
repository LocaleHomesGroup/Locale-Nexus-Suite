"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { RateBar } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { OKRS, OKR_ON_TRACK_AT, personTone } from "../data";

/**
 * HR › Performance — Q3 key results per person. A score of 85+ is on track
 * (emerald); below that it wants a conversation (amber), as the mockup split it.
 */
export function HrPerformanceTab() {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="HR"
        title="Performance"
        description="Q3 objectives and key results · 360 feedback opens 1 September."
      />

      <Reveal index={0}>
        <Card>
          <CardHeader>
            <CardTitle>Q3 objectives and key results</CardTitle>
            <CardMeta>{OKRS.length} people</CardMeta>
          </CardHeader>
          <CardContent className="pb-2">
            <ul>
              {OKRS.map((p, i) => {
                const onTrack = p.score >= OKR_ON_TRACK_AT;
                const delay = rowDelay(i, reduce, 0.09, 0.3);
                return (
                  <motion.li
                    key={p.name}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT, delay }}
                    className="border-t border-hairline py-3 first:border-t-0"
                  >
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <Avatar name={p.name} tone={personTone(p.name)} size="xs" />
                      <span className="text-[13px] font-semibold">{p.name}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {p.onTrack} of {p.total} key results on track
                      </span>
                      <span
                        className={cn(
                          "ml-auto text-[13px] font-bold tabular-nums",
                          onTrack ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
                        )}
                      >
                        <CountUp value={p.score} />
                      </span>
                    </div>
                    <RateBar
                      value={p.score / 100}
                      tone={onTrack ? "ok" : "pending"}
                      className="mt-2"
                      delay={delay}
                      label={`${p.name}: score ${p.score} of 100`}
                    />
                  </motion.li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
