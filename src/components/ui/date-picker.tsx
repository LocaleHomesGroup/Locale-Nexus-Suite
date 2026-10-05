"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP } from "@/lib/motion";

/**
 * DatePicker — HRIS's single-date picker (`simple-hris/components/ui/date-picker.tsx`)
 * in Launchpad tokens: a trigger shaped like SmoothSelect's that opens a month
 * calendar, with roving arrow-key focus, a today marker, an optional min/max
 * and quick picks. Weeks start on Monday (Australia). Values are ISO
 * "YYYY-MM-DD" strings in local time; no date library.
 *
 * The panel is portalled and fixed to the trigger, so a Dialog's scrolling body
 * never clips it. It opens below, flips above when there's no room, and stays
 * inside the viewport. Escape closes the panel, not the dialog beneath it.
 *
 *   <DatePicker value={iso} onChange={setIso} min={todayIso} presets={[{ label: "Today", iso: todayIso }]} />
 */

const p2 = (n: number) => String(n).padStart(2, "0");
export const toIso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export function fromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** "2026-10-12" → "Mon 12 Oct 2026". */
export function formatDayLong(iso: string): string {
  const d = fromIso(iso);
  return d ? `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}` : iso;
}

export interface DatePreset {
  label: string;
  iso: string;
}

/** Month slides sideways the way you're paging, like the list pager (§ 11.1). */
const SLIDE = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -24 : 24 }),
};

const NAV =
  "flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45 disabled:pointer-events-none disabled:opacity-35";

