/**
 * HR — static data from the mockup (`xm`). Every figure is Horilla's mirror as
 * the mockup shows it; nothing here is fetched.
 */

export const HR_TABS = ["overview", "people", "attendance", "leave", "recruitment", "performance", "assets"] as const;
export type HrTab = (typeof HR_TABS)[number];

export const HR_TAB_LABELS: Record<HrTab, string> = {
  overview: "Overview",
  people: "Global Master List",
  attendance: "Attendance",
  leave: "Leave",
  recruitment: "Recruitment",
  performance: "Performance",
  assets: "Assets",
};

/* ── Overview ──────────────────────────────────────────────────────────── */

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
  /** The master-list id of the person taking the seat over, once their name has been edited away from its slug. */
  transitionId?: string;
  /** Changes made to the seat holder's employee record in the Launchpad (Global Master List › Edit). */
  edits?: RecordEdit;
  /** The same, for the person taking the seat over. */
  transitionEdits?: RecordEdit;
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

/** A seat's avatar colour: its first sub-brand's tint, or charcoal for group services. */
export const orgTone = (brands?: OrgBrand[]) => (brands?.length ? ORG_BRANDS[brands[0]].tone : "charcoal");

/* ── Global master list ────────────────────────────────────────────────── */

/**
 * The Horilla employee record behind each person on the org chart: what
 * the chart doesn't draw. Employee numbers run in order of commencement; the
 * gaps are people who have left. Someone added in the Launchpad has no record
 * until Horilla issues one.
 */
export interface EmployeeRecord {
  employeeId: string;
  /** Commencement date (ISO). */
  commenced: string;
  workEmail: string;
  personalEmail: string;
  /** The name they go by, when it isn't their first name. */
  preferredName?: string;
  mobile?: string;
  /** Where they work from: "Perth, WA". */
  location?: string;
}

/** The record fields HR can change from the master list. The employee ID is Horilla's. */
export type RecordEdit = Partial<Omit<EmployeeRecord, "employeeId">>;

