# Employee Master Roster: design

**Date:** 2026-10-06
**Status:** approved in conversation, awaiting written review
**Builds on:** HR's org chart and Global Master List (`modules/hr/`), Admin (`modules/admin/`), Accounting's
Pay run (`modules/accounting/`), the Employee portal (`modules/employee/`)

## Goal

Make Locale's **Employee Master Roster** (the HR spreadsheet, kept at
`Reference/Employee Master Roster*.xlsx`) the source of every employee record in the Launchpad. It
replaces the "mirrored from Horilla" records. The Global Master List carries the roster's fields, and
every dashboard that reads people agrees with it.

What Kane said:

- "Check and analyze @Reference/Employee Master Roser and make sure that this will now update all the
  fields in our Global Master List as this will now be the one responsible for all the Employee records
  from now on check all affected stuff in our Dashboards"

What was agreed in the conversation:

| Question | Decision |
| --- | --- |
| The repo is public. Which roster fields go into git? | **Work fields only.** Birthday, Employee Folder links and Remarks live in a git-ignored file generated from `Reference/`. A build without it shows those fields as *Kept locally*. |
| Editing people in the Launchpad | **Roster-only, keep pay.** People, roles, reporting lines and dates change in the spreadsheet and arrive by re-import. Edit profile, department moves, Add person and Fill seat come out. Pay rates and one-off Pay stay. |
| Kane's start date (roster: 29 Sep 2026) vs the Employee portal's sample history (from 24 Aug) | **Follow the roster.** Kane's history starts the week of 27 Sep. |
| How the roster gets in | **An import script**, `npm run roster`, re-run whenever HR updates the sheet. |
| Conflicts between the roster and today's chart | **The roster wins**, reporting lines included. |
| Ids | **Stable.** Today's seat ids survive through an alias table. New people get a slug of their roster name. |
| Sales teams | **Unchanged.** They are HubSpot owner groups, not reporting lines. |

Out of scope:

- The fictional mockup people (A. Mercer, K. Ellery, D. Okafor, S. Hart, Kellie Rowe, Lane Dixon,
  Diane Cruz) on deals, jobs, leave, attendance, assets, expenses and IT tickets. They aren't roster
  records.
- Home's celebrations. They could read local birthdays later.
- An in-app roster upload. The import script covers it for now.
- The Sales portal spec (`2026-10-06-sales-portal-design.md`) and Sales' HubSpot data.
- The pay currency. The pay run keeps converting to pesos; see Open points.

## 1. The roster as it stands

Read from `Employee Master Roster 1.xlsx`, the copy in `Reference/` on 2026-10-06.

**Sheets.** `Active` (81 rows), `Inactive` (31 rows), and `Sheet2`, which holds the Company Name
dropdown list. Columns start at D; A to C are empty.

**Active sheet columns:** Company Name, Division, Department, Location, Employee Name, Reports To,
Role, Birthday, Employment Type, Probation Status, Start Date, Confirmation Date, End Date, Status,
Employee Folder, Remarks.

**Inactive sheet columns:** the same, without Location.

**What the rows hold:**

- **Active sheet:** 79 rows are Active. Two are TBA:
  - the vacant Advocate Manager QLD seat, named "TBA";
  - Christopher Wootton, starting 2 Nov 2026.
- **Values:**
  - **Companies:** Locale Homes Australia Pty Ltd (64), Locale Wealth Pty Ltd (11), Locale Financial
    Pty Ltd (6).
  - **Divisions:** Locale Homes (43), Locale Property Group (19), Locale Wealth (11), Locale
    Financial (8).
  - **Departments:** Sales (53, including the vacancy), Marketing (10), Finance (8), Operations (4),
    Information Technology (4), Accounting (1), Executive Office (1).
  - **Locations:** Australia (70), Philippines (9), Nicaragua (1), TBA (1).
  - **Employment types:** Contractor (67), Employment - Full Time (11), Employment - Part Time (2),
    TBA (1). The Inactive sheet adds Casual.
  - **Probation statuses:** N/A, Passed, On Probation (5), TBA. The Inactive sheet adds Failed.
- **Missing.** There are no employee numbers and no emails.

**Against today's org chart** (`ORG_SEED`, 70 named seats):

