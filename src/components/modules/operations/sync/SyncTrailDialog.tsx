"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Columns3, DollarSign, RefreshCw, Share2, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trailDone, trailTitle, type SyncRun, type SyncStep, type SyncSystem, type SyncTrail } from "./types";

const SYSTEM_ICON: Record<SyncSystem, LucideIcon> = {
  Launchpad: Zap,
  Monday: Columns3,
  HubSpot: Share2,
  Xero: DollarSign,
};

/**
 * The sync trail (mockup `rm`), opened on demand from a sync toast or a job's
 * "View sync trail". Each write lands in Launchpad first, then walks the
 * connected systems one node at a time. The run carries on in the background
 * whether or not this is open, so it can always be closed; if it is still open
 * when the last system confirms, the provider closes it a moment later.
 */
export function SyncTrailDialog({
  open,
  trail,
  onClose,
}: {
  open: boolean;
  trail: SyncTrail | null;
  onClose: () => void;
}) {
  if (!trail) return null;
  const done = trailDone(trail);
  const batch = trail.runs.length > 1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      icon={done ? Check : RefreshCw}
      iconTone={done ? "ok" : "haven"}
      title={trailTitle(trail)}
      description={
        done
          ? "Saved to Launchpad first, then confirmed by each connected system."
          : "Saved to Launchpad first, then pushed to each connected system. It carries on in the background if you close this."
      }
      footer={
        <Button className="w-full" size="lg" variant={done ? "default" : "outline"} onClick={onClose}>
          {done ? "Close" : "Keep working"}
        </Button>
      }
    >
      {/* Focus lands on the trail itself, so the live region is read as it fills. */}
      <div aria-live="polite" tabIndex={-1} data-autofocus className="flex flex-col gap-4 outline-none">
        {trail.runs.map((run) => (
          <RunTrail key={run.id} run={run} showLabel={batch} />
        ))}
      </div>
    </Dialog>
  );
}

function RunTrail({ run, showLabel }: { run: SyncRun; showLabel: boolean }) {
  return (
    <section aria-label={run.label}>
      {showLabel ? (
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold">
          <span>{run.label}</span>
          <span
            className={cn(
              "font-normal",
              run.done ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
            )}
          >
            {run.done ? "Synced" : "Syncing"}
          </span>
        </p>
      ) : null}
      <ol aria-label={`Sync steps for ${run.label}`} className="flex flex-col">
        {run.steps.map((step, i) => (
          <TrailStep key={`${i}-${step.state}`} step={step} last={i === run.steps.length - 1} />
        ))}
      </ol>
    </section>
  );
}

function TrailStep({ step, last }: { step: SyncStep; last: boolean }) {
  const reduce = useReducedMotion();
  const done = step.state === "done";
  const Icon = SYSTEM_ICON[step.sys];

  return (
    <motion.li
      className="flex gap-3"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
    >
      <div className="flex flex-col items-center">
        <motion.span
          className={cn(
            "flex size-[30px] shrink-0 items-center justify-center rounded-full",
            done
              ? "bg-emerald-600 text-white dark:bg-emerald-500"
              : // The one live indicator: this system is being written to right now.
                "pulse-haven border-[1.5px] border-tone-strong bg-card text-tone-ink",
          )}
          // A landed step pops once (it remounts on pending → done); `initial` never reads reduce.
          initial={done ? { scale: 0.6 } : false}
          animate={{ scale: 1 }}
          transition={{ duration: reduce ? 0 : 0.3, ease: EASE_OUT }}
          aria-hidden
        >
          {done ? (
            <Check className="size-3.5" strokeWidth={2.5} />
          ) : (
            <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />
          )}
        </motion.span>
        {!last ? (
          <span
            className={cn("min-h-3.5 w-0.5 flex-1 rounded-full", done ? "bg-emerald-600/40 dark:bg-emerald-400/40" : "bg-hairline")}
            aria-hidden
          />
        ) : null}
      </div>
      <div className={cn("min-w-0 flex-1", !last && "pb-3.5")}>
        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          <Icon className="size-3" aria-hidden />
          {step.sys}
        </p>
        <p
          className={cn(
            "mt-0.5 text-[13px] leading-snug",
            done ? "text-foreground" : "text-amber-700 dark:text-amber-300",
          )}
        >
          <span className="sr-only">{done ? "Done: " : "In progress: "}</span>
          {step.label}
        </p>
        {step.meta ? (
          <p className="mt-0.5 font-mono text-xs text-subtle-foreground tabular-nums">{step.meta}</p>
        ) : null}
      </div>
    </motion.li>
  );
}
