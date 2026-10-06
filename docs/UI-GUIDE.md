# Locale Launchpad — UI guide

The Launchpad is the Next.js 16 rebuild of the static prototype in
`Reference/locale-launchpad 1.html`. It is **static**: every figure comes from
`src/data/` or the in-memory store. There is no backend, no auth and no RBAC yet.

**Structure, density and motion** follow Simple HRIS (`simple-hris/docs/design/ui-standards.md`).
**Colour, type and logo** follow the Locale brand kit (`Reference/Logos & Fonts/LOCALE STYLESHEET_NOV25.pdf`).
When the two disagree, brand wins on *what it looks like* and HRIS wins on *how it behaves*.

---

## 1. Brand tokens

| Token | Value | Use |
| --- | --- | --- |
| `charcoal` | `#323232` | Master brand ink; primary button fill (light) |
| `granite` | `#737373` | Brand grey. Tertiary ink (`text-subtle-foreground`) sits one step darker, `#686868`, so it clears 4.5:1 on every tint |
| `silver` | `#F2F2F2` | Muted surfaces |
| `haven-300` | `#9CE3DB` | Locale Homes |
| `nectar-300` | `#F7D4B7` | Locale Financial |
| `skyblue-300` | `#C8D5F5` | Locale Wealth, **only** Wealth. Never generic "info" (use `neutral`) |

Each sub-brand colour is the **300** step of a 50–950 ramp (`haven-*`, `nectar-*`,
`skyblue-*`). The 300s are light tints: **they never carry small text on white.**

### 1.1 Dashboard tone: the accent follows the dashboard

The shell root (and `<html>`, for portalled dialogs) carries `data-tone="haven|nectar|skyblue|charcoal"`,
and the `tone-*` roles remap to that dashboard's sub-brand in both themes (`globals.css`, "Dashboard tone").
**Anything that means "this dashboard's accent" uses a tone role, never a hard-coded `haven-*`.**
Accounts is Nectar from the rail to its last active filter.

| Role | Use |
| --- | --- |
| `text-tone-ink` | Accent text, icons, links (4.9:1+ on white and the tints) |
| `bg-tone-soft` | Selected / highlight wash, active filter tile, "needs you" panel |
| `bg-tone-tint` | A step stronger: count chips, search highlights |
| `border-tone-line` | Accent borders and rims |
| `bg-tone-fill` + `text-tone-on-fill` | The brand colour as a fill: active tab pill, `brand` button, selected chip |
| `bg-tone-strong` | Bars, dots, underlines; `ring-ring` (focus) follows it |
| `from-tone-chip-a to-tone-chip-b` | KPI and dialog icon chips (white glyph) |

The primary button is charcoal carrying the dashboard's ink (Haven, Nectar or Sky Blue on charcoal,
8.7:1+); in dark it becomes the tone fill. A named sub-brand class is right only when the colour
means that brand (a Wealth figure on Leadership). Money is `text-foreground`, never brand green.
Data fills are flat: `tone` for the series the chart is about, `neutral` (`zinc-300 / zinc-600`)
for the one beside it. Colour is never the only code: a coloured cell gets a mark and a legend.

Semantic tokens (switch per theme — prefer these over raw zinc):
`bg-background`, `bg-canvas`, `bg-card`, `bg-popover`, `bg-muted`,
`text-foreground`, `text-muted-foreground`, `text-subtle-foreground`,
`border-border`, `border-hairline`, `ring-ring`, `bg-primary text-primary-foreground`.

**Status colours carry verdicts, brand colours carry identity** (HRIS § 15). Never
use a brand tint for a verdict or a status colour for identity.

| Meaning | Colour |
| --- | --- |
| done · approved · synced | emerald |
| pending · in review · caution | amber |
| conflict · rejected · overdue | rose |

### Dark mode
Class-based (`next-themes`, `attribute="class"`, light default). Dark surfaces are the
charcoal family (`#141416` page, `#1c1c1f` card), not HRIS navy. Every hard-coded
colour needs a `dark:` partner. Test both themes.

