"use client";

import * as React from "react";
import Link from "next/link";
import { CreditCard, FileText } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { hrefForKey } from "@/components/shell/dashboards";
import { Dialog } from "@/components/ui/dialog";
import {
  BILL_TO,
  CURRENCY,
  invoiceTotals,
  lineAmount,
  longDate,
  money,
  paymentLines,
  processor,
  stateOf,
  type InvoiceLine,
  type PaymentMethod,
  type StaffInvoice,
} from "./data";
import { StatusPill, billsFor } from "./parts";

/**
 * The invoice as a sheet of paper — HRIS's contractor invoice (its New Invoice
 * builder and the read-only copy Accounting opens): a punched-hole frame, FROM
 * and LOCATION, a read-only BILL TO, the invoice details, a dark line-items
 * header, a dark TOTAL and the payment rail. The builder (`NewInvoice`) and
 * the read-only `InvoiceDocument` are drawn from these same pieces, so what
 * you send is exactly what Accounts sees.
 */

/** The perforated strip along the sheet's top and bottom. */
export function PunchedHoles({ position }: { position: "top" | "bottom" }) {
  const holes = (
    <span className="flex gap-1.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full bg-background shadow-inner ring-1 ring-border",
            // Six a side on a phone, so the strip never overflows the sheet.
            i >= 6 && "hidden sm:block",
          )}
        />
      ))}
    </span>
  );
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center justify-between border border-border bg-muted px-3 py-1.5",
        position === "top" ? "rounded-t-xl border-b-0" : "rounded-b-xl border-t-0",
      )}
    >
      {holes}
      {position === "top" ? (
        <span className="text-[10px] font-semibold tracking-[0.25em] text-subtle-foreground uppercase">Invoice</span>
      ) : null}
      {holes}
    </div>
  );
}

/** The paper between the two strips. */
export function Sheet({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <PunchedHoles position="top" />
      <div className="space-y-6 border-x border-border bg-card px-4 py-6 sm:px-8">{children}</div>
      <PunchedHoles position="bottom" />
    </div>
  );
}

/** "FROM", "BILL TO" — a block heading on the sheet. */
export function SheetHeading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-xs font-bold tracking-[0.12em] text-foreground uppercase">{children}</h3>
      {right}
    </div>
  );
}

/** A field's tiny-caps label on the sheet. */
export function SheetLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  const cls = "mb-1 block text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {children}
    </label>
  ) : (
    <span className={cls}>{children}</span>
  );
}

/** A filled-in field, read-only: the builder's input with the value printed in it. */
export function ReadValue({ children, mono, className }: { children?: React.ReactNode; mono?: boolean; className?: string }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div
      className={cn(
        "flex min-h-8 items-center rounded-lg border border-border bg-canvas/60 px-2.5 py-1 text-sm",
        mono && "font-mono text-xs",
        empty ? "text-subtle-foreground" : "text-foreground",
        className,
      )}
    >
      {empty ? "—" : children}
    </div>
  );
}

/** The logo square: an uploaded logo, or the sender's initials. */
export function LogoBox({ logo, name, className, children }: { logo: string | null; name: string; className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border",
        logo ? "bg-white p-1" : "bg-charcoal text-haven-300 dark:bg-silver dark:text-charcoal",
        className,
      )}
    >
      {logo ? (
        // A data URL the sender uploaded; next/image has nothing to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={`${name} logo`} className="size-full rounded-lg object-contain" />
      ) : (
        <span aria-hidden className="font-heading text-2xl font-bold">
          {initials(name)}
        </span>
      )}
      {children}
    </div>
  );
}

export function InvoiceHeading() {
  return <h2 className="font-heading text-2xl font-bold tracking-[0.15em] uppercase">Invoice</h2>;
}

/** BILL TO: always Locale, never editable. */
export function BillToBox() {
  return (
    <div className="space-y-1 rounded-lg border border-border bg-canvas/60 px-3 py-3">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">Read-only</p>
      <p className="text-sm font-semibold">{BILL_TO.company}</p>
      <p className="text-[13px] text-muted-foreground">{BILL_TO.address}</p>
      <p className="text-[13px] text-muted-foreground">{BILL_TO.country}</p>
    </div>
  );
}

/** The currency line: Accounts sets it, so it's never a control. */
export function CurrencyValue() {
  return (
    <ReadValue>
      <span className="font-semibold">{CURRENCY}</span>
      <span className="ml-2 text-xs text-subtle-foreground">set by Locale Accounts</span>
    </ReadValue>
  );
}

/** Line-item columns: description, qty, rate, tax %, amount (and the builder's remove). */
export const LINE_COLS = "grid-cols-[minmax(0,1fr)_64px_96px_60px_104px]";
export const LINE_COLS_EDIT = "grid-cols-[minmax(0,1fr)_64px_96px_60px_104px_32px]";

export function LineHeader({ editable }: { editable?: boolean }) {
  return (
    <div
      className={cn(
        "grid items-center bg-charcoal px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-silver uppercase dark:bg-white/[0.08] dark:text-zinc-200",
        editable ? LINE_COLS_EDIT : LINE_COLS,
      )}
    >
      <span>Item description</span>
      <span className="text-right">Qty</span>
      <span className="text-right">Rate</span>
      <span className="text-right">Tax %</span>
      <span className="text-right">Amount</span>
      {editable ? <span /> : null}
    </div>
  );
}

