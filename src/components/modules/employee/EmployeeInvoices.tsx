"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { CircleCheck, Eye, FileText, Hourglass, Plus, RotateCcw, Send, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, RISE_VARIANTS, rowDelay } from "@/lib/motion";
import { useTabParam } from "@/hooks/useTabParam";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { hrefForKey } from "@/components/shell/dashboards";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { AutoHeight, Ticker, useCascading } from "@/components/ui/list-motion";
import {
  EMPLOYEE,
  EMPLOYEE_TODAY,
  INVOICE_APPROVER,
  RATES,
  addDays,
  formatHours,
  invoiceNumber,
  invoiceTotals,
  lineAmount,
  longDate,
  money,
  weekByStart,
  weekLabel,
  weekLines,
  weekPay,
  type InvoiceLine,
  stateOf,
  type InvoiceStatus,
  type SenderDetails,
  type StaffInvoice,
} from "./data";
import { retractInvoice, sendInvoice, useInvoices } from "./invoice-store";
import { StatusPill, billsFor, uninvoicedWeeks } from "./parts";
import {
  BillToBox,
  CurrencyValue,
  InvoiceDialog,
  InvoiceHeading,
  LINE_COLS_EDIT,
  LineHeader,
  LogoBox,
  PaymentDetails,
  Sheet,
  SheetHeading,
  SheetLabel,
  Totals,
} from "./InvoiceSheet";

const VIEWS = ["new", "history"] as const;

/**
 * Employee › Invoices: HRIS's contractor Invoices, its New Invoice and History
 * sub-tabs as two rail items. Sending an invoice opens History, as HRIS does.
 */
export function EmployeeInvoices() {
  const [view, setView, dir] = useTabParam(VIEWS, "new", "view");
  return (
    <TabPanels value={view} dir={dir}>
      {view === "new" ? <NewInvoice onSent={() => setView("history")} /> : <InvoiceHistory />}
    </TabPanels>
  );
}

/* ── New invoice ───────────────────────────────────────────────────────── */

/** The "Bill for" choice that isn't a pay week. */
const ONE_OFF = "one-off";

interface Form {
  week: string;
  from: SenderDetails;
  number: string;
  /** Typed by hand: stop deriving it from the entity name and date (HRIS). */
  numberEdited: boolean;
  date: string;
  due: string;
  lines: InvoiceLine[];
  notes: string;
}

let lineSeq = 0;
const newId = () => `line-${Date.now().toString(36)}-${++lineSeq}`;

const blankLine = (): InvoiceLine => ({ id: newId(), description: "", notes: "", qty: 1, rate: 0, taxPct: 0 });

/** A week's hours as lines, or one blank line for a one-off. */
function linesFor(week: string): InvoiceLine[] {
  const w = weekByStart(week);
  return w ? weekLines(w, newId) : [blankLine()];
}

function makeForm(week: string, from: SenderDetails, seq: number): Form {
  return {
    week,
    from,
    number: invoiceNumber(from.entityName || from.name, EMPLOYEE_TODAY, seq),
    numberEdited: false,
    date: EMPLOYEE_TODAY,
    due: addDays(EMPLOYEE_TODAY, 7),
    lines: linesFor(week),
    notes: "",
  };
}

/** Why the invoice can't go yet, in the order you'd fix them. */
function problems(form: Form, invoices: StaffInvoice[]): string[] {
  const out: string[] = [];
  if (!form.number.trim()) out.push("Add an invoice number.");
  else if (invoices.some((i) => i.number === form.number.trim())) out.push("You've already sent an invoice with this number.");
  if (!form.date || !form.due) out.push("Set an invoice date and a due date.");
  else if (form.due < form.date) out.push("The due date is before the invoice date.");
  if (invoiceTotals(form.lines).total <= 0) out.push("Add a line with an amount.");
  return out;
}

/**
 * Employee › Invoices › New invoice — HRIS's New Invoice builder, prefilled.
 * Pick the pay week it bills and its hours arrive as lines at your rates;
 * the sender block comes from Profile, the number is HRIS's
 * `{entity}-{M-D-YY}-{n}`, and Bill To is always Locale. Lines you add
 * yourself stay when you change the week. Send holds for the undo window,
 * then it's with Accounts.
 */