## 2. Type

**One face: Manrope, the same as the sidebar.** `font-heading` and `font-mono` are kept as
classes, but both resolve to Manrope (`globals.css`, `@theme inline`), so either role can be
restyled from one line. `font-mono` also turns on tabular figures, so job numbers still line up.

| Role | Class | Face |
| --- | --- | --- |
| Page H1 | `font-heading text-xl font-bold tracking-tight sm:text-2xl` (via `PageHeader`) | Manrope Bold |
| Card / panel title | `CardTitle` (15px bold) | Manrope Bold |
| Accent word | `font-accent` | Libre Baskerville Italic, −25 tracking. The only serif left: one accent word (Home's greeting), never a heading |
| Body | `text-sm` / `text-[13px]` | Manrope |
| Caption | `text-xs text-muted-foreground` | Manrope |
| Tiny caps label | `text-[10px] font-semibold uppercase tracking-[0.12em]` | Manrope |
| IDs, job numbers, record IDs, file names | `font-mono text-xs` | Manrope, tabular figures |

**The scale is closed:** `text-[10px]` (tiny uppercase labels, fixed-size count badges, avatar
initials, chart axis labels), `text-xs` (12px captions, meta, hints), `text-[13px]` (dense body:
tables, lists), `text-sm` (body), `CardTitle` 15px, dialog title 17px, page H1 via `PageHeader`,
KPI figure 28px. No `11px`, `10.5px`, `11.5px` or `12.5px`. Running text caps at ~70ch
(`max-w-[70ch]`); a full-width page never means a full-width paragraph.

**No eyebrow above a heading.** `PageHeader` has no eyebrow: the rail already names the
dashboard, and the heading carries its own weight.

`tabular-nums` on every number that sits in a column or animates.

## 3. Shell (don't rebuild it)

`app/(dashboard)/layout.tsx` mounts `LaunchpadProvider` + `AppShell` (HRIS § 1.1: the
root owns the viewport, pages scroll inside). `template.tsx` gives every route the
HRIS page-enter (opacity + 10px rise, 0.28s, `[0.22, 1, 0.36, 1]`).

### 3.1 Dashboards, not tabs

Each module is its own **dashboard**, HRIS-style (`src/components/shell/dashboards.ts`).

- **A dashboard's sections live in its sidebar — never as a tab strip in the page.**
  This also holds for navigation inside a section: Doc formatter's four views are nested
  under it in the rail, and Knowledge's categories are rail items.
- A rail item can carry a `tag` (`dashboards.ts`), drawn as a quiet caps chip. Operations →
  Inbound capture is tagged **Preview**: a mock of a screen not built yet, nested under the
  CRM dash sync it belongs to, every control on it a real `disabled` control.
  Filters are not navigation, so they stay in the page as `SlidingTabs` pills, e.g. Leadership's
  period and Sales' plan / estate / period / team filters.
- Every section is a URL (`/sales?tab=team`, `/operations?tab=formatter&view=changes`,
  `/knowledge?cat=security`). Modules read it with `useTabParam(tabs, default, key?)`;
  `defaults` in the dashboard config is how `/sales` highlights Overview.
- **Every dashboard after Home opens on its Overview**, the first item in its rail
  (`?tab=overview`; Knowledge's is the category-less `/knowledge`). It is built on
  `DashboardOverview` (`src/components/modules/overview/`): four headline KPI cards, then two
  to five smaller ones under a `SectionLabel`, then any panels the dashboard keeps (HR's
  divisions and org chart). Each card links to the rail item its figure comes from, by key
  (`to: "sales:pipeline"`, resolved by `hrefForKey`), and reads the same data or store as that
  section. Leadership's Overview takes one figure from each dashboard, and each card opens
  that dashboard. A figure nothing records yet is `sample` and says "Sample" (Finance, two on IT).
  A link to a specific section names it: `/sales?tab=pipeline`, never a bare `/sales`.
- **Switch view** (`ViewSwitcher.tsx`) lists every dashboard, under the dashboard's own sections.
  A switch paints `DashboardSwitchLoader` ("Switching to … dashboard", themed to the destination and
  shaped like it), as in HRIS § 4.1. Keep it: it is the HRIS pattern, and the user wants it as is.
- **Portals have their own Switch view.** `dashboards.ts` puts each dashboard in a `space`. The
  Launchpad is the staff dashboards; the portals are views for one person. Two are the outward-facing
  pair from the client-journey meeting (`docs/Meeting1.md`): **Client** (`/client`, Haven) and
  **Developer** (`/developer`, Charcoal; the building company Locale sells for). The third is
  **Employee** (`/employee`, Charcoal), described below. On a portal, Switch view lists only the
  portals, then **Back to Launchpad**; the Launchpad's lists its dashboards, then the portals under a
  "Portals" caption so staff can preview them. A portal rail also drops the staff Inbox, captions the
  logo with the portal's name, shows the previewed client, developer or employee on the user card
  (`persona`), and scopes Ctrl+K to the portals. Client and Developer read the shared jobs, so their
  milestones are Operations' milestones (`src/data/journey.ts` maps a job onto the nine-stage
  journey, enquiry to keys). What passes between them, the builder's site updates and the client's
  messages, lives in the portal store (`src/state/portal-store.tsx`). Portal writes also land in the
  staff Inbox, and accepting a job in the Developer portal ticks Builder Acceptance behind the usual
  undo window.
- **The Employee portal** is Simple HRIS's employee dashboard for Locale's own people, previewed as
  Jan Kane Reroma (AI & Growth). It has no KPI Results or MESA yet. Locale's offshore team is paid by
  invoice, so its pay side is HRIS's contractor dashboard. The rail is Overview · Invoices (New invoice,
  History) · Profile · Department.
  - **Overview:** the pay week picker, the week's hours and your rates, the estimated pay behind HRIS's
    eye (pay figures start hidden on every visit), the daily hours, and where your invoices stand.
  - **New invoice:** HRIS's receipt-style builder, prefilled. The pay week's hours become lines at your
    rates, Profile supplies the sender and payment method, the number is HRIS's `{entity}-{M-D-YY}-{n}`,
    and Bill To is always Locale.
  - **Sending:** an invoice goes through `undoable()` and then waits on Accounts. **History** can
    retract it while it's pending, which frees its week.
  - **Department:** HRIS's team tab, named for your department. It reads HR's live org chart.
  - **Sources:** invoices and the details that prefill them live in
    `src/components/modules/employee/invoice-store.ts`. Hours, rates and invoice history are sample
    figures (`employee/data.ts`).
