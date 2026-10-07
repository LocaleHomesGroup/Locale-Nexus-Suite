"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ClipboardList,
  HardHat,
  Loader2,
  Lock,
  ShieldCheck,
  Trophy,
  UserRoundCog,
  Wallet,
  X,
} from "lucide-react";
import { useLaunchpad, confirm } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { undoable } from "@/lib/undoable";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { RateBar } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/states";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  JOBS_BY_STAGE,
  REPS,
  SALES_WON_MTD,
  SALES_WON_QTD,
  STAGE_REPORT_DEALS,
  STAGE_REPORT_LEADS,
  STAGE_REPORT_STATS,
  type DiscountApproval,
  type TeamTask,
} from "../data";
import { useSalesState } from "../sales-state";
import { Footnote, Legend, ManagersOnly, StackedBar } from "../parts";
import { WeeklyScorecard } from "./WeeklyScorecard";
import { commissionPipeline } from "../progress/progress";

const aud = (n: number) => `$${n.toLocaleString("en-AU")}`;

/**
 * Sales › Team — the manager's view: headline figures, sales and jobs per
 * rep, the weekly scorecard, discount approvals that block submissions, the
 * stage report and every open task across the team.
 */
export function Team() {
  const { notify } = useLaunchpad();
  const { deals, discounts, setDiscounts, tasks, setTasks } = useSalesState();
  const reduce = useReducedMotion();

  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [declining, setDeclining] = React.useState<DiscountApproval | null>(null);
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [reassigning, setReassigning] = React.useState<TeamTask | null>(null);
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [reassignTo, setReassignTo] = React.useState<string>("");
  // Decisions inside their undo window: the row shows what's happening, nothing is logged yet.
  const [deciding, setDeciding] = React.useState<Record<string, "approve" | "decline">>({});
  const setDecision = React.useCallback((id: string, d: "approve" | "decline" | null) => {
    setDeciding((prev) => {
      const next = { ...prev };
      if (d) next[id] = d;
      else delete next[id];
      return next;
    });
  }, []);

  const overdue = tasks.filter((t) => t.flag).length;
  const shownTasks = overdueOnly ? tasks.filter((t) => t.flag) : tasks;

  /**
   * Approve and decline both tell the rep and log against the deal, so each
   * waits out an undo window first. Only the commit removes the request.
   */
  const approve = (d: DiscountApproval) => {
    if (deciding[d.id]) return;
    setDecision(d.id, "approve");
    undoable({
      message: `Approving ${aud(d.discount)} discount for ${d.client}`,
      description: `${d.plan} · ${d.rep} can submit once it's approved`,
      commit: () => {
        setDiscounts((prev) => prev.filter((x) => x.id !== d.id));
        setDecision(d.id, null);
        notify(`Discount approved — ${d.client} (${d.plan}) · ${d.rep} can submit`);
      },
      undo: () => setDecision(d.id, null),
      done: {
        message: `Discount approved · ${d.client}`,
        description: `${d.rep} can submit the deal. Approval logged against it.`,
      },
    });
  };

  const decline = () => {
    if (!declining || deciding[declining.id]) return;
    const d = declining;
    setDeclineOpen(false);
    setDecision(d.id, "decline");
    undoable({
      message: `Declining ${aud(d.discount)} discount for ${d.client}`,
      description: `${d.plan} · ${d.rep} is told when it goes through`,
      commit: () => {
        setDiscounts((prev) => prev.filter((x) => x.id !== d.id));
        setDecision(d.id, null);
        notify(`Discount declined — ${d.client} (${d.plan}) · ${d.rep} notified`, "red");
      },
      undo: () => setDecision(d.id, null),
      done: {
        message: `Discount declined · ${d.client}`,
        description: `${d.rep} has been told. Decision logged against the deal.`,
      },
    });
  };

  const openReassign = (t: TeamTask) => {
    setReassigning(t);
    setReassignTo(REPS.find((r) => r !== t.rep) ?? "");
    setReassignOpen(true);
  };

  const reassign = () => {
    if (!reassigning || !reassignTo) return;
    const t = reassigning;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, rep: reassignTo } : x)));
    setReassignOpen(false);
    confirm(`Task reassigned to ${reassignTo}`, t.task);
    notify(`${t.task} — reassigned from ${t.rep} to ${reassignTo}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team overview"
        description="Every rep's pipeline, jobs and tasks in one place — no chasing spreadsheets."
        actions={
          <>
            <Pill tone="neutral" icon={Lock}>
              Manager role
            </Pill>
            <span className="text-xs text-subtle-foreground">All reps · live from Launchpad</span>
          </>
        }
      />

      <Reveal index={0}>
        <KpiGrid cols={4}>
          <KpiCard label="Team sales MTD" value={SALES_WON_MTD} icon={Trophy} />
          <KpiCard label="Pipeline value" value="$2.98m" icon={Wallet} />
          <KpiCard label="Active client builds" value={223} icon={HardHat} tone="charcoal" />
          <KpiCard
            label="Overdue tasks"
            value={overdue}
            icon={AlertTriangle}
            alert={overdue > 0}
            tone="ok"
            onClick={() => setOverdueOnly((v) => !v)}
            active={overdueOnly}
            hint="Tap to see them"
          />
        </KpiGrid>
      </Reveal>

      <Reveal index={1} className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Sales won · quarter to date</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2.5">
              {SALES_WON_QTD.map(([rep, sales, value], i) => (
                <li key={rep}>
                  <div className="flex text-xs">
                    <span className="font-semibold">{rep}</span>
                    <span className="ml-auto text-muted-foreground tabular-nums">
                      {sales} sales · {value}
                    </span>
                  </div>
                  <RateBar
                    value={sales / 7}
                    height="h-2.5"
                    delay={Math.min(i * 0.06, 0.3)}
                    label={`${rep}: ${sales} sales, ${value}`}
                    className="mt-1"
                  />
                </li>
              ))}
            </ul>
            <Footnote className="mt-3">Fed by Sale Won events — same data as Leadership.</Footnote>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Client jobs by stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2.5">
              {JOBS_BY_STAGE.map(([rep, precon, construction, handed], i) => (
                <li key={rep}>
                  <div className="flex text-xs">
                    <span className="font-semibold">{rep}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {precon + construction + handed} jobs
                    </span>
                  </div>
                  <StackedBar
                    className="mt-1"
                    delay={Math.min(i * 0.06, 0.3)}
                    label={`${rep}: ${precon} preconstruction, ${construction} construction, ${handed} handed over`}
                    segments={[
                      {
                        value: precon,
                        tone: "mist",
                        title: "Preconstruction",
                      },
                      {
                        value: construction,
                        tone: "haven",
                        title: "Construction",
                      },
                      { value: handed, tone: "charcoal", title: "Handed over" },
                    ]}
                  />
                </li>
              ))}
            </ul>
            <Legend
              className="mt-3"
              items={[
                { label: "Precon", tone: "mist" },
                { label: "Construction", tone: "haven" },
                { label: "Handed over", tone: "charcoal" },
              ]}
            />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <WeeklyScorecard />
      </Reveal>

      <Reveal index={3}>
        <Card className={cn(discounts.length > 0 ? "pulse-rose border-rose-200 dark:border-rose-500/30" : undefined)}>
          <CardHeader>
            <AlertTriangle
              className={cn(
                "size-4",
                discounts.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-subtle-foreground",
              )}
              aria-hidden
            />
            <CardTitle>Discount approvals</CardTitle>
            <ManagersOnly />
            <CardMeta>Deals cannot be submitted until approved</CardMeta>
          </CardHeader>
          <CardContent>
            {discounts.length === 0 ? (
              <EmptyState
                className="py-6"
                icon={ShieldCheck}
                title="No discounts waiting"
                description="New requests land here when a rep prices a deal below the builder's threshold."
              />
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {discounts.map((d, i) => {
                    const decision = deciding[d.id];
                    return (
                      <motion.li
                        key={d.id}
                        aria-busy={decision ? true : undefined}
                        layout="position"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          transition: {
                            duration: 0.2,
                            ease: EASE_OUT,
                            delay: rowDelay(i, reduce),
                          },
                        }}
                        exit={{
                          opacity: 0,
                          x: -14,
                          transition: { duration: 0.14 },
                        }}
                        className={cn(
                          "flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline py-2.5 transition-opacity duration-200",
                          decision && "opacity-70",
                        )}
                      >
                        <div className="min-w-[190px]">
                          <p className="text-[13px] font-semibold">
                            {d.client} <span className="font-normal text-muted-foreground">· {d.rep}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{d.plan}</p>
                        </div>
                        <p className="text-xs tabular-nums">
                          Discount <strong className="font-semibold">{aud(d.discount)}</strong>
                          <span className="text-rose-700 dark:text-rose-300">
                            {" "}
                            · {aud(d.contribution)} company contribution
                          </span>
                        </p>
                        {decision ? (
                          <span
                            role="status"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 sm:ml-auto dark:text-amber-300"
                          >
                            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                            {decision === "approve" ? "Approving…" : "Declining…"}
                          </span>
                        ) : (
                          <span className="flex gap-1.5 sm:ml-auto">
                            <Button
                              size="sm"
                              onClick={() => approve(d)}
                              aria-label={`Approve ${aud(d.discount)} discount for ${d.client}`}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Decline ${aud(d.discount)} discount for ${d.client}`}
                              onClick={() => {
                                setDeclining(d);
                                setDeclineOpen(true);
                              }}
                            >
                              Decline
                            </Button>
                          </span>
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
            <Footnote className="mt-2">
              Thresholds are indicative pending confirmation. Approvals are logged against the deal.
            </Footnote>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal index={4}>
        <Card>
          <CardHeader>
            <CardTitle>Stage report by rep</CardTitle>
            <ManagersOnly />
            <Pill tone="neutral">Placeholder rate</Pill>
            <CardMeta>Values are commission payable, not contract value</CardMeta>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-3">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                  <TableHead className="pl-0">Deals</TableHead>
                  <TableHead>Appt booked</TableHead>
                  <TableHead>Appt held</TableHead>
                  <TableHead>Potential sale</TableHead>
                  <TableHead>Sale won MTD</TableHead>
                  <TableHead className="pr-0 text-right">Pipeline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {STAGE_REPORT_DEALS.map(([rep, counts]) => (
                  <TableRow key={rep}>
                    <TableCell className="py-2 pl-0 font-semibold whitespace-nowrap">{rep}</TableCell>
                    {counts.map((n, ci) => (
                      <TableCell key={ci} className="py-2 tabular-nums">
                        {n || <Dash />}
                      </TableCell>
                    ))}
                    <TableCell className="py-2 pr-0 text-right font-semibold text-foreground tabular-nums">
                      {aud(commissionPipeline(deals, rep))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-wrap gap-x-3.5 gap-y-1 border-t border-hairline pt-2.5">
              {STAGE_REPORT_STATS.map(([label, value, warn]) => (
                <span
                  key={label}
                  className={cn(
                    "text-xs tabular-nums",
                    warn ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground",
                  )}
                >
                  <span className="font-semibold">{label}:</span> {value}
                </span>
              ))}
            </div>

            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                  <TableHead className="pl-0">Leads</TableHead>
                  <TableHead>New</TableHead>
                  <TableHead>Attempting</TableHead>
                  <TableHead>Connected</TableHead>
                  <TableHead className="pr-0">Qualified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {STAGE_REPORT_LEADS.map(([rep, counts]) => (
                  <TableRow key={rep}>
                    <TableCell className="py-2 pl-0 font-semibold whitespace-nowrap">{rep}</TableCell>
                    {counts.map((n, ci) => (
                      <TableCell key={ci} className={cn("py-2 tabular-nums", ci === counts.length - 1 && "pr-0")}>
                        {n || <Dash />}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Footnote>
              Deals from the HubSpot sales pipeline; leads from HubSpot lead stages. Both mirrored live. The whole
              team&apos;s commission is visible to managers and leadership only; a consultant sees only their own, in the
              Sales Representative portal.
            </Footnote>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal index={5}>
        <Card>
          <CardHeader className="border-b border-hairline pb-3">
            <ClipboardList className="size-4 text-subtle-foreground" aria-hidden />
            <CardTitle>Tasks across the team</CardTitle>
            {overdueOnly ? (
              <Button
                variant="ghost"
                size="xs"
                className="text-rose-700 hover:text-rose-800 dark:text-rose-300"
                onClick={() => setOverdueOnly(false)}
              >
                Overdue only <X aria-hidden />
                <span className="sr-only">— show all tasks</span>
              </Button>
            ) : null}
            <CardMeta>Reassign from here when someone is away</CardMeta>
          </CardHeader>
          <ul>
            <AnimatePresence initial={false}>
              {shownTasks.map((t, i) => (
                <motion.li
                  key={t.id}
                  layout="position"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: {
                      duration: 0.2,
                      ease: EASE_OUT,
                      delay: rowDelay(i, reduce),
                    },
                  }}
                  exit={{ opacity: 0, x: -14, transition: { duration: 0.14 } }}
                  className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-hairline px-5 py-2.5 first:border-t-0 hover:bg-tone-soft/60"
                >
                  <span className="min-w-0 basis-full text-[13px] sm:basis-auto">{t.task}</span>
                  <span className="text-xs text-muted-foreground sm:ml-auto">{t.rep}</span>
                  <span
                    className={cn(
                      "min-w-[90px] text-xs sm:text-right",
                      t.flag ? "font-semibold text-rose-700 dark:text-rose-300" : "text-muted-foreground",
                    )}
                  >
                    {t.due}
                  </span>
                  <Button size="xs" variant="outline" className="ml-auto sm:ml-0" onClick={() => openReassign(t)}>
                    <UserRoundCog aria-hidden /> Reassign
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Card>
      </Reveal>

      <Dialog
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        icon={AlertTriangle}
        iconTone="problem"
        title={declining ? `Decline the discount for ${declining.client}?` : "Decline discount"}
        description={
          declining
            ? `${declining.rep} is notified and the deal stays blocked from submission until a new discount is requested. The decision is logged against the deal.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={decline}>
              {declining ? `Decline ${aud(declining.discount)} discount` : "Decline discount"}
            </Button>
          </>
        }
      >
        {declining ? (
          <div className="rounded-lg border border-border bg-canvas px-3 py-2.5 text-xs">
            <p className="text-[13px] font-semibold">
              {declining.client} <span className="font-normal text-muted-foreground">· {declining.rep}</span>
            </p>
            <p className="mt-0.5 text-muted-foreground">{declining.plan}</p>
            <p className="mt-1.5 tabular-nums">
              Discount <strong className="font-semibold">{aud(declining.discount)}</strong>
              <span className="text-rose-700 dark:text-rose-300">
                {" "}
                · {aud(declining.contribution)} company contribution
              </span>
            </p>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        icon={UserRoundCog}
        title="Reassign task"
        description={
          reassigning
            ? `Moves “${reassigning.task}” off ${reassigning.rep}'s list. The new owner sees it in My week and gets a notification.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={reassign} disabled={!reassignTo}>
              {reassignTo ? `Reassign to ${reassignTo}` : "Reassign"}
            </Button>
          </>
        }
      >
        {reassigning ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Currently with <strong className="font-semibold text-foreground">{reassigning.rep}</strong> ·{" "}
              <span className={reassigning.flag ? "font-semibold text-rose-700 dark:text-rose-300" : undefined}>
                {reassigning.due}
              </span>
            </p>
            <Field label="Reassign to">
              <SmoothSelect
                ariaLabel="Reassign to"
                value={reassignTo}
                onChange={setReassignTo}
                options={REPS.filter((r) => r !== reassigning.rep).map((r) => ({
                  value: r,
                  label: r,
                }))}
              />
            </Field>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