- **New (11):** Luisa Travan, Steve Ross, Christopher Wootton, Edward Matkovic, Danae Kasimis, Taner
  Kibar, Marianne Simmons, Simon Murray, Angus Brandt, Anandha Balachandirane, Candice Joyce.
- **Gone:** Ray Shanks is on the Inactive sheet as Raymond Shanks. Adam Schaal and Yasmin Georgiadis
  aren't on the roster at all, but appear in Reports To.
- **Legal vs go-by names:**

  | Roster | Today's chart |
  | --- | --- |
  | Bradley Linford | Brad Linford |
  | Jericho Delos Santos | Jerry Delos Santos |
  | Natalie Mason | Nat Mason |
  | Ronalyn Nelson | Roni Nelson |
  | Loretana Pirozzi | Lori Pirozzi |
  | Naresh Sivayanam | Nash Sivayanam |
  | Pablo Rafael Lopez Solorzano | Pablo Lopez |
  | Maria Joana Soriano | Maria Soriano |
  | Oliver Cheveralls | Oli Chevellas (a different spelling) |
  | Tim Hill (VIC) | Tim Hill, note VIC |
  | Jian Wen (Jay Tan) | Jian Wen, note Jay Tan |

- **Reporting lines:**
  - Alison Carter holds Sales Operations Manager. Today's chart shows a transition.
  - Larnie Clark is Operations Manager under Adam Schaal.
  - Shannan Murray and Rachel Riggio report to Alison.
  - Keira Whitbread and Elisa Kalliosalo report to Kellie Boyer.
  - Kristian Charlon Serrano and Sarah Jasmin report to Keira.
  - Tristan Hatt reports to Sean O'Neill.
- **Roles:** Elisa is Marketing & Content Coordinator, Andre Mikhail Serra is AI Engineer, Larnie is
  Operations Manager.
- **Start dates:** every one differs from today's, except Lane Dula's. Today's were placeholders.

**Problems in the sheet itself** (the import copes; worth fixing at source):

- Ciaran Fahy's and Nathan Good's Start Dates are text, not dates.
- Six Employee Folder cells read "Link" with no link behind them.
- Brendan Ford reports to the vacant Advocate Manager QLD.
- Maria Joana Soriano reports to "Adam Schaal / Yasmin Georgiadis".
- Confirmation Date is mostly a formula (Start + 90 or + 180).
- Roles carry stray spaces ("Group  Performance Manager", "Social Media Lead ").
- O'Neill is spelled with a curly apostrophe in some cells.
- The Inactive sheet uses short company names ("Locale Homes") and has blanks.

## 2. Import

### `npm run roster`

`scripts/import-roster.mjs`, a Node script. It uses `exceljs` (devDependency), which reads formulas'
cached results and cell hyperlinks.

- **Input.** The path given as an argument. Otherwise the newest `Reference/Employee Master Roster*.xlsx`.
- **Columns.** Found by header text, not position. The two sheets differ, since Inactive has no
  Location.
- **Rows.**
  - A row with no Employee Name is skipped.
  - A row named "TBA" is a vacant seat.
- **Cleaning:**
  - Trims every value and collapses double spaces.
  - Normalises curly apostrophes.
  - Text dates ("1 May 2026") become ISO dates.
  - Confirmation Date takes the formula's result.
  - "TBA" and "N/A" become empty.
- **Outputs:**
  - **`src/data/roster.ts`:** generated and committed. It opens with "Generated by `npm run roster`
    from <file> on <date>. Don't edit by hand."
  - **`src/data/roster.private.ts`:** generated and git-ignored.
- **Report.** The script prints:
  - counts;
  - who's new and who's gone since the last `roster.ts`;
  - changed fields per person;
  - every problem it coped with.
- **Failure.** It exits non-zero, writing nothing, when an active row's Reports To doesn't resolve.

### What's committed and what's private

**`roster.ts`** exports:

- **`ROSTER_SOURCE`:** `{ file, importedOn }`.
- **`ROSTER: RosterRecord[]`:** one record per row of both sheets, in sheet order. Each record holds:
  - id, name, role, company, division, department, location;
  - `reportsTo`, the manager's id, or the raw text for an inactive row;
  - employmentType, probation, start, confirmation, end;
  - status (`active`, `inactive` or `pending` for TBA);
  - `folderOnFile`, a boolean.

**`roster.private.ts`** exports `ROSTER_PRIVATE: Record<id, { birthday?, folderUrl?, remarks? }>`.

