"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Columns3, DollarSign, RefreshCw, Share2, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SyncStep, SyncSystem } from "./types";

const SYSTEM_ICON: Record<SyncSystem, LucideIcon> = {
  Launchpad: Zap,
  Monday: Columns3,
  HubSpot: Share2,
  Xero: DollarSign,
};

/**
 * The sync trail (mockup `rm`): each write lands in Launchpad first, then walks
 * the connected systems one node at a time. The dialog can't be dismissed
 * while a step is in flight (HRIS § 10.1) — Done unlocks when the last system
 * confirms.
 */
export function SyncTrailDialog({
  open,
  title,
  steps,
  onClose,
}: {
  open: boolean;
  title: string;
  steps: SyncStep[];
  onClose: () => void;
}) {
  const pending = steps.some((s) => s.state === "pending");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      size="md"
      icon={RefreshCw}
      title={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {title}
          {pending ? (
            <span className="inline-flex items-center gap-1.5 font-sans text-[11px] font-semibold text-haven-700 dark:text-haven-300">
              <span className="pulse-haven size-[7px] rounded-full bg-haven-400 dark:bg-haven-300" aria-hidden />
              Live
            </span>
          ) : null}
        </span>
      }
      description="Saved to Launchpad first, then pushed to each connected system."
      footer={
        <Button className="w-full" size="lg" onClick={onClose} disabled={pending}>
          {pending ? "Syncing…" : "Done"}
        </Button>
      }
    >
      {/* Focus lands on the trail itself: the Done button is disabled until the last step lands. */}
      <ol aria-live="polite" aria-label="Sync steps" tabIndex={-1} data-autofocus className="flex flex-col outline-none">
        {steps.map((step, i) => (
          <TrailStep key={`${i}-${step.state}`} step={step} last={i === steps.length - 1} />
        ))}
      </ol>
    </Dialog>
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
              ? "bg-haven-300 text-charcoal"
              : "pulse-haven border-[1.5px] border-haven-400 bg-card text-haven-700 dark:border-haven-300 dark:text-haven-300",
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
            className={cn("min-h-3.5 w-0.5 flex-1 rounded-full", done ? "bg-haven-300" : "bg-hairline")}
            aria-hidden
          />
        ) : null}
      </div>
      <div className={cn("min-w-0 flex-1", !last && "pb-3.5")}>
        <p
          className={cn(
            "flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase",
            done ? "text-haven-700 dark:text-haven-300" : "text-subtle-foreground",
          )}
        >
          <Icon className="size-3" aria-hidden />
          {step.sys}
        </p>
        <p
          className={cn(
            "mt-0.5 text-[12.5px] leading-snug",
            done ? "text-foreground" : "text-amber-700 dark:text-amber-300",
          )}
        >
          <span className="sr-only">{done ? "Done: " : "In progress: "}</span>
          {step.label}
        </p>
        {step.meta ? (
          <p className="mt-0.5 font-mono text-[10.5px] text-subtle-foreground tabular-nums">{step.meta}</p>
        ) : null}
      </div>
    </motion.li>
  );
}