/** Sub total, tax and the dark TOTAL bar. */
export function Totals({ lines }: { lines: InvoiceLine[] }) {
  const { subtotal, tax, total } = invoiceTotals(lines);
  return (
    <div className="flex justify-end">
      <dl className="w-full max-w-60 space-y-1.5 text-[13px]">
        <div className="flex items-center justify-between text-muted-foreground">
          <dt>Sub total</dt>
          <dd className="font-medium text-foreground tabular-nums">{money(subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <dt>Tax</dt>
          <dd className="font-medium text-foreground tabular-nums">{money(tax)}</dd>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-primary px-3 py-2 text-primary-foreground">
          <dt className="text-xs font-bold tracking-[0.12em] uppercase">Total</dt>
          <dd className="text-sm font-bold tabular-nums">{money(total)}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * PAYMENT DETAILS: how you want to be paid. Profile owns it; the invoice
 * carries a copy (HRIS: "the invoice only previews it").
 */
export function PaymentDetails({ payment, builder }: { payment: PaymentMethod | null; builder?: boolean }) {
  const lines = paymentLines(payment);
  const proc = payment ? processor(payment.processor) : null;
  return (
    <div>
      <SheetHeading>Payment details</SheetHeading>
      <p className="mt-1 mb-3 text-xs text-subtle-foreground">
        {builder ? (
          <>
            Set in your{" "}
            <Link href={hrefForKey("employee:profile")} className="font-medium text-tone-ink hover:underline">
              Profile › Payment method
            </Link>
            . It goes on the invoice so Accounts knows where to pay you.
          </>
        ) : payment ? (
          "How you asked to be paid."
        ) : (
          "No payment method was on this invoice."
        )}
      </p>
      {proc ? (
        <div className="rounded-xl border border-border bg-canvas/60 p-4">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            <proc.icon className="size-4 text-muted-foreground" aria-hidden />
            {proc.label}
          </p>
          {lines.length ? (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {lines.map((l) => (
                <div key={l.label} className="min-w-0">
                  <dt className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{l.label}</dt>
                  <dd className={cn("truncate text-[13px]", l.mono && "font-mono text-xs")}>{l.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-subtle-foreground">No details saved yet. Add them in Profile.</p>
          )}
        </div>
      ) : builder ? (
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-7 text-center">
          <CreditCard className="size-6 text-subtle-foreground" aria-hidden />
          <p className="text-[13px] font-medium">No payment method set</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Choose one in Profile and it appears here. You can still send this invoice without it.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ── The read-only invoice ─────────────────────────────────────────────── */

function ReadField({ label, mono, children }: { label: string; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div>
      <SheetLabel>{label}</SheetLabel>
      <ReadValue mono={mono}>{children}</ReadValue>
    </div>
  );
}

/** A sent invoice exactly as Accounts sees it: the builder, filled in and locked. */
export function InvoiceDocument({ invoice }: { invoice: StaffInvoice }) {
  const from = invoice.from;
  return (
    <Sheet>
      <div className="flex items-start gap-4">
        <LogoBox logo={from.logo} name={from.entityName || from.name} />
        <div className="flex flex-1 justify-end">
          <InvoiceHeading />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <SheetHeading>From</SheetHeading>
          <ReadField label="Entity name">{from.entityName}</ReadField>
          <ReadField label="Your name">{from.name}</ReadField>
        </div>
        <div className="space-y-3">
          <SheetHeading>Location</SheetHeading>
          <ReadField label="Address">{[from.address, from.cityStateZip].filter(Boolean).join(", ")}</ReadField>
          <ReadField label="Country">{from.country}</ReadField>
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
          <ReadField label="Invoice #" mono>
            {invoice.number}
          </ReadField>
          <div className="grid grid-cols-2 gap-3">
            <ReadField label="Invoice date">{longDate(invoice.date)}</ReadField>
            <ReadField label="Due date">{longDate(invoice.due)}</ReadField>
          </div>
        </div>
      </div>

      <div>
        <SheetHeading>Line items</SheetHeading>
        <div className="mt-2 overflow-x-auto rounded-xl border border-border">
          <div className="min-w-[520px]">
            <LineHeader />
            <div className="divide-y divide-hairline">
              {invoice.lines.map((l) => (
                <div key={l.id} className={cn("grid items-start px-3 py-2 text-[13px]", LINE_COLS)}>
                  <div className="min-w-0 pr-2">
                    <p>{l.description || "—"}</p>
                    {l.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{l.notes}</p> : null}
                  </div>
                  <span className="text-right tabular-nums">{l.qty}</span>
                  <span className="text-right tabular-nums">{money(l.rate)}</span>
                  <span className="text-right tabular-nums">{l.taxPct}</span>
                  <span className="text-right font-medium tabular-nums">{money(lineAmount(l).amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Totals lines={invoice.lines} />

      {invoice.notes ? (
        <div>
          <SheetLabel>Notes</SheetLabel>
          <p className="rounded-lg border border-border bg-canvas/60 px-2.5 py-2 text-[13px] whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      ) : null}

      <PaymentDetails payment={invoice.payment} />
    </Sheet>
  );
}

/** History › View: the invoice in a dialog, with where it stands. */
export function InvoiceDialog({ invoice, sending, onClose }: { invoice: StaffInvoice | null; sending?: boolean; onClose: () => void }) {
  // Keep the last invoice while the dialog animates out.
  const [shown, setShown] = React.useState(invoice);
  if (invoice && invoice !== shown) setShown(invoice);
  const inv = invoice ?? shown;
  return (
    <Dialog
      open={invoice !== null}
      onClose={onClose}
      size="xl"
      icon={FileText}
      title={inv ? `Invoice ${inv.number}` : "Invoice"}
      description={
        inv ? (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusPill status={stateOf(inv)} sending={sending} />
            <span>
              {billsFor(inv)} · {inv.decision ?? (sending ? "Sending to Accounts" : `Sent ${longDate(inv.date)}, with Accounts for review`)}
            </span>
          </span>
        ) : null
      }
    >
      {inv ? <InvoiceDocument invoice={inv} /> : null}
    </Dialog>
  );
}