**The private stub.** `src/data/roster.private.stub.ts` is committed. It has the same export, `{}`.

**How the app finds the private file:**

- `next.config.ts` sets `turbopack.resolveAlias["@roster-private"]`:
  - to the private file when it exists;
  - to the stub when it doesn't.
- `tsconfig.json` maps `@roster-private` to the stub for type-checking.
- A clone of the public repo builds with the stub.

**The types** live in a hand-written `src/data/roster-types.ts`.

**Caveat.** Deploying from a working copy that has the private file ships it in the bundle. Deploy from
git, or delete the file first.

### Ids, names and the chart overlay

`src/data/roster-overlay.json` is committed and hand-edited. Both the script and the app read it. It
holds what the roster doesn't:

- **`ids`.** Roster name → today's id, so existing ids survive. For example, "Bradley Linford" →
  `brad-linford`, "Jericho Delos Santos" → `jerry-delos-santos` and "Oliver Cheveralls" →
  `oli-chevellas`. Everyone else's id is `orgSlug(name)`.
- **`goesBy`.** id → the name they go by: Brad, Jerry, Nat, Roni, Lori, Nash, Oli, Kane. It becomes
  `preferredName`, shown in brackets after the name. Reports To resolves against full names and go-by
  names alike, so "Brad Linford" finds `brad-linford`.
- **`notes`.** A roster name with a bracket, such as "Tim Hill (VIC)" or "Jian Wen (Jay Tan)", becomes
  the name plus a chart note. This replaces today's hand-set `note`.
- **`directors`.**
  - Adam Schaal: Managing Director, the chart's root.
  - Yasmin Georgiadis: Non-Exec Director, `link: "peer"`.
  - Both have department Leadership and division Locale Property Group.
- **`links`.** Maria Joana Soriano is `link: "assistant"` under Adam Schaal. For her "Adam Schaal /
  Yasmin Georgiadis", the first name is the manager.
- **`vacancies`.** A vacant row's id, e.g. `advocate-manager-qld`.
- **`departmentHeads`** (section 3).
- **`placeholderEmails`.** id → the Launchpad sign-in, carried over from today's records. New people
  get `first@localegroup.au`, with the surname initial added on a clash, as today (`adamo@`).

## 3. The data model in the app

`hr/data.ts` keeps its exports' names, so consumers and the Tickets branch change as little as possible.

**`ORG_SEED`.** Built from `ROSTER` (active and pending rows) plus the overlay.

- **Seat.** Each person or vacancy is a seat. `managerId` is its Reports To.
- **Brands.** From Division:
  - Locale Homes → `homes`;
  - Locale Financial → `financial`;
  - Locale Wealth → `wealth`;
  - Locale Property Group → none (group services).
- **`team`.** Worked out. Two or more reports of one manager who share a role and lead no one form a
  block named for the role, pluralised: "New Home Advocates", "Finance Brokers", "Property Investment
  Partners", "Broker Support". This replaces `orgTeam()`.
- **`isNew`.** Start date no earlier than 30 days before `ROSTER_SOURCE.importedOn`. That includes
  people who haven't started yet.

**"Today" for roster facts is the import date.** `ROSTER_SOURCE.importedOn` is the as-of date for:

- statuses;
- `isNew`;
- headcounts;
- Admin's starting grants.

That way the server and the client agree, and the numbers match the snapshot. Tenure keeps the viewer's
clock, as today.
- **Removed.** `transition`, `transitionId`, `transitionEdits` and `edits`.

**Departments are the roster's field.** `ORG_DEPARTMENTS` becomes:

| id | Name | Head |
| --- | --- | --- |
| `leadership` | Leadership | `adam-schaal` |
| `finance` | Finance | `brad-linford` |
| `sales` | Sales | `sean-oneill` |
| `marketing` | Marketing | `kellie-boyer` |
| `operations` | Operations | `larnie-clark` |
| `it` | Information Technology | `jerry-delos-santos` |
| `accounting` | Accounting | `aled-smith` |
| `executive` | Executive Office | `maria-soriano` |

- **Reading a department.** `orgDepartmentOf(people, id)` reads the seat's department; it no longer
  walks the tree. A vacancy takes its roster row's department.
- **The ids that go.** `ai` and `accounts` are retired. Every literal use moves to `it` and
  `accounting`, e.g. `employee/data.ts`'s `orgDepartment("accounts")`.

