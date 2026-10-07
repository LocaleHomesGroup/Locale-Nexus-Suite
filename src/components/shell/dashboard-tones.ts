/**
 * Per-dashboard accent — the Simple HRIS rule (ui-standards § 1.2): every
 * dashboard shares one shell, and the accent is the only thing that changes.
 * Locale's accents are its own sub-brand system:
 *
 *   haven     Locale Homes      — Home, Operations, Sales Manager; the Client and Sales Representative portals
 *   nectar    Locale Financial  — Finance, Accounts, Accounting
 *   skyblue   Locale Wealth     — Wealth
 *   charcoal  master brand      — Marketing, HR, Knowledge, Leadership, IT, Tickets, Admin;
 *                                 the Developer and Employee portals
 *
 * Flat fills only: the rail is a working surface, so it stays quiet and lets
 * the selected row carry the sub-brand. No gradients.
 *
 * Every value is a COMPLETE literal class string. Tailwind only generates
 * classes it can read verbatim in source, so these must never be built by
 * concatenating fragments (HRIS § 15.2).
 *
 * `tone-*` utilities (globals.css) always mean the CURRENT dashboard. Anything
 * that shows ANOTHER dashboard (switcher rows, palette rows, the switch loader)
 * must use that dashboard's entry here instead.
 */
export type DashboardTone = "haven" | "nectar" | "skyblue" | "charcoal";

export interface ToneClasses {
  /** Rail background + right border. Flat; the light tint is white with a breath of the 50 step. */
  rail: string;
  /** Hairline dividers inside the rail. */
  divider: string;
  /** Selected nav row. */
  navActive: string;
  navActiveIcon: string;
  /** Idle nav row hover. */
  navHover: string;
  /** Selected nested (child) row. */
  childActive: string;
  /** Small caps caption ink ("Launchpad", the user card's role line). */
  caption: string;
  /** Soft card chrome: the user card, the switcher box. */
  softCard: string;
  /** The current dashboard's row inside the view switcher. */
  switcherActive: string;
  /** This dashboard's icon colour when it is listed in the switcher. */
  switcherIcon: string;
  /** This dashboard's icon tile when it is listed in the command palette. */
  listChip: string;
  /** Collapse pull-tab accent. */
  pullTab: string;
  /** Mobile top bar border. */
  mobileBorder: string;
  /** Switch loader. */
  loader: {
    card: string;
    ring: string;
    emblem: string;
    eyebrow: string;
    status: string;
    dot: string;
    barTrack: string;
    barFill: string;
  };
}

