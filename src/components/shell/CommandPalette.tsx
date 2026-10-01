"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CornerDownLeft, ExternalLink, House, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { useLaunchpad } from "@/state/launchpad-store";
import type { Job, LotDetail } from "@/data/jobs";
import { CATEGORIES, CATEGORY_SLUGS } from "@/components/modules/knowledge/data";
import { DASHBOARDS, DASHBOARD_GROUPS, NOTIFICATIONS_HREF, NOTIFICATIONS_ICON, dashboardById, hrefFor } from "./dashboards";
import { TONES, type DashboardTone } from "./dashboard-tones";
import { useDashboardSwitch } from "./dashboard-switch";
import { SidebarFocusTile } from "./CollapsibleSidebarShell";

/**
 * The command palette: Ctrl+K / ⌘K from anywhere, or the rail's Search row.
 * One field finds dashboards, every rail section and nested view, jobs (by job
 * number, client, lot or estate) and Knowledge categories. Picking a result
 * goes through the shell's switch path, so a jump into another dashboard gets
 * the same loader and accent change as the picker.
 *
 * ARIA combobox + listbox (focus stays in the field; the highlighted option is
 * `aria-activedescendant`). Up / Down move, Enter opens, Escape closes; Tab is
 * trapped inside the dialog; focus goes back where it was. Empty query: the
 * last few picks, then every dashboard.
 */
const PICKS_KEY = "launchpad:palette-recent";
const PICKS_MAX = 5;
const LIMIT: Record<ResultGroup, number> = { dashboards: 12, sections: 8, jobs: 6, knowledge: 5 };
const GROUP_ORDER: ResultGroup[] = ["dashboards", "sections", "jobs", "knowledge"];
const GROUP_LABEL: Record<ResultGroup | "recent", string> = {
  recent: "Recent",
  dashboards: "Dashboards",
  sections: "Sections",
  jobs: "Jobs",
  knowledge: "Knowledge",
};

type ResultGroup = "dashboards" | "sections" | "jobs" | "knowledge";

interface PaletteItem {
  id: string;
  group: ResultGroup;
  label: string;
  /** Second line: where it lives ("HR", "Operations · Doc formatter", an address). */
  detail?: string;
  /** Job number, shown in mono before the label. */
  mono?: string;
  icon: LucideIcon;
  /** Whose accent the icon tile wears (the item's own dashboard, not the current one). */
  tone: DashboardTone;
  href: string;
  external?: boolean;
  /** Lower-cased text the query is matched against. */
  hay: string;
}

interface ResultSection {
  key: string;
  label: string;
  items: PaletteItem[];
}

/* ── Open state + the global shortcut ─────────────────────────────────────── */

interface PaletteCtx {
  open: boolean;
  openPalette: () => void;
  /** `toPage`: send focus to the page instead of back to where it was. */
  closePalette: (opts?: { toPage?: boolean }) => void;
  /** "Ctrl K", or "⌘K" on a Mac. */
  shortcut: string;
}

const Ctx = React.createContext<PaletteCtx | null>(null);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [mac, setMac] = React.useState(false);
  const openRef = React.useRef(false);
  const returnTo = React.useRef<HTMLElement | null>(null);
  openRef.current = open;

  // Platform label after mount, so the server and first client render agree.
  React.useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.userAgent)), []);

  const openPalette = React.useCallback(() => {
    if (openRef.current) return;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);

  const closePalette = React.useCallback((opts?: { toPage?: boolean }) => {
    if (!openRef.current) return;
    setOpen(false);
    const prev = returnTo.current;
    returnTo.current = null;
    const usable = prev && prev !== document.body && prev.isConnected && !prev.closest("[inert]");
    const target = !opts?.toPage && usable ? prev : document.getElementById("launchpad-scroll");
    target?.focus({ preventScroll: true });
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "k") return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      if (openRef.current) {
        e.preventDefault();
        closePalette();
        return;
      }
      // Another modal owns the keyboard: leave it alone.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      e.preventDefault();
      openPalette();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette, closePalette]);

  const value = React.useMemo<PaletteCtx>(
    () => ({ open, openPalette, closePalette, shortcut: mac ? "⌘K" : "Ctrl K" }),
    [open, openPalette, closePalette, mac],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCommandPalette(): PaletteCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useCommandPalette must be used inside <CommandPaletteProvider>");
  return v;
}

