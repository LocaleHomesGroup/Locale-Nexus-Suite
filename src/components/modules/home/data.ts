/**
 * Home — the company content from the mockup (announcements, events,
 * celebrations). Static: nothing here is fetched. Jarvis's Home FAQ reads the
 * same arrays, so the bubble and the page always agree.
 */
import { BookOpen, Gift, Map, PartyPopper, Sparkles, UserPlus, Users, type LucideIcon } from "lucide-react";
import type { ModuleId } from "@/state/launchpad-store";

export interface Announcement {
  title: string;
  body: string;
  meta: string;
  pinned: boolean;
}

/** Newest first. */
export const ANNOUNCEMENTS: Announcement[] = [
  {
    title: "Launchpad is live in pilot",
    body: "CRM Dash Sync is now syncing milestones to HubSpot and Monday automatically. Ops: updates entered once now land everywhere.",
    meta: "Today · Jerry",
    pinned: true,
  },
  {
    title: "August builder price lists published",
    body: "Move Homes and Forma are current. La Vida in review — hold quotes on affected models until Thursday.",
    meta: "Yesterday · Yasmin",
    pinned: false,
  },
  {
    title: "New phishing simulation this month",
    body: "Check sender addresses before clicking. When unsure, forward to support@localegroup.au.",
    meta: "Mon · IT",
    pinned: false,
  },
];

export const COMING_UP: { title: string; when: string; where: string; icon: LucideIcon }[] = [
  { title: "Sales training · objection handling", when: "Tue 12 Aug, 9:00am", where: "Subiaco boardroom", icon: BookOpen },
  { title: "Peet land release · Seaside Rise stage 4", when: "Thu 14 Aug", where: "Titles expected Mar 2027", icon: Map },
  { title: "Sales awards · July winners", when: "Fri 15 Aug, 4:00pm", where: "Drinks after", icon: Sparkles },
  { title: "Team day · end of quarter", when: "Fri 29 Aug", where: "Details to follow", icon: Users },
];

export const CELEBRATIONS: { icon: LucideIcon; name: string; note: string }[] = [
  { icon: Gift, name: "Kellie Rowe", note: "Birthday — Thursday" },
  { icon: Gift, name: "D. Okafor", note: "Birthday — Saturday" },
  { icon: PartyPopper, name: "Alison Carter", note: "3 years at Locale — next week" },
  { icon: UserPlus, name: "L. Dixon", note: "New starter — say hi (Broker Support)" },
];

export const QUICK_LINKS: { label: string; module: ModuleId; tab: string | null }[] = [
  { label: "Leave request", module: "hr", tab: "leave" },
  { label: "Expenses", module: "accounts", tab: "expenses" },
  { label: "IT help desk", module: "it", tab: null },
];
