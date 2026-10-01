"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, CircleHelp, ListChecks, Send, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_SWAP } from "@/lib/motion";
import { useLaunchpad } from "@/state/launchpad-store";
import { dashboardById } from "../dashboards";
import type { DashboardTone } from "../dashboard-tones";
import type { ModuleId } from "@/state/launchpad-store";
import { useNavState } from "../nav-state";
import {
  JARVIS,
  answerFor,
  featuredFor,
  relatedTo,
  type JarvisAnswer,
  type JarvisContext,
} from "./jarvis-knowledge";

/**
 * Jarvis — the Launchpad's assistant bubble, on every dashboard. It is HRIS's
 * Penny AI chat head (CeoChatBubble): a beating mark bottom-right that opens a
 * chat panel, starter questions in the empty state, a "thinking" beat, then
 * the reply. Here the mark is the Locale "L", the panel wears the dashboard's
 * accent, and the starter questions are that dashboard's own.
 *
 * Each dashboard has its own FAQ, grouped by the same sections as its rail.
 * An empty chat opens on that FAQ; mid-conversation the FAQ button brings it
 * back, and every answer offers related questions from its section.
 *
 * Each dashboard keeps its own thread, so switching from Sales to HR and back
 * returns you to the Sales conversation. Answers come from jarvis-knowledge.ts
 * — computed from the dashboard's data, never invented (static prototype: no
 * model). Escape closes the panel.
 */

type Msg = {
  id: number;
  role: "user" | "jarvis";
  text: string;
  answer?: JarvisAnswer;
  pending?: boolean;
  /** Follow-up FAQ questions offered under this answer. */
  related?: string[];
};

const THINK_MS = 700;

const TONE: Record<
  DashboardTone,
  { header: string; mark: string; user: string; send: string; chip: string; halo: string; focus: string; action: string }
> = {
  haven: {
    header: "bg-gradient-to-br from-haven-300 via-haven-300 to-haven-500 text-haven-950",
    mark: "bg-white/45",
    user: "bg-gradient-to-br from-haven-300 to-haven-400 text-haven-950",
    send: "bg-gradient-to-br from-haven-300 to-haven-500 text-haven-950 hover:from-haven-200 hover:to-haven-400",
    chip: "hover:border-haven-300 hover:bg-haven-50 dark:hover:border-haven-800 dark:hover:bg-haven-950/40",
    halo: "bg-haven-400/45",
    focus: "focus-within:border-haven-400 focus-within:ring-haven-300/40",
    action: "text-haven-800 hover:bg-haven-50 dark:text-haven-200 dark:hover:bg-haven-950/50",
  },
  nectar: {
    header: "bg-gradient-to-br from-nectar-300 via-nectar-300 to-nectar-500 text-nectar-950",
    mark: "bg-white/45",
    user: "bg-gradient-to-br from-nectar-300 to-nectar-400 text-nectar-950",
    send: "bg-gradient-to-br from-nectar-300 to-nectar-500 text-nectar-950 hover:from-nectar-200 hover:to-nectar-400",
    chip: "hover:border-nectar-300 hover:bg-nectar-50 dark:hover:border-nectar-800 dark:hover:bg-nectar-950/40",
    halo: "bg-nectar-400/45",
    focus: "focus-within:border-nectar-400 focus-within:ring-nectar-300/40",
    action: "text-nectar-800 hover:bg-nectar-50 dark:text-nectar-200 dark:hover:bg-nectar-950/50",
  },
  skyblue: {
    header: "bg-gradient-to-br from-skyblue-300 via-skyblue-300 to-skyblue-500 text-skyblue-950",
    mark: "bg-white/45",
    user: "bg-gradient-to-br from-skyblue-300 to-skyblue-400 text-skyblue-950",
    send: "bg-gradient-to-br from-skyblue-300 to-skyblue-500 text-skyblue-950 hover:from-skyblue-200 hover:to-skyblue-400",
    chip: "hover:border-skyblue-300 hover:bg-skyblue-50 dark:hover:border-skyblue-800 dark:hover:bg-skyblue-950/40",
    halo: "bg-skyblue-400/45",
    focus: "focus-within:border-skyblue-400 focus-within:ring-skyblue-300/40",
    action: "text-skyblue-800 hover:bg-skyblue-50 dark:text-skyblue-200 dark:hover:bg-skyblue-950/50",
  },
  charcoal: {
    header: "bg-gradient-to-br from-charcoal to-[#4a4a4e] text-silver",
    mark: "bg-white/10",
    user: "bg-gradient-to-br from-charcoal to-[#4a4a4e] text-silver dark:from-silver dark:to-zinc-300 dark:text-charcoal",
    send: "bg-charcoal text-haven-300 hover:bg-charcoal/90 dark:bg-silver dark:text-charcoal dark:hover:bg-silver/90",
    chip: "hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-white/15 dark:hover:bg-white/[0.05]",
    halo: "bg-zinc-500/40",
    focus: "focus-within:border-zinc-400 focus-within:ring-zinc-300/40",
    action: "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/[0.06]",
  },
};

