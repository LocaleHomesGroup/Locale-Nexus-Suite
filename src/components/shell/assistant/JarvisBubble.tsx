"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, CircleHelp, ListChecks, Send, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_SWAP } from "@/lib/motion";
import { useLaunchpad } from "@/state/launchpad-store";
import type { ModuleId } from "@/state/launchpad-store";
import { useLeave } from "@/components/modules/hr/leave-store";
import { useOrg } from "@/components/modules/hr/org-store";
import { useInvoices } from "@/components/modules/employee/invoice-store";
import { useRun } from "@/components/modules/accounting/payrun-store";
import { dashboardById } from "../dashboards";
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
 * Penny AI chat head (CeoChatBubble): a mark bottom-right that opens a chat
 * panel, starter questions in the empty state, a "thinking" beat, then the
 * reply. The panel wears the dashboard's tone (`tone-*` utilities) and the
 * starter questions are that dashboard's own.
 *
 * The chat head is built like Penny's: the Locale mark floating free (no
 * button disc), two staggered halo rings in the dashboard tone and Penny's
 * lub-dub beat. Unlike Penny it is calm: the first load of a browser session
 * plays three beats with the halo, then it rests; hover or keyboard focus
 * plays one beat and shows a small "Ask Jarvis" label. Nothing loops. While
 * the panel is open the head becomes its close (X), the only close control.
 *
 * Each dashboard keeps its own thread, so switching from Sales to HR and back
 * returns you to the Sales conversation. Answers come from jarvis-knowledge.ts,
 * computed from the dashboard's data and the live store, never invented
 * (static prototype: no model). Escape closes the panel.
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
/** Once a browser session: the arrival plays on the first load only. */
const ARRIVED_KEY = "launchpad:jarvis:arrived";
/** Penny's timings: a 1.3s lub-dub and a 1.5s halo, the second ring 0.35s behind. */
const BEAT_S = 1.3;
const HALO_S = 1.5;
/** The arrival: three beats, the halo rippling twice under them, then rest. */
const ARRIVAL_BEATS = 3;
const ARRIVAL_RINGS = 2;
const ARRIVAL_MS = Math.max(ARRIVAL_BEATS * BEAT_S, ARRIVAL_RINGS * HALO_S + 0.35) * 1000 + 100;

/** Penny's keyframes, renamed. Reduced motion: no beat, no halo. */
const KEYFRAMES = `
@keyframes jarvisHeartbeat {
  0%, 28%, 70%, 100% { transform: scale(1); }
  14% { transform: scale(1.22); }
  42% { transform: scale(1.1); }
}
@keyframes jarvisHalo {
  0% { transform: scale(0.7); opacity: 0.55; }
  70% { transform: scale(1.95); opacity: 0; }
  100% { transform: scale(1.95); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .jarvis-mark, .jarvis-ring { animation: none !important; }
}`;
/**
 * Decided once per page load, outside React: StrictMode runs effects twice in
 * dev, and the second run would otherwise read the flag the first just wrote
 * and skip the timer that ends the arrival.
 */
let arrivalPending: boolean | null = null;

const CHIP =
  "border-border bg-card text-foreground hover:border-tone-line hover:bg-tone-soft dark:bg-white/[0.03] dark:hover:bg-tone-soft";

