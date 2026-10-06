"use client";

import * as React from "react";
import { animate, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";

/** A card follows the pointer only after this much travel, so a click still opens it (HRIS: 5px). */
const ACTIVATE_PX = 5;

export interface BoardDrag<K extends string> {
  /** The card being carried, and its width for the overlay. Stays set through the drop flight. */
  active: { id: string; width: number } | null;
  /** The column under the pointer while carrying. */
  over: K | null;
  /** True while the overlay flies into its slot after the drop. */
  dropping: boolean;
  /** Overlay position (viewport px). */
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** Spread onto a card: starts a drag on a mouse or pen press. */
  start: (e: React.PointerEvent<HTMLElement>, id: string, from: K) => void;
  /** Browsers fire a click on the card right after a drop; check this before opening it. */
  wasJustDropped: () => boolean;
}

/**
 * Pointer drag for a column board, HRIS TicketsBoard's feel without dnd-kit:
 * the card lifts into an overlay that follows the pointer, the column under it
 * lights up, `onHover` lets the board slot the card into that column at once so
 * it reflows under the pointer, and on release the overlay glides into the
 * card's new slot. Escape, or letting go outside every column, puts it back.
 *
 * Touch is left to scrolling: on a phone, tap the card and change its stage.
 */
export function useBoardDrag<K extends string>({
  columnAt,
  onHover,
  onDrop,
}: {
  /** The column under a viewport point, or null. */
  columnAt: (x: number, y: number) => K | null;
  onHover: (id: string, column: K) => void;
  /** `to` is null when the drag was cancelled. */
  onDrop: (id: string, from: K, to: K | null) => void;
}): BoardDrag<K> {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [active, setActive] = React.useState<{ id: string; width: number } | null>(null);
  const [over, setOver] = React.useState<K | null>(null);
  const [dropping, setDropping] = React.useState(false);
  const justDropped = React.useRef(false);
  const cleanup = React.useRef<(() => void) | null>(null);

  // Latest callbacks, so a drag that started a render ago still calls the current ones.
  const cb = React.useRef({ columnAt, onHover, onDrop });
  cb.current = { columnAt, onHover, onDrop };

  React.useEffect(() => () => cleanup.current?.(), []);

  const start = React.useCallback(
    (e: React.PointerEvent<HTMLElement>, id: string, from: K) => {
      if (e.button !== 0 || e.pointerType === "touch" || cleanup.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const origin = { x: e.clientX, y: e.clientY };
      const grab = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      let started = false;
      let current: K | null = from;

      const settle = (to: K | null) => {
        justDropped.current = true;
        window.setTimeout(() => (justDropped.current = false), 150);
        cb.current.onDrop(id, from, to);
        setOver(null);
        // Fly the overlay into wherever the card now sits (its slot in the new
        // column, or back home), then hand back to the card.
        requestAnimationFrame(() => {
          const slot = document.querySelector<HTMLElement>(`[data-deal-card="${CSS.escape(id)}"]`);
          const target = to ? slot?.getBoundingClientRect() : rect;
          if (!target || reduce) {
            setActive(null);
            return;
          }
          setDropping(true);
          const ease = [0.2, 0, 0, 1] as const;
          Promise.all([
            animate(x, target.left, { duration: 0.22, ease }),
            animate(y, target.top, { duration: 0.22, ease }),
          ]).then(() => {
            setDropping(false);
            setActive(null);
          });
        });
      };

      const onMove = (ev: PointerEvent) => {
        if (!started) {
          if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < ACTIVATE_PX) return;
          started = true;
          setActive({ id, width: rect.width });
          setOver(from);
          document.body.style.userSelect = "none";
          document.body.style.cursor = "grabbing";
        }
        x.set(ev.clientX - grab.x);
        y.set(ev.clientY - grab.y);
        const hit = cb.current.columnAt(ev.clientX, ev.clientY);
        if (hit !== current) {
          current = hit;
          setOver(hit);
          if (hit) cb.current.onHover(id, hit);
        }
      };
      const finish = (to: K | null) => {
        cleanup.current?.();
        if (started) settle(to);
      };
      const onUp = () => finish(current);
      const onCancel = () => finish(null);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape" || !started) return;
        ev.preventDefault();
        ev.stopPropagation();
        finish(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
      cleanup.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey, true);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        cleanup.current = null;
      };
    },
    [reduce, x, y],
  );

  const wasJustDropped = React.useCallback(() => justDropped.current, []);

  return { active, over, dropping, x, y, start, wasJustDropped };
}
