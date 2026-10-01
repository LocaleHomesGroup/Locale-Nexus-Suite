"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { CalendarClock, Download, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { confirm } from "@/state/launchpad-store";
import { PageHeader, SectionLabel } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { RateBar } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CASHFLOW, CASHFLOW_SEGMENTS, COMMISSION_BY_STAGE, PACK_FILE } from "./data";

/**
 * Segment fills, in split order: Finance Approval (seafoam → Haven), Land
 * Settlement (mist → Sky Blue), Slab and later (charcoal). Literal strings so
 * Tailwind sees every class.
 */
const SEGMENT_FILL = [
  "bg-haven-300 dark:bg-haven-400",
  "bg-skyblue-300 dark:bg-skyblue-400",
  "bg-charcoal dark:bg-zinc-300",
] as const;

/** Accounts › Reports — the monthly management pack, built live. */
export function ReportsTab() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Accounts"
        title="Management reporting"
        description="The monthly pack, built live from pipeline and Xero data instead of spreadsheets."
        actions={
          <Pill tone="haven" icon={Mail}>
            Auto-generated · sent to Adam and Yaz monthly
          </Pill>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal index={0} className="min-w-0">
          <CashflowCard />
        </Reveal>
        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={1}>
            <CommissionByStageCard />
          </Reveal>
          <Reveal index={2}>
            <NextPackCard />
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function CashflowCard() {
  const reduce = useReducedMotion();
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Cashflow forecast · commission receipts</CardTitle>
        <CardDescription>Deals by month lodged × average lodge-to-invoice lag × average stage rate</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex flex-col gap-3 pt-1">
          {CASHFLOW.map((m, i) => (
            <div key={m.month}>
              <div className="flex items-baseline text-xs">
                <span className="font-medium">{m.month}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">
                  <CountUp value={`$${m.projectedK}k projected`} />
                </span>
              </div>
              <div
                role="img"
                aria-label={`${m.month}: $${m.projectedK}k projected — ${CASHFLOW_SEGMENTS.map((s, k) => `${s.title} ${m.split[k]}%`).join(", ")}`}
                className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
              >
                {/* One transform on the whole stack: it grows from the left, nothing reflows.
                    `initial` never branches on reduced motion (server and client must agree);
                    under reduced motion the duration is 0, so it lands at once. */}
                <motion.div
                  className="flex h-full w-full origin-left gap-0.5"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: reduce ? 0 : DURATION.fill, ease: EASE_SWAP, delay: reduce ? 0 : Math.min(i * 0.14, 0.3) }}
                >
                  {m.split.map((share, k) => (
                    <div
                      key={CASHFLOW_SEGMENTS[k].title}
                      title={`${CASHFLOW_SEGMENTS[k].title} · ${share}%`}
                      className={cn("h-full first:rounded-l-full last:rounded-r-full", SEGMENT_FILL[k])}
                      style={{ flexGrow: share, flexBasis: 0 }}
                    />
                  ))}
                </motion.div>
              </div>
            </div>
          ))}
        </div>

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[10.5px] text-muted-foreground" aria-label="Legend">
          {CASHFLOW_SEGMENTS.map((s, k) => (
            <li key={s.title} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 shrink-0 rounded-[2px]", SEGMENT_FILL[k])} aria-hidden />
              {s.legend}
            </li>
          ))}
        </ul>

        {/* The chart's table twin (HRIS § 19 rule 14) — every value readable as text. */}
        <div className="mt-auto pt-5">
          <SectionLabel>Split by month</SectionLabel>
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                <TableHead className="pl-0">Month</TableHead>
                {CASHFLOW_SEGMENTS.map((s) => (
                  <TableHead key={s.title} className="text-right">
                    {s.title}
                  </TableHead>
                ))}
                <TableHead className="pr-0 text-right">Projected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CASHFLOW.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="py-2 pl-0 font-medium whitespace-nowrap">{m.month}</TableCell>
                  {m.split.map((share, k) => (
                    <TableCell key={CASHFLOW_SEGMENTS[k].title} className="py-2 text-right text-muted-foreground tabular-nums">
                      {share}%
                    </TableCell>
                  ))}
                  <TableCell className="py-2 pr-0 text-right font-medium tabular-nums">${m.projectedK}k</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function CommissionByStageCard() {
  const reduce = useReducedMotion();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission by stage · YTD</CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          {COMMISSION_BY_STAGE.map((s, i) => (
            <motion.li
              key={s.stage}
              className="border-b border-hairline py-2 last:border-b-0"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.06) }}
            >
              <div className="flex items-baseline text-xs">
                <span>{s.stage}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">
                  <CountUp value={`${s.pct}%`} /> · {s.amount}
                </span>
              </div>
              <RateBar
                value={s.pct / 100}
                tone={i === 0 ? "haven" : "skyblue"}
                className="mt-1.5"
                delay={Math.min(i * 0.09, 0.3)}
                label={`${s.stage}: ${s.pct}% of YTD commission, ${s.amount}`}
              />
            </motion.li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function NextPackCard() {
  const onDownload = () => {
    const rows: string[][] = [
      ["Locale management pack", "August 2026"],
      [],
      ["Cashflow forecast · commission receipts", "Projected", ...CASHFLOW_SEGMENTS.map((s) => s.title)],
      ...CASHFLOW.map((m) => [m.month, `$${m.projectedK}k`, ...m.split.map((p) => `${p}%`)]),
      [],
      ["Commission by stage · YTD", "Share", "Amount"],
      ...COMMISSION_BY_STAGE.map((s) => [s.stage, `${s.pct}%`, s.amount]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = PACK_FILE;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    confirm("This month's pack downloaded", PACK_FILE);
  };

  return (
    <Card className="border-skyblue-300 bg-skyblue-100 px-5 py-4 dark:border-skyblue-800/50 dark:bg-skyblue-950/40">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-skyblue-950 dark:text-skyblue-100">
        <CalendarClock className="size-3.5" aria-hidden />
        Next pack: 1 September
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-skyblue-900 dark:text-skyblue-200/85">
        Compiled automatically on the first business day and emailed to Adam and Yaz. Down adjustments and cancellations
        included from Xero actuals.
      </p>
      <Button
        size="sm"
        onClick={onDownload}
        className="mt-3 bg-charcoal text-skyblue-300 hover:bg-charcoal/90 dark:bg-skyblue-300 dark:text-skyblue-950 dark:hover:bg-skyblue-200"
      >
        <Download /> Download this month&apos;s pack
      </Button>
    </Card>
  );
}
