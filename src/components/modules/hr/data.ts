/**
 * HR — static data from the mockup (`xm`). Every figure is Horilla's mirror as
 * the mockup shows it; nothing here is fetched.
 */

export const HR_TABS = ["dashboard", "people", "attendance", "leave", "recruitment", "performance", "assets"] as const;
export type HrTab = (typeof HR_TABS)[number];

export const HR_TAB_LABELS: Record<HrTab, string> = {
  dashboard: "Dashboard",
  people: "Employees",
  attendance: "Attendance",
  leave: "Leave",
  recruitment: "Recruitment",
  performance: "Performance",
  assets: "Assets",
};

/* ── Dashboard ─────────────────────────────────────────────────────────── */

export const HR_KPIS = {
  totalEmployees: 23,
  onLeaveToday: 1,
  newJoiners: 1,
  openPositions: 2,
} as const;

/** Division, headcount, share of headcount (%). */
export const DIVISIONS: { name: string; count: number; share: number }[] = [
  { name: "Locale Homes", count: 13, share: 57 },
  { name: "Locale Financial", count: 6, share: 26 },
  { name: "Locale Wealth", count: 2, share: 9 },
  { name: "Group services", count: 2, share: 9 },
];

export const ON_LEAVE_TODAY = { name: "K. Ellery", note: "K. Ellery · Personal leave · back tomorrow" };

export const ATTENDANCE_TODAY: { label: string; value: string; caution?: boolean }[] = [
  { label: "Clocked in", value: "19 of 22" },
  { label: "Working from home", value: "4" },
  { label: "Not yet in", value: "2", caution: true },
];

/* ── Employees ─────────────────────────────────────────────────────────── */

export type Division = "Homes" | "Financial" | "Group";

export interface Employee {
  name: string;
  role: string;
  division: Division;
  location: "Perth" | "Remote";
}

export const EMPLOYEES: Employee[] = [
  { name: "Shannan Hart", role: "Sales Admin", division: "Homes", location: "Perth" },
  { name: "Alison Carter", role: "Sales Operations", division: "Homes", location: "Perth" },
  { name: "Kellie Rowe", role: "Marketing Lead", division: "Group", location: "Perth" },
  { name: "Pablo Lopez", role: "IT Systems Engineer", division: "Group", location: "Remote" },
  { name: "Lane Dixon", role: "Broker Support", division: "Financial", location: "Perth" },
  { name: "Diane Cruz", role: "Broker Support", division: "Financial", location: "Remote" },
];

/**
 * One avatar colour per person across every HR tab — the mockup tints Financial
 * people Sky Blue and everyone else Haven. Matched on surname so "S. Hart" and
 * "Shannan Hart" read as the same person. Unknown people fall back to "auto".
 */
export function personTone(name: string): "haven" | "skyblue" | "auto" {
  const surname = name.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  const hit = EMPLOYEES.find((e) => e.name.split(" ").pop()?.toLowerCase() === surname);
  if (!hit) return "auto";
  return hit.division === "Financial" ? "skyblue" : "haven";
}

/* ── Attendance ────────────────────────────────────────────────────────── */

export type AttendanceStatus = "Present" | "WFH" | "On leave" | "Not yet in";

export interface AttendanceRow {
  name: string;
  checkIn: string | null;
  checkOut: string | null;
  hours: string | null;
  status: AttendanceStatus;
}

export const ATTENDANCE: AttendanceRow[] = [
  { name: "Shannan Hart", checkIn: "7:52am", checkOut: null, hours: "In progress", status: "Present" },
  { name: "Alison Carter", checkIn: "8:04am", checkOut: null, hours: "In progress", status: "Present" },
  { name: "Pablo Lopez", checkIn: "8:15am", checkOut: null, hours: "In progress", status: "WFH" },
  { name: "K. Ellery", checkIn: null, checkOut: null, hours: null, status: "On leave" },
  { name: "D. Okafor", checkIn: null, checkOut: null, hours: null, status: "Not yet in" },
];

export const ATTENDANCE_FOOTNOTE = "2 attendance records need validation for July payroll.";

/* ── Leave ─────────────────────────────────────────────────────────────── */

export type LeaveStatus = "Pending" | "Approved" | "Declined";

export interface LeaveRequest {
  id: string;
  name: string;
  type: string;
  when: string;
  length: string;
  status: LeaveStatus;
}

export const LEAVE_SEED: LeaveRequest[] = [
  { id: "mercer-aug", name: "A. Mercer", type: "Annual leave", when: "17–21 Aug", length: "3 days", status: "Pending" },
  { id: "ellery-aug", name: "K. Ellery", type: "Personal leave", when: "8 Aug", length: "1 day", status: "Pending" },
  { id: "hart-sep", name: "S. Hart", type: "Annual leave", when: "14–18 Sep", length: "5 days", status: "Approved" },
];

export const LEAVE_BALANCES: { label: string; value: string }[] = [
  { label: "Annual leave", value: "12.4 days" },
  { label: "Personal leave", value: "6.0 days" },
  { label: "Long service", value: "accruing" },
];

/* ── Recruitment ───────────────────────────────────────────────────────── */

export interface OpenRole {
  role: string;
  manager: string;
  stages: { label: "Applied" | "Interview" | "Offer"; count: number }[];
}

export const OPEN_ROLES: OpenRole[] = [
  {
    role: "Sales Consultant · Homes",
    manager: "Adam",
    stages: [
      { label: "Applied", count: 14 },
      { label: "Interview", count: 3 },
      { label: "Offer", count: 1 },
    ],
  },
  {
    role: "Settlements Officer · Financial",
    manager: "Yasmin",
    stages: [
      { label: "Applied", count: 8 },
      { label: "Interview", count: 2 },
      { label: "Offer", count: 0 },
    ],
  },
];

export const ONBOARDING = {
  name: "Lane Dixon",
  detail: "Broker Support · started Monday",
  done: 5,
  total: 7,
  remaining: "Remaining: Mercury access request · phishing awareness module",
} as const;

/* ── Performance ───────────────────────────────────────────────────────── */

export interface OkrRow {
  name: string;
  onTrack: number;
  total: number;
  /** Q3 score out of 100. 85+ reads as on track. */
  score: number;
}

export const OKRS: OkrRow[] = [
  { name: "Shannan Hart", onTrack: 4, total: 5, score: 82 },
  { name: "A. Mercer", onTrack: 5, total: 6, score: 91 },
  { name: "K. Ellery", onTrack: 3, total: 5, score: 74 },
  { name: "D. Okafor", onTrack: 4, total: 4, score: 88 },
];

export const OKR_ON_TRACK_AT = 85;

/* ── Assets ────────────────────────────────────────────────────────────── */

export type AssetStatus = "In use" | "Available" | "In repair";

export interface Asset {
  name: string;
  tag: string;
  category: "Laptop" | "Phone" | "Peripheral";
  assignedTo: string | null;
  status: AssetStatus;
}

export const ASSETS: Asset[] = [
  { name: "MacBook Air M4", tag: "LH-021", category: "Laptop", assignedTo: "Shannan Hart", status: "In use" },
  { name: "iPhone 16", tag: "LH-034", category: "Phone", assignedTo: "A. Mercer", status: "In use" },
  { name: "Dell 27″ monitor", tag: "LH-058", category: "Peripheral", assignedTo: "Lane Dixon", status: "In use" },
  { name: "Surface Pro", tag: "LH-011", category: "Laptop", assignedTo: null, status: "Available" },
  { name: "iPhone 14", tag: "LH-019", category: "Phone", assignedTo: null, status: "In repair" },
];