const RECORDS: [orgId: string, employeeId: string, commenced: string, workEmail: string, personalEmail: string][] = [
  ["adam-schaal", "LPG-0001", "2014-03-03", "adam@localegroup.au", "aschaal@icloud.com"],
  ["yasmin-georgiadis", "LPG-0004", "2016-07-04", "yasmin@localegroup.au", "yasmingeorgiadis@bigpond.com"],
  ["oli-chevellas", "LPG-0005", "2017-02-06", "oli@localegroup.au", "oli_chevellas@bigpond.com"],
  ["larnie-clark", "LPG-0008", "2017-06-12", "larnie@localegroup.au", "larnie_clark@gmail.com"],
  ["kristian-charlon-serrano", "LPG-0010", "2017-06-26", "kristian@localegroup.au", "kristian.serrano@outlook.com"],
  ["maria-soriano", "LPG-0012", "2018-02-05", "maria@localegroup.au", "msoriano@hotmail.com"],
  ["sean-oneill", "LPG-0015", "2018-03-26", "sean@localegroup.au", "seanoneill@hotmail.com"],
  ["keira-whitbread", "LPG-0017", "2018-05-14", "keira@localegroup.au", "keiraw84@outlook.com"],
  ["brad-linford", "LPG-0020", "2018-09-17", "brad@localegroup.au", "blinford@icloud.com"],
  ["quentin-smith", "LPG-0021", "2018-12-03", "quentin@localegroup.au", "quentinsmith@outlook.com"],
  ["aled-smith", "LPG-0023", "2019-01-07", "aled@localegroup.au", "aled.smith85@gmail.com"],
  ["mitch-forbes", "LPG-0025", "2019-01-28", "mitch@localegroup.au", "mitch_forbes@icloud.com"],
  ["conor-lloyd-fox", "LPG-0027", "2019-03-11", "conor@localegroup.au", "conor.lloydfox@gmail.com"],
  ["adam-orlando", "LPG-0030", "2019-07-01", "adamo@localegroup.au", "adam_orlando@hotmail.com"],
  ["tayla-juratovac", "LPG-0033", "2019-07-22", "tayla@localegroup.au", "tayla.juratovac96@gmail.com"],
  ["kellie-boyer", "LPG-0035", "2020-03-16", "kellie@localegroup.au", "kellie_boyer@outlook.com"],
  ["oumi-kapila", "LPG-0037", "2020-05-04", "oumi@localegroup.au", "oumi.kapila@gmail.com"],
  ["bavinder-singh", "LPG-0040", "2020-06-22", "bavinder@localegroup.au", "bavindersingh@icloud.com"],
  ["josh-beardsell", "LPG-0042", "2020-06-22", "josh@localegroup.au", "joshbeardsell@hotmail.com"],
  ["thales-ferreira", "LPG-0045", "2020-07-06", "thales@localegroup.au", "thales_ferreira@hotmail.com"],
  ["jessica-williamson", "LPG-0048", "2020-08-03", "jessica@localegroup.au", "jessica.williamson93@gmail.com"],
  ["james-francis", "LPG-0050", "2020-08-17", "james@localegroup.au", "james.francis@outlook.com"],
  ["sebastian-tindale", "LPG-0052", "2020-08-24", "sebastian@localegroup.au", "sebastian.tindale89@gmail.com"],
  ["shea-connolly", "LPG-0054", "2020-09-28", "shea@localegroup.au", "shea.connolly94@gmail.com"],
  ["kate-grierson", "LPG-0055", "2020-11-16", "kate@localegroup.au", "kateg91@gmail.com"],
  ["nathan-good", "LPG-0058", "2020-11-16", "nathan@localegroup.au", "nathan_good@icloud.com"],
  ["omar-khirzad", "LPG-0059", "2021-02-01", "omar@localegroup.au", "omar.khirzad79@gmail.com"],
  ["jian-wen", "LPG-0060", "2021-03-15", "jian@localegroup.au", "jian_wen@gmail.com"],
  ["nat-mason", "LPG-0063", "2021-04-19", "nat@localegroup.au", "nat.mason@hotmail.com"],
  ["nash-sivayanam", "LPG-0065", "2021-05-10", "nash@localegroup.au", "nashs80@hotmail.com"],
  ["lane-dula", "LPG-0067", "2021-06-28", "lane@localegroup.au", "lane_dula@bigpond.com"],
  ["rachel-riggio", "LPG-0070", "2021-07-19", "rachel@localegroup.au", "rachelr87@gmail.com"],
  ["dianne-alvarez", "LPG-0073", "2021-08-16", "dianne@localegroup.au", "diannealvarez@hotmail.com"],
  ["shannan-murray", "LPG-0074", "2021-08-30", "shannan@localegroup.au", "shannan_murray@bigpond.com"],
  ["ray-shanks", "LPG-0075", "2021-09-13", "ray@localegroup.au", "ray.shanks79@bigpond.com"],
  ["lori-pirozzi", "LPG-0076", "2021-10-11", "lori@localegroup.au", "lpirozzi@gmail.com"],
  ["ciaran-fahy", "LPG-0077", "2021-11-22", "ciaran@localegroup.au", "ciaran_fahy@gmail.com"],
  ["hayden-wilson", "LPG-0078", "2022-07-18", "hayden@localegroup.au", "hwilson@outlook.com"],
  ["jordan-dench", "LPG-0081", "2022-07-18", "jordan@localegroup.au", "jordandench@yahoo.com.au"],
  ["de-wet-de-la-porte", "LPG-0084", "2022-10-10", "dewet@localegroup.au", "dewetd94@bigpond.com"],
  ["rachal-maffina", "LPG-0087", "2023-01-09", "rachal@localegroup.au", "rachalmaffina@gmail.com"],
  ["sharni-clavarino", "LPG-0089", "2023-02-20", "sharni@localegroup.au", "sclavarino@gmail.com"],
  ["pryncess-bungard", "LPG-0092", "2023-03-13", "pryncess@localegroup.au", "pryncessbungard@icloud.com"],
  ["jerry-delos-santos", "LPG-0094", "2023-05-01", "jerry@localegroup.au", "jerrys87@outlook.com"],
  ["sarah-jasmin", "LPG-0097", "2023-06-12", "sarah@localegroup.au", "sjasmin@hotmail.com"],
  ["kristen-margetts", "LPG-0099", "2023-07-03", "kristen@localegroup.au", "kristen.margetts@outlook.com"],
  ["elisa-kalliosalo", "LPG-0101", "2023-07-17", "elisa@localegroup.au", "ekalliosalo@gmail.com"],
  ["kathryn-carr", "LPG-0102", "2023-08-21", "kathryn@localegroup.au", "kathryncarr@gmail.com"],
  ["emily-dann", "LPG-0103", "2023-09-25", "emily@localegroup.au", "emilydann@yahoo.com.au"],
  ["renae-dysart", "LPG-0105", "2024-02-19", "renae@localegroup.au", "rdysart@gmail.com"],
  ["krystal-mosca", "LPG-0108", "2024-03-25", "krystal@localegroup.au", "krystal_mosca@hotmail.com"],
  ["monique-juratovac", "LPG-0109", "2024-05-27", "monique@localegroup.au", "moniquej97@hotmail.com"],
  ["brendan-ford", "LPG-0111", "2024-07-01", "brendan@localegroup.au", "brendanf89@gmail.com"],
  ["audris-quek", "LPG-0114", "2024-08-26", "audris@localegroup.au", "aquek@gmail.com"],
  ["brett-jenkinson", "LPG-0117", "2025-04-07", "brett@localegroup.au", "brett.jenkinson95@gmail.com"],
  ["tomas-watson", "LPG-0119", "2025-04-07", "tomas@localegroup.au", "tomasw89@bigpond.com"],
  ["andre-mikhail-serra", "LPG-0121", "2025-04-21", "andre@localegroup.au", "andre.serra00@hotmail.com"],
  ["matt-raven", "LPG-0123", "2025-04-21", "matt@localegroup.au", "matt.raven@bigpond.com"],
  ["jasmin-bainbridge", "LPG-0125", "2025-06-23", "jasmin@localegroup.au", "jasminbainbridge@icloud.com"],
  ["roni-nelson", "LPG-0126", "2025-06-30", "roni@localegroup.au", "roninelson@yahoo.com.au"],
  ["tim-hill", "LPG-0129", "2025-06-30", "tim@localegroup.au", "tim_hill@gmail.com"],
  ["karina-saxby", "LPG-0131", "2025-07-14", "karina@localegroup.au", "karina.saxby84@outlook.com"],
  ["alison-carter", "LPG-0132", "2025-08-04", "alison@localegroup.au", "alisoncarter@outlook.com"],
  ["ankit-kausik", "LPG-0134", "2025-09-15", "ankit@localegroup.au", "akausik@yahoo.com.au"],
  ["pablo-lopez", "LPG-0135", "2026-01-19", "pablo@localegroup.au", "pablol78@yahoo.com.au"],
  ["kristen-jackson", "LPG-0137", "2026-03-16", "kristenj@localegroup.au", "kristenjackson@gmail.com"],
  ["khai-tran", "LPG-0139", "2026-03-23", "khai@localegroup.au", "khaitran@bigpond.com"],
  ["michael-fox", "LPG-0140", "2026-06-15", "michael@localegroup.au", "michael.fox99@outlook.com"],
  ["steph-stritch", "LPG-0143", "2026-06-22", "steph@localegroup.au", "steph.stritch@icloud.com"],
  ["tristan-hatt", "LPG-0144", "2026-06-22", "tristan@localegroup.au", "thatt@outlook.com"],
  ["jan-kane-reroma", "LPG-0147", "2026-08-24", "jan@localegroup.au", "jreroma@outlook.com"],
  ["nam-su-byun", "LPG-0149", "2026-09-07", "nam@localegroup.au", "nam.byun93@bigpond.com"],
];

