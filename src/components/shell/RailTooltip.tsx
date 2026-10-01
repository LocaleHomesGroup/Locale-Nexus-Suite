"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * Labels for the collapsed rail's icon column. Any control in the rail can opt
 * in with `data-rail-tip="Label"`; one delegated listener shows the label to
 * the right of the rail on pointer hover (after a short delay) AND on keyboard
 * focus (`:focus-visible`, at once), which the native `title` tooltip never
 * did. Escape, a press, a scroll or leaving the control hides it.
 *
 * Controls that only have a `title` (the Switch view rows) get the label on
 * keyboard focus too, never on hover, where the browser already shows the
 * title.
 *
 * Visual only (`aria-hidden`): every opted-in control already carries the same
 * words as its accessible name.
 */
const HOVER_DELAY_MS = 120;

interface Tip {
  label: string;
  top: number;
  left: number;
}

export function RailTooltip({ railId, enabled }: { railId: string; enabled: boolean }) {
  const reduce = useReducedMotion();
  const [tip, setTip] = React.useState<Tip | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const rail = document.getElementById(railId);
    if (!rail || !enabled) {
      setTip(null);
      return;
    }
    const desktop = window.matchMedia("(min-width: 768px)");
    let timer: ReturnType<typeof setTimeout> | undefined;

    const show = (el: HTMLElement, label: string | undefined) => {
      if (!label || !desktop.matches) return;
      const r = el.getBoundingClientRect();
      const railBox = rail.getBoundingClientRect();
      setTip({ label, top: r.top + r.height / 2, left: railBox.right + 10 });
    };
    const hide = () => {
      clearTimeout(timer);
      setTip(null);
    };
    const tipTarget = (e: Event, selector = "[data-rail-tip]") =>
      (e.target as Element | null)?.closest?.<HTMLElement>(selector) ?? null;

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = tipTarget(e);
      if (!el) return;
      clearTimeout(timer);
      timer = setTimeout(() => show(el, el.dataset.railTip), HOVER_DELAY_MS);
    };
    const onOut = (e: PointerEvent) => {
      const el = tipTarget(e);
      if (el && el.contains(e.relatedTarget as Node | null)) return;
      if (el && el.matches(":focus-visible")) return;
      hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = tipTarget(e, "[data-rail-tip], [title]");
      if (el && el.matches(":focus-visible")) {
        clearTimeout(timer);
        show(el, el.dataset.railTip ?? el.title);
      } else hide();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    rail.addEventListener("pointerover", onOver);
    rail.addEventListener("pointerout", onOut);
    rail.addEventListener("pointerdown", hide);
    rail.addEventListener("focusin", onFocusIn);
    rail.addEventListener("focusout", hide);
    rail.addEventListener("scroll", hide, true);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      rail.removeEventListener("pointerover", onOver);
      rail.removeEventListener("pointerout", onOut);
      rail.removeEventListener("pointerdown", hide);
      rail.removeEventListener("focusin", onFocusIn);
      rail.removeEventListener("focusout", hide);
      rail.removeEventListener("scroll", hide, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [railId, enabled]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {tip ? (
        <motion.div
          key="rail-tip"
          aria-hidden
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.08 } }}
          transition={{ duration: reduce ? 0 : 0.14, ease: "easeOut" }}
          style={{ top: tip.top, left: tip.left }}
          className="pointer-events-none fixed z-[75] -mt-3.5 flex h-7 items-center rounded-md bg-charcoal px-2.5 text-xs font-medium whitespace-nowrap text-white shadow-lg shadow-black/15 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {tip.label}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
