"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * CountUp — eases the numeric part of a formatted value to its real figure,
 * then holds (HRIS § 14.5). Prefix/suffix and thousands separators are kept:
 * "$1,240,500", "86%", "12 days", "4.2x" all animate. Non-numeric values
 * ("—", "Live") render as-is. Under reduced motion it renders the final value.
 *
 * First paint counts up from 0. A later change glides from the figure already
 * on screen to the new one — an approval that takes "3 awaiting" to 2 should
 * tick down, not replay from zero.
 */
const NUMERIC = /^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/;

export function CountUp({ value, duration = 900 }: { value: string | number; duration?: number }) {
  const reduce = useReducedMotion();
  const target = String(value);
  const [shown, setShown] = useState(target);
  // The number currently on screen, or null before the first animation.
  const current = useRef<number | null>(null);

  useEffect(() => {
    const m = target.match(NUMERIC);
    if (!m || reduce) {
      setShown(target);
      current.current = m ? parseFloat(m[2].replace(/,/g, "")) : null;
      return;
    }
    const [, pre, num, post] = m;
    const end = parseFloat(num.replace(/,/g, ""));
    const from = current.current ?? 0;
    if (from === end) {
      setShown(target);
      return;
    }
    const decimals = (num.split(".")[1] ?? "").length;
    const grouped = num.includes(",");
    // A small step (3 → 2) should be quick; a first count-up uses the full span.
    const span = current.current == null ? duration : Math.min(duration, 450);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / span);
      const eased = 1 - Math.pow(1 - t, 3);
      const n = from + (end - from) * eased;
      current.current = n;
      const text = grouped
        ? n.toLocaleString("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : n.toFixed(decimals);
      setShown(pre + text + post);
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        current.current = end;
        setShown(target);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);

  return <span className="tabular-nums">{shown}</span>;
}
