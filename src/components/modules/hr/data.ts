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

/* ── Org chart ─────────────────────────────────────────────────────────── */

/**
 * The Locale Property Group org chart, from the group's chart. Every seat
 * points at the seat it hangs under; a department is everything under one of
 * the managing director's direct reports. The live chart (with seats added in
 * the Launchpad) is in `org-store.ts`.
 */
export type OrgBrand = "homes" | "financial" | "wealth";

export const ORG_BRANDS: Record<OrgBrand, { label: string; tone: "haven" | "nectar" | "skyblue" }> = {
  homes: { label: "Locale Homes", tone: "haven" },
  financial: { label: "Locale Financial", tone: "nectar" },
  wealth: { label: "Locale Wealth", tone: "skyblue" },
};

export interface OrgPerson {
  id: string;
  /** Null while the seat is vacant ("TBA" on the chart). */
  name: string | null;
  role: string;
  /** The seat they sit under. Null only for the managing director. */
  managerId: string | null;
  /** Drawn beside the manager on a dotted line (a board seat) or off the stem (an assistant), not beneath. */
  link?: "peer" | "assistant";
  /** A manager's block of like seats, drawn as one list: "New Home Advocates". */
  team?: string;
  /** The sub-brand(s) the seat works for. None means group services. */
  brands?: OrgBrand[];
  /** Shown in brackets after the name: a state, or the name they go by. */
  note?: string;
  /** Joined recently: "(new)" on the chart. */
  isNew?: boolean;
  /** Who is taking the seat over: "Alison Carter (transition)". */
  transition?: string;
}

export const ORG_DEPARTMENTS = [
  { id: "leadership", name: "Leadership", headId: "adam-schaal" },
  { id: "finance", name: "Finance", headId: "brad-linford" },
  { id: "sales", name: "Sales", headId: "sean-oneill" },
  { id: "marketing", name: "Marketing", headId: "kellie-boyer" },
  { id: "accounts", name: "Accounts", headId: "aled-smith" },
  { id: "ai", name: "AI & Growth", headId: "jerry-delos-santos" },
] as const;

export type OrgDepartmentId = (typeof ORG_DEPARTMENTS)[number]["id"];

/** "Sean O'Neill" → "sean-oneill". */
export const orgSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** A manager's team block: one seat per name, all with the same role and brand. */
function orgTeam(
  managerId: string,
  team: string,
  role: string,
  brands: OrgBrand[],
  names: (string | [name: string, note: string])[],
): OrgPerson[] {
  return names.map((n) => {
    const [name, note] = typeof n === "string" ? [n, undefined] : n;
    return { id: orgSlug(name), name, role, managerId, team, brands, ...(note ? { note } : {}) };
  });
}

const seat = (
  id: string,
  name: string | null,
  role: string,
  managerId: string | null,
  extra: Partial<OrgPerson> = {},
): OrgPerson => ({ id, name, role, managerId, ...extra });