**`EmployeeRecord` becomes the roster record:** company, division, location, employmentType, probation,
start, confirmation, end, status, folderOnFile, and `workEmail` (the placeholder sign-in).

- **Removed:** `employeeId`, `commenced` (now `start`), `personalEmail`, `mobile`.
- **Kept:** `preferredName`, from the overlay.
- **`EMPLOYEE_RECORDS`.** Keyed by id, built from `ROSTER`. It includes inactive rows.

**`MasterRow`:**

- **Gets:** `status`, worked out:
  - `inactive` when the roster says Inactive;
  - `starting` when the start date is after the import date, or the roster says TBA;
  - `probation` when Probation Status is On Probation;
  - otherwise `active`.
- **Loses:** `takingOverFrom`.
- **`masterList(people, today)`:**
  - returns the active and pending people from the chart, plus inactive rows from `ROSTER`, plus the
    two directors (department Leadership, role from the overlay, no roster record);
  - vacancies stay off;
  - sorts by name, A to Z.

**`useRosterPrivate(id)`** returns the private fields, or `null` when the stub is in use. The screens
show *Kept locally* for null.

**`org-store.ts`.**

- **Kept.** `useOrg()` returns `{ people }`, the roster-built chart.
- **Removed:**
  - `addPerson`, `fillSeat`, `transferNow`, `scheduleTransfer`, `cancelTransfer`, `transferBlock` and
    `updateProfile`;
  - the `pending`, `scheduled` and `saving` state.

**Pay rates.**

- `HOURLY_BY_ROLE` gets a rate for every active roster role. That includes Operations Manager,
  Marketing & Content Coordinator, and the roster's hyphenated marketing manager titles. The
  chart-only titles go.
- `seedPayRate` reads `record.start`. Inactive people and directors have no rate.
- The rates stay placeholders.

## 4. HR

### Global Master List

**Header.** "Global Master List", then "Everyone on Locale's Employee Master Roster · imported 6 Oct
2026 from Employee Master Roster 1.xlsx".

**Toolbar:**

- **Status:** `SlidingTabs`, Active (default) · Inactive · All, with counts. Active covers active,
  probation and starting.
- **Department:** the 8 departments, with counts.
- **Search, Export CSV, and the table/cards switch** stay as they are.

**Table columns:**

- **Employee:**
  - avatar, name, then the preferred name or note in brackets;
  - division on the second line, where the employee ID was.
- **Department.**
- **Position.**
- **Location.**
- **Employment type.** Shortened: "Full time", "Part time", "Contractor", "Casual".
- **Start date.**
- **Tenure.** Or "Starts 2 Nov" when the start is ahead, or "Left" for inactive.
- **Status.** A pill: Active `ok`, On probation `pending`, Starting `tone`, Inactive `neutral`.
- **Actions.**

The cards show the same fields. Motion and paging are unchanged.

**Actions:**

- **Pay · View · Rates.**
  - Rates is today's Edit, cut down to the pay-rate form. It becomes `master-list/RatesDialog.tsx`.
  - Edit's profile and department parts go, along with the scheduled-move line (`BookedLine`).
- **Inactive rows and directors:** View only. Directors aren't on the roster, so they have no start date
  and no pay rate.

**View dialog (`RecordDialog`):**

- **Header pills:** department, then the status.
- **Employment:** Position, Department, Division, Company, Employment type, Probation status, Start date,
  Confirmation date, End date, Tenure, Status.
- **Personal:**
  - **Location.**
  - **Birthday.**
  - **Employee folder:** "Open folder", linking to `folderUrl`; or "No folder link in the roster" when
    `folderOnFile` is false.
  - **Remarks.**
  - Without the private file, Birthday, Employee folder and Remarks read *Kept locally*.
- **Reporting line:** Reports to, Team, Direct reports.
- **Pay:** unchanged.
- **Launchpad sign-in:** the work email, with "Placeholder until the roster has emails".
- **A director's record:** Employment shows "Director · not on the Employee Master Roster".

**Search** covers name, preferred name, note, role, department, division, company, location and
employment type.

**CSV export:**

- **Columns:** Name, Preferred name, Company, Division, Department, Location, Position, Reports to,
  Employment type, Probation status, Start date, Confirmation date, End date, Tenure, Status, Hourly
  rate (AUD), Overtime rate (AUD).
