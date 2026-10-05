"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, ArrowRight, BadgeDollarSign, Clock, FileText, Hourglass, Plus, UserRoundPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, RISE_VARIANTS, rowDelay } from "@/lib/motion";
import { hrefForKey } from "@/components/shell/dashboards";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { KpiCard, KpiGrid, type KpiTone } from "@/components/ui/kpi-card";
import { SmoothSelect } from "@/components/ui/select";
import { RateBar } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import {
  DAY_TARGET,
  GOES_BY,
  LATEST_WEEK,
  PAY_WEEKS,
  RATES,
  addDays,
  formatDuration,
  formatHours,
  invoiceTotals,
  missingDetails,
  money,
  weekByStart,
  weekLabel,
  weekPay,
  weekdayDate,
  stateOf,
  type InvoiceState,
  type StaffInvoice,
} from "./data";
import { useInvoices } from "./invoice-store";
import { EyeToggle, HiddenValue, StatusPill, billsFor, invoiceByWeek, statusLabel, uninvoicedWeeks, useGreeting } from "./parts";
import { InvoiceDialog } from "./InvoiceSheet";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const sumOf = (list: StaffInvoice[]) => list.reduce((a, i) => a + invoiceTotals(i.lines).total, 0);

/** "Approved by Aled Smith" → "approved by Aled Smith", mid-sentence. */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const STATUS_TONE: Record<InvoiceState, KpiTone> = { pending: "pending", approved: "ok", rejected: "problem", paid: "ok" };

/** The longest day the breakdown draws to scale; longer days fill the bar. */
const DAY_SCALE = 10;

/**
 * Employee › Overview — HRIS's employee Overview with its contractor
 * dashboard's invoices folded in, because Locale's offshore team is paid by
 * invoice. A greeting and the pay week picker; the week's hours, your rates
 * and its invoice; the week's estimated pay behind HRIS's eye; the days that
 * make it up; and where your invoices stand with Accounts.
 *
 * Pay figures start hidden on every visit, as HRIS's do. Rates stay visible:
 * they're what you'd quote, not what you earned.
 */
