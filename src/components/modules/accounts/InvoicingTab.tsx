"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ExternalLink, FileClock, Lock, Receipt, TrendingUp, Zap } from "lucide-react";
import { aud } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { FORECAST_NEXT_MONTH, type BuilderInvoice } from "./data";
import { INVOICE_TONE } from "./status";

/**
 * Accounts › Builder invoicing. Stage completions in CRM Dash raise draft Xero
 * invoices; nothing reaches a builder until it's approved here. The invoice
 * list is owned by AccountsScreen so approvals survive a tab switch.
 */
export function InvoicingTab({
  invoices,
  invoicedThisMonth,
  onApprove,
  onOpenInXero,
}: {
  invoices: BuilderInvoice[];
  invoicedThisMonth: number;
  onApprove: (id: string) => void;
  onOpenInXero: (id: string) => void;
}) {
  const drafts = invoices.filter((i) => i.status === "Draft");
  const draftTotal = drafts.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Accounts"
        title="Builder invoicing"
        description="Stage completions raise draft invoices per each builder's schedule. Nothing reaches a builder until it's approved here."
        actions={
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-subtle-foreground">
            <Zap className="size-3.5" aria-hidden />
            Raised automatically from CRM Dash milestones · all amounts excl GST
          </span>
        }
      />

      <Reveal index={0}>
        <KpiGrid cols={3}>
          <KpiCard
            label="Drafts awaiting approval"
            value={drafts.length}
            icon={FileClock}
            tone="haven"
            pulse={drafts.length > 0}
            sub={drafts.length > 0 ? `${aud(draftTotal)} + GST in drafts` : "All drafts approved"}
          />
          <KpiCard label="Invoiced this month" value={aud(invoicedThisMonth)} icon={Receipt} tone="charcoal" sub="excl GST" />
          <KpiCard label="Forecast next month" value={aud(FORECAST_NEXT_MONTH)} icon={TrendingUp} tone="skyblue" sub="excl GST" />
        </KpiGrid>
      </Reveal>

      <Reveal index={1}>
        <Card className="overflow-hidden">
          <ul aria-label="Builder invoices">
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} onApprove={onApprove} onOpenInXero={onOpenInXero} />
            ))}
          </ul>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <Card tone="muted">
          <CardHeader className="gap-x-2">
            <Lock className="size-3.5 text-muted-foreground" aria-hidden />
            <CardTitle as="h3">Invoicing schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Each builder&apos;s commercial terms are held in Accounts and applied automatically when a milestone
              completes. The schedules themselves are not displayed here.
            </p>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

/**
 * One invoice — a card-list row (HRIS § 5.2). Stacks on mobile; on desktop a
 * fixed column grid keeps the amounts in one right-aligned line whatever the
 * status and actions beside them.
 */
const InvoiceRow = React.memo(function InvoiceRow({
  invoice: inv,
  onApprove,
  onOpenInXero,
}: {
  invoice: BuilderInvoice;
  onApprove: (id: string) => void;
  onOpenInXero: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const isDraft = inv.status === "Draft";

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline px-5 py-3 transition-colors first:border-t-0 hover:bg-haven-50/50 md:grid md:grid-cols-[minmax(0,1fr)_8rem_6.5rem_13.5rem] md:gap-x-4 dark:hover:bg-haven-950/20">
      <div className="min-w-0 basis-full md:basis-auto">
        <p className="truncate text-[13px] font-medium">
          <span className="font-mono text-[12px] tabular-nums">{inv.job}</span> · {inv.client}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          <span className="font-mono text-[10.5px] text-subtle-foreground">{inv.id}</span> · {inv.builder} · {inv.stage}
          {inv.note ? ` · ${inv.note}` : ""}
        </p>
      </div>

      <span className="text-[13px] font-semibold whitespace-nowrap text-haven-700 tabular-nums md:text-right dark:text-haven-300">
        {aud(inv.amount)} + GST
      </span>

      <span className="flex">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={inv.status}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
            className="inline-flex"
          >
            <Pill variant="caps" tone={INVOICE_TONE[inv.status]} icon={inv.status === "Approved" ? Check : undefined}>
              {inv.status}
            </Pill>
          </motion.span>
        </AnimatePresence>
      </span>

      <div className="ml-auto flex items-center justify-end gap-1.5 md:ml-0">
        {isDraft ? (
          <>
            <Button size="sm" onClick={() => onApprove(inv.id)} aria-label={`Approve invoice ${inv.id} for job ${inv.job}`}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenInXero(inv.id)}
              aria-label={`Open invoice ${inv.id} in Xero`}
            >
              Open in Xero <ExternalLink className="size-3" aria-hidden />
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
});