- **Accounting** is where the company accountant pays those invoices: HRIS's Accounting view, with
  its Payroll Wizard cut to the four steps an invoice-only payroll needs. The rail is Overview ·
  Pay run · Pay history.
  - **Pay run:** four steps. **Rate** (HRIS's per-cycle FX card, AUD → PHP, unset at the start of
    every run) → **Invoices** (HRIS's Contractors: approve, reject, Reset) → **Validation** (a
    pre-flight, then a per-person review; no payment method holds someone, and a switch holds anyone
    else) → **Dispatch** (lock in and send behind `undoable()`, then a receipt). A step opens only
    when the one before allows it. Hubstaff, hours maths, Orphanage, PAB and Additions don't apply.
  - **Layout:** the steps sit in a four-up strip above the body, and become HRIS's side rail only
    at `2xl`. Below that, a side rail leaves the tables too narrow.
  - **Pay history:** every dispatched run, its figures frozen at dispatch. Open one to see who it
    paid.
  - **Sources:** `accounting/payrun-store.ts`. The previewed employee's invoices are the Employee
    portal's own store, so a decision or a payment shows in their History straight away (a paid
    invoice reads **Paid**). The other payees, their payment methods and past runs are sample
    figures (`accounting/data.ts`, `accounting/fx.ts`). The flow's name is `PAY_RUN`.
