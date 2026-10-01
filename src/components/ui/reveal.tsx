"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/motion";

/**
 * Reveal — staggered rise-in for sections and cards on first paint (HRIS § 14.3
 * envelope: small offset, capped delay). `index` orders the cascade.
 *
 *   {cards.map((c, i) => <Reveal key={c.id} index={i}>…</Reveal>)}
 */
export function Reveal({
  index = 0,
  className,
  children,
  as = "div",
}: {
  index?: number;
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "li";
}) {
  const reduce = useReducedMotion();
  const Comp = as === "section" ? motion.section : as === "li" ? motion.li : motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.32, ease: EASE_OUT, delay: reduce ? 0 : Math.min(index * 0.05, 0.3) }}
    >
      {children}
    </Comp>
  );
}