export const ORG_SEED: OrgPerson[] = [
  seat("adam-schaal", "Adam Schaal", "Managing Director", null),
  seat("yasmin-georgiadis", "Yasmin Georgiadis", "Non-Exec Director", "adam-schaal", { link: "peer" }),
  seat("maria-soriano", "Maria Soriano", "Senior Executive Assistant", "adam-schaal", { link: "assistant" }),

  // Finance
  seat("brad-linford", "Brad Linford", "Head of Finance", "adam-schaal", { brands: ["financial"] }),
  ...orgTeam("brad-linford", "Finance Brokers", "Finance Broker", ["financial"], [
    "Ankit Kausik",
    "Matt Raven",
    "Ray Shanks",
    "Renae Dysart",
    "Sharni Clavarino",
  ]),
  ...orgTeam("brad-linford", "Broker Support", "Broker Support", ["financial"], ["Lane Dula", "Dianne Alvarez"]),

  // Sales
  seat("sean-oneill", "Sean O'Neill", "Head of Sales", "adam-schaal"),
  seat("bavinder-singh", "Bavinder Singh", "Advocate Manager VIC", "sean-oneill", { brands: ["homes"] }),
  ...orgTeam("bavinder-singh", "New Home Advocates", "New Home Advocate", ["homes"], [
    "Jasmin Bainbridge",
    "Omar Khirzad",
  ]),
  seat("advocate-manager-qld", null, "Advocate Manager QLD", "sean-oneill", { brands: ["homes"] }),
  ...orgTeam("advocate-manager-qld", "New Home Advocates", "New Home Advocate", ["homes"], [
    "Brendan Ford",
    "Tristan Hatt",
  ]),
  seat("adam-orlando", "Adam Orlando", "Advocate Manager WA", "sean-oneill", { brands: ["homes"] }),
  ...orgTeam("adam-orlando", "New Home Advocates", "New Home Advocate", ["homes"], [
    "Brett Jenkinson",
    "Ciaran Fahy",
    "Jordan Dench",
    "Josh Beardsell",
    "Kathryn Carr",
    "Krystal Mosca",
    "Michael Fox",
    "Nat Mason",
    "Nathan Good",
    "Oumi Kapila",
    "Pryncess Bungard",
    "Thales Ferreira",
    "Roni Nelson",
  ]),
  seat("quentin-smith", "Quentin Smith", "Advocate Manager WA", "sean-oneill", { brands: ["homes"] }),
  ...orgTeam("quentin-smith", "New Home Advocates", "New Home Advocate", ["homes"], [
    "Audris Quek",
    "James Francis",
    "Jessica Williamson",
    "Kate Grierson",
    "Kristen Margetts",
    "Lori Pirozzi",
    "Monique Juratovac",
    "Rachal Maffina",
    "Shea Connolly",
    "Tayla Juratovac",
    "Emily Dann",
  ]),
  seat("rachel-riggio", "Rachel Riggio", "Sales Associate", "sean-oneill"),
  seat("larnie-clark", "Larnie Clark", "Sales Operations Manager", "sean-oneill", { transition: "Alison Carter" }),
  seat("shannan-murray", "Shannan Murray", "Workflow & Compliance Lead", "larnie-clark"),
  seat("administration-officer", null, "Administration Officer", "larnie-clark"),
  seat("steph-stritch", "Steph Stritch", "Business Development Manager", "sean-oneill", {
    brands: ["wealth", "homes"],
  }),
  seat("conor-lloyd-fox", "Conor Lloyd-Fox", "Wealth Manager", "sean-oneill", { brands: ["wealth"] }),
  ...orgTeam("conor-lloyd-fox", "Property Investment Partners", "Property Investment Partner", ["wealth"], [
    "Nash Sivayanam",
    "Khai Tran",
    ["Tim Hill", "VIC"],
    "De Wet de la Porte",
    "Mitch Forbes",
    "Tomas Watson",
    ["Jian Wen", "Jay Tan"],
    "Sebastian Tindale",
  ]),

  // Marketing
  seat("kellie-boyer", "Kellie Boyer", "Head of Marketing", "adam-schaal"),
  seat("oli-chevellas", "Oli Chevellas", "Group Performance Manager", "kellie-boyer"),
  seat("keira-whitbread", "Keira Whitbread", "Social Media Lead", "oli-chevellas"),
  seat(
    "kristian-charlon-serrano",
    "Kristian Charlon Serrano",
    "Senior Video Editor & Content Production Lead",
    "keira-whitbread",
  ),
  seat("sarah-jasmin", "Sarah Jasmin", "Graphic Designer", "kristian-charlon-serrano"),
  seat("elisa-kalliosalo", "Elisa Kalliosalo", "Content Coordinator", "oli-chevellas"),
  seat("nam-su-byun", "Nam Su Byun", "Senior Media Buyer", "oli-chevellas", { isNew: true }),
  seat("karina-saxby", "Karina Saxby", "Marketing Manager – Wealth & Financial", "kellie-boyer", {
    brands: ["wealth", "financial"],
  }),
  seat("hayden-wilson", "Hayden Wilson", "Marketing Manager – Homes", "kellie-boyer", { brands: ["homes"] }),
  seat("kristen-jackson", "Kristen Jackson", "Marketing Specialist", "kellie-boyer"),

  // Accounts
  seat("aled-smith", "Aled Smith", "Company Accountant", "adam-schaal"),

  // AI & Growth
  seat("jerry-delos-santos", "Jerry Delos Santos", "Head of AI & Growth Systems", "adam-schaal"),
  seat("pablo-lopez", "Pablo Lopez", "IT Systems Engineer", "jerry-delos-santos"),
  seat("andre-mikhail-serra", "Andre Mikhail Serra", "AI Engineer – Sales & Marketing", "jerry-delos-santos"),
  seat("jan-kane-reroma", "Jan Kane Reroma", "AI Engineer", "jerry-delos-santos", { isNew: true }),
];