export function JarvisBubble() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { dashboardId } = useNavState();
  const { jobs, notifications, reviewItems, submissionDocs, submissionStatus, invoices, claims } = useLaunchpad();
  const { requests: leave } = useLeave();
  const { people } = useOrg();
  const { invoices: staffInvoices } = useInvoices();
  const payRun = useRun();
  const dash = dashboardById(dashboardId);
  const brief = JARVIS[dash.id];

  const [open, setOpen] = React.useState(false);
  const [arriving, setArriving] = React.useState(false);
  /** Bumped on hover / keyboard focus: each bump plays exactly one beat. */
  const [beat, setBeat] = React.useState(0);
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
  const fabRef = React.useRef<HTMLButtonElement>(null);
  const wasOpen = React.useRef(false);

  // Always answer from the CURRENT data, even for a reply that lands later.
  const ctx: JarvisContext = {
    jobs,
    notifications,
    reviewItems,
    submissionDocs,
    submissionStatus,
    leave,
    invoices,
    claims,
    staffInvoices,
    people,
    payRun,
  };
  const ctxRef = React.useRef<JarvisContext>(ctx);
  ctxRef.current = ctx;

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // The arrival: once per browser session, after first paint, then never again.
  React.useEffect(() => {
    if (arrivalPending === null) {
      arrivalPending = false;
      try {
        if (sessionStorage.getItem(ARRIVED_KEY) !== "1") {
          sessionStorage.setItem(ARRIVED_KEY, "1");
          arrivalPending = true;
        }
      } catch {
        // Storage blocked: skip the arrival rather than replay it every load.
      }
    }
    if (!arrivalPending) return;
    setArriving(true);
    const t = setTimeout(() => {
      arrivalPending = false;
      setArriving(false);
    }, ARRIVAL_MS);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [msgs, reduce]);

  React.useEffect(() => {
    if (open) {
      wasOpen.current = true;
      // Opening ends any arrival or beat; the mark comes back at rest.
      arrivalPending = false;
      setArriving(false);
      setBeat(0);
      const t = setTimeout(() => inputRef.current?.focus(), 140);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => {
        clearTimeout(t);
        window.removeEventListener("keydown", onKey);
      };
    }
    // Closing hands focus back to the chat head it came from.
    if (wasOpen.current) {
      wasOpen.current = false;
      fabRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  /** One lub-dub on hover or keyboard focus, never during the arrival or while open. */
  const beatOnce = () => {
    if (open || arriving || reduce) return;
    setBeat((n) => n + 1);
  };

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
            id="jarvis-panel"
            role="dialog"
            aria-label={`Jarvis, ${dash.label} assistant`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE_SWAP }}
            // Anchored above the chat head (Penny's bottom-[6.5rem]) so its X stays in view.
            // z-30: under the mobile drawer (z-50) and its scrim (z-40), and under dialogs.
            className="fixed right-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] z-30 flex h-[min(560px,calc(100dvh-7.5rem-env(safe-area-inset-bottom,0px)))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl shadow-black/20 sm:right-6"
          >
            {/* Header — the dashboard's tone as a flat fill. */}
            <div className="flex shrink-0 items-start justify-between gap-3 bg-tone-fill px-4 py-3 text-tone-on-fill">
              <div className="flex min-w-0 items-center gap-2.5">
                {/* Charcoal mark on the 300 tints; on the charcoal dashboards' fill
                    (charcoal in light, silver in dark) the opposite colourway. */}
                <span className="flex size-8 shrink-0" aria-hidden>
                  {dash.tone === "charcoal" ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/brand/locale-mark-silver.svg" alt="" className="size-8 dark:hidden" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/brand/locale-mark-charcoal.svg" alt="" className="hidden size-8 dark:block" />
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/brand/locale-mark-charcoal.svg" alt="" className="size-8" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-tight font-semibold">Jarvis</p>
                  {/* Wraps rather than truncates: two lines at most at this width. */}
                  <p className="mt-0.5 text-xs leading-snug text-pretty opacity-80">
                    {dash.label} · {brief.subtitle}
                  </p>
                </div>
              </div>
              <div className="-mr-1.5 flex shrink-0 items-center gap-0.5">
                {msgs.length > 0 ? (
                  <HeaderButton
                    onClick={() => setFaqOpen((v) => !v)}
                    pressed={faqOpen}
                    label={faqOpen ? "Back to the chat" : `${dash.label} FAQ`}
                  >
                    <ListChecks className="size-4" aria-hidden />
                  </HeaderButton>
                ) : null}
                {msgs.length > 0 ? (
                  <HeaderButton onClick={clear} label="Clear chat">
                    <Trash2 className="size-4" aria-hidden />
                  </HeaderButton>
                ) : null}
                {/* No X here: the chat head below is the close control, as in Penny. */}
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
                      className="inline-flex items-center gap-1 self-start text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden /> Back to the chat
                    </button>
                  )}
                  <FaqList id={dash.id} label={dash.label} asked={asked} onAsk={send} />
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
                      <div className="max-w-[82%] rounded-2xl rounded-br-md bg-tone-fill px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap text-tone-on-fill shadow-sm">
                        {m.text}
                      </div>
                    ) : (
                      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-card-foreground shadow-sm">
                        {m.pending ? (
                          <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                            <span className="inline-flex gap-0.5" aria-hidden>
                              {[0, 1, 2].map((d) => (
                                <span key={d} className="jarvis-dot size-1 rounded-full bg-current" style={{ animationDelay: `${d * 0.15}s` }} />
                              ))}
                            </span>
                            Reading your data…
                          </span>
                        ) : (
                          <AnswerBody answer={m.answer ?? { text: m.text }} onFollow={follow} />
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
                              className={cn("rounded-full border px-2.5 py-1 text-left text-xs transition disabled:opacity-50", CHIP)}
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
              <div className="flex items-end gap-2 rounded-xl border border-input bg-card px-2.5 py-1.5 focus-within:border-tone-strong focus-within:ring-2 focus-within:ring-ring/30 dark:bg-white/[0.03]">
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
                  className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-foreground outline-none placeholder:text-subtle-foreground"
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="size-4" aria-hidden />
                </button>
              </div>
              <p className="mt-1 px-1 text-xs text-subtle-foreground">
                Jarvis answers from the figures on this dashboard. Check anything important.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* The chat head, built like Penny's: the Locale mark floating free in a
          64px hit area, with no disc behind it. While the panel is open it
          becomes the close control (a 64px circle with an X). z-30 keeps it
          under the mobile drawer (z-50), its scrim (z-40) and dialogs; the
          bottom offset clears the home indicator on notched phones. */}
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") beatOnce();
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) beatOnce();
        }}
        aria-label={open ? "Close Jarvis" : `Ask Jarvis about ${dash.label}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? "jarvis-panel" : undefined}
        className="group fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] z-30 flex h-16 w-16 items-center justify-center rounded-full transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-90 motion-reduce:transition-none sm:right-6"
      >
        <style>{KEYFRAMES}</style>
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: reduce ? 0 : 0.15 }}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-popover shadow-lg shadow-black/20"
            >
              <X className="h-7 w-7 text-tone-ink" aria-hidden />
            </motion.span>
          ) : (
            <motion.span
              key="mark"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: EASE_SWAP }}
              className="relative flex h-16 w-16 items-center justify-center"
            >
              {/* Penny's halo (two staggered rings), in the dashboard tone. Arrival only. */}
              {arriving && !reduce ? (
                <>
                  <span
                    aria-hidden
                    className="jarvis-ring absolute h-[3.25rem] w-[3.25rem] rounded-full bg-tone-strong/45 blur-md"
                    style={{ animation: `jarvisHalo ${HALO_S}s ease-out ${ARRIVAL_RINGS}` }}
                  />
                  <span
                    aria-hidden
                    className="jarvis-ring absolute h-[3.25rem] w-[3.25rem] rounded-full bg-tone-strong/40"
                    style={{ animation: `jarvisHalo ${HALO_S}s ease-out ${ARRIVAL_RINGS} 0.35s backwards` }}
                  />
                </>
              ) : null}
              {/* The mark, beating: three times on arrival, once per hover or focus. The
                  key restarts the CSS animation for each new beat. */}
              <span
                key={arriving ? "arrive" : `beat-${beat}`}
                aria-hidden
                className="jarvis-mark relative flex h-11 w-11"
                style={
                  reduce || (!arriving && beat === 0)
                    ? undefined
                    : {
                        animation: `jarvisHeartbeat ${BEAT_S}s ease-in-out ${arriving ? ARRIVAL_BEATS : 1}`,
                        transformOrigin: "center",
                      }
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/locale-mark-charcoal.svg"
                  alt=""
                  draggable={false}
                  className="h-11 w-11 object-contain drop-shadow-md dark:hidden"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/locale-mark-silver.svg"
                  alt=""
                  draggable={false}
                  className="hidden h-11 w-11 object-contain drop-shadow-md dark:block"
                />
              </span>
            </motion.span>
          )}
        </AnimatePresence>
        {/* A small label on hover or keyboard focus only; never at rest. */}
        {!open ? (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 right-full mr-1 -translate-y-1/2 translate-x-1 rounded-lg border border-border bg-popover px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-foreground opacity-0 shadow-md",
              "transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
              "group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
            )}
          >
            Ask Jarvis <span className="font-medium text-muted-foreground">· {dash.label}</span>
          </span>
        ) : null}
      </button>
    </>
  );
}

function HeaderButton({
  onClick,
  label,
  pressed,
  children,
}: {
  onClick: () => void;
  label: string;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-full opacity-80 transition outline-none hover:bg-tone-on-fill/10 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-tone-on-fill/40",
        pressed && "bg-tone-on-fill/10 opacity-100",
      )}
    >
      {children}
    </button>
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
  onAsk,
}: {
  id: ModuleId;
  label: string;
  asked: Set<string>;
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
              "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] shadow-xs transition",
              CHIP,
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

function AnswerBody({ answer, onFollow }: { answer: JarvisAnswer; onFollow: (href: string) => void }) {
  return (
    <div className="space-y-2">
      <p>{answer.text}</p>
      {answer.bullets?.length ? (
        <ul className="space-y-1 text-[13px] text-muted-foreground">
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
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-tone-ink transition hover:bg-tone-soft"
            >
              {a.label}
              <ArrowRight className="size-3" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
      {answer.source ? <p className="text-xs text-subtle-foreground">{answer.source}</p> : null}
    </div>
  );
}
