"use client";

import { Check, Circle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { RateBar } from "@/components/ui/progress";
import { PROCESS_STEPS } from "./data";

/**
 * New job → processing. The bar tracks completed steps, not elapsed time
 * (HRIS § 10.1) — it moves only when a step ticks over.
 */
export function ProcessingStep({ step }: { step: number }) {
  return (
    <Card className="w-full px-6 py-10 text-center">
      <RefreshCw
        className="mx-auto size-6 animate-spin text-haven-700 [animation-duration:1.1s] motion-reduce:animate-none dark:text-haven-300"
        aria-hidden
      />
      <h2 className="mt-3 mb-3.5 font-heading text-base font-bold">Formatting your file</h2>
      <ol className="flex flex-col items-center gap-1" aria-live="polite">
        {PROCESS_STEPS.map((label, i) => {
          const done = step > i;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2 py-0.5 text-[12.5px] transition-colors",
                done ? "text-foreground" : "text-subtle-foreground",
              )}
            >
              {done ? (
                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : (
                <Circle className="size-3.5" aria-hidden />
              )}
              {label}
              <span className="sr-only">{done ? "(done)" : "(waiting)"}</span>
            </li>
          );
        })}
      </ol>
      <RateBar
        value={step / PROCESS_STEPS.length}
        className="mx-auto mt-5 max-w-[420px]"
        label={`${step} of ${PROCESS_STEPS.length} steps complete`}
      />
    </Card>
  );
}