export const EMPLOYEE_RECORDS: Record<string, EmployeeRecord> = Object.fromEntries(
  RECORDS.map(([id, employeeId, commenced, workEmail, personalEmail]) => [
    id,
    { employeeId, commenced, workEmail, personalEmail },
  ]),
);

/** One person on the master list: their seat on the chart plus their record. */
export interface MasterRow {
  id: string;
  name: string;
  role: string;
  /** Shown in brackets after the name, as on the chart: "VIC", "Jay Tan". */
  note?: string;
  brands?: OrgBrand[];
  managerId: string | null;
  link?: OrgPerson["link"];
  department: OrgDepartmentId;
  isNew?: boolean;
  /** Taking the seat over (a transition): who holds it now. */
  takingOverFrom?: string;
  /** Missing for someone added in the Launchpad until Horilla issues their record. */
  record?: EmployeeRecord;
}

/** The master-list id of whoever is taking a seat over. Stays put if their name is edited. */
export const transitionIdOf = (p: OrgPerson) => (p.transition ? (p.transitionId ?? orgSlug(p.transition)) : null);

/** Horilla's record with the Launchpad's edits laid over it. No record until Horilla issues one. */
const withEdits = (id: string, edits?: RecordEdit): EmployeeRecord | undefined =>
  EMPLOYEE_RECORDS[id] ? { ...EMPLOYEE_RECORDS[id], ...edits } : undefined;

