"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SendHorizontal, ShieldCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { confirm } from "@/state/launchpad-store";
import { usePortal } from "@/state/portal-store";
import type { PortalMessage, Sender } from "@/data/portal";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardFooter, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { CONSULTANT_ROLE } from "./data";
import { TeamCard, useClientJob } from "./parts";

const MAX = 600;

/**
 * Client › Messages — one thread for everyone on the build: the consultant,
 * Locale Operations and the builder, instead of a phone call to each. A
 * message the client sends also lands in the Launchpad Inbox, and the
 * builder's site updates from the Developer portal arrive here as they're
 * posted. Opening the thread marks it read.
 */
export function ClientMessages() {
  const reduce = useReducedMotion();
  const { job } = useClientJob();
  const { messages, unread, sendMessage, markRead } = usePortal();
  const thread = messages.filter((m) => m.jobId === job.id);
  const [draft, setDraft] = React.useState("");
  const listRef = React.useRef<HTMLOListElement>(null);
  // Unread as the page opened, so the "New" marks survive marking them read.
  const [seenAsNew] = React.useState(() => new Set(thread.filter((m) => unread.has(m.id)).map((m) => m.id)));

  React.useEffect(() => {
    markRead(job.id);
  }, [job.id, markRead, thread.length]);

  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(job.id, job.client, text);
    setDraft("");
    confirm("Message sent", `To ${job.rep}, Locale Operations and ${job.builder}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        description={`One thread for everyone on your build: ${job.rep}, Locale Operations and ${job.builder}. No more chasing four inboxes.`}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Reveal index={0} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Your build thread</CardTitle>
              <CardMeta>{thread.length} messages</CardMeta>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ol
                ref={listRef}
                aria-label="Messages"
                className="flex max-h-[min(560px,60dvh)] flex-col gap-4 overflow-y-auto px-5 pt-1 pb-5 [scrollbar-width:thin]"
              >
                <AnimatePresence initial={false}>
                  {thread.map((m) => (
                    <motion.li
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
                    >
                      <Bubble m={m} isNew={seenAsNew.has(m.id)} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2">
              <label htmlFor="client-message" className="sr-only">
                Write a message
              </label>
              <Textarea
                id="client-message"
                rows={2}
                maxLength={MAX}
                placeholder={`Ask ${job.rep}, Locale Operations or ${job.builder} anything…`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                className="resize-none bg-card"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-subtle-foreground">Enter to send · Shift+Enter for a new line</span>
                <Button onClick={send} disabled={!draft.trim()}>
                  <SendHorizontal aria-hidden /> Send
                </Button>
              </div>
            </CardFooter>
          </Card>
        </Reveal>

        <Reveal index={1} className="min-w-0">
          <TeamCard job={job} />
        </Reveal>
      </div>
    </div>
  );
}

const ROLE: Record<Exclude<Sender, "you">, string> = {
  consultant: CONSULTANT_ROLE,
  operations: "Locale",
  builder: "Your builder",
};

const ICON: Partial<Record<Sender, React.ComponentType<{ className?: string }>>> = {
  operations: ShieldCheck,
  builder: Wrench,
};

function Bubble({ m, isNew }: { m: PortalMessage; isNew: boolean }) {
  const mine = m.from === "you";
  const Icon = ICON[m.from];
  return (
    <div className={cn("flex items-end gap-2.5", mine && "flex-row-reverse")}>
      {mine ? null : Icon ? (
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-charcoal dark:bg-white/[0.08] dark:text-zinc-200"
        >
          <Icon className="size-3.5" />
        </span>
      ) : (
        <Avatar name={m.name} tone="haven" size="sm" />
      )}
      <div className={cn("flex max-w-[min(34rem,85%)] flex-col", mine ? "items-end" : "items-start")}>
        <p className="mb-1 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{m.name}</span>
          {mine ? null : <span>· {ROLE[m.from as Exclude<Sender, "you">]}</span>}
          <span className="tabular-nums">· {m.when}</span>
          {isNew ? (
            <span className="rounded-full bg-tone-tint px-1.5 text-[10px] font-semibold tracking-[0.12em] text-tone-ink uppercase">
              New
            </span>
          ) : null}
        </p>
        <p
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
            mine
              ? "rounded-br-md bg-charcoal text-silver dark:bg-tone-fill dark:text-tone-on-fill"
              : "rounded-bl-md border border-hairline bg-muted/60 text-foreground",
          )}
        >
          {m.body}
        </p>
      </div>
    </div>
  );
}