/** The month grid on its own, for a picker panel or inline use. */
export function Calendar({
  value,
  onChange,
  min,
  max,
  presets,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  presets?: DatePreset[];
  autoFocus?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const todayIso = toIso(new Date());
  const isDisabled = React.useCallback((iso: string) => Boolean((min && iso < min) || (max && iso > max)), [min, max]);
  const anchor = value && fromIso(value) ? value : min && todayIso < min ? min : todayIso;

  const [month, setMonth] = React.useState(() => startOfMonth(fromIso(anchor)!));
  const [dir, setDir] = React.useState(1);
  const [focusIso, setFocusIso] = React.useState(anchor);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const monthKey = toIso(month);

  const cells = React.useMemo(() => {
    const first = startOfMonth(month);
    const start = addDays(first, -((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const focusCell = React.useCallback((key: string, iso: string) => {
    requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLButtonElement>(`[data-month="${key}"] [data-iso="${iso}"]`)?.focus(),
    );
  }, []);

  React.useEffect(() => {
    if (autoFocus) focusCell(monthKey, focusIso);
    // Only on mount: later moves focus from the key handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showMonth = (target: Date) => {
    const next = startOfMonth(target);
    setDir(next > month ? 1 : -1);
    setMonth(next);
    return toIso(next);
  };

  // Paging keeps the same day of the month, so a keyboard user lands somewhere sensible.
  const page = (n: number) => {
    const next = addMonths(month, n);
    const day = Math.min(fromIso(focusIso)?.getDate() ?? 1, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
    setDir(n);
    setMonth(next);
    setFocusIso(toIso(new Date(next.getFullYear(), next.getMonth(), day)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const cur = fromIso(focusIso);
    if (!cur) return;
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cur, -1),
      ArrowRight: () => addDays(cur, 1),
      ArrowUp: () => addDays(cur, -7),
      ArrowDown: () => addDays(cur, 7),
      PageUp: () => new Date(cur.getFullYear(), cur.getMonth() - 1, cur.getDate()),
      PageDown: () => new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()),
      Home: () => addDays(cur, -((cur.getDay() + 6) % 7)),
      End: () => addDays(cur, 6 - ((cur.getDay() + 6) % 7)),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const target = move();
    const iso = toIso(target);
    if (isDisabled(iso)) return;
    const key = sameMonth(target, month) ? monthKey : showMonth(target);
    setFocusIso(iso);
    focusCell(key, iso);
  };

  const prevDisabled = Boolean(min && toIso(addDays(month, -1)) < min);
  const nextDisabled = Boolean(max && toIso(addMonths(month, 1)) > max);

  return (
    <div ref={rootRef} className={cn("w-[17.5rem] select-none", className)}>
      <div className="flex items-center gap-2 pb-2">
        <button type="button" aria-label="Previous month" disabled={prevDisabled} onClick={() => page(-1)} className={NAV}>
          <ChevronLeft className="size-4" />
        </button>
        <div className="relative h-5 flex-1 overflow-hidden text-center">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.p
              key={monthKey}
              custom={dir}
              variants={SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
              className="text-[13px] font-semibold"
              aria-live="polite"
            >
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </motion.p>
          </AnimatePresence>
        </div>
        <button type="button" aria-label="Next month" disabled={nextDisabled} onClick={() => page(1)} className={NAV}>
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 pb-1 text-center text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
        {DOW.map((d) => (
          <span key={d} aria-hidden>
            {d}
          </span>
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={monthKey}
            data-month={monthKey}
            custom={dir}
            variants={SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE_SWAP }}
            onKeyDown={onKeyDown}
            className="grid grid-cols-7 gap-y-0.5"
          >
            {cells.map((d) => {
              const iso = toIso(d);
              const inMonth = sameMonth(d, month);
              const disabled = isDisabled(iso);
              const selected = iso === value;
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  data-iso={iso}
                  disabled={disabled}
                  tabIndex={iso === focusIso && inMonth ? 0 : -1}
                  aria-label={`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`}
                  aria-pressed={selected}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => onChange(iso)}
                  onFocus={() => setFocusIso(iso)}
                  className={cn(
                    "relative flex h-9 items-center justify-center rounded-lg text-[13px] tabular-nums outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
                    selected
                      ? "bg-tone-fill font-semibold text-tone-on-fill shadow-sm"
                      : disabled
                        ? "cursor-not-allowed text-subtle-foreground/40"
                        : cn(
                            "hover:bg-tone-soft",
                            inMonth ? "text-foreground" : "text-subtle-foreground/70",
                            isToday && "font-semibold text-tone-ink",
                          ),
                  )}
                >
                  {d.getDate()}
                  {isToday ? (
                    <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-current opacity-80" />
                  ) : null}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {presets?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-hairline pt-2.5">
          {presets.map((p) => {
            const on = p.iso === value;
            return (
              <button
                key={p.label}
                type="button"
                disabled={isDisabled(p.iso)}
                aria-pressed={on}
                onClick={() => onChange(p.iso)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/45 disabled:pointer-events-none disabled:opacity-40",
                  on
                    ? "border-tone-strong bg-tone-soft text-tone-ink"
                    : "border-border bg-card text-foreground/80 hover:border-tone-line hover:bg-tone-soft/70 dark:bg-white/[0.03]",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const PANEL_WIDTH = 304;
const PANEL_GAP = 6;
const EDGE = 12;

export function DatePicker({
  value,
  onChange,
  min,
  max,
  presets,
  placeholder = "Pick a date",
  id,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  presets?: DatePreset[];
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [pos, setPos] = React.useState<{ left: number; top?: number; bottom?: number; up: boolean } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  const place = React.useCallback(() => {
    const t = triggerRef.current?.getBoundingClientRect();
    if (!t) return;
    const height = panelRef.current?.offsetHeight ?? 380;
    const below = window.innerHeight - t.bottom;
    const up = below < height + PANEL_GAP + EDGE && t.top > below;
    const left = Math.max(EDGE, Math.min(t.left, window.innerWidth - PANEL_WIDTH - EDGE));
    setPos(up ? { left, bottom: window.innerHeight - t.top + PANEL_GAP, up } : { left, top: t.bottom + PANEL_GAP, up });
  }, []);

  const close = React.useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  React.useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    // Capture phase, and stop it there: Escape closes this panel, not the Dialog listening on document.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, close]);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-card px-2.5 text-left text-sm text-foreground shadow-xs outline-none hover:border-tone-line focus-visible:border-tone-strong focus-visible:ring-3 focus-visible:ring-tone-line/45 dark:bg-white/[0.03] dark:hover:border-tone-line",
          open && "border-tone-strong",
          className,
        )}
      >
        <CalendarDays className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
        <span className={cn("min-w-0 flex-1 truncate tabular-nums", !value && "text-subtle-foreground")}>
          {value ? formatDayLong(value) : placeholder}
        </span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-subtle-foreground transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {mounted
        ? createPortal(
            <AnimatePresence>
              {open && pos ? (
                <motion.div
                  ref={panelRef}
                  role="dialog"
                  aria-label={ariaLabel ?? "Choose a date"}
                  initial={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: reduce ? 0 : 0.18, ease: EASE_SWAP } }}
                  exit={{ opacity: 0, y: reduce ? 0 : pos.up ? 4 : -4, scale: reduce ? 1 : 0.97, transition: { duration: reduce ? 0 : 0.12 } }}
                  style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: PANEL_WIDTH }}
                  className={cn(
                    "fixed z-[90] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl",
                    pos.up ? "origin-bottom-left" : "origin-top-left",
                  )}
                >
                  <Calendar
                    value={value}
                    min={min}
                    max={max}
                    presets={presets}
                    autoFocus
                    className="w-full"
                    onChange={(iso) => {
                      onChange(iso);
                      close(true);
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