/**
 * Everyone employed across the group: each named seat on the org chart, plus
 * anyone taking a seat over (Alison Carter, Sales Operations). Vacant seats
 * aren't people, so they stay off. Employee-number order; anyone still without
 * a record comes last. Record edits ride on the seat, so every reader of the
 * chart sees them.
 */
export function masterList(people: OrgPerson[]): MasterRow[] {
  const rows: MasterRow[] = [];
  for (const p of people) {
    const department = orgDepartmentOf(people, p.id);
    const seat = { role: p.role, brands: p.brands, managerId: p.managerId, link: p.link, department };
    if (p.name) {
      rows.push({ ...seat, id: p.id, name: p.name, note: p.note, isNew: p.isNew, record: withEdits(p.id, p.edits) });
    }
    const tid = transitionIdOf(p);
    if (p.transition && tid) {
      rows.push({
        ...seat,
        id: tid,
        name: p.transition,
        takingOverFrom: p.name ?? p.role,
        record: withEdits(tid, p.transitionEdits),
      });
    }
  }
  return rows.sort((a, b) => {
    if (!a.record || !b.record) return Number(!a.record) - Number(!b.record);
    return a.record.employeeId.localeCompare(b.record.employeeId);
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-07" → "7 Sep 2026". */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** A full name in parts, for editing, as HRIS splits it. */
export interface NameParts {
  first: string;
  middle: string;
  last: string;
}

const NAME_PARTICLES = new Set(["da", "de", "del", "der", "di", "do", "dos", "du", "la", "le", "van", "von"]);

/** "Kristian Charlon Serrano" → first, middle, last. A lower-case particle stays with the surname: "de la Porte". */
export function splitName(name: string): NameParts {
  const t = name.trim().split(/\s+/).filter(Boolean);
  if (t.length < 2) return { first: t[0] ?? "", middle: "", last: "" };
  let i = t.length - 1;
  while (i > 1 && NAME_PARTICLES.has(t[i - 1])) i--;
  return { first: t[0], middle: t.slice(1, i).join(" "), last: t.slice(i).join(" ") };
}

/** The parts back into the one name the chart and the master list show. */
export const joinName = (p: NameParts) =>
  [p.first, p.middle, p.last]
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(" ");

/** Time served from the commencement date to `today`, as HRIS writes it: "4y 2m", "4y", "8mo", "12d", "New". */
export function tenure(commenced: string, today: Date): string {
  const [y, m, d] = commenced.split("-").map(Number);
  const months = (today.getFullYear() - y) * 12 + today.getMonth() + 1 - m - (today.getDate() < d ? 1 : 0);
  if (months < 1) {
    const days = Math.floor((today.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
    return days <= 0 ? "New" : `${days}d`;
  }
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  return yrs && mos ? `${yrs}y ${mos}m` : yrs ? `${yrs}y` : `${mos}mo`;
}

/* ── Pay rates ─────────────────────────────────────────────────────────── */

/** An hourly pay rate in AUD: ordinary time and overtime, and the day it applies from. */
export interface PayRate {
  hourly: number;
  overtime: number;
  /** Effective date (ISO). */
  effective: string;
}

/** The last rate review (start of the financial year). Seed rates apply from here, or from commencement if later. */
export const RATE_REVIEW = "2026-07-01";

/** Overtime is time-and-a-half unless set otherwise. */
export const OVERTIME_MULTIPLIER = 1.5;

/** Ordinary hourly rate by position at the last review (AUD, before super). Placeholder until Horilla is wired in. */
const HOURLY_BY_ROLE: Record<string, number> = {
  "Managing Director": 125,
  "Non-Exec Director": 110,
  "Senior Executive Assistant": 42,
  "Head of Finance": 92,
  "Finance Broker": 52,
  "Broker Support": 34,
  "Head of Sales": 95,
  "Advocate Manager VIC": 62,
  "Advocate Manager QLD": 62,
  "Advocate Manager WA": 62,
  "New Home Advocate": 40,
  "Sales Associate": 36,
  "Sales Operations Manager": 58,
  "Workflow & Compliance Lead": 46,
  "Administration Officer": 32,
  "Business Development Manager": 60,
  "Wealth Manager": 70,
  "Property Investment Partner": 48,
  "Head of Marketing": 88,
  "Group Performance Manager": 64,
  "Social Media Lead": 44,
  "Senior Video Editor & Content Production Lead": 48,
  "Graphic Designer": 40,
  "Content Coordinator": 36,
  "Senior Media Buyer": 50,
  "Marketing Manager – Wealth & Financial": 58,
  "Marketing Manager – Homes": 58,
  "Marketing Specialist": 42,
  "Company Accountant": 72,
  "Head of AI & Growth Systems": 90,
  "IT Systems Engineer": 52,
  "AI Engineer – Sales & Marketing": 55,
  "AI Engineer": 55,
};

/** Cents-safe rounding for a dollar figure. */
export const roundCents = (n: number) => Math.round(n * 100) / 100;

/**
 * Someone's rate at the last review: their position's rate plus 50c an hour
 * for each full year of service (up to five), overtime at time-and-a-half.
 * Null for a position with no rate on file.
 */
export function seedPayRate(row: MasterRow): PayRate | null {
  const base = HOURLY_BY_ROLE[row.role];
  if (base == null || !row.record) return null;
  const [y, m, d] = row.record.commenced.split("-").map(Number);
  const [ry, rm, rd] = RATE_REVIEW.split("-").map(Number);
  const years = Math.max(0, ry - y - (rm < m || (rm === m && rd < d) ? 1 : 0));
  const hourly = roundCents(base + Math.min(years, 5) * 0.5);
  return {
    hourly,
    overtime: roundCents(hourly * OVERTIME_MULTIPLIER),
    effective: row.record.commenced > RATE_REVIEW ? row.record.commenced : RATE_REVIEW,
  };
}

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

/** Attendance records to validate before July payroll — the Attendance footnote and the Overview card. */
export const ATTENDANCE_TO_VALIDATE = 2;

export const ATTENDANCE_FOOTNOTE = `${ATTENDANCE_TO_VALIDATE} attendance records need validation for July payroll.`;

/* ── Leave ─────────────────────────────────────────────────────────────── */

/**
 * Leave types, HRIS's set: what an employee picks as the reason they're out.
 * Vacation, Sick and Personal draw on a balance; Bereavement and Other are
 * granted case by case, so they carry none.
 */
export const LEAVE_TYPES = ["Vacation", "Sick", "Personal", "Bereavement", "Other"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const BALANCE_TYPES: readonly LeaveType[] = ["Vacation", "Sick", "Personal"];

export type LeaveStatus = "Pending" | "Approved" | "Declined" | "Cancelled";

export interface LeaveRequest {
  id: string;
  name: string;
  type: LeaveType;
  when: string;
  length: string;
  status: LeaveStatus;
  /** Working days this request takes off the requester's balance. */
  days: number;
  /** First and last day away (ISO dates), for the cover check. */
  start: string;
  end: string;
  /** The requester's balance for this type before the request, in days (Horilla); null when the type has none. */
  balance: number | null;
  /** Requests filed in the Employee portal say whose they are, which department and who decides them. */
  seatId?: string;
  department?: OrgDepartmentId;
  approver?: string;
  /** The requester's note to their manager. */
  reason?: string;
  /** ISO dates. */
  filed?: string;
  decidedBy?: string;
  decidedOn?: string;
}

/** The leave calendar's "today": the Employee portal's (see EMPLOYEE_TODAY). */
export const LEAVE_TODAY = "2026-10-04";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** ISO dates are read as UTC, so a date never shifts with the viewer's time zone. */
const utcDay = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Monday to Friday from `start` to `end`, both included. Public holidays aren't known here. */
export function workingDays(start: string, end: string): number {
  let n = 0;
  for (const d = utcDay(start); d <= utcDay(end); d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

/** "16 Oct", "19–23 Oct", "30 Sep – 2 Oct". */
export function leaveWhen(start: string, end: string): string {
  const [s, e] = [utcDay(start), utcDay(end)];
  const dm = (d: Date) => `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
  if (start === end) return dm(s);
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) return `${s.getUTCDate()}–${dm(e)}`;
  return `${dm(s)} – ${dm(e)}`;
}

export const leaveLength = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

/**
 * Who decides a seat's leave: the head of its department. A head's own leave
 * goes to their manager; the managing director's goes to no one here.
 */
export function leaveApprover(people: OrgPerson[], seatId: string): OrgPerson | null {
  const byId = new Map(people.map((p) => [p.id, p]));
  const head = byId.get(orgDepartment(orgDepartmentOf(people, seatId)).headId);
  if (head && head.id !== seatId) return head;
  const self = byId.get(seatId);
  return self?.managerId ? (byId.get(self.managerId) ?? null) : null;
}

/** Leave that still stands: waiting on a decision or approved. */
const live = (r: LeaveRequest) => r.status === "Pending" || r.status === "Approved";

/** Days of a type someone has taken or asked for. */
export function leaveUsed(requests: LeaveRequest[], name: string, type: LeaveType): number {
  return requests.filter((r) => r.name === name && r.type === type && live(r)).reduce((n, r) => n + r.days, 0);
}

/** Someone's own pending or approved leave that falls on any of these days. */
export function leaveOverlap(requests: LeaveRequest[], name: string, start: string, end: string): LeaveRequest | undefined {
  return requests.find((r) => r.name === name && live(r) && r.start <= end && r.end >= start);
}

/** A queue's order: pending soonest first (what to decide next), then the rest newest first. */
export function leaveOrder(a: LeaveRequest, b: LeaveRequest): number {
  const ap = a.status === "Pending";
  const bp = b.status === "Pending";
  if (ap !== bp) return ap ? -1 : 1;
  return ap ? a.start.localeCompare(b.start) : b.start.localeCompare(a.start);
}

/** A seeded request from its dates: the when, length and working days follow from them. */
function filedLeave(
  seatId: string,
  type: LeaveType,
  start: string,
  end: string,
  status: LeaveStatus,
  balance: number | null,
  extra: Partial<LeaveRequest> = {},
): LeaveRequest {
  const seat = ORG_SEED.find((p) => p.id === seatId)!;
  const days = workingDays(start, end);
  return {
    id: `${seatId}-${start}`,
    name: seat.name!,
    type,
    when: leaveWhen(start, end),
    length: leaveLength(days),
    status,
    days,
    start,
    end,
    balance,
    seatId,
    department: orgDepartmentOf(ORG_SEED, seatId),
    approver: leaveApprover(ORG_SEED, seatId)?.name ?? undefined,
    ...extra,
  };
}

const decided = (filed: string, decidedOn: string) => ({ filed, decidedOn, decidedBy: "Jerry Delos Santos" });

/**
 * AI & Growth's year so far, so its head's Approvals run past a page. Sample
 * requests with made-up dates (Horilla isn't connected); balances follow
 * placeholder allowances of Vacation 15, Sick 5 and Personal 3, and Kane's
 * follow LEAVE_ALLOWANCE in the Employee portal.
 */
const AI_GROWTH_LEAVE: LeaveRequest[] = [
  filedLeave("pablo-lopez", "Personal", "2026-02-02", "2026-02-02", "Declined", 3, { reason: "Car service", ...decided("2026-01-28", "2026-01-29") }),
  filedLeave("pablo-lopez", "Sick", "2026-03-12", "2026-03-13", "Approved", 5, decided("2026-03-12", "2026-03-12")),
  filedLeave("pablo-lopez", "Vacation", "2026-04-13", "2026-04-17", "Approved", 15, decided("2026-03-23", "2026-03-24")),
  filedLeave("pablo-lopez", "Sick", "2026-06-09", "2026-06-09", "Approved", 3, decided("2026-06-09", "2026-06-09")),
  filedLeave("pablo-lopez", "Vacation", "2026-08-24", "2026-08-28", "Approved", 10, { reason: "Family trip", ...decided("2026-08-03", "2026-08-04") }),
  filedLeave("pablo-lopez", "Personal", "2026-09-21", "2026-09-21", "Approved", 3, decided("2026-09-14", "2026-09-15")),
  filedLeave("pablo-lopez", "Vacation", "2026-12-21", "2026-12-23", "Approved", 5, decided("2026-10-01", "2026-10-02")),
  filedLeave("pablo-lopez", "Personal", "2026-11-06", "2026-11-06", "Pending", 2, { reason: "Graduation", filed: "2026-10-03" }),
  filedLeave("andre-mikhail-serra", "Vacation", "2026-03-09", "2026-03-11", "Cancelled", 15, { filed: "2026-02-20" }),
  filedLeave("andre-mikhail-serra", "Sick", "2026-05-18", "2026-05-18", "Approved", 5, decided("2026-05-18", "2026-05-18")),
  filedLeave("andre-mikhail-serra", "Vacation", "2026-07-06", "2026-07-10", "Approved", 15, { reason: "Family trip", ...decided("2026-06-15", "2026-06-16") }),
  filedLeave("andre-mikhail-serra", "Personal", "2026-08-14", "2026-08-14", "Declined", 3, { reason: "Errands", ...decided("2026-08-10", "2026-08-11") }),
  filedLeave("andre-mikhail-serra", "Vacation", "2026-10-19", "2026-10-23", "Pending", 10, { reason: "Holiday", filed: "2026-10-02" }),
  filedLeave("andre-mikhail-serra", "Other", "2026-10-30", "2026-10-30", "Pending", null, { reason: "Moving house", filed: "2026-10-02" }),
  filedLeave("jan-kane-reroma", "Sick", "2026-10-01", "2026-10-01", "Approved", 5, decided("2026-10-01", "2026-10-01")),
  filedLeave("jan-kane-reroma", "Personal", "2026-10-16", "2026-10-16", "Pending", 3, { reason: "Passport appointment", filed: "2026-10-03" }),
  filedLeave("jan-kane-reroma", "Vacation", "2026-12-22", "2026-12-24", "Pending", 10, { reason: "Christmas with family", filed: "2026-10-03" }),
];

/** HR's own queue (people off the org chart), then AI & Growth's. */
export const LEAVE_SEED: LeaveRequest[] = [
  {
    id: "mercer-nov",
    name: "A. Mercer",
    type: "Vacation",
    when: "11–13 Nov",
    length: "3 days",
    status: "Pending",
    days: 3,
    start: "2026-11-11",
    end: "2026-11-13",
    balance: 11.6,
  },
  {
    id: "ellery-oct",
    name: "K. Ellery",
    type: "Personal",
    when: "23 Oct",
    length: "1 day",
    status: "Pending",
    days: 1,
    start: "2026-10-23",
    end: "2026-10-23",
    balance: 4,
  },
  {
    id: "hart-nov",
    name: "S. Hart",
    type: "Vacation",
    when: "16–20 Nov",
    length: "5 days",
    status: "Approved",
    days: 5,
    start: "2026-11-16",
    end: "2026-11-20",
    balance: 17.4,
  },
  ...AI_GROWTH_LEAVE,
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
  { name: "D. Okafor", type: "Vacation", when: "19–20 Oct", start: "2026-10-19", end: "2026-10-20" },
  { name: "Kellie Rowe", type: "Vacation", when: "30 Oct", start: "2026-10-30", end: "2026-10-30" },
];

/** Everyone booked off: the team calendar plus requests approved in the queue, soonest first. */
export function bookedLeave(queue: LeaveRequest[]): TeamAbsence[] {
  return [...TEAM_LEAVE, ...queue.filter((r) => r.status === "Approved")]
    .map(({ name, type, when, start, end }) => ({ name, type, when, start, end }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Booked leave that hasn't ended yet. */
export const upcomingLeave = (queue: LeaveRequest[]) => bookedLeave(queue).filter((a) => a.end >= LEAVE_TODAY);

/** Who else is away while this request would be: the approver's cover check. */
export function othersOff(req: Pick<LeaveRequest, "name" | "start" | "end">, queue: LeaveRequest[]): TeamAbsence[] {
  return bookedLeave(queue).filter((a) => a.name !== req.name && a.start <= req.end && a.end >= req.start);
}

/** The requester's balance once this request is taken, in days; null when the type has none. */
export function balanceAfter(req: Pick<LeaveRequest, "balance" | "days">): number | null {
  return req.balance === null ? null : Math.round((req.balance - req.days) * 10) / 10;
}

/**
 * The staff inbox's call to action for a request filed in the Employee
 * portal. It's resolved (dropped) once the request is decided or withdrawn.
 */
export const leaveNotice = (r: LeaveRequest) =>
  `Leave to approve: ${r.name}, ${r.type.toLowerCase()} ${r.when} (${r.length}). Waiting on ${r.approver ?? "their manager"} (Employee portal)`;

/** "8.6 days" — leave balances always carry one decimal, as Horilla shows them. */
export const formatDays = (n: number) => `${n.toFixed(1)} days`;

/** The approver's own balances (S. Hart), shown apart from the approval queue. */
export const LEAVE_BALANCES: { label: string; value: string }[] = [
  { label: "Vacation", value: "12.4 days" },
  { label: "Personal", value: "6.0 days" },
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
