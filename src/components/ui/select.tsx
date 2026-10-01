"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_SWAP } from "@/lib/motion";

/**
 * SmoothSelect — theme-aware single select (HRIS § 9.4). Use instead of a native
 * <select>, whose popup ignores the app theme. The menu animates in (180ms) and
 * out (120ms) with a 4px drift and 0.97 scale; opacity only under reduced motion.
 *
 *   <SmoothSelect value={builder} onChange={setBuilder} options={[{ value: "Forma", label: "Forma" }]} />
 */
export interface SelectOption<T extends string> {
  value: T;
  label: React.ReactNode;
  hint?: React.ReactNode;
}

export function SmoothSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  leading,
  size = "md",
  align = "start",
  className,
  id,
  ariaLabel,
}: {
  value: T | "";
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  /** Muted prefix inside the trigger, e.g. "Builder". */
  leading?: React.ReactNode;
  size?: "sm" | "md";
  align?: "start" | "end";
  className?: string;
  id?: string;
  ariaLabel?: string;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const current = options.find((o) => o.value === value);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openMenu = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[active];
      if (opt) onChange(opt.value);
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-input bg-card text-left text-foreground shadow-xs outline-none hover:border-tone-line focus-visible:border-tone-strong focus-visible:ring-3 focus-visible:ring-tone-line/45 dark:bg-white/[0.03] dark:hover:border-tone-line",
          size === "sm" ? "h-[26px] px-2 text-xs" : "h-8 px-2.5 text-sm",
        )}
      >
        {leading ? <span className="shrink-0 text-subtle-foreground">{leading}</span> : null}
        <span className={cn("min-w-0 flex-1 truncate", !current && "text-subtle-foreground")}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-subtle-foreground transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.ul
            id={listId}
            role="listbox"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: reduce ? 0 : 0.18, ease: EASE_SWAP } }}
            exit={{ opacity: 0, y: reduce ? 0 : -4, scale: reduce ? 1 : 0.97, transition: { duration: reduce ? 0 : 0.12 } }}
            className={cn(
              "absolute z-50 mt-1 max-h-64 min-w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg",
              align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            )}
          >
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] whitespace-nowrap",
                    i === active ? "bg-tone-soft text-foreground" : "text-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    {o.label}
                    {o.hint ? <span className="ml-2 text-xs text-subtle-foreground">{o.hint}</span> : null}
                  </span>
                  {selected ? <Check className="size-3.5 text-tone-ink" aria-hidden /> : null}
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