export function EmployeeOverview() {
  const reduce = useReducedMotion();
  const greeting = useGreeting();
  const { invoices, sending, sender, payment } = useInvoices();
  const [weekStart, setWeekStart] = React.useState(LATEST_WEEK.start);
  const [shown, setShown] = React.useState(false);
  const [viewId, setViewId] = React.useState<string | null>(null);

  const week = weekByStart(weekStart) ?? LATEST_WEEK;
  const pay = weekPay(week);
  const byWeek = invoiceByWeek(invoices);
  const billed = byWeek.get(week.start);
  const ready = uninvoicedWeeks(invoices);
  const pending = invoices.filter((i) => i.status === "pending");
  const approved = invoices.filter((i) => i.status === "approved");
  const rejected = invoices.filter((i) => i.status === "rejected");
  const missing = missingDetails(sender, payment);
  const recent = [...invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const viewing = invoices.find((i) => i.id === viewId) ?? null;
  const invoiceThisWeek = hrefForKey("employee:invoices:new", { week: week.start });

  // HRIS contractor's subline: what's waiting, on whom.
  const subline = [
    ready.length ? `Your week of ${weekLabel(ready[0].start)} is ready to invoice.` : null,
    pending.length ? `${plural(pending.length, "invoice")} ${pending.length === 1 ? "is" : "are"} with Accounts for review.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting}, ${GOES_BY}.`}
        description={subline || "You're all caught up: every week is invoiced and nothing is waiting on Accounts."}
        actions={
          <>
            <SmoothSelect
              value={weekStart}
              onChange={setWeekStart}
              ariaLabel="Pay week"
              className="w-56"
              options={[...PAY_WEEKS].reverse().map((w, i) => {
                const inv = byWeek.get(w.start);
                return {
                  value: w.start,
                  label: `Week of ${weekLabel(w.start)}`,
                  hint: i === 0 ? "Latest" : inv ? statusLabel(stateOf(inv)) : "To invoice",
                };
              })}
            />
            <Link href={hrefForKey("employee:invoices:new")} className={buttonVariants({ variant: "brand" })}>
              <Plus aria-hidden /> New invoice
            </Link>
          </>
        }
      />

      {/* The week at a glance: HRIS's stat strip. */}
      <Reveal index={0}>
        <KpiGrid cols={4}>
          <KpiCard
            size="sm"
            label="Hours worked"
            value={formatHours(pay.hours)}
            sub={`${pay.daysWorked} days · ${formatHours(pay.regularHours)} reg / ${formatHours(pay.overtimeHours)} OT`}
            icon={Clock}
          />
          <KpiCard
            size="sm"
            label="Your rate"
            value={`${money(RATES.regular)}/h`}
            sub={`Overtime ${money(RATES.overtime)}/h after ${RATES.overtimeAfter}h`}
            icon={BadgeDollarSign}
            href={hrefForKey("employee:profile")}
          />
          <KpiCard
            size="sm"
            label="This week's invoice"
            value={billed ? (sending[billed.id] ? "Sending" : statusLabel(stateOf(billed))) : "Not sent"}
            sub={billed ? billed.number : "Ready to invoice"}
            icon={FileText}
            tone={billed ? STATUS_TONE[stateOf(billed)] : "tone"}
            href={billed ? hrefForKey("employee:invoices:history") : invoiceThisWeek}
          />
          <KpiCard
            size="sm"
            label="Awaiting review"
            value={shown ? money(sumOf(pending)) : "$•••••"}
            sub={pending.length ? `${plural(pending.length, "invoice")} with Accounts` : "Nothing pending"}
            icon={Hourglass}
            href={hrefForKey("employee:invoices:history")}
          />
        </KpiGrid>
      </Reveal>

      {missing.length ? (
        <Reveal index={1}>
          <Card tone="accent" className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tone-fill text-tone-on-fill" aria-hidden>
              <UserRoundPen className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Finish your invoice details</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your invoices go out without {missing.join(" or ")}. Add {missing.length > 1 ? "them" : "it"} in Profile and
                every new invoice carries {missing.length > 1 ? "them" : "it"}, so Accounts knows who&apos;s billing and where to pay.
              </p>
            </div>
            <Link href={hrefForKey("employee:profile")} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open Profile <ArrowRight aria-hidden />
            </Link>
          </Card>
        </Reveal>
      ) : null}

      {rejected.length ? (
        <Reveal index={1}>
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-950/20">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
                {plural(rejected.length, "invoice")} {rejected.length === 1 ? "wasn't" : "weren't"} approved
              </p>
              <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">
                Accounts sent {rejected.length === 1 ? "it" : "them"} back. Send a corrected invoice to get paid.
              </p>
            </div>
            <Link
              href={hrefForKey("employee:invoices:history")}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-950/50")}
            >
              View
            </Link>
          </div>
        </Reveal>
      ) : null}

      {/* HRIS's "Estimated take-home": the week's pay, hidden until you ask. */}
      <Reveal index={2}>
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 border-l-2 border-l-tone-strong px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
                  Estimated pay · week of {weekLabel(week.start)}
                </p>
                <EyeToggle shown={shown} onToggle={() => setShown((s) => !s)} />
              </div>
              <p className="mt-0.5 text-[28px] leading-tight font-bold">
                <HiddenValue shown={shown}>
                  <CountUp key={week.start} value={money(pay.total)} />
                </HiddenValue>
              </p>
              <p className="mt-1 max-w-[70ch] text-xs text-muted-foreground">
                {formatHours(pay.hours)} at your rates ·{" "}
                {billed
                  ? `invoiced as ${billed.number}${billed.decision ? `, ${lowerFirst(billed.decision)}` : ", with Accounts"}`
                  : "not invoiced yet"}{" "}
                · <span className="text-subtle-foreground">Sample figures: time tracking isn&apos;t connected yet</span>
              </p>
            </div>
            {billed ? (
              <button
                type="button"
                onClick={() => setViewId(billed.id)}
                className={cn(buttonVariants({ variant: "outline" }), "self-start sm:self-auto")}
              >
                <FileText aria-hidden /> View invoice
              </button>
            ) : (
              <Link href={invoiceThisWeek} className={cn(buttonVariants({ variant: "brand" }), "self-start sm:self-auto")}>
                <FileText aria-hidden /> Invoice this week
              </Link>
            )}
          </div>
          <dl className="grid grid-cols-1 divide-y divide-hairline border-t border-hairline bg-canvas/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Ribbon label="Regular">
              <HiddenValue shown={shown}>{money(pay.regular)}</HiddenValue>
              <RibbonSub>
                {formatHours(pay.regularHours)} · {money(RATES.regular)}/h
              </RibbonSub>
            </Ribbon>
            <Ribbon label="Overtime">
              {pay.overtimeHours ? <HiddenValue shown={shown}>{money(pay.overtime)}</HiddenValue> : <span>None</span>}
              <RibbonSub>
                {pay.overtimeHours
                  ? `${formatHours(pay.overtimeHours)} · ${money(RATES.overtime)}/h`
                  : `Starts after ${RATES.overtimeAfter}h in a week`}
              </RibbonSub>
            </Ribbon>
            <Ribbon label="Invoice">
              {billed ? <StatusPill status={stateOf(billed)} sending={Boolean(sending[billed.id])} /> : <span>Not sent</span>}
              <RibbonSub>{billed ? <span className="font-mono">{billed.number}</span> : "Bills Locale for this week"}</RibbonSub>
            </Ribbon>
          </dl>
        </Card>
      </Reveal>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Reveal index={3} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Daily hours</CardTitle>
              <CardMeta>
                {formatHours(pay.hours)} · {weekLabel(week.start)}
              </CardMeta>
              <CardDescription>Tracked hours each day, Sunday to Saturday. A full day is {DAY_TARGET}h.</CardDescription>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait" initial={false}>
                <motion.ul
                  key={week.start}
                  variants={RISE_VARIANTS}
                  custom={1}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: reduce ? 0 : 0.22, ease: EASE_SWAP }}
                  className="space-y-2.5"
                >
                  {week.hours.map((h, i) => (
                    <DayRow key={i} date={addDays(week.start, i)} hours={h} index={i} />
                  ))}
                </motion.ul>
              </AnimatePresence>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline pt-3 text-xs text-muted-foreground">
                <Legend swatch="bg-emerald-500 dark:bg-emerald-400">Full day</Legend>
                <Legend swatch="bg-amber-400">Short day</Legend>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-3 w-px bg-foreground/50" /> {DAY_TARGET}h mark
                </span>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        {/* HRIS contractor Overview: the totals strip and recent invoices. */}
        <Reveal index={4} className="min-w-0">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-hairline pb-3">
              <CardTitle>Your invoices</CardTitle>
              <CardMeta>
                <Link
                  href={hrefForKey("employee:invoices:history")}
                  className="inline-flex items-center gap-1 rounded-sm font-medium text-tone-ink hover:underline focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
                >
                  View all <ArrowRight className="size-3" aria-hidden />
                </Link>
              </CardMeta>
            </CardHeader>
            <dl className="grid grid-cols-3 divide-x divide-hairline border-b border-hairline">
              <Stat label="Total billed" sub={plural(invoices.length, "invoice")}>
                <HiddenValue shown={shown}>{money(sumOf(invoices))}</HiddenValue>
              </Stat>
              <Stat label="Awaiting" sub={pending.length ? `${pending.length} with Accounts` : "Nothing pending"}>
                <HiddenValue shown={shown}>{money(sumOf(pending))}</HiddenValue>
              </Stat>
              <Stat label="Approved" sub={`${approved.length} cleared`}>
                <HiddenValue shown={shown}>{money(sumOf(approved))}</HiddenValue>
              </Stat>
            </dl>
            <ul className="divide-y divide-hairline">
              {recent.map((inv, i) => (
                <motion.li
                  key={inv.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.04) }}
                >
                  <button
                    type="button"
                    onClick={() => setViewId(inv.id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-tone-soft/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-xs font-medium">{inv.number}</span>
                      <span className="block truncate text-xs text-muted-foreground">{billsFor(inv)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[13px] font-semibold">
                        <HiddenValue shown={shown}>{money(invoiceTotals(inv.lines).total)}</HiddenValue>
                      </span>
                      <StatusPill status={stateOf(inv)} sending={Boolean(sending[inv.id])} />
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      <InvoiceDialog invoice={viewing} sending={viewing ? Boolean(sending[viewing.id]) : false} onClose={() => setViewId(null)} />
    </div>
  );
}

function Ribbon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-5 py-3">
      <dt className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{label}</dt>
      <dd className="flex min-w-0 flex-col items-start gap-0.5 text-sm font-semibold">{children}</dd>
    </div>
  );
}