export const TONES: Record<DashboardTone, ToneClasses> = {
  haven: {
    rail: "border-haven-100/80 bg-[#f9fdfc] dark:border-white/[0.06] dark:bg-[#111113]",
    divider: "border-haven-100/70 dark:border-white/[0.06]",
    navActive: "bg-haven-300 font-semibold text-haven-950",
    navActiveIcon: "text-haven-900",
    navHover: "hover:bg-haven-50 hover:text-haven-900 dark:hover:bg-haven-950/40 dark:hover:text-haven-100",
    childActive: "bg-haven-100/80 font-medium text-haven-900 dark:bg-haven-950/60 dark:text-haven-100",
    caption: "text-haven-700 dark:text-haven-300",
    softCard: "border-haven-100 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]",
    switcherActive: "bg-haven-100/80 text-haven-900 dark:bg-haven-950/60 dark:text-white",
    switcherIcon: "text-haven-600 dark:text-haven-300",
    listChip: "bg-haven-100 text-haven-800 dark:bg-haven-950/80 dark:text-haven-300",
    pullTab: "border-haven-200 hover:text-haven-800 focus-visible:ring-haven-400 dark:border-haven-900/60 dark:hover:text-haven-200",
    mobileBorder: "border-haven-100/80 dark:border-white/[0.06]",
    loader: {
      card: "border-haven-100/80 bg-white/90 shadow-[0_8px_48px_-12px_rgba(22,116,107,0.3)] dark:border-white/10 dark:bg-[#18181b]/90 dark:shadow-[0_8px_48px_-12px_rgba(0,0,0,0.6)]",
      ring: "border-haven-300/70 dark:border-haven-400/40",
      emblem: "bg-haven-300 text-haven-950",
      eyebrow: "text-haven-700 dark:text-haven-300",
      status: "text-haven-700 dark:text-haven-300",
      dot: "bg-haven-500 dark:bg-haven-300",
      barTrack: "bg-haven-100/80 dark:bg-zinc-800",
      barFill: "bg-haven-400",
    },
  },
  nectar: {
    rail: "border-nectar-100/90 bg-[#fffcf9] dark:border-white/[0.06] dark:bg-[#111113]",
    divider: "border-nectar-100/80 dark:border-white/[0.06]",
    navActive: "bg-nectar-300 font-semibold text-nectar-950",
    navActiveIcon: "text-nectar-900",
    navHover: "hover:bg-nectar-50 hover:text-nectar-900 dark:hover:bg-nectar-950/40 dark:hover:text-nectar-100",
    childActive: "bg-nectar-100/80 font-medium text-nectar-900 dark:bg-nectar-950/60 dark:text-nectar-100",
    caption: "text-nectar-800 dark:text-nectar-300",
    softCard: "border-nectar-100 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]",
    switcherActive: "bg-nectar-100/80 text-nectar-900 dark:bg-nectar-950/60 dark:text-white",
    switcherIcon: "text-nectar-600 dark:text-nectar-300",
    listChip: "bg-nectar-100 text-nectar-800 dark:bg-nectar-950/80 dark:text-nectar-300",
    pullTab: "border-nectar-200 hover:text-nectar-800 focus-visible:ring-nectar-400 dark:border-nectar-900/60 dark:hover:text-nectar-200",
    mobileBorder: "border-nectar-100/80 dark:border-white/[0.06]",
    loader: {
      card: "border-nectar-100/80 bg-white/90 shadow-[0_8px_48px_-12px_rgba(175,87,48,0.3)] dark:border-white/10 dark:bg-[#18181b]/90 dark:shadow-[0_8px_48px_-12px_rgba(0,0,0,0.6)]",
      ring: "border-nectar-300/80 dark:border-nectar-400/40",
      emblem: "bg-nectar-300 text-nectar-950",
      eyebrow: "text-nectar-800 dark:text-nectar-300",
      status: "text-nectar-800 dark:text-nectar-300",
      dot: "bg-nectar-500 dark:bg-nectar-300",
      barTrack: "bg-nectar-100/80 dark:bg-zinc-800",
      barFill: "bg-nectar-400",
    },
  },
  skyblue: {
    rail: "border-skyblue-100/90 bg-[#fbfcff] dark:border-white/[0.06] dark:bg-[#111113]",
    divider: "border-skyblue-100/80 dark:border-white/[0.06]",
    navActive: "bg-skyblue-300 font-semibold text-skyblue-950",
    navActiveIcon: "text-skyblue-900",
    navHover: "hover:bg-skyblue-50 hover:text-skyblue-900 dark:hover:bg-skyblue-950/40 dark:hover:text-skyblue-100",
    childActive: "bg-skyblue-100/80 font-medium text-skyblue-900 dark:bg-skyblue-950/60 dark:text-skyblue-100",
    caption: "text-skyblue-700 dark:text-skyblue-300",
    softCard: "border-skyblue-100 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]",
    switcherActive: "bg-skyblue-100/80 text-skyblue-900 dark:bg-skyblue-950/60 dark:text-white",
    switcherIcon: "text-skyblue-600 dark:text-skyblue-300",
    listChip: "bg-skyblue-100 text-skyblue-800 dark:bg-skyblue-950/80 dark:text-skyblue-300",
    pullTab: "border-skyblue-200 hover:text-skyblue-800 focus-visible:ring-skyblue-400 dark:border-skyblue-900/60 dark:hover:text-skyblue-200",
    mobileBorder: "border-skyblue-100/80 dark:border-white/[0.06]",
    loader: {
      card: "border-skyblue-100/80 bg-white/90 shadow-[0_8px_48px_-12px_rgba(73,87,191,0.3)] dark:border-white/10 dark:bg-[#18181b]/90 dark:shadow-[0_8px_48px_-12px_rgba(0,0,0,0.6)]",
      ring: "border-skyblue-300/80 dark:border-skyblue-400/40",
      emblem: "bg-skyblue-300 text-skyblue-950",
      eyebrow: "text-skyblue-700 dark:text-skyblue-300",
      status: "text-skyblue-700 dark:text-skyblue-300",
      dot: "bg-skyblue-500 dark:bg-skyblue-300",
      barTrack: "bg-skyblue-100/80 dark:bg-zinc-800",
      barFill: "bg-skyblue-400",
    },
  },
  charcoal: {
    rail: "border-zinc-200/80 bg-[#fbfbfb] dark:border-white/[0.06] dark:bg-[#111113]",
    divider: "border-zinc-200/70 dark:border-white/[0.06]",
    // The Locale pairing: charcoal fill, Haven Green icon (dark: inverted to silver).
    navActive: "bg-charcoal font-semibold text-silver dark:bg-silver dark:text-charcoal",
    navActiveIcon: "text-haven-300 dark:text-charcoal",
    navHover: "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100",
    childActive: "bg-zinc-100 font-medium text-zinc-900 dark:bg-white/[0.08] dark:text-zinc-100",
    caption: "text-granite dark:text-zinc-400",
    softCard: "border-zinc-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]",
    switcherActive: "bg-zinc-200/60 text-zinc-900 dark:bg-white/[0.08] dark:text-white",
    switcherIcon: "text-charcoal dark:text-zinc-300",
    listChip: "bg-zinc-100 text-charcoal dark:bg-white/[0.08] dark:text-zinc-200",
    pullTab: "border-zinc-200 hover:text-zinc-900 focus-visible:ring-zinc-400 dark:border-white/10 dark:hover:text-zinc-100",
    mobileBorder: "border-zinc-200/80 dark:border-white/[0.06]",
    loader: {
      card: "border-zinc-200/80 bg-white/90 shadow-[0_8px_48px_-12px_rgba(50,50,50,0.35)] dark:border-white/10 dark:bg-[#18181b]/90 dark:shadow-[0_8px_48px_-12px_rgba(0,0,0,0.6)]",
      ring: "border-zinc-400/60 dark:border-zinc-500/40",
      emblem: "bg-charcoal text-haven-300 dark:bg-silver dark:text-charcoal",
      eyebrow: "text-granite dark:text-zinc-400",
      status: "text-charcoal dark:text-zinc-300",
      dot: "bg-charcoal dark:bg-zinc-300",
      barTrack: "bg-zinc-200/80 dark:bg-zinc-800",
      barFill: "bg-charcoal dark:bg-zinc-300",
    },
  },
};