export function JarvisBubble() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { dashboardId } = useNavState();
  const { jobs, notifications, portalUpdates, submissionDocs, submissionStatus } = useLaunchpad();
  const dash = dashboardById(dashboardId);
  const brief = JARVIS[dash.id];
  const tone = TONE[dash.tone];

  const [open, setOpen] = React.useState(false);
  const [faqOpen, setFaqOpen] = React.useState(false);
  const [threads, setThreads] = React.useState<Record<string, Msg[]>>({});
  const [input, setInput] = React.useState("");
  const msgs = threads[dash.id] ?? [];
  const busy = msgs.some((m) => m.pending);
  const asked = new Set(msgs.filter((m) => m.role === "user").map((m) => m.text));
  const lastJarvisId = [...msgs].reverse().find((m) => m.role === "jarvis")?.id;

  // A different dashboard opens on its own FAQ/thread, not the last one's FAQ view.
  React.useEffect(() => setFaqOpen(false), [dash.id]);
  const nextId = React.useRef(1);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Always answer from the CURRENT store, even for a reply that lands later.
  const ctxRef = React.useRef<JarvisContext>({ jobs, notifications, portalUpdates, submissionDocs, submissionStatus });
  ctxRef.current = { jobs, notifications, portalUpdates, submissionDocs, submissionStatus };

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [msgs, reduce]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 140);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    const thread = dash.id;
    const userMsg: Msg = { id: nextId.current++, role: "user", text };
    const pending: Msg = { id: nextId.current++, role: "jarvis", text: "", pending: true };
    const askedNow = new Set([...asked, text]);
    setThreads((t) => ({ ...t, [thread]: [...(t[thread] ?? []), userMsg, pending] }));
    setInput("");
    setFaqOpen(false);
    timers.current.push(
      setTimeout(
        () => {
          const brief = JARVIS[thread];
          const { answer, matched } = answerFor(brief, text, ctxRef.current);
          // Follow-ups: the dashboard's other FAQ questions not asked yet.
          const related = relatedTo(thread, matched ?? "", askedNow);
          setThreads((t) => ({
            ...t,
            [thread]: (t[thread] ?? []).map((m) =>
              m.id === pending.id ? { ...m, pending: false, text: answer.text, answer, related } : m,
            ),
          }));
        },
        reduce ? 0 : THINK_MS,
      ),
    );
  };

  const clear = () => {
    setThreads((t) => ({ ...t, [dash.id]: [] }));
    setFaqOpen(false);
  };

  const follow = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="jarvis-panel"
            role="dialog"
            aria-label={`Jarvis — ${dash.label} assistant`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE_SWAP }}
            className="fixed right-4 bottom-[6.5rem] z-50 flex h-[min(560px,calc(100dvh-7.5rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl shadow-black/20 sm:right-6"
          >
            {/* Header */}
            <div className={cn("flex shrink-0 items-center justify-between gap-3 px-4 py-3", tone.header)}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full backdrop-blur-sm", tone.mark)}>
                  {/* Silver "L" on the charcoal header, charcoal on the light tints. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dash.tone === "charcoal" ? "/brand/locale-mark-silver.svg" : "/brand/locale-mark-charcoal.svg"}
                    alt=""
                    className="size-6"
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm leading-tight font-semibold">Jarvis</p>
                  <p className="truncate text-[11px] leading-tight opacity-80">
                    {dash.label} · {brief.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {msgs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFaqOpen((v) => !v)}
                    aria-pressed={faqOpen}
                    aria-label={faqOpen ? "Back to the chat" : `${dash.label} FAQ`}
                    title={faqOpen ? "Back to the chat" : `${dash.label} FAQ`}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full opacity-80 transition hover:bg-black/10 hover:opacity-100",
                      faqOpen && "bg-black/10 opacity-100",
                    )}
                  >
                    <ListChecks className="size-4" aria-hidden />
                  </button>
                ) : null}
                {msgs.length > 0 ? (
                  <button
                    type="button"
                    onClick={clear}
                    aria-label="Clear chat"
                    title="Clear chat"
                    className="flex size-8 items-center justify-center rounded-full opacity-80 transition hover:bg-black/10 hover:opacity-100"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Jarvis"
                  className="flex size-8 items-center justify-center rounded-full opacity-80 transition hover:bg-black/10 hover:opacity-100"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-canvas px-3.5 py-4" aria-live="polite">
              {msgs.length === 0 || faqOpen ? (
                <div className="flex flex-col gap-3 px-1 pt-1">
                  {msgs.length === 0 ? (
                    <p className="text-sm font-medium text-foreground">{brief.greeting}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFaqOpen(false)}
                      className="inline-flex items-center gap-1 self-start text-[12px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden /> Back to the chat
                    </button>
                  )}
                  <FaqList id={dash.id} label={dash.label} asked={asked} chipClass={tone.chip} onAsk={send} />
                </div>
              ) : (
                msgs.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduce ? 0 : 0.24, ease: EASE_SWAP }}
                    className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-1"}
                  >
                    {m.role === "user" ? (
                      <div className={cn("max-w-[82%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap shadow-sm", tone.user)}>
                        {m.text}
                      </div>
                    ) : (
                      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-[13.5px] leading-relaxed text-card-foreground shadow-sm">
                        {m.pending ? (
                          <span className="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground">
                            <span className="inline-flex gap-0.5" aria-hidden>
                              {[0, 1, 2].map((d) => (
                                <span key={d} className="jarvis-dot size-1 rounded-full bg-current" style={{ animationDelay: `${d * 0.15}s` }} />
                              ))}
                            </span>
                            Reading your data…
                          </span>
                        ) : (
                          <AnswerBody answer={m.answer ?? { text: m.text }} actionClass={tone.action} onFollow={follow} />
                        )}
                      </div>
                    )}
                    {/* Related FAQ questions — under the latest answer only. */}
                    {m.role === "jarvis" && !m.pending && m.id === lastJarvisId && m.related?.length ? (
                      <div className="mt-1 flex flex-col gap-1.5 pl-1">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">Related questions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.related.map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => send(q)}
                              disabled={busy}
                              className={cn(
                                "rounded-full border border-border bg-card px-2.5 py-1 text-left text-[12px] text-foreground transition disabled:opacity-50",
                                tone.chip,
                              )}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </motion.div>
                ))
              )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-border bg-popover px-3 py-2.5">
              <div className={cn("flex items-end gap-2 rounded-xl border border-input bg-card px-2.5 py-1.5 focus-within:ring-2 dark:bg-white/[0.03]", tone.focus)}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  aria-label={`Ask Jarvis about ${dash.label}`}
                  placeholder={`Ask about ${dash.label}…`}
                  className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[13.5px] leading-relaxed text-foreground outline-none placeholder:text-subtle-foreground"
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className={cn("mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40", tone.send)}
                >
                  <Send className="size-4" aria-hidden />
                </button>
              </div>
              <p className="mt-1 px-1 text-[10.5px] text-subtle-foreground">
                Jarvis answers from the figures on this dashboard. Check anything important.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* The chat head — the Locale "L", beating, with a halo in the dashboard's tone. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Jarvis" : `Ask Jarvis about ${dash.label}`}
        aria-expanded={open}
        title={open ? undefined : `Ask Jarvis about ${dash.label}`}
        className="fixed right-4 bottom-5 z-50 flex size-16 items-center justify-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:right-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: reduce ? 0 : 0.15 }}
              className="flex size-14 items-center justify-center rounded-full border border-border bg-card shadow-lg shadow-black/20"
            >
              <X className="size-6 text-foreground" aria-hidden />
            </motion.span>
          ) : (
            <motion.span
              key="mark"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: EASE_SWAP }}
              className="relative flex size-16 items-center justify-center"
            >
              <span aria-hidden className={cn("jarvis-halo absolute size-[3.25rem] rounded-full blur-md", tone.halo)} />
              <span aria-hidden className={cn("jarvis-halo-late absolute size-[3.25rem] rounded-full", tone.halo)} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/locale-mark-charcoal.svg"
                alt=""
                draggable={false}
                className="jarvis-beat relative size-12 drop-shadow-md dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/locale-mark-silver.svg"
                alt=""
                draggable={false}
                className="jarvis-beat relative hidden size-12 drop-shadow-md dark:block"
              />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </>
  );
}

