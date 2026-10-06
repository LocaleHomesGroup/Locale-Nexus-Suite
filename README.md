# Locale Launchpad

Locale Property Group's internal platform, rebuilt in **Next.js 16** from the static
prototype in `Reference/locale-launchpad 1.html`.

It keeps the prototype's modules and content, but reworks the UI to follow **Simple HRIS**:
the same shell (collapsible rail, mobile drawer), KPI cards, tabs, dialogs and motion. It uses
**Locale's brand** for colour, type and logo, from `Reference/Logos & Fonts`. Light and dark mode
are both supported.

> **Static prototype.** Every figure comes from `src/data/` or an in-memory store. There is
> no backend, no sign-in and no RBAC yet. A reload resets the demo to its seed data.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000, or the next free port if 3000 is taken (see the terminal)
npm run build    # production build (stop the dev server first — they share .next/)
npm run lint     # type-check
```

Requires Node 20.9+.

## Modules

Each module is its own **dashboard**. Its sections are listed in its sidebar, and "Switch view"
in the sidebar moves between dashboards, the way it does in HRIS. Every dashboard has **Jarvis**,
an assistant bubble (bottom-right) with three FAQ questions about that dashboard.

| Route | Dashboard | Sidebar sections (`?tab=`) |
| --- | --- | --- |
| `/` | Home | — |
| `/operations` | Operations | `jobs` (CRM Dash Sync) · `submissions` · `pricing` · `formatter` |
| `/operations/jobs/[id]` | Job detail | — |
| `/sales` | Sales | `pipeline` · `clients` · `week` · `build` · `costing` · `submissions` · `land` · `team` |
| `/marketing` | Marketing | `performance` · `channels` · `attribution` |
| `/finance` | Finance | — |
| `/accounts` | Accounts | `invoicing` · `reports` · `expenses` |
| `/accounting` | Accounting | `payrun` (Pay run: Rate → Invoices → Validation → Dispatch) · `history` |
| `/wealth` | Wealth | — |
| `/hr` | HR | `dashboard` · `people` · `attendance` · `leave` · `recruitment` · `performance` · `assets` |
| `/knowledge` | Knowledge | — |
| `/leadership` | Leadership | `overview` · `custom` |
| `/it` | IT | — |
| `/tickets` | Tickets | `board` · `projects` · `archived` (filters `&dash=` · `&project=` · `&priority=`; `&ticket=` opens one). `/projects` redirects to `projects` |
| `/notifications` | Notifications inbox | — |

Sections live in the URL, so Home's shortcuts deep-link (for example `/hr?tab=leave`). Doc
formatter's views (`&view=`) and Knowledge's categories (`?cat=`) are sidebar items too.
Collapse the sidebar with its pull-tab or Ctrl+B / ⌘B.

Every staff dashboard, and the Employee portal, has **Suggest an improvement** under Feedback in its
sidebar. It raises a ticket on the Tickets board against that dashboard without leaving the page.

## Layout

```
app/
  layout.tsx               fonts (Manrope, plus Libre Baskerville for the one accent word), theme, toaster
  (dashboard)/layout.tsx   store + shell, stays mounted across navigation
  (dashboard)/template.tsx page-enter animation
  (dashboard)/<module>/    one route per module
src/
  components/ui/           shared primitives: KpiCard, Card, SlidingTabs, Dialog, Pill, Table, …
  components/shell/        dashboards + their sidebars, view switcher, switch loader, Jarvis, app shell
  components/modules/      one folder per module
  state/launchpad-store.tsx  shared in-memory state (jobs, audit log, notifications, submission)
  data/                    jobs and seed data, extracted verbatim from the prototype
  styles/globals.css       Locale tokens, dark theme, motion and reduced-motion rules
public/brand/              Locale master logo and sticker (from the brand kit)
docs/UI-GUIDE.md           the design system: tokens, components, motion, porting rules
```

## Brand

- **Colour:** Charcoal `#323232`, Granite `#737373` and Silver `#F2F2F2` are the master brand.
  The three sub-brand tints are Haven Green `#9CE3DB` (Homes, and the Launchpad accent),
  Nectar `#F7D4B7` (Financial) and Sky Blue `#C8D5F5` (Wealth).
- **Type:** one face, Manrope, for headings, body and IDs alike, the same as the sidebar. The
  only exception is the brand accent word, Libre Baskerville Italic, on Home's greeting.
  Both fonts are self-hosted from the brand kit.
- **Logo:** the Locale Property Group master logo sits in the rail. When the rail is
  collapsed it becomes the "L" sticker, which is also the favicon.

See `docs/UI-GUIDE.md` for the full token and component reference.
