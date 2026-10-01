"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_SWAP } from "@/lib/motion";

/**
 * Dialog — HRIS § 10: opens on a 0.94 zoom + rise over 320ms on the dialog ease,
 * closes over 180ms. The backdrop is branded (charcoal → deep Haven, blurred).
 * Escape backs out one layer; the backdrop closes unless `dismissible={false}`
 * (use that while a write is in flight, § 10.1).
 *
 *   <Dialog open={open} onClose={() => setOpen(false)} title="Resolve conflict"
 *     icon={AlertTriangle} description="…" size="md"
 *     footer={<><Button variant="outline">Cancel</Button><Button>Confirm</Button></>}>
 *     body
 *   </Dialog>
 *
 * Confirmation dialogs: an icon, a description that names the side effects (not
 * "Are you sure?"), an outline Cancel and a tinted confirm.
 */
const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-[480px]",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  iconTone = "haven",
  size = "md",
  dismissible = true,
  footer,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  iconTone?: "haven" | "problem" | "pending" | "ok" | "charcoal";
  size?: keyof typeof SIZES;
  dismissible?: boolean;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  // Callers usually pass an inline arrow; keep it in a ref so the focus effect
  // below runs once per open, not on every render (which would steal focus
  // from whatever field the user is typing in).
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], input, textarea, select, button:not([data-dialog-close])",
      );
      (first ?? panelRef.current)?.focus();
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      previous?.focus?.();
    };
  }, [open, dismissible]);

  if (!mounted) return null;

  const iconClass = {
    // "haven" is the accent slot: it follows the dashboard's tone.
    haven: "bg-tone-fill text-tone-on-fill shadow-black/10",
    problem: "bg-rose-600 text-white shadow-rose-500/25",
    pending: "bg-amber-500 text-white shadow-amber-500/25",
    ok: "bg-emerald-600 text-white shadow-emerald-500/25",
    charcoal: "bg-charcoal text-haven-300 shadow-black/20 dark:bg-zinc-700",
  }[iconTone];

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-charcoal/55 backdrop-blur-[2px] dark:bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={dismissible ? onClose : undefined}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
              "relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none sm:max-h-[90dvh]",
              SIZES[size],
              className,
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: reduce ? 0 : DURATION.dialogIn, ease: EASE_SWAP } }}
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, scale: 0.97, transition: { duration: DURATION.dialogOut, ease: "easeIn" } }
            }
          >
            <div className="flex shrink-0 items-start gap-3 border-b border-hairline px-5 pt-5 pr-12 pb-4">
              {Icon ? (
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
                    iconClass,
                  )}
                  aria-hidden
                >
                  <Icon className="size-4.5" />
                </span>
              ) : null}
              <div className="min-w-0">
                <h2 id={titleId} className="font-heading text-[17px] leading-snug font-bold">
                  {title}
                </h2>
                {description ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
                ) : null}
              </div>
            </div>
            {dismissible ? (
              <button
                type="button"
                data-dialog-close
                onClick={onClose}
                aria-label="Close"
                className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-lg text-subtle-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
            {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
            {footer ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-hairline bg-canvas/70 px-5 py-3">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
