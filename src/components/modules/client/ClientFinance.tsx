"use client";

import { Check } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { RateBar } from "@/components/ui/progress";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BORROWING_CAPACITY,
  BUILD_CONTRACT,
  PACKAGE_SPLIT,
  PACKAGE_TOTAL,
  PRE_APPROVAL,
  PRE_SALE,
  PROGRESS_PAYMENTS,
} from "./data";
import { useClientJob } from "./parts";

/** The split's three parts, each with its own flat fill and a legend mark. */
const SPLIT = [
  { ...PACKAGE_SPLIT.build, fill: "bg-tone-strong" },
  { ...PACKAGE_SPLIT.land, fill: "bg-zinc-300 dark:bg-zinc-600" },
  { ...PACKAGE_SPLIT.extras, fill: "bg-tone-strong/45" },
] as const;

/**
 * Client › Finance — the meeting's first step after the consultation: what the
 * client can borrow, then that budget split between land and build and
 * packaged up, then what has been paid to the builder as the house goes up.
 * Approvals and payments read the job's own milestones.
 */
export function ClientFinance() {
  const { job } = useClientJob();
  const doneOn = new Map(
    [...job.precon, ...job.milestones].filter((m) => m.status === "done").map((m) => [m.name, m.date]),
  );
  const headroom = BORROWING_CAPACITY - PACKAGE_TOTAL;
  const payments = PROGRESS_PAYMENTS.map((p) => ({
    ...p,
    amount: (BUILD_CONTRACT * p.pct) / 100,
    paidOn: doneOn.get(p.milestone),
  }));
  const nextDue = payments.find((p) => !p.paidOn);
  const paidTotal = payments.filter((p) => p.paidOn).reduce((sum, p) => sum + p.amount, 0);

  const approvals = [
    { label: "Borrowing capacity assessed", date: PRE_SALE.finance?.date ?? "", by: "Locale Financial" },
    { label: "Pre-approval", date: PRE_APPROVAL.date, by: PRE_APPROVAL.lender },
    { label: "Formal finance approval", date: doneOn.get("Formal Finance Approval") ?? "", by: "Your lender" },
    { label: "Land settlement", date: doneOn.get("Settlement Confirmation") ?? "", by: "Locale Operations" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finance"
        description="What you can borrow, how your budget splits between the land and the build, and what's been paid to your builder so far."
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Reveal index={0} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>What you can borrow</CardTitle>
              <CardDescription>Worked out with Locale Financial before you looked at a single home.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[28px] leading-tight font-bold tabular-nums">{aud(BORROWING_CAPACITY)}</p>
              <div className="mt-4">
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">Your package</span>
                  <span className="font-medium tabular-nums">
                    {aud(PACKAGE_TOTAL)} · {Math.round((PACKAGE_TOTAL / BORROWING_CAPACITY) * 100)}%
                  </span>
                </div>
                <RateBar
                  value={PACKAGE_TOTAL / BORROWING_CAPACITY}
                  height="h-2"
                  label={`Package is ${Math.round((PACKAGE_TOTAL / BORROWING_CAPACITY) * 100)}% of what you can borrow`}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {aud(headroom)} under your borrowing capacity, kept as a buffer.
                </p>
              </div>
              <ul className="mt-4 border-t border-hairline pt-1">
                {approvals.map((a) => (
                  <li
                    key={a.label}
                    className="flex items-center gap-2.5 border-t border-hairline py-2 first:border-t-0"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full",
                        a.date
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "border border-dashed border-border",
                      )}
                    >
                      {a.date ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{a.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.by}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{a.date || "To come"}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={1} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>How your budget splits</CardTitle>
              <CardMeta>{aud(PACKAGE_TOTAL)}</CardMeta>
              <CardDescription>
                Your house and land package: the land, the build, and the fixed site costs that make the price real.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={SPLIT.map((p) => `${p.label} ${aud(p.amount)}`).join(", ")}
              >
                {SPLIT.map((p) => (
                  <span
                    key={p.label}
                    className={cn("h-full", p.fill)}
                    style={{ width: `${(p.amount / PACKAGE_TOTAL) * 100}%` }}
                  />
                ))}
              </div>
              <ul className="mt-4">
                {SPLIT.map((p) => (
                  <li key={p.label} className="flex items-start gap-3 border-t border-hairline py-2.5 first:border-t-0">
                    <span aria-hidden className={cn("mt-1 size-2.5 shrink-0 rounded-sm", p.fill)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{p.label}</span>
                      <span className="block text-xs text-muted-foreground">{p.detail}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[13px] font-semibold tabular-nums">{aud(p.amount)}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {Math.round((p.amount / PACKAGE_TOTAL) * 100)}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <Reveal index={2}>
        <Card>
          <CardHeader>
            <CardTitle>Progress payments to {job.builder}</CardTitle>
            <CardMeta>
              {aud(paidTotal)} of {aud(BUILD_CONTRACT)} paid
            </CardMeta>
            <CardDescription>
              Each payment is due when your builder reaches its milestone, and your lender pays it from your loan.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Stage</TableHead>
                    <TableHead>Due at</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="pr-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.stage}>
                      <TableCell className="pl-5 font-medium">{p.stage}</TableCell>
                      <TableCell className="text-muted-foreground">{p.milestone}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.pct}%</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{aud(p.amount)}</TableCell>
                      <TableCell className="pr-5">
                        {p.paidOn ? (
                          <Pill tone="ok" variant="caps">
                            Paid {p.paidOn}
                          </Pill>
                        ) : p === nextDue ? (
                          <Pill tone="pending" variant="caps">
                            Due next
                          </Pill>
                        ) : (
                          <Pill tone="neutral" variant="caps">
                            Upcoming
                          </Pill>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            A standard progress-payment schedule on your {aud(BUILD_CONTRACT)} build contract. Your contract has the
            exact amounts.
          </CardFooter>
        </Card>
      </Reveal>
    </div>
  );
}