/** Seats drawn beneath this one (not its board peers or assistants), in chart order. */
export function orgReports(people: OrgPerson[], id: string): OrgPerson[] {
  return people.filter((p) => p.managerId === id && !p.link);
}

/** The department a seat belongs to: the nearest department head above it (or itself). */
export function orgDepartmentOf(people: OrgPerson[], id: string): OrgDepartmentId {
  const byId = new Map(people.map((p) => [p.id, p]));
  for (let cur = byId.get(id); cur; cur = cur.managerId ? byId.get(cur.managerId) : undefined) {
    const dept = ORG_DEPARTMENTS.find((d) => d.id !== "leadership" && d.headId === cur!.id);
    if (dept) return dept.id;
  }
  return "leadership";
}

export const orgDepartment = (id: OrgDepartmentId) => ORG_DEPARTMENTS.find((d) => d.id === id)!;

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
 * One avatar colour per person across every HR tab, in their division's
 * sub-brand: Homes wear Haven, Financial wear Nectar, group services wear the
 * charcoal master brand (Sky Blue is Wealth's alone). Matched on surname so
 * "S. Hart" and "Shannan Hart" read as the same person. Unknown people fall
 * back to "auto".
 */
export function personTone(name: string): "haven" | "nectar" | "charcoal" | "auto" {
  const surname = name.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  const hit = EMPLOYEES.find((e) => e.name.split(" ").pop()?.toLowerCase() === surname);
  if (!hit) return "auto";
  return hit.division === "Financial" ? "nectar" : hit.division === "Group" ? "charcoal" : "haven";
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
  /** Working days this request takes off the requester's balance. */
  days: number;
  /** First and last day away (ISO dates), for the cover check. */
  start: string;
  end: string;
  /** The requester's own balance for this leave type before the request, in days (Horilla). */
  balance: number;
}

export const LEAVE_SEED: LeaveRequest[] = [
  {
    id: "mercer-aug",
    name: "A. Mercer",
    type: "Annual leave",
    when: "17–21 Aug",
    length: "3 days",
    status: "Pending",
    days: 3,
    start: "2026-08-17",
    end: "2026-08-21",
    balance: 11.6,
  },
  {
    id: "ellery-aug",
    name: "K. Ellery",
    type: "Personal leave",
    when: "8 Aug",
    length: "1 day",
    status: "Pending",
    days: 1,
    start: "2026-08-08",
    end: "2026-08-08",
    balance: 4,
  },
  {
    id: "hart-sep",
    name: "S. Hart",
    type: "Annual leave",
    when: "14–18 Sep",
    length: "5 days",
    status: "Approved",
    days: 5,
    start: "2026-09-14",
    end: "2026-09-18",
    balance: 17.4,
  },
];

/** Leave already approved in Horilla outside this queue: the team calendar. */
export interface TeamAbsence {
  name: string;
  type: string;
  when: string;
  start: string;
  end: string;
}

export const TEAM_LEAVE: TeamAbsence[] = [
  { name: "D. Okafor", type: "Annual leave", when: "19–20 Aug", start: "2026-08-19", end: "2026-08-20" },
  { name: "Kellie Rowe", type: "Annual leave", when: "21 Aug", start: "2026-08-21", end: "2026-08-21" },
  { name: "Pablo Lopez", type: "Annual leave", when: "24–28 Aug", start: "2026-08-24", end: "2026-08-28" },
];

/** Everyone booked off: the team calendar plus requests approved in the queue, soonest first. */
export function bookedLeave(queue: LeaveRequest[]): TeamAbsence[] {
  return [...TEAM_LEAVE, ...queue.filter((r) => r.status === "Approved")]
    .map(({ name, type, when, start, end }) => ({ name, type, when, start, end }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Who else is away while this request would be: the approver's cover check. */
export function othersOff(req: LeaveRequest, queue: LeaveRequest[]): TeamAbsence[] {
  return bookedLeave(queue).filter((a) => a.name !== req.name && a.start <= req.end && a.end >= req.start);
}

/** The requester's balance once this request is taken, in days. */
export function balanceAfter(req: LeaveRequest): number {
  return Math.round((req.balance - req.days) * 10) / 10;
}

/** "8.6 days" — leave balances always carry one decimal, as Horilla shows them. */
export const formatDays = (n: number) => `${n.toFixed(1)} days`;

/** The approver's own balances (S. Hart), shown apart from the approval queue. */
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