- **Sales › Pipeline** is HRIS's Tickets board (`TicketsBoard`, `TicketCard`, `TicketDialog`) in Sales'
  Haven tone. HRIS's black-and-red console look stays on `/tickets`.
  - **Board:** four stage columns, each with a dot, a count and a value total. Each card shows the deal's
    number, priority, client, value, package, next step, owner, updates and time in stage. Owner, priority
    and search filters sit above, with a Board / Lost switch.
  - **Moving:** drag a card between columns (`use-board-drag.ts`, pointer-based, no dnd-kit), or use
    Alt+←/→ on a focused card. On a phone, tap the card and change its stage.
  - **Updating:** a card opens the two-pane deal dialog. The fields sit on the left. On the right is the
    deal's Updates thread, interleaved with its edit history.
  - **Lost:** "Mark as lost" parks a deal under Lost, where it can be reopened, like HRIS's Archive.
  - **Writes:** moves, saves, lost and reopen all go through `undoable()` (`deal-writes.ts`), and a card
    reads "Syncing" until its window closes. Posting an update is immediate, like a ticket reply.
  - **Sources:** the seed deals, updates and history are sample content (`sales/data.ts`, `seedDeals`).
- **Rail order:** logo → Search → sections (full height, never squeezed into their own scroll box)
  → links → Inbox → Switch view; the middle scrolls as one block when the window is short, and
  the footer (theme switch, user card, sign out) is pinned.
- **Search (Ctrl+K / ⌘K)** (`CommandPalette.tsx`) finds dashboards, every section, jobs (number,
  client, lot, estate) and Knowledge categories. A jump to another dashboard goes through the same
  switch path as Switch view (`dashboard-switch.tsx`), so the loader and tone behave identically.
- **Skip to content** is the first Tab stop; it focuses `#launchpad-scroll`. Collapsed-rail labels
  (`RailTooltip.tsx`) show on keyboard focus as well as hover.
- Each dashboard takes its Locale sub-brand as its accent (`dashboard-tones.ts`). This is the
  HRIS per-dashboard accent (§ 1.2):
  - Haven: Home, Operations and Sales, and the Client portal.
  - Nectar: Finance, Accounts and Accounting.
  - Sky Blue: Wealth.
  - Charcoal (master brand): Marketing, HR, Projects, Knowledge, Leadership and IT, and the Developer and Employee portals.
- **Rail badges and reselect** (`nav-state.tsx`):
  - A module publishes counts with `useNavBadge("hr:leave", { count, tone: "pending" })`.
  - It listens for a re-click on the open section with `useNavReselect("sales:", reset)`.
- **Collapse:** use the pull-tab or Ctrl+B / ⌘B. The rail animates only its width; nothing
  inside re-flows. The rail's columns slide 6px and each row clips to a 36px tile, so the 64px
  strip reads as a centred icon column.

### 3.2 Width

