"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP } from "@/lib/motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JARVIS_SUGGESTIONS, METRIC_BY_ID } from "./data";
import type { CustomDashboardState } from "./useCustomDashboard";

/**
 * Ask Jarvis — the simulated ask-your-data assistant. A question waits 1.1s
 * ("Reading your data…"), then answers from a fixed set by keyword; whatever
 * metric the answer cites is added to the preview above.
 */
export function JarvisPanel({ state }: { state: CustomDashboardState }) {
  const { messages, pending, draft, setDraft, ask } = state;
  const reduce = useReducedMotion();
  const listRef = React.useRef<HTMLUListElement>(null);

  // Keep the newest exchange in view once the thread outgrows its box.
  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, pending, reduce]);

  return (
    <Card>
      <CardHeader className="gap-y-1.5">
        <Sparkles className="size-4 shrink-0 text-haven-700 dark:text-haven-300" aria-hidden />
        <CardTitle>Ask Jarvis</CardTitle>
        <Pill tone="skyblue">Jarvis · reads mirrored data only</Pill>
        <CardDescription>
          Ask Jarvis in plain English. Answers come from the same figures on this page, and anything it references gets
          added to your view.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="mb-1 flex flex-wrap gap-1.5" role="group" aria-label="Suggested questions">
            {JARVIS_SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="rounded-full border border-hairline bg-muted px-3 py-1.5 text-[11px] text-foreground transition-colors hover:border-haven-300 hover:bg-haven-50 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none dark:hover:border-haven-800 dark:hover:bg-haven-950/40"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}

        {messages.length > 0 ? (
          <ul
            ref={listRef}
            aria-live="polite"
            aria-label="Conversation with Jarvis"
            className="max-h-[360px] overflow-y-auto overscroll-contain pr-1"
          >
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.li
                  key={m.id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
                  className="flex gap-2.5 border-t border-hairline py-2 first:border-t-0"
                >
                  <span
                    className={cn(
                      "flex size-[22px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-semibold",
                      m.role === "ai" ? "bg-haven-300 text-haven-950" : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {m.role === "ai" ? "J" : "AS"}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs leading-relaxed text-foreground">
                      <span className="sr-only">{m.role === "ai" ? "Jarvis: " : "You: "}</span>
                      {m.text}
                    </p>
                    {m.added ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-haven-700 dark:text-haven-300">
                        <Check className="size-3" aria-hidden />
                        Added {METRIC_BY_ID[m.added].label} to your dashboard
                      </p>
                    ) : null}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : null}

        {pending > 0 ? <ReadingIndicator /> : null}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question about the business"
            aria-label="Ask Jarvis a question about the business"
            className="h-9 text-[13px]"
          />
          <Button type="submit" className="h-9 px-4">
            Ask
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ReadingIndicator() {
  const reduce = useReducedMotion();
  return (
    <p role="status" className="py-2 text-xs text-subtle-foreground">
      Reading your data
      <span aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block"
            animate={reduce ? { opacity: 1 } : { opacity: [0.25, 1, 0.25] }}
            transition={
              reduce ? { duration: 0 } : { duration: 1.1, repeat: Infinity, ease: EASE_SWAP, delay: i * 0.18 }
            }
          >
            .
          </motion.span>
        ))}
      </span>
    </p>
  );
}
