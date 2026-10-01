/**
 * Motion constants — the Simple HRIS set (ui-standards § 14). Use these; do not
 * introduce new curves or springs.
 */

/** Refined ease-out — most enter / settle animations. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Dialog enter, tab swap, page enter, sliding indicators. */
export const EASE_SWAP = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  /** Element fade-in on mount. */
  fade: 0.24,
  /** Tab swap cross-fade / page enter. */
  swap: 0.28,
  /** Sliding tab indicator. */
  indicator: 0.28,
  /** Dialog open. */
  dialogIn: 0.32,
  /** Dialog close. */
  dialogOut: 0.18,
  /** Bar / progress fill. */
  fill: 0.85,
} as const;

/** Card hover lift (§ 14.4). */
export const LIFT_SPRING = { type: "spring", stiffness: 320, damping: 24 } as const;

/**
 * Capped per-row stagger (§ 14.3) — a long list never takes seconds to reveal.
 * Returns 0 under reduced motion.
 */
export function rowDelay(index: number, reduce: boolean | null, step = 0.025, cap = 0.2): number {
  if (reduce) return 0;
  return Math.min(index * step, cap);
}

/**
 * Dashboard section swap — the HRIS main-content animator (§ 1.1: rise 10px in,
 * lift 8px out, 0.28s). Direction-aware for the rail: moving DOWN the nav, the
 * new section rises from below; moving up, it drops in from above.
 */
export const RISE_VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, y: dir >= 0 ? 10 : -10 }),
  center: { opacity: 1, y: 0 },
  exit: (dir: number) => ({ opacity: 0, y: dir >= 0 ? -8 : 8 }),
};

/** Directional sideways slide for an in-page step flow (§ 11.1). */
export const PANEL_VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -28 : 28 }),
};
