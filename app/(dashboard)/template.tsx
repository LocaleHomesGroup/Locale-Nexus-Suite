"use client";

import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASE_SWAP } from "@/lib/motion";

/**
 * Page enter — the HRIS tab-swap animator (§ 1.1), applied per route. A
 * template remounts on every navigation, so each module rises in on the
 * dialog ease. Sub-tab changes inside a module use <TabPanels> instead.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
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