- **Private columns:** Birthday, Employee folder and Remarks are added only when the private file is
  present.

### Org chart

- **Read-only.** Removed:
  - the "+" under seats, "Add to team" and "Fill seat";
  - Add person in the header;
  - `AddPersonDialog.tsx`.
- **Header meta:** "N people · 1 vacant · roster imported 6 Oct".
- **Department tabs:** Whole company, plus the 8 departments with counts.
- **One department on its own.** The head's tree first, cut to members of that department. Then, as
  separate roots, any member whose manager sits outside it. For example, Operations is Larnie Clark,
  then Alison Carter with Shannan Murray and Rachel Riggio under her.
- **Leadership** shows the directors and the department heads, as the summary does today.

### Overview

- **Total employees.** Active roster people who had started by the import date. Directors aren't
  counted.
- **New joiners.** Started in the 30 days up to the import date.
- **Open positions.** Vacant seats.
- **On leave today.** Stays sample.
- **Division split (`DIVISIONS`).** Worked out from active people: Locale Homes, Locale Property Group,
  Locale Wealth, Locale Financial.
- **New card, Probation:**
  - lists everyone On Probation with their confirmation date, soonest first;
  - says "Due in N days", or "Overdue" in caution tone once the date has passed;
  - shows rows in the master-list style and opens their record.
- **Attendance, Recruitment and Performance cards:** unchanged.

`HR_KPIS` stays only for the sample figures, `onLeaveToday`.

## 5. Admin

- **Global Master List and Roles:**
  - The directory is the active roster plus the directors. Inactive people can't sign in, so they
    aren't listed.
  - The department filter uses the 8 departments.
- **Detail panel:**
  - **Shows:** Position, Department, Division, Location, Employment type, Start date, Status, Sign-in
    email.
  - **Drops:** employee ID, mobile and personal email.
- **`identityEmail`.** The placeholder sign-in. The no-email notice in Roles stays for anyone without
  one.
- **Starting grants (`DEPARTMENT_ROLES`):**

  | Department | Roles |
  | --- | --- |
  | Finance | `finance` |
  | Sales | `sales`, or `wealth` for the Locale Wealth division |
  | Marketing | `marketing` |
  | Operations | `operations`, `projects` (`tickets` once the Tickets branch lands) |
  | Information Technology | `it` |
  | Accounting | `accounts`, `accounting` |
  | Executive Office | `hr`, `knowledge` |
  | Leadership | `leadership` |

- **`EXTRA_ROLES`.**
  - Unchanged ids.
  - Maria's `hr` and `knowledge` now come from her department, so they leave her extras.
  - `alison-carter` keeps `operations` and `projects`.
- **Not started yet.** Someone whose start date is after `ROSTER_SOURCE.importedOn` gets no starting
  grants ("No dashboard yet"). That's Candice Joyce, Angus Brandt, Anandha Balachandirane and
  Christopher Wootton as of this import. Nam Su Byun's made-up case goes.
- **`SECTION_LIMITS` and `PRESENCE_SEED`:** unchanged.
- **Overview:** headcount and department counts from the directory.

## 6. Other dashboards

### Accounting: Pay run

- **Payees (`PAYEE_IDS`).** Worked out: active roster contractors whose Location isn't Australia, with
  the previewed employee first. That's 10:
  - Jan Kane Reroma, Jerry Delos Santos, Pablo Lopez, Andre Mikhail Serra, Maria Soriano, Kristian
    Charlon Serrano, Sarah Jasmin, Dianne Alvarez;
  - and, new, Lane Dula and Nam Su Byun.
- **`PAYEE_SEED`.** Keeps addresses and payment methods, as sample data. It adds two:
  - Lane Dula: Wise, sample details.
  - Nam Su Byun: bank wire, sample details.
  - A payee with no seed entry has no payment method, and Validation holds them.
- **Invoice history.** Only weeks that end on or after a payee's start date. Nam Su Byun (started 30
  Sep) has the latest week only, pending.
- **Kane.** Jan Kane Reroma drops out of every past run:
  - the run builder reads the portal's new seed;
  - the 29 Sep run's `skipped` count no longer counts Kane's week of 20 Sep.
- **Invoice sender.** `from.country` is the payee's roster Location, so Pablo reads Nicaragua.
  `personOf` returns roster names.
