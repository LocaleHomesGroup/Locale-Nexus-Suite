"use client";

import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASE_SWAP } from "@/lib/motion";

/**
 * The dashboard template only remounts when the top segment changes, so moving
 * between the jobs list and a job page (both under /operations) would snap.
 * This gives that hop the same HRIS page-enter (§ 1.1).
 */
export default function OperationsTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}