/* ── The rail's Search row ────────────────────────────────────────────────── */

export function PaletteTrigger({ collapsed }: { collapsed: boolean }) {
  const { open, openPalette, shortcut } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts="Control+K Meta+K"
      aria-label="Search Launchpad"
      data-rail-tip={`Search (${shortcut})`}
      className={cn(
        "group/row sb-row relative flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-muted-foreground",
        "bg-white ring-1 ring-zinc-200 ring-inset hover:bg-zinc-50 hover:text-foreground dark:bg-white/[0.03] dark:ring-white/10 dark:hover:bg-white/[0.06]",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        // Collapsed rail: no field chrome, just the icon in the column.
        collapsed && "md:bg-transparent! md:ring-0!",
      )}
    >
      <SidebarFocusTile collapsed={collapsed} hover />
      <Search className="relative size-[15px] shrink-0" aria-hidden />
      <span className="sb-collapse-fade flex-1 truncate">Search</span>
      <kbd className="sb-collapse-fade rounded border border-border bg-muted/70 px-1.5 font-sans text-[10px] leading-[18px] font-semibold text-muted-foreground">
        {shortcut}
      </kbd>
    </button>
  );
}

/* ── The palette ──────────────────────────────────────────────────────────── */

export function CommandPalette({ onNavigate }: { onNavigate?: () => void }) {
  const { open, closePalette, shortcut } = useCommandPalette();
  const { navigate, prefetch } = useDashboardSwitch();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const choose = (item: PaletteItem) => {
    rememberPick(item.id);
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    closePalette({ toPage: mobile && !item.external });
    if (item.external) {
      window.open(item.href, "_blank", "noopener,noreferrer");
      return;
    }
    onNavigate?.();
    navigate(item.href);
  };

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <PalettePanel key="palette" shortcut={shortcut} onClose={() => closePalette()} onChoose={choose} onPeek={prefetch} />
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function PalettePanel({
  shortcut,
  onClose,
  onChoose,
  onPeek,
}: {
  shortcut: string;
  onClose: () => void;
  onChoose: (item: PaletteItem) => void;
  onPeek: (href: string) => void;
}) {
  const reduce = useReducedMotion();
  const { jobs, lotDetails } = useLaunchpad();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  // The panel only ever renders on the client (portal after mount).
  const [picks] = React.useState(readPicks);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const uid = React.useId();
  const listId = `${uid}-list`;

  const all = React.useMemo(() => buildItems(jobs, lotDetails), [jobs, lotDetails]);
  const tokens = React.useMemo(() => tokenize(query), [query]);
  const sections = React.useMemo(() => search(all, tokens, picks), [all, tokens, picks]);
  const flat = React.useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const current = flat.length ? Math.min(active, flat.length - 1) : -1;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  React.useEffect(() => setActive(0), [query]);
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);
  React.useEffect(() => {
    if (current < 0) return;
    document.getElementById(optionId(current))?.scrollIntoView({ block: "nearest" });
    const item = flat[current];
    if (item && !item.external) onPeek(item.href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, flat]);

  const move = (delta: number) => {
    if (!flat.length) return;
    setActive((a) => (Math.min(a, flat.length - 1) + delta + flat.length) % flat.length);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "PageDown":
        e.preventDefault();
        move(5);
        break;
      case "PageUp":
        e.preventDefault();
        move(-5);
        break;
      case "Enter":
        e.preventDefault();
        if (current >= 0) onChoose(flat[current]);
        break;
    }
  };

  // Escape closes from anywhere in the dialog; Tab cycles inside it.
  const onPanelKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const stops = [...panelRef.current.querySelectorAll<HTMLElement>("input, button")];
    if (!stops.length) return;
    e.preventDefault();
    const at = stops.indexOf(document.activeElement as HTMLElement);
    stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus();
  };

  const fade = { duration: reduce ? 0 : 0.15 };
  let index = -1;

  return (
    <div className="fixed inset-0 z-[90]">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-charcoal/40 backdrop-blur-[2px] dark:bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: fade }}
        exit={{ opacity: 0, transition: fade }}
        onClick={onClose}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-3 pt-3 sm:pt-[min(12vh,7rem)]">
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Search Launchpad"
          onKeyDown={onPanelKey}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: reduce ? 0 : 0.18, ease: EASE_OUT } }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: reduce ? 0 : 0.12, ease: "easeIn" } }}
          className="pointer-events-auto flex max-h-[min(560px,calc(100dvh-1.5rem))] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl shadow-black/20"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls={listId}
              aria-activedescendant={current >= 0 ? optionId(current) : undefined}
              aria-autocomplete="list"
              aria-label="Search Launchpad"
              placeholder="Search dashboards, sections, jobs and articles"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="shrink-0 rounded-md border border-border px-1.5 font-sans text-[10px] leading-[20px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Esc
            </button>
          </div>

          {flat.length ? (
            <div
              id={listId}
              role="listbox"
              aria-label="Results"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin]"
            >
              {sections.map((s) => (
                <div key={s.key} role="group" aria-labelledby={`${uid}-${s.key}`} className="pb-1">
                  <div
                    id={`${uid}-${s.key}`}
                    className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase"
                  >
                    {s.label}
                  </div>
                  {s.items.map((item) => {
                    index += 1;
                    const i = index;
                    const on = i === current;
                    const Icon = item.icon;
                    return (
                      <div
                        key={`${s.key}:${item.id}`}
                        id={optionId(i)}
                        role="option"
                        aria-selected={on}
                        onPointerMove={() => {
                          if (!on) setActive(i);
                        }}
                        onClick={() => onChoose(item)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5",
                          on ? "bg-muted" : "bg-transparent",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", TONES[item.tone].listChip)}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-baseline gap-2">
                            {item.mono ? (
                              <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                                <Highlight text={item.mono} tokens={tokens} />
                              </span>
                            ) : null}
                            <span className="truncate text-[13px] font-medium text-foreground">
                              <Highlight text={item.label} tokens={tokens} />
                            </span>
                          </span>
                          {item.detail ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              <Highlight text={item.detail} tokens={tokens} />
                            </span>
                          ) : null}
                        </span>
                        {item.external ? (
                          <ExternalLink aria-hidden className="size-3.5 shrink-0 text-subtle-foreground" />
                        ) : on ? (
                          <CornerDownLeft aria-hidden className="size-3.5 shrink-0 text-subtle-foreground" />
                        ) : null}
                        {item.external ? <span className="sr-only">(opens in a new tab)</span> : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No matches for &ldquo;{query.trim()}&rdquo;</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a job number, a client, an estate or a section name.</p>
            </div>
          )}

          <div className="hidden shrink-0 items-center gap-4 border-t border-hairline bg-canvas/60 px-4 py-2 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to move
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Enter</Kbd> to open
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Esc</Kbd> to close
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Kbd>{shortcut}</Kbd> from anywhere
            </span>
          </div>
          <p className="sr-only" aria-live="polite">
            {query.trim() ? (flat.length ? `${flat.length} results` : "No results") : ""}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center rounded border border-border bg-popover px-1 font-sans text-[10px] leading-[16px] font-semibold text-muted-foreground">
      {children}
    </kbd>
  );
}

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens.length) return <>{text}</>;
  const re = new RegExp(`(${tokens.map(escapeRe).join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[3px] bg-tone-tint text-inherit">
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

/* ── The index ────────────────────────────────────────────────────────────── */

const hay = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ").toLowerCase();

function buildItems(jobs: Job[], lots: Record<number, LotDetail>): PaletteItem[] {
  const items: PaletteItem[] = [];

  // In picker order: by sub-brand.
  for (const g of DASHBOARD_GROUPS) {
    for (const d of g.dashboards) {
      items.push({ id: `dash:${d.id}`, group: "dashboards", label: d.label, detail: g.label, icon: d.icon, tone: d.tone, href: d.href, hay: hay(d.label, d.title, g.label) });
    }
  }

  for (const d of DASHBOARDS) {
    // Knowledge's rail items ARE its categories: they get their own group below.
    if (d.id === "knowledge") continue;
    for (const item of d.items) {
      items.push({ id: `nav:${item.key}`, group: "sections", label: item.label, detail: d.label, icon: item.icon, tone: d.tone, href: hrefFor(d, item), hay: hay(item.label, d.label) });
      for (const child of item.children ?? []) {
        items.push({
          id: `nav:${child.key}`,
          group: "sections",
          label: child.label,
          detail: `${d.label} · ${item.label}`,
          icon: child.icon,
          tone: d.tone,
          href: hrefFor(d, child),
          hay: hay(child.label, item.label, d.label),
        });
      }
    }
    for (const l of d.links ?? []) {
      items.push({ id: `link:${l.href}`, group: "sections", label: l.label, detail: `${d.label} · opens in a new tab`, icon: l.icon, tone: d.tone, href: l.href, external: true, hay: hay(l.label, d.label) });
    }
  }
  items.push({ id: "nav:inbox:notifications", group: "sections", label: "Notifications", detail: "Inbox", icon: NOTIFICATIONS_ICON, tone: "charcoal", href: NOTIFICATIONS_HREF, hay: hay("notifications inbox alerts") });

  for (const j of jobs) {
    const lot = lots[j.id];
    const where = j.address.replace(/,?\s+WA\s+\d{4}$/, "");
    items.push({
      id: `job:${j.id}`,
      group: "jobs",
      label: j.client,
      mono: j.jobNo || "New",
      detail: lot?.estate ? `${where} · ${lot.estate}` : where,
      icon: House,
      tone: "haven",
      href: `/operations/jobs/${j.id}`,
      hay: hay(j.client, j.jobNo, j.address, lot?.estate, lot?.suburb, lot?.lot, j.builder),
    });
  }

  const kb = dashboardById("knowledge");
  for (const c of CATEGORIES) {
    const slug = CATEGORY_SLUGS[c.name];
    items.push({
      id: `kb:${slug}`,
      group: "knowledge",
      label: c.name,
      detail: `${c.count} articles`,
      icon: c.icon,
      tone: kb.tone,
      href: hrefFor(kb, { key: `knowledge:${slug}`, label: c.name, icon: c.icon, params: { cat: slug } }),
      hay: hay(c.name, "knowledge articles"),
    });
  }
  return items;
}

function tokenize(q: string): string[] {
  return [...new Set(q.toLowerCase().split(/\s+/).filter(Boolean))];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 0 = no match. Every token must match somewhere; label hits outrank detail hits. */
function scoreItem(item: PaletteItem, tokens: string[]): number {
  const label = item.label.toLowerCase();
  const mono = (item.mono ?? "").toLowerCase();
  let total = 0;
  for (const t of tokens) {
    let s: number;
    if (label === t || mono === t) s = 6;
    else if (label.startsWith(t) || mono.startsWith(t)) s = 5;
    else if (label.includes(` ${t}`)) s = 4;
    else if (label.includes(t)) s = 3;
    else if (item.hay.startsWith(t) || item.hay.includes(` ${t}`)) s = 2;
    else if (item.hay.includes(t)) s = 1;
    else return 0;
    total += s;
  }
  return total;
}

function search(all: PaletteItem[], tokens: string[], picks: string[]): ResultSection[] {
  if (!tokens.length) {
    const recent = picks.map((id) => all.find((it) => it.id === id)).filter((it): it is PaletteItem => Boolean(it));
    const sections: ResultSection[] = [];
    if (recent.length) sections.push({ key: "recent", label: GROUP_LABEL.recent, items: recent });
    sections.push({ key: "dashboards", label: GROUP_LABEL.dashboards, items: all.filter((it) => it.group === "dashboards") });
    return sections;
  }
  const scored = all
    .map((item, order) => ({ item, order, score: scoreItem(item, tokens) }))
    .filter((r) => r.score > 0);
  const sections = GROUP_ORDER.map((group) => {
    const rows = scored
      .filter((r) => r.item.group === group)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .slice(0, LIMIT[group]);
    return { group, best: rows[0]?.score ?? 0, rows };
  })
    .filter((g) => g.rows.length)
    // The group holding the best match leads, so Enter takes the best match.
    .sort((a, b) => b.best - a.best || GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  return sections.map((g) => ({ key: g.group, label: GROUP_LABEL[g.group], items: g.rows.map((r) => r.item) }));
}

function readPicks(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PICKS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, PICKS_MAX) : [];
  } catch {
    return [];
  }
}

function rememberPick(id: string) {
  try {
    const next = [id, ...readPicks().filter((x) => x !== id)].slice(0, PICKS_MAX);
    localStorage.setItem(PICKS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: recents just don't persist */
  }
}