function RibbonSub({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-normal text-muted-foreground tabular-nums">{children}</span>;
}

function Stat({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="truncate text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold">{children}</dd>
      <dd className="truncate text-xs text-muted-foreground">{sub}</dd>
    </div>
  );
}

/** One day of the week: its hours to scale, against the full-day mark. */
function DayRow({ date, hours, index }: { date: string; hours: number; index: number }) {
  const short = hours > 0 && hours < DAY_TARGET;
  const off = hours <= 0;
  return (
    <li className="grid grid-cols-[52px_minmax(0,1fr)_88px] items-center gap-3 text-[13px]">
      <span className={cn("tabular-nums", off ? "text-subtle-foreground" : "text-muted-foreground")}>{weekdayDate(date)}</span>
      <span className="relative">
        <RateBar
          value={off ? 0 : Math.min(1, hours / DAY_SCALE)}
          tone={short ? "pending" : "ok"}
          height="h-2"
          delay={index * 0.04}
          label={off ? `${weekdayDate(date)}: not worked` : `${weekdayDate(date)}: ${formatDuration(hours)}${short ? ", a short day" : ""}`}
        />
        {/* The full-day mark. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-y-1 w-px bg-foreground/45"
          style={{ left: `${(DAY_TARGET / DAY_SCALE) * 100}%` }}
        />
      </span>
      <span className="text-right tabular-nums">
        <span className={cn(off && "text-subtle-foreground", short && "font-medium text-amber-700 dark:text-amber-300")}>
          {formatDuration(hours)}
        </span>
        {short ? <span className="sr-only">, short day</span> : null}
      </span>
    </li>
  );
}

function Legend({ swatch, children }: { swatch: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 rounded-full", swatch)} />
      {children}
    </span>
  );
}
