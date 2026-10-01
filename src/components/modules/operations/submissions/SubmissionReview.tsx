"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { ReviewQueue } from "./ReviewQueue";
import { OpsReview } from "./OpsReview";

/**
 * Operations → Submission review (mockup `lm`, drilling into `am`).
 *
 * The board shows every deal submission by stage. The live one is the Nguyen
 * deal from the store: the rep submits it in Sales → My Deal Submissions, it
 * lands in "Ops review" here, and Ops opens it to verify each document or send
 * it back. Both sides read and write the same `submissionDocs` /
 * `submissionStatus`, so a fix requested here shows up on the rep's screen.
 */
export function SubmissionReview() {
  const reduce = useReducedMotion();
  const [view, setView] = React.useState<"queue" | "ops">("queue");

  const show = (next: "queue" | "ops") => {
    setView(next);
    // The page scrolls inside the shell, not the window.
    const scroller = document.getElementById("launchpad-scroll");
    if (scroller && scroller.scrollTop > 120) scroller.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT } }}
        exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
      >
        {view === "ops" ? <OpsReview onBack={() => show("queue")} /> : <ReviewQueue onOpen={() => show("ops")} />}
      </motion.div>
    </AnimatePresence>
  );
}
