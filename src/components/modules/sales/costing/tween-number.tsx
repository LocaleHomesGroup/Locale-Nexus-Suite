"use client";

import * as React from "react";
import { animate, useReducedMotion } from "motion/react";
import { DURATION, EASE_OUT } from "@/lib/motion";

/** Matches `CountUp`'s first-paint rise (HRIS § 14.5). */
const COUNT_UP_SECONDS = 0.9;

/**
 * TweenNumber — a live figure that glides from its previous value to the new
 * one when an input changes (the costing total as options are toggled).
 * `CountUp` restarts from zero on every change, which reads as a glitch on a
 * value the user is steering; this eases between values instead. With
 * `countUp`, the first paint also rises from zero like a KPI figure.
 * Reduced motion snaps to the final value.
 */
export function TweenNumber({
  value,
  format,
  countUp = false,
  className,
}: {
  value: number;
  format: (n: number) => string;
  countUp?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = React.useState(value);
  const from = React.useRef(countUp ? 0 : value);
  // The opening rise runs until it completes (StrictMode's double effect must
  // not demote it to a short tween); any later change is a short glide.
  const initial = React.useRef(value);
  const rose = React.useRef(!countUp);

  React.useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      rose.current = true;
      setShown(value);
      return;
    }
    const opening = !rose.current && value === initial.current;
    const controls = animate(from.current, value, {
      duration: opening ? COUNT_UP_SECONDS : DURATION.swap,
      ease: [...EASE_OUT],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
      onComplete: () => {
        rose.current = true;
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return <span className={className ?? "tabular-nums"}>{format(Math.round(shown))}</span>;
}