**Full width, like HRIS.** `PageContainer` has no max-width and content runs edge to edge
inside the gutters, so tables and panels span the page. Only running text caps its own
line length (PageHeader's description). Don't add `mx-auto max-w-*` wrappers around page
content.

### 3.3 Jarvis

Jarvis is the assistant bubble on every dashboard (`src/components/shell/assistant/`), built
on HRIS's Penny AI pattern with the Locale "L" as its chat head.

- **FAQ:** each dashboard's FAQ offers exactly **three** questions about that dashboard
  (`FEATURED` in `jarvis-knowledge.ts`). Answers are computed from the dashboard's own data
  or the live store, never invented.
- **Typed questions:** the wider brief answers typed questions, routed by the most specific
  keyword.
- **The rule:** a question with no answer behind it can't be offered (`featuredFor` throws).

## 4. Component inventory (`src/components/ui`)

| Component | File | Notes |
| --- | --- | --- |
| `PageContainer`, `PageHeader`, `SectionLabel` | `page.tsx` | Every screen starts `<PageContainer><PageHeader …/>` |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardMeta`, `CardContent`, `CardFooter`, `CardRow` | `card.tsx` | `tone="accent"` (dashboard-tone rim, flat, "needs you"), `"inverse"` (charcoal feature), `"muted"` |
| `KpiCard`, `KpiGrid` | `kpi-card.tsx` | **The KPI standard.** Icon chip in the dashboard tone (default `tone="tone"`), tiny-caps label, 28px tabular figure (counts up), one sub line. **Pure black in dark mode.** `onClick` → filter tile with "Tap to filter" hint + `aria-pressed`. `href` → a link to where the figure comes from (Overview cards): keeps its sub line, arrow on hover and focus. `pulse` only fires with `alert`. `KpiGrid` is two-up on phones |
| `SlidingTabs`, `TabPanels` | `sliding-tabs.tsx` | `SlidingTabs` is for in-page **filters** only. Sections go in the rail (§ 3.1). `TabPanels` animates a section swap (`rise`, the default) or an in-page step flow (`slide`) |
| `Button` | `button.tsx` | `default` · `brand` (tone-fill CTA, sparingly) · `outline` · `secondary` · `ghost` · `destructive` · `link`; sizes `xs sm default lg icon icon-sm icon-xs` |
| `Pill`, `SystemTag` | `pill.tsx` | `variant="soft"` tag or `"caps"` status; tones `tone` (dashboard accent) `haven nectar skyblue` (brand identity only) `neutral ok pending problem charcoal` |
| `Input`, `Textarea`, `Label`, `Field`, `SearchInput`, `Switch`, `Checkbox` | `input.tsx` | `SearchInput` shows a count + clear |
| `SmoothSelect` | `select.tsx` | Use instead of native `<select>` |
| `DatePicker`, `Calendar` | `date-picker.tsx` | HRIS's single-date picker: ISO `YYYY-MM-DD` values, Monday-first weeks, today marker, arrow-key grid, `min`/`max`, quick-pick `presets`. The panel is portalled, so it works inside a `Dialog`; Escape closes the panel only |
| `Dialog` | `dialog.tsx` | HRIS § 10 motion. Icon + description that names side effects + outline Cancel + tinted confirm. `dismissible={false}` while a write is in flight. `bodyClassName` swaps the body's padding and scroll for a two-pane dialog whose panes scroll on their own (the deal dialog) |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `Dash` | `table.tsx` | Tiny-caps heads, hairline rows, tone hover; `Dash` = empty cell |
| `RateBar`, `ColumnBars`, `RingGauge` | `progress.tsx` | Transform-only, flat fills; tones `tone` (default) `neutral` + brand/status; `null` = unmeasured, drawn differently from 0 |
| `EmptyState`, `NoMatches`, `ErrorState`, `Skeleton` | `states.tsx` | Three states, never merged (HRIS § 12) |
| `CountUp` | `count-up.tsx` | Reduced-motion snaps to the final value |
| `AutoHeight`, `Ticker`, `useCascading` | `list-motion.tsx` | The master list's motion: a body that glides to its new height, a count that rolls, a row cascade only while a pane arrives |
| `Reveal` | `reveal.tsx` | Staggered rise-in for sections (capped delay) |
| `Avatar` | `avatar.tsx` | Initials, sub-brand tints |
| `SyncBadge` | `sync-badge.tsx` | HS · Mon / Syncing / Conflict |
| `BrandShapes` | `brand-shapes.tsx` | Sub-brand shapes — Home only |

Icons: `lucide-react`, `aria-hidden` when a label sits beside them.

## 5. State (`src/state/launchpad-store.tsx`)

`usePortal()` (`src/state/portal-store.tsx`) holds what the Client and Developer portals share: builder
site updates, client messages and unread state, and the client's learn-from-my-journey consent.

`useLaunchpad()` gives `jobs`/`updateJob`, `lotDetails`/`updateLot`,
`activity`/`logActivity`, `notifications`/`notify`, `reviewItems` (Operations' review queue),
`submissionDocs`/`submissionStatus`, `go(module, tab)`, `openJob(id)` and `later(fn, ms)`
(a timer cancelled on unmount — use it for simulated multi-step syncs).
`confirm(message, description?)` is the success toast (sonner, top-right, HRIS).
Module-private state stays in the module.

### 5.1 Writes that leave the Launchpad wait for an undo window

Anything that sends to Xero, HubSpot, Monday, CRM Dash or a builder's inbox goes through
`undoable()` (`src/lib/undoable.ts`): the row shows its pending state at once, the toast names
exactly what is going where with an **Undo**, and nothing commits until the 6s window closes.
Batches ("Send 3 invoices · $42,500 + GST") confirm in a `Dialog` that lists every item and
the total first. A confirm button names its action, never "OK".

## 6. Motion (HRIS § 14)

Only `EASE_OUT [0.16, 1, 0.3, 1]` and `EASE_SWAP [0.22, 1, 0.36, 1]` (`src/lib/motion.ts`).
Durations: fade 0.2–0.3s, tab swap 0.26–0.28s, dialog 0.32s in / 0.18s out, bars 0.85s.
Row stagger capped: `rowDelay(i, reduce)`. Hover: colour shift for rows, `-translate-y-0.5`
lift for cards. Every JS animation checks `useReducedMotion()`; CSS loops are disabled
in `globals.css` under `prefers-reduced-motion`. No 3D tilt, no bounce.

**One alarm, and it rests.** `pulse-rose` rings three times as it arrives, then stops; the rose
text keeps saying why. It marks a real problem that needs a decision, never a count. `pulse-haven`
may loop only while a live, transient state lasts (a sync step in flight). Nothing ambient loops
forever: the rail's logo beats three times on arrival; Jarvis arrives once a session, then sits still.

**Gate the transition, never `initial`.** `useReducedMotion()` is `null` on the server and
`true` on a reduced-motion client, so `initial={reduce ? false : {…}}` renders different HTML
on each side — a hydration mismatch. Write `initial={{ opacity: 0, y: 8 }}` and
`transition={{ duration: reduce ? 0 : 0.3 }}`. The root `MotionConfig reducedMotion="user"`
(`Providers.tsx`) additionally strips transform travel app-wide under reduced motion.

## 7. Porting a module from the mockup

1. The mockup's minified source is prettified at build time into a scratch file; each
   module brief names its line range. Port **all** content: every tab, table, card,
   figure, label and interaction. Copy strings verbatim (they are Locale's words).
2. Route: `app/(dashboard)/<module>/page.tsx` renders `<Suspense><ModuleScreen/></Suspense>`
   (needed because tabs live in `?tab=` via `useTabParam`).
3. Code: `src/components/modules/<module>/`. Static data: `src/components/modules/<module>/data.ts`.
4. Replace inline styles with Tailwind + the components above. Mockup → Launchpad mapping:
   `J` → `KpiCard`, `j` pill → `Pill`, `lh-card` → `Card`, `Gi` tabs → rail sections in `dashboards.ts` (never a strip),
   `bn` → `CountUp`, `lh-fill` → `RateBar`, `lh-bar` → `ColumnBars`, modal → `Dialog`,
   `notify`/toast → `notify()` / `confirm()`, `B` icon → lucide.
5. Mockup colour → token: `seafoam` → `haven-300`, `greenDeep` → `haven-700` when it is an accent
   (links, icons, selection) but `emerald-700` when it states a verdict ("Verified by…", "Approved…",
   "Published…"), `mist` → `neutral` (never Sky Blue),
   `green` → emerald, `amber` → amber, `red` → rose, `charcoal` → `foreground`/`charcoal`,
   `grey` → `muted-foreground`, `faint` → `subtle-foreground`, `offwhite` → `muted`/`canvas`,
   `white` → `card`, `border`/`hairline` → `border-border`/`border-hairline`.
6. `npx tsc --noEmit` clean. No new dependencies.
