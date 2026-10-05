/**
 * Marketing — static figures from the mockup (`ym`). Month to date, Kellie's
 * view: ad-platform spend joined to the HubSpot deal mirror. Nothing is fetched.
 */
import { Home, Megaphone, Target, TrendingUp, Users, type LucideIcon } from "lucide-react";

export const MARKETING_TABS = ["overview", "performance", "channels", "attribution"] as const;
export type MarketingTab = (typeof MARKETING_TABS)[number];

export interface Channel {
  name: string;
  spend: number;
  leads: number;
  qual: number;
  won: number;
  icon: LucideIcon;
}

export const CHANNELS: Channel[] = [
  { name: "Meta ads", spend: 18400, leads: 142, qual: 38, won: 9, icon: Megaphone },
  { name: "Google search", spend: 22100, leads: 118, qual: 44, won: 12, icon: Target },
  { name: "Display homes", spend: 9600, leads: 64, qual: 31, won: 8, icon: Home },
  { name: "Referral", spend: 3200, leads: 38, qual: 26, won: 11, icon: Users },
  { name: "Organic and email", spend: 2400, leads: 51, qual: 19, won: 5, icon: TrendingUp },
];

/** "$18.4k" — the mockup's one-decimal thousands. */
export const k1 = (n: number) => `$${(n / 1e3).toFixed(1)}k`;
/** "$1,238" */
export const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

/** Blended commission per deal from the P and L — revenue is commission, not contract value. */
export const COMMISSION_PER_DEAL = 11500;

/** The "won" bar on the spend-versus-converted rows is drawn against 12 deals. */
export const WON_BAR_SCALE = 12;

export const TOTAL_SPEND = CHANNELS.reduce((s, c) => s + c.spend, 0);
export const TOTAL_WON = CHANNELS.reduce((s, c) => s + c.won, 0);
export const TOTAL_LEADS = CHANNELS.reduce((s, c) => s + c.leads, 0);
export const TOTAL_QUALIFIED = CHANNELS.reduce((s, c) => s + c.qual, 0);
export const MAX_SPEND = Math.max(...CHANNELS.map((c) => c.spend));

/** Spend versus deals won — last six months. `spend` is $k. */
export const MONTHLY: { month: string; spend: number; won: number }[] = [
  { month: "Mar", spend: 48, won: 9 },
  { month: "Apr", spend: 52, won: 11 },
  { month: "May", spend: 44, won: 8 },
  { month: "Jun", spend: 61, won: 14 },
  { month: "Jul", spend: 58, won: 13 },
  { month: "Aug", spend: 56, won: 12 },
];

/** Tag coverage by source — % of deals whose source tag resolves. Below 75 is a warning. */
export const TAG_COVERAGE: { source: string; pct: number }[] = [
  { source: "Google search", pct: 98 },
  { source: "Organic and email", pct: 94 },
  { source: "Referral", pct: 88 },
  { source: "Display homes", pct: 71 },
  { source: "Meta ads", pct: 65 },
];

export const TAG_COVERAGE_FLOOR = 75;

/** What Launchpad checks nightly. */
export const NIGHTLY_CHECKS: { check: string; found: string }[] = [
  { check: "Deals created with no source", found: "4 this month" },
  { check: "Unresolved parameters in tags", found: "23 deals" },
  { check: "Leads with no channel", found: "11 this month" },
  { check: "Spend rows missing a campaign match", found: "2" },
];