function NewInvoice({ onSent }: { onSent: () => void }) {
  const reduce = useReducedMotion();
  const params = useSearchParams();
  const { notify } = useLaunchpad();
  const { invoices, sender, payment } = useInvoices();
  const ready = uninvoicedWeeks(invoices);
  const seq = invoices.length + 1;

  const firstWeek = () => {
    const asked = params.get("week");
    return ready.find((w) => w.start === asked)?.start ?? ready[0]?.start ?? ONE_OFF;
  };
  const [form, setForm] = React.useState<Form>(() => makeForm(firstWeek(), sender, seq));
  const [tried, setTried] = React.useState(false);
  const logoInput = React.useRef<HTMLInputElement>(null);

  const issues = problems(form, invoices);
  const week = weekByStart(form.week);
  const pay = week ? weekPay(week) : null;
  const { total } = invoiceTotals(form.lines);

  // The number follows the entity name and date until it's typed by hand.
  const renumber = (f: Form): Form =>
    f.numberEdited ? f : { ...f, number: invoiceNumber(f.from.entityName || f.from.name, f.date || EMPLOYEE_TODAY, seq) };

  const setFrom = (patch: Partial<SenderDetails>) => setForm((f) => renumber({ ...f, from: { ...f.from, ...patch } }));
  const setLine = (id: string, patch: Partial<InvoiceLine>) =>
    // Editing a filled-in line makes it yours: changing the week won't replace it.
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, ...patch, auto: undefined } : l)) }));

  const pickWeek = (next: string) =>
    setForm((f) => {
      const own = f.lines.filter((l) => !l.auto && (l.description.trim() || l.rate));
      const filled = weekByStart(next) ? weekLines(weekByStart(next)!, newId) : [];
      const lines = [...filled, ...own];
      return { ...f, week: next, lines: lines.length ? lines : [blankLine()] };
    });

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("That logo is over 5 MB", { description: "Use a PNG, JPG or SVG under 5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && setFrom({ logo: reader.result });
    reader.readAsDataURL(file);
  };

  const send = () => {
    setTried(true);
    if (issues.length) return;
    const number = form.number.trim();
    const invoice: StaffInvoice = {
      id: `inv-${Date.now().toString(36)}`,
      number,
      date: form.date,
      due: form.due,
      week: week ? week.start : null,
      from: form.from,
      lines: form.lines.filter((l) => l.description.trim() || lineAmount(l).amount),
      notes: form.notes.trim(),
      payment,
      status: "pending",
    };
    sendInvoice(invoice, () => notify(`${EMPLOYEE.name} sent invoice ${number} · ${money(total)} (Employee portal)`));
    onSent();
  };

  const startOver = () => {
    setTried(false);
    setForm(makeForm(firstWeek(), sender, seq));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New invoice"
        description="Bill Locale for a week's hours. Your hours and rates fill it in and your Profile fills in the sender; check it, then send it to Accounts."
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Reveal index={0} className="min-w-0">
          <Sheet>
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  className="group/logo rounded-xl focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
                  aria-label={form.from.logo ? "Change the logo on this invoice" : "Upload a logo for this invoice"}
                >
                  <LogoBox logo={form.from.logo} name={form.from.entityName || form.from.name}>
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover/logo:opacity-100 group-focus-visible/logo:opacity-100">
                      {form.from.logo ? "Change" : "Upload logo"}
                    </span>
                  </LogoBox>
                </button>
                <input ref={logoInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={onLogo} />
                {form.from.logo ? (
                  <button
                    type="button"
                    onClick={() => setFrom({ logo: null })}
                    className="inline-flex items-center gap-1 text-xs text-subtle-foreground hover:text-rose-600"
                  >
                    <X className="size-3" aria-hidden /> Remove logo
                  </button>
                ) : (
                  <span className="text-xs text-subtle-foreground">Your initials · max 5 MB</span>
                )}
              </div>
              <div className="flex flex-1 justify-end">
                <InvoiceHeading />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <SheetHeading>From</SheetHeading>
                <SheetField id="inv-entity" label="Entity name">
                  <Input
                    id="inv-entity"
                    value={form.from.entityName}
                    onChange={(e) => setFrom({ entityName: e.target.value })}
                    placeholder="Your entity or company"
                  />
                </SheetField>
                <SheetField id="inv-name" label="Your name">
                  <Input id="inv-name" value={form.from.name} onChange={(e) => setFrom({ name: e.target.value })} placeholder="Full name" />
                </SheetField>
              </div>
              <div className="space-y-3">
                <SheetHeading>Location</SheetHeading>
                <SheetField id="inv-address" label="Address">
                  <Input
                    id="inv-address"
                    value={form.from.address}
                    onChange={(e) => setFrom({ address: e.target.value })}
                    placeholder="Street address"
                  />
                </SheetField>
                <SheetField id="inv-country" label="Country">
                  <Input
                    id="inv-country"
                    value={form.from.country}
                    onChange={(e) => setFrom({ country: e.target.value })}
                    placeholder="Country"
                  />
                </SheetField>
              </div>
            </div>

            <hr className="border-hairline" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <SheetHeading>Bill to</SheetHeading>
                <BillToBox />
              </div>
              <div className="space-y-3">
                <SheetHeading>Invoice details</SheetHeading>
                <div>
                  <SheetLabel>Currency</SheetLabel>
                  <CurrencyValue />
                </div>
                <SheetField id="inv-number" label="Invoice #">
                  <Input
                    id="inv-number"
                    value={form.number}
                    onChange={(e) => setForm((f) => ({ ...f, number: e.target.value, numberEdited: true }))}
                    className="font-mono text-xs"
                    aria-invalid={tried && !form.number.trim() ? true : undefined}
                  />
                </SheetField>
                <div className="grid grid-cols-2 gap-3">
                  <SheetField id="inv-date" label="Invoice date">
                    <Input
                      id="inv-date"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => renumber({ ...f, date: e.target.value }))}
                    />
                  </SheetField>
                  <SheetField id="inv-due" label="Due date">
                    <Input
                      id="inv-due"
                      type="date"
                      value={form.due}
                      min={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))}
                      aria-invalid={tried && form.due < form.date ? true : undefined}
                    />
                  </SheetField>
                </div>
              </div>
            </div>

            <div>
              <SheetHeading>Line items</SheetHeading>
              <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                <div className="min-w-[560px]">
                  <LineHeader editable />
                  <div className="divide-y divide-hairline">
                    <AnimatePresence initial={false}>
                      {form.lines.map((l, i) => (
                        <motion.div
                          key={l.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: reduce ? 0 : 0.18, ease: EASE_SWAP }}
                          className="overflow-hidden"
                        >
                          <LineRow
                            line={l}
                            index={i}
                            removable={form.lines.length > 1}
                            onChange={(patch) => setLine(l.id, patch)}
                            onRemove={() => setForm((f) => ({ ...f, lines: f.lines.filter((x) => x.id !== l.id) }))}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  <div className="border-t border-hairline bg-canvas/60 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, blankLine()] }))}
                      className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-tone-ink hover:underline focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
                    >
                      <Plus className="size-3.5" aria-hidden /> Add line item
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <Totals lines={form.lines} />

            <SheetField id="inv-notes" label="Notes">
              <Textarea
                id="inv-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Anything Accounts should know about this invoice"
              />
            </SheetField>

            <PaymentDetails payment={payment} builder />

            <div className="flex flex-col gap-3 border-t border-hairline pt-4">
              <AnimatePresence initial={false}>
                {tried && issues.length ? (
                  <motion.ul
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
                    className="space-y-0.5 text-right text-xs text-rose-700 dark:text-rose-300"
                  >
                    {issues.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </motion.ul>
                ) : null}
              </AnimatePresence>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={startOver}>
                  <RotateCcw /> Start over
                </Button>
                <Button variant="brand" onClick={send}>
                  <Send /> Send {money(total)} to Accounts
                </Button>
              </div>
            </div>
          </Sheet>
        </Reveal>

        {/* On a phone the week comes first: pick it, then check the sheet. */}
        <div className="order-first flex min-w-0 flex-col gap-5 xl:sticky xl:top-6 xl:order-none">
          <Reveal index={1}>
            <Card>
              <CardHeader>
                <CardTitle>Bill for</CardTitle>
                <CardDescription>Pick the pay week this invoice is for. Its hours fill the lines at your rates.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SmoothSelect
                  value={form.week}
                  onChange={pickWeek}
                  ariaLabel="Pay week this invoice bills"
                  options={[
                    ...ready.map((w, i) => ({
                      value: w.start,
                      label: `Week of ${weekLabel(w.start)}`,
                      hint: i === 0 ? "Latest" : formatHours(weekPay(w).hours),
                    })),
                    { value: ONE_OFF, label: "One-off (no pay week)" },
                  ]}
                />
                {!ready.length ? (
                  <p className="text-xs text-muted-foreground">
                    Every closed week is invoiced. The week of {weekLabel(EMPLOYEE_TODAY)} closes on Saturday.
                  </p>
                ) : null}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.dl
                    key={form.week}
                    variants={RISE_VARIANTS}
                    custom={1}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: reduce ? 0 : 0.2, ease: EASE_SWAP }}
                    className="divide-y divide-hairline rounded-lg border border-hairline text-[13px]"
                  >
                    {pay ? (
                      <>
                        <SummaryRow label="Hours" value={formatHours(pay.hours)} sub={`${pay.daysWorked} days`} />
                        <SummaryRow
                          label="Regular"
                          value={money(pay.regular)}
                          sub={`${formatHours(pay.regularHours)} at ${money(RATES.regular)}/h`}
                        />
                        <SummaryRow
                          label="Overtime"
                          value={pay.overtimeHours ? money(pay.overtime) : "—"}
                          sub={pay.overtimeHours ? `${formatHours(pay.overtimeHours)} at ${money(RATES.overtime)}/h` : "None this week"}
                        />
                      </>
                    ) : (
                      <SummaryRow label="One-off" value="—" sub="Add your own lines: equipment, a reimbursement" />
                    )}
                  </motion.dl>
                </AnimatePresence>
                <p className="text-xs text-subtle-foreground">Sample hours and rates: time tracking isn&apos;t connected yet.</p>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={2}>
            <Card>
              <CardHeader>
                <CardTitle>What happens next</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-[13px]">
                  {[
                    ["Accounts reviews it", `${INVOICE_APPROVER} approves or sends it back, usually within the week.`],
                    ["You're paid by the due date", "Into the payment method on the invoice."],
                    ["Changed your mind?", "Retract it from History while it's still pending, then send a corrected one."],
                  ].map(([title, body], i) => (
                    <li key={title} className="flex gap-3">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-tone-tint text-[10px] font-bold text-tone-ink tabular-nums">
                        {i + 1}
                      </span>
                      <span>
                        <span className="font-medium">{title}</span>
                        <span className="block text-xs text-muted-foreground">{body}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function SheetField({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <SheetLabel htmlFor={id}>{label}</SheetLabel>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-subtle-foreground">{sub}</span>
      </dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

const CELL =
  "w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-1 outline-none hover:border-border focus-visible:border-tone-strong focus-visible:ring-3 focus-visible:ring-tone-line/45";

function LineRow({
  line,
  index,
  removable,
  onChange,
  onRemove,
}: {
  line: InvoiceLine;
  index: number;
  removable: boolean;
  onChange: (patch: Partial<InvoiceLine>) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const num = (v: string) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
  return (
    <div className={cn("grid items-start gap-0 px-2 py-1.5 text-[13px]", LINE_COLS_EDIT)}>
      <div className="min-w-0 pr-2">
        <input
          value={line.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Item description"
          aria-label={`Line ${n} description`}
          className={cn(CELL, "placeholder:text-subtle-foreground")}
        />
        <input
          value={line.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Notes (optional)"
          aria-label={`Line ${n} notes`}
          className={cn(CELL, "text-xs text-muted-foreground placeholder:text-subtle-foreground")}
        />
      </div>
      <input
        type="number"
        min={0}
        step={0.5}
        value={line.qty}
        onChange={(e) => onChange({ qty: num(e.target.value) })}
        aria-label={`Line ${n} quantity`}
        className={cn(CELL, "text-right tabular-nums")}
      />
      <input
        type="number"
        min={0}
        step={0.01}
        value={line.rate}
        onChange={(e) => onChange({ rate: num(e.target.value) })}
        aria-label={`Line ${n} rate`}
        className={cn(CELL, "text-right tabular-nums")}
      />
      <input
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={line.taxPct}
        onChange={(e) => onChange({ taxPct: num(e.target.value) })}
        aria-label={`Line ${n} tax percent`}
        className={cn(CELL, "text-right tabular-nums")}
      />
      <span className="px-1.5 py-1 text-right font-medium tabular-nums">{money(lineAmount(line).amount)}</span>
      <span className="flex justify-end pt-0.5">
        {removable ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove line ${n}`}
            className="flex size-6 items-center justify-center rounded-md text-subtle-foreground hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none dark:hover:bg-rose-500/15"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/* ── History ───────────────────────────────────────────────────────────── */

type Filter = "all" | InvoiceStatus;

const sumOf = (list: StaffInvoice[]) => list.reduce((a, i) => a + invoiceTotals(i.lines).total, 0);

/**
 * Employee › Invoices › History — every invoice you've sent and where it
 * stands (HRIS's History: View, and Retract while pending). The tiles filter
 * the table; a retracted invoice drifts out and frees its week.
 */
function InvoiceHistory() {
  const reduce = useReducedMotion();
  const { notify } = useLaunchpad();
  const { invoices, sending } = useInvoices();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [viewId, setViewId] = React.useState<string | null>(null);
  const [retracting, setRetracting] = React.useState<StaffInvoice | null>(null);

  // Newest first: by invoice date, then by the order they were sent.
  const all = React.useMemo(
    () => invoices.map((inv, order) => ({ inv, order })).sort((a, b) => b.inv.date.localeCompare(a.inv.date) || b.order - a.order).map((x) => x.inv),
    [invoices],
  );
  const pending = all.filter((i) => i.status === "pending");
  const approved = all.filter((i) => i.status === "approved");
  const rejected = all.filter((i) => i.status === "rejected");
  const rows = filter === "all" ? all : all.filter((i) => i.status === filter);
  const viewing = all.find((i) => i.id === viewId) ?? null;
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "all" : f));

  const doRetract = () => {
    const inv = retracting;
    if (!inv) return;
    retractInvoice(inv.id);
    setRetracting(null);
    notify(`${EMPLOYEE.name} retracted invoice ${inv.number} (Employee portal)`);
    confirm("Invoice retracted", `${inv.number} was withdrawn from Accounts${inv.week ? ` · the week of ${weekLabel(inv.week)} is ready to invoice again` : ""}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoice history"
        description="Every invoice you've sent Locale and where it stands with Accounts. Open one to see it exactly as Accounts does."
        actions={
          <Link href={hrefForKey("employee:invoices:new")} className={buttonVariants({ variant: "brand" })}>
            <Plus aria-hidden /> New invoice
          </Link>
        }
      />

      <Reveal index={0}>
        <KpiGrid cols={rejected.length ? 4 : 3}>
          <KpiCard label="Total billed" value={money(sumOf(all))} sub={`${all.length} invoices sent`} icon={FileText} />
          <KpiCard
            label="Awaiting review"
            value={money(sumOf(pending))}
            icon={Hourglass}
            tone="pending"
            onClick={() => toggle("pending")}
            active={filter === "pending"}
            hint={pending.length ? `${pending.length} with Accounts · tap to filter` : "Nothing pending"}
          />
          <KpiCard
            label="Approved"
            value={money(sumOf(approved))}
            icon={CircleCheck}
            tone="ok"
            onClick={() => toggle("approved")}
            active={filter === "approved"}
            hint={`${approved.length} cleared · tap to filter`}
          />
          {rejected.length ? (
            <KpiCard
              label="Not approved"
              value={money(sumOf(rejected))}
              alert
              onClick={() => toggle("rejected")}
              active={filter === "rejected"}
              hint="Send a corrected invoice"
            />
          ) : null}
        </KpiGrid>
      </Reveal>

      <Reveal index={1}>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-hairline pb-3">
            <CardTitle>Your invoices</CardTitle>
            <CardMeta>
              <span>
                <Ticker value={rows.length} /> of {all.length} shown
              </span>
            </CardMeta>
          </CardHeader>
          <AutoHeight>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={rows.length ? filter : "none"}
                variants={RISE_VARIANTS}
                custom={1}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP }}
              >
                {rows.length ? (
                  <HistoryTable
                    rows={rows}
                    sending={sending}
                    onView={setViewId}
                    onRetract={setRetracting}
                  />
                ) : (
                  <EmptyState
                    icon={FileText}
                    title={all.length ? "Nothing here" : "No invoices yet"}
                    description={
                      all.length ? "No invoices match that filter." : "Send your first invoice and it shows here, with where it stands."
                    }
                    action={
                      all.length ? (
                        <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                          Show all invoices
                        </Button>
                      ) : null
                    }
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </AutoHeight>
        </Card>
      </Reveal>

      <InvoiceDialog invoice={viewing} sending={viewing ? Boolean(sending[viewing.id]) : false} onClose={() => setViewId(null)} />

      <Dialog
        open={retracting !== null}
        onClose={() => setRetracting(null)}
        icon={Undo2}
        iconTone="problem"
        title={retracting ? `Retract ${retracting.number}?` : "Retract invoice?"}
        description={
          retracting
            ? `It's withdrawn from Accounts and removed from your history. ${
                retracting.week
                  ? `The week of ${weekLabel(retracting.week)} goes back to ready to invoice, so you can send a corrected one.`
                  : "You can send a corrected one."
              }`
            : null
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setRetracting(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={doRetract}>
              <Undo2 /> Retract invoice
            </Button>
          </>
        }
      />
    </div>
  );
}

function HistoryTable({
  rows,
  sending,
  onView,
  onRetract,
}: {
  rows: StaffInvoice[];
  sending: Record<string, true>;
  onView: (id: string) => void;
  onRetract: (inv: StaffInvoice) => void;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  return (
    <Table className="min-w-[760px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
          <TableHead className="pl-5">Invoice #</TableHead>
          <TableHead>Bills</TableHead>
          <TableHead>Invoice date</TableHead>
          <TableHead>Due</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="pr-5 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence initial={false}>
          {rows.map((inv, i) => {
            const isSending = Boolean(sending[inv.id]);
            return (
              <motion.tr
                key={inv.id}
                layout="position"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -14, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } }}
                transition={{
                  duration: reduce ? 0 : 0.18,
                  ease: EASE_OUT,
                  delay: cascading ? rowDelay(i, reduce, 0.03) : 0,
                  layout: { duration: reduce ? 0 : 0.22, ease: EASE_SWAP, delay: 0 },
                }}
                onClick={() => onView(inv.id)}
                className="cursor-pointer border-b border-hairline transition-colors hover:bg-tone-soft/70"
              >
                <TableCell className="pl-5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(inv.id);
                    }}
                    className="rounded-sm font-mono text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
                  >
                    {inv.number}
                  </button>
                </TableCell>
                <TableCell className="whitespace-nowrap text-foreground/80">{billsFor(inv)}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{longDate(inv.date)}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{longDate(inv.due)}</TableCell>
                <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">
                  {money(invoiceTotals(inv.lines).total)}
                </TableCell>
                <TableCell>
                  <StatusPill status={stateOf(inv)} sending={isSending} />
                </TableCell>
                <TableCell className="pr-5">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`View invoice ${inv.number}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(inv.id);
                      }}
                    >
                      <Eye />
                    </Button>
                    {inv.status === "pending" && !isSending ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetract(inv);
                        }}
                      >
                        <Undo2 /> Retract
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </motion.tr>
            );
          })}
        </AnimatePresence>
      </TableBody>
    </Table>
  );
}