/**
 * The dashboard's FAQ — its three questions. Questions already asked in this
 * thread are ticked, so the list doubles as a record of what's been covered.
 */
function FaqList({
  id,
  label,
  asked,
  chipClass,
  onAsk,
}: {
  id: ModuleId;
  label: string;
  asked: Set<string>;
  chipClass: string;
  onAsk: (q: string) => void;
}) {
  return (
    <section aria-label={`${label} FAQ`} className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{label} FAQ</p>
      {featuredFor(id).map((f) => {
        const done = asked.has(f.question);
        return (
          <button
            key={f.question}
            type="button"
            onClick={() => onAsk(f.question)}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-[13px] text-foreground shadow-xs transition",
              chipClass,
            )}
          >
            <CircleHelp
              className={cn("size-3.5 shrink-0", done ? "text-emerald-600 dark:text-emerald-400" : "text-subtle-foreground")}
              aria-hidden
            />
            <span className="min-w-0 flex-1">{f.question}</span>
            {done ? <span className="sr-only">(asked)</span> : null}
          </button>
        );
      })}
    </section>
  );
}

function AnswerBody({
  answer,
  actionClass,
  onFollow,
}: {
  answer: JarvisAnswer;
  actionClass: string;
  onFollow: (href: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p>{answer.text}</p>
      {answer.bullets?.length ? (
        <ul className="space-y-1 text-[12.5px] text-muted-foreground">
          {answer.bullets.map((b, i) => (
            <li key={i} className="flex gap-1.5">
              <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-current opacity-60" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {answer.actions?.length ? (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {answer.actions.map((a) => (
            <button
              key={a.href + a.label}
              type="button"
              onClick={() => onFollow(a.href)}
              className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold transition", actionClass)}
            >
              {a.label}
              <ArrowRight className="size-3" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
      {answer.source ? <p className="text-[10.5px] text-subtle-foreground">{answer.source}</p> : null}
    </div>
  );
}