- **Wording.** `AccountingOverview`'s "offshore team" copy stays. The definition now comes from the
  roster.

### Employee portal

- **`EMPLOYEE`.**
  - Name Jan Kane Reroma, going by Kane.
  - AI Engineer, Information Technology, manager `jerry-delos-santos`.
  - Contractor, Philippines, start 29 Sep 2026.
- **`PAY_WEEKS`.** One week, `2026-09-27`, with hours `[0, 0, 8, 8, 8, 8, 0]`: Tuesday 29 Sep to
  Friday 2 Oct. Sample hours.
- **`SEED_INVOICES`.** Empty, so the Overview asks Kane to invoice the week of 27 Sep – 3 Oct. Invoice
  numbering starts at 1.
- **Profile:**
  - "From Horilla" becomes "From the Employee Master Roster";
  - the record shows the roster's fields;
  - no employee ID.
- **Department tab.** Information Technology: Jerry, Pablo, Andre, Kane. Newest starter reads `start`.
- **Sidebar.** `dashboards.ts` persona line: "Information Technology · AI Engineer".

### Jarvis (`jarvis-knowledge.ts`)

- **Headcount.** Answers from the roster: employees, divisions, departments, new joiners, probation.
- **Admin and Employee answers.** Read the new departments and records.
- **Wording.** "Horilla · live" becomes "Employee Master Roster" for records. Leave and attendance
  answers keep Horilla.

### Leadership and IT

- `LeadershipOverview`'s headcount and `leadership/data.ts`'s "23" read the HR Overview's Total
  employees. That figure is a function of the roster and the import date, so a static module can use it.
- `it/data.ts`'s `phishingDue` does the same.

### Wording

"Horilla" becomes "the Employee Master Roster" where the copy is about employee records:

- the master list;
- `hr/data.ts` comments;
- the Rates dialog's toasts;
- the Employee Profile;
- Jarvis.

Leave, attendance, assets and recruitment keep Horilla.

### Tickets branch (`feat/tickets-dashboard`)

- **Unaffected:**
  - It reads `ORG_SEED` and ids `jan-kane-reroma`, `jerry-delos-santos`, `pablo-lopez` and
    `andre-mikhail-serra`. All survive.
  - Its swap of `projects` → `tickets` in `EXTRA_ROLES` still applies.
- **Changes:** names show as the roster has them.
- **Merging:** whichever lands second rebases. The Operations `DEPARTMENT_ROLES` row then reads
  `tickets`.

## 7. Testing

**`scripts/check-roster.mjs`** (Node `assert`) runs the import's parser on the real file and asserts:

- 80 active and pending people, 1 vacancy and 31 inactive rows;
- the 7 roster departments, with the counts in section 1 (Sales' 53 includes the vacancy);
- every active Reports To resolves;
- every alias id survives (`brad-linford`, `jerry-delos-santos`, `oli-chevellas`, `nat-mason`,
  `roni-nelson`, `lori-pirozzi`, `nash-sivayanam`, `pablo-lopez`, `maria-soriano`);
- the text start dates parse (Ciaran Fahy 2026-05-01, Nathan Good 2025-02-18);
- confirmation formulas resolve (Bradley Linford: 2025-04-14 + 180);
- the generated `roster.ts` contains no birthday, Drive URL or remark text.

**Build checks:**

- `npm run lint` and `npm run build` pass with the private file and without it.
- For the build without it: move the private file aside and rebuild.

**In the browser:**

- **HR:**
  - the master list with each status filter and department;
  - View for an active person, a starter, an inactive person and a director;
  - Rates, Pay and CSV;
  - the org chart's Operations and Information Technology tabs;
  - the Overview's Probation card.
- **Admin:** Roles for a not-started person.
- **Accounting:** the Pay run with 10 payees, Nam's single invoice, and Kane absent from history.
- **Employee portal:** the Overview prompt, Profile and Department.

## Open points

- **Pay currency.** The pay run converts everyone to pesos, but Pablo is in Nicaragua. This was already
  unconfirmed (rates and currency are placeholders).
- **Jesse Williamson.** HubSpot (Sales' `TEAMS`, scorecards) says "Jesse Williamson" where the roster
  says Jessica Williamson. Is it the same person? Sales is untouched until Kane confirms.
- **Real emails and employee numbers.** Sign-ins stay placeholders until the roster carries them.
