/**
 * Per-dashboard accent — the Simple HRIS rule (ui-standards § 1.2): every
 * dashboard shares one shell, and the accent is the only thing that changes.
 * Locale's accents are its own sub-brand system:
 *
 *   haven     Locale Homes      — Home, Operations, Sales
 *   nectar    Locale Financial  — Finance, Accounts
 *   skyblue   Locale Wealth     — Wealth
 *   charcoal  master brand      — Marketing, HR, Projects, Knowledge, Leadership, IT
 *
 * Every value is a COMPLETE literal class string. Tailwind only generates
 * classes it can read verbatim in source, so these must never be built by
 * concatenating fragments (HRIS § 15.2).
 */
export type DashboardTone = "haven" | "nectar" | "skyblue" | "charcoal";

export interface ToneClasses {
  /** Rail background + right border. */
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
  /** Small caps caption ink ("Sales", "Launchpad"). */
  caption: string;
  /** Soft card chrome: user card, theme toggle, switcher box. */
  softCard: string;
  softCardHover: string;
  /** The current dashboard's row inside the view switcher. */
  switcherActive: string;
  /** This dashboard's icon colour when it is listed in the switcher. */
  switcherIcon: string;
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
    rail: "border-haven-100/80 bg-gradient-to-b from-white via-haven-50/40 to-white dark:border-white/[0.06] dark:from-[#111113] dark:via-haven-950/20 dark:to-[#111113]",
    divider: "border-haven-100/70 dark:border-white/[0.06]",
    navActive: "bg-gradient-to-r from-haven-300 to-haven-400 font-semibold text-haven-950 shadow-sm shadow-haven-600/20",
    navActiveIcon: "text-haven-900",
    navHover: "hover:bg-haven-50 hover:text-haven-900 dark:hover:bg-haven-950/40 dark:hover:text-haven-100",
    childActive: "bg-haven-100/80 font-medium text-haven-900 dark:bg-haven-950/60 dark:text-haven-100",
    caption: "text-haven-700 dark:text-haven-300",
    softCard: "border-haven-100 bg-gradient-to-br from-white to-haven-50/70 dark:border-haven-950/60 dark:from-[#18181b] dark:to-haven-950/25",
    softCardHover: "hover:from-haven-50 hover:to-haven-100/70 dark:hover:from-haven-950/30 dark:hover:to-haven-950/45",
    switcherActive: "bg-gradient-to-r from-haven-100 to-haven-50 text-haven-900 dark:from-haven-950/70 dark:to-haven-950/40 dark:text-white",
    switcherIcon: "text-haven-600 dark:text-haven-300",
    pullTab: "border-haven-200 hover:text-haven-800 focus-visible:ring-haven-400 dark:border-haven-900/60 dark:hover:text-haven-200",
    mobileBorder: "border-haven-100/80 dark:border-white/[0.06]",
    loader: {
      card: "border-haven-100/80 bg-white/90 shadow-[0_8px_48px_-12px_rgba(22,116,107,0.3)] dark:border-white/10 dark:bg-[#18181b]/90 dark:shadow-[0_8px_48px_-12px_rgba(0,0,0,0.6)]",
      ring: "border-haven-300/70 dark:border-haven-400/40",
      emblem: "from-haven-300 to-haven-500 text-haven-950 shadow-haven-500/40",
      eyebrow: "text-haven-700 dark:text-haven-300",
      status: "text-haven-700 dark:text-haven-300",
      dot: "bg-haven-500 dark:bg-haven-300",
      barTrack: "bg-haven-100/80 dark:bg-zinc-800",
      barFill: "from-haven-300 to-haven-500",
    },
  },
  nectar: {
    rail: "border-nectar-100/90 bg-gradient-to-b from-white via-nectar-50/60 to-white dark:border-white/[0.06] dark:from-[#111113] dark:via-nectar-950/20 dark:to-[#111113]",
    divider: "border-nectar-100/80 dark:border-white/[0.06]",
    navActive: "bg-gradient-to-r from-nectar-300 to-nectar-400 font-semibold text-nectar-950 shadow-sm shadow-nectar-600/20",
    navActiveIcon: "text-nectar-900",
    navHover: "hover:bg-nectar-50 hover:text-nectar-900 dark:hover:bg-nectar-950/40 dark:hover:text-nectar-100",
    childActive: "bg-nectar-100/80 font-medium text-nectar-900 dark:bg-nectar-950/60 dark:text-nectar-100",
    caption: "text-nectar-700 dark:text-nectar-300",
    softCard: "border-nectar-100 bg-gradient-to-br from-white to-nectar-50/80 dark:border-nectar-950/60 dark:from-[#18181b] dark:to-nectar-950/25",
    softCardHover: "hover:from-nectar-50 hover:to-nectar-100/70 dark:hover:from-nectar-950/30 dark:hover:to-nectar-950/45",
    switcherActive: "bg-gradient-to-r from-nectar-100 to-nectar-50 text-nectar-900 dark:from-nectar-950/70 dark:to-nectar-950/40 dark:text-white",
    switcherIcon: "text-nectar-600 dark:text-nectar-300",
    pullTab: "border-nectar-200 hover:text-nectar-800 focus-visible:ring-nectar-400 dark:border-nectar-900/60 dark:hover:text-nectar-200",
    mobileBorder: "border-nectar-100/80 dark:border-white/[0.06]",
    loader: {
      card: "border-nectar-100/80 bg-white/90 shadow-[0_8px_48px_-12px_rgba(175,87,48,0.3)] dark:border-white/10 dark:bg-[#18181b]/90 dark:shadow-[0_8px_48px_-12px_rgba(0,0,0,0.6)]",
      ring: "border-nectar-300/80 dark:border-nectar-400/40",
      emblem: "from-nectar-300 to-nectar-500 text-nectar-950 shadow-nectar-500/40",
      eyebrow: "text-nectar-700 dark:text-nectar-300",
      status: "text-nectar-700 dark:text-nectar-300",
      dot: "bg-nectar-500 dark:bg-nectar-300",
      barTrack: "bg-nectar-100/80 dark:bg-zinc-800",
      barFill: "from-nectar-300 to-nectar-500",
    },
  },
  skyblue: {
    rail: "border-skyblue-100/90 bg-gradient-to-b from-white via-skyblue-50/70 to-white dark:border-white/[0.06] dark:from-[#111113] dark:via-skyblue-950/25 dark:to-[#111113]",
    divider: "border-skyblue-100/80 dark:border-white/[0.06]",
    navActive: "bg-gradient-to-r from-skyblue-300 to-skyblue-400 font-semibold text-skyblue-950 shadow-sm shadow-skyblue-600/20",
    navActiveIcon: "text-skyblue-900",
    navHover: "hover:bg-skyblue-50 hover:text-skyblue-900 dark:hover:bg-skyblue-950/40 dark:hover:text-skyblue-100",
    childActive: "bg-skyblue-100/80 font-medium text-skyblue-900 dark:bg-skyblue-950/60 dark:text-skyblue-100",
    caption: "text-skyblue-700 dark:text-skyblue-300",
    softCard: "border-skyblue-100 bg-gradient-to-br from-white to-skyblue-50/80 dark:border-skyblue-950/60 dark:from-[#18181b] dark:to-skyblue-950/25",
    softCardHover: "hover:from-skyblue-50 hover:to-skyblue-100/70 dark:hover:from-skyblue-950/30 dark:hover:to-skyblue-950/45",
    switcherActive: "bg-gradient-to-r from-skyblue-100 to-skyblue-50 text-skyblue-900 dark:from-skyblue-950/70 dark:to-skyblue-950/40 dark:text-white",
    switcherIcon: "text-skyblue-600 dark:text-skyblue-300",
    pullTab: "border-skyblue-200 hover:text-skyblue-800 focus-visible:ring-skyblue-400 dark:border-skyblue-900/60 dark:hover:text-skyblue-200",
    mobileBorder: "border-skyblue-100/80 dark:border-white/[0.06]",
    loader: {
      card: "border-skyblue-100/80 bg-white/90 shadow-[0_8px_48px_-12px_rgba(73,87,191,0.3)] dark:border-white/10 dark:bg-[#18181b]/90 dark:shadow-[0_8px_48px_-12px_rgba(0,0,0,0.6)]",
      ring: "border-skyblue-300/80 dark:border-skyblue-400/40",
      emblem: "from-skyblue-300 to-skyblue-500 text-skyblue-950 shadow-skyblue-500/40",
      eyebrow: "text-skyblue-700 dark:text-skyblue-300",
      status: "text-skyblue-700 dark:text-skyblue-300",
      dot: "bg-skyblue-500 dark:bg-skyblue-300",
      barTrack: "bg-skyblue-100/80 dark:bg-zinc-800",
      barFill: "from-skyblue-300 to-skyblue-500",
    },
  },
  charcoal: {
    rail: "border-zinc-200/80 bg-gradient-to-b from-white via-zinc-50 to-white dark:border-white/[0.06] dark:from-[#111113] dark:via-[#151517] dark:to-[#111113]",
    divider: "border-zinc-200/70 dark:border-white/[0.06]",
    // The Locale pairing: charcoal fill, Haven Green icon (dark: inverted to silver).
    navActive: "bg-gradient-to-r from-charcoal to-[#464648] font-semibold text-silver shadow-sm shadow-black/20 dark:from-silver dark:to-zinc-300 dark:text-charcoal",
    navActiveIcon: "text-haven-300 dark:text-charcoal",
    navHover: "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100",
    childActive: "bg-zinc-100 font-medium text-zinc-900 dark:bg-white/[0.08] dark:text-zinc-100",
    caption: "text-granite dark:text-zinc-400",
    softCard: "border-zinc-200 bg-gradient-to-br from-white to-zinc-50 dark:border-white/10 dark:from-[#18181b] dark:to-[#1c1c1f]",
    softCardHover: "hover:from-zinc-50 hover:to-zinc-100 dark:hover:from-[#1c1c1f] dark:hover:to-[#222226]",
    switcherActive: "bg-gradient-to-r from-zinc-200/80 to-zinc-100 text-zinc-900 dark:from-white/[0.1] dark:to-white/[0.04] dark:text-white",
    switcherIcon: "text-charcoal dark:text-zinc-300",
    pullTab: "border-zinc-200 hover:text-zinc-900 focus-visible:ring-zinc-400 dark:border-white/10 dark:hover:text-zinc-100",
    mobileBorder: "border-zinc-200/80 dark:border-white/[0.06]",
    loader: {
      card: "border-zinc-200/80 bg-white/90 shadow-[0_8px_48px_-12px_rgba(50,50,50,0.35)] dark:border-white/10 dark:bg-[#18181b]/90 dark:shadow-[0_8px_48px_-12px_rgba(0,0,0,0.6)]",
      ring: "border-zinc-400/60 dark:border-zinc-500/40",
      emblem: "from-granite to-charcoal text-haven-300 shadow-black/30",
      eyebrow: "text-granite dark:text-zinc-400",
      status: "text-charcoal dark:text-zinc-300",
      dot: "bg-charcoal dark:bg-zinc-300",
      barTrack: "bg-zinc-200/80 dark:bg-zinc-800",
      barFill: "from-granite to-charcoal dark:from-zinc-400 dark:to-zinc-200",
    },
  },
};
