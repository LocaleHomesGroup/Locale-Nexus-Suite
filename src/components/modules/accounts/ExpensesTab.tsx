"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Hourglass, Loader2, Timer, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AVG_APPROVAL_TIME, EXPENSES_THIS_MONTH, cents, type ClaimDecision, type ExpenseClaim } from "./data";
import { CLAIM_TONE } from "./status";

/** Kept for existing imports: claim amounts keep their cents ("$186.40"). */
export { cents };

/**
 * Accounts › Expenses. Home's "2 expense claims awaiting approval" lands here;
 * the waiting claims sit at the top of the table with Approve / Decline (the
 * mockup's own approval pair, from HR › Leave). A decision waits out an undo
 * window in the shared store; meanwhile the row says "Approving…" and the
 * claim still counts as awaiting approval.
 */
export function ExpensesTab({
  claims,
  deciding,
  onDecide,
}: {
  claims: ExpenseClaim[];
  /** Decisions inside their undo window, by claim name. */
  deciding: Readonly<Record<string, ClaimDecision>>;
  onDecide: (claim: string, decision: ClaimDecision) => void;
}) {
  const reduce = useReducedMotion();
  const waiting = claims.filter((c) => c.status === "Awaiting approval");
  const waitingTotal = waiting.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expense management"
        description="Claims flow to the right approver and land in Xero coded correctly."
      />

      <Reveal index={0}>
        <KpiGrid cols={3}>
          <KpiCard
            label="Awaiting approval"
            value={waiting.length}
            icon={Hourglass}
            sub={waiting.length > 0 ? `${cents(waitingTotal)} to review` : "All claims reviewed"}
          />
          <KpiCard label="This month" value={EXPENSES_THIS_MONTH} icon={Wallet} tone="charcoal" sub="claimed in August" />
          <KpiCard
            label="Avg approval time"
            value={AVG_APPROVAL_TIME}
            icon={Timer}
            sub="submitted to approved"
          />
        </KpiGrid>
      </Reveal>

      <Reveal index={1} className="min-w-0">
        <Card className="min-w-0 overflow-hidden">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                <TableHead className="pl-5">Claim</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Xero code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((c) => {
                const isWaiting = c.status === "Awaiting approval";
                const decision = isWaiting ? deciding[c.claim] : undefined;
                return (
                  <TableRow
                    key={c.claim}
                    aria-busy={decision ? true : undefined}
                    className={cn(decision && "bg-amber-50/50 dark:bg-amber-500/[0.06]")}
                  >
                    <TableCell className="pl-5 font-medium whitespace-nowrap">{c.claim}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={c.staff} size="xs" />
                        {c.staff}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{cents(c.amount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      <span className="font-mono text-xs text-foreground tabular-nums">{c.code}</span> · {c.account}
                    </TableCell>
                    <TableCell>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={c.status}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
                          className="inline-flex"
                        >
                          <Pill variant="caps" tone={CLAIM_TONE[c.status]}>
                            {c.status}
                          </Pill>
                        </motion.span>
                      </AnimatePresence>
                    </TableCell>
                    <TableCell className="pr-5">
                      {decision ? (
                        <span
                          role="status"
                          className="flex items-center justify-end gap-1.5 text-xs font-medium whitespace-nowrap text-amber-700 dark:text-amber-300"
                        >
                          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                          {decision === "Approved" ? "Approving…" : "Declining…"}
                        </span>
                      ) : isWaiting ? (
                        <span className="flex justify-end gap-1.5">
                          <Button
                            size="xs"
                            onClick={() => onDecide(c.claim, "Approved")}
                            aria-label={`Approve ${c.claim}, ${c.staff}, ${cents(c.amount)}`}
                          >
                            <Check aria-hidden /> Approve
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => onDecide(c.claim, "Declined")}
                            aria-label={`Decline ${c.claim}, ${c.staff}, ${cents(c.amount)}`}
                          >
                            <X aria-hidden /> Decline
                          </Button>
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </Reveal>
    </div>
  );
}
