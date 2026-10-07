"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RotateCcw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, RISE_VARIANTS } from "@/lib/motion";
import { useLaunchpad } from "@/state/launchpad-store";
import {
  LEAVE_TYPES,
  formatDays,
  leaveLength,
  leaveNotice,
  leaveOverlap,
  leaveWhen,
  othersOff,
  personTone,
  workingDays,
  type LeaveRequest,
  type LeaveType,
} from "@/components/modules/hr/data";
import { fileLeave, useLeave } from "@/components/modules/hr/leave-store";
import { LEAVE_TYPE_META } from "@/components/modules/hr/LeaveQueue";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { EMPLOYEE, EMPLOYEE_ID, EMPLOYEE_TODAY, LEAVE_ALLOWANCE, SICK_BACKDATE_DAYS, addDays, leaveAvailable } from "./data";
import { useLeaveRoute } from "./leave-route";

interface Form {
  type: LeaveType;
  start: string;
  end: string;
  note: string;
}

const BLANK: Form = { type: "Vacation", start: "", end: "", note: "" };

/** The first day a type can start on: today, or a fortnight back for sick leave. */
const earliest = (type: LeaveType) => (type === "Sick" ? addDays(EMPLOYEE_TODAY, -SICK_BACKDATE_DAYS) : EMPLOYEE_TODAY);

/** Why the request can't go yet, in the order you'd fix them. */
function problems(form: Form, mine: LeaveRequest[]): string[] {
  const out: string[] = [];
  if (!form.start || !form.end) out.push("Pick the first and last day you'll be away.");
  else if (form.end < form.start) out.push("The last day is before the first.");
  else if (form.start < earliest(form.type))
    out.push(form.type === "Sick" ? `Sick leave can go back ${SICK_BACKDATE_DAYS} days at most.` : "Leave can't start in the past.");
  else if (workingDays(form.start, form.end) === 0) out.push("Those days are a weekend. Pick at least one working day.");
  else {
    const clash = leaveOverlap(mine, EMPLOYEE.name, form.start, form.end);
    if (clash) out.push(`You already have ${clash.type.toLowerCase()} leave on ${clash.when}.`);
  }
  if (form.type === "Other" && !form.note.trim()) out.push("Say what the leave is for: Other needs a note.");
  return out;
}

/**
 * Employee › Leave › File leave — HRIS's New request. Pick the reason you're
 * out (Vacation, Sick, Personal, Bereavement or Other), the first and last
 * day, and a note for your manager. The summary works out the working days,
 * your balance after, who else is off and who decides it. Send holds for the
 * undo window, then your department head is notified.
 */
export function FileLeave({ onFiled }: { onFiled: () => void }) {
  const reduce = useReducedMotion();
  const { notify } = useLaunchpad();
  const { requests, filing } = useLeave();
  const { department, approver } = useLeaveRoute();
  const [form, setForm] = React.useState<Form>(BLANK);
  const [tried, setTried] = React.useState(false);

  // Your own requests, including any still inside their undo window.
  const mine = React.useMemo(() => [...filing, ...requests].filter((r) => r.name === EMPLOYEE.name), [filing, requests]);
  const issues = problems(form, mine);
  const dated = Boolean(form.start && form.end && form.end >= form.start);
  const days = dated ? workingDays(form.start, form.end) : 0;
  const available = leaveAvailable(mine, form.type);
  const after = available === null ? null : Math.round((available - days) * 10) / 10;
  const off = dated ? othersOff({ name: EMPLOYEE.name, start: form.start, end: form.end }, requests) : [];
  const first = approver?.name?.split(" ")[0] ?? "your manager";

  const pickType = (type: LeaveType) =>
    setForm((f) => ({ ...f, type, ...(f.start && f.start < earliest(type) ? { start: "", end: "" } : {}) }));
  const pickStart = (start: string) => setForm((f) => ({ ...f, start, end: !f.end || f.end < start ? start : f.end }));

  const send = () => {
    setTried(true);
    if (issues.length || !approver?.name) return;
    const req: LeaveRequest = {
      id: `leave-${Date.now().toString(36)}`,
      name: EMPLOYEE.name,
      type: form.type,
      when: leaveWhen(form.start, form.end),
      length: leaveLength(days),
      status: "Pending",
      days,
      start: form.start,
      end: form.end,
      balance: available,
      seatId: EMPLOYEE_ID,
      department,
      approver: approver.name,
      ...(form.note.trim() ? { reason: form.note.trim() } : {}),
      filed: EMPLOYEE_TODAY,
    };
    fileLeave(req, () => notify(leaveNotice(req), "red"));
    setForm(BLANK);
    setTried(false);
    onFiled();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="File leave"
        description={`Pick the kind of leave and the days you'll be away. It goes to ${approver?.name ?? "your department head"}, and their decision shows in My requests.`}
      />

      <Reveal index={0}>
        <KpiGrid cols={3}>
          {(["Vacation", "Sick", "Personal"] as const).map((t) => {
            const left = leaveAvailable(mine, t) ?? 0;
            const pending = mine.filter((r) => r.type === t && r.status === "Pending").reduce((n, r) => n + r.days, 0);
            return (
              <KpiCard
                key={t}
                size="sm"
                label={`${t} left`}
                value={formatDays(left)}
                sub={`of ${LEAVE_ALLOWANCE[t]} a year${pending ? ` · ${leaveLength(pending)} pending` : ""}`}
                icon={LEAVE_TYPE_META[t].icon}
                tone={left < 0 ? "problem" : "tone"}
              />
            );
          })}
        </KpiGrid>
      </Reveal>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Reveal index={1} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Your request</CardTitle>
              <CardDescription>Bereavement and Other don&apos;t come out of a balance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-muted-foreground">Reason for leave</legend>
                <div role="radiogroup" aria-label="Reason for leave" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {LEAVE_TYPES.map((t) => (
                    <TypeOption key={t} type={t} checked={form.type === t} onPick={() => pickType(t)} reduce={reduce} />
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First day" htmlFor="leave-start">
                  <DatePicker
                    id="leave-start"
                    value={form.start}
                    onChange={pickStart}
                    min={earliest(form.type)}
                    placeholder="Pick the first day"
                  />
                </Field>
                <Field label="Last day" htmlFor="leave-end">
                  <DatePicker
                    id="leave-end"
                    value={form.end}
                    onChange={(end) => setForm((f) => ({ ...f, end }))}
                    min={form.start || earliest(form.type)}
                    placeholder="Pick the last day"
                  />
                </Field>
              </div>

              <Field
                label={form.type === "Other" ? `Note for ${first}` : `Note for ${first} (optional)`}
                htmlFor="leave-note"
                hint="A line is plenty: what it's for, or who's covering."
              >
                <Textarea
                  id="leave-note"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder={form.type === "Other" ? "What's the leave for?" : "Family trip, appointment, who's covering…"}
                  maxLength={240}
                  aria-invalid={tried && form.type === "Other" && !form.note.trim() ? true : undefined}
                />
              </Field>

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
                  <Button
                    variant="outline"
                    onClick={() => {
                      setForm(BLANK);
                      setTried(false);
                    }}
                  >
                    <RotateCcw /> Start over
                  </Button>
                  <Button variant="brand" onClick={send} disabled={!approver?.name}>
                    <Send /> Send to {first}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        {/* On a phone the summary comes after the form: fill it in, then check it. */}
        <div className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-6">
          <Reveal index={2}>
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.dl
                    key={`${form.type}:${form.start}:${form.end}`}
                    variants={RISE_VARIANTS}
                    custom={1}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: reduce ? 0 : 0.2, ease: EASE_SWAP }}
                    className="divide-y divide-hairline rounded-lg border border-hairline text-[13px]"
                  >
                    <SummaryRow
                      label="Away"
                      value={dated ? leaveLength(days) : "—"}
                      sub={dated ? `${leaveWhen(form.start, form.end)} · working days only` : "Pick your dates"}
                    />
                    <SummaryRow
                      label="Balance after"
                      value={after === null ? "None used" : formatDays(after)}
                      sub={
                        available === null
                          ? `${form.type} is granted case by case`
                          : after !== null && after < 0
                            ? `${formatDays(-after)} over · ${first} can still approve it`
                            : `${formatDays(available)} ${form.type.toLowerCase()} available now`
                      }
                      warn={after !== null && after < 0}
                    />
                    <SummaryRow
                      label="Also off"
                      value={dated ? (off.length ? String(off.length) : "No one") : "—"}
                      sub={dated ? (off.length ? off.map((a) => `${a.name} (${a.when})`).join(", ") : "Nobody's booked off then") : "Once you pick dates"}
                    />
                  </motion.dl>
                </AnimatePresence>
                {approver?.name ? (
                  <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-canvas/70 px-3 py-2.5 dark:bg-white/[0.02]">
                    <Avatar name={approver.name} tone={personTone(approver.name)} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Goes to</p>
                      <p className="truncate text-[13px] font-medium">{approver.name}</p>
                      <p className="truncate text-xs text-subtle-foreground">{approver.role}</p>
                    </div>
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-subtle-foreground">Sample allowances: Horilla&apos;s balances aren&apos;t connected yet.</p>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={3}>
            <Card>
              <CardHeader>
                <CardTitle>What happens next</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-[13px]">
                  {[
                    [`${first} is notified`, "It lands in their Approvals, and in their Launchpad Notifications."],
                    [`${first} approves or declines`, "The decision shows in My requests, marked New, with a badge on the rail."],
                    ["Plans changed?", "Cancel it from My requests while it's still pending."],
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

/** One reason as a radio card. The selected card's fill glides to the next one picked. */
function TypeOption({
  type,
  checked,
  onPick,
  reduce,
}: {
  type: LeaveType;
  checked: boolean;
  onPick: () => void;
  reduce: boolean | null;
}) {
  const { icon: Icon, hint } = LEAVE_TYPE_META[type];
  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col gap-1 rounded-xl border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/45",
        checked ? "border-tone-strong" : "border-border hover:border-tone-line hover:bg-tone-soft/50",
      )}
    >
      {checked ? (
        <motion.span
          layoutId="leave-type-fill"
          className="absolute inset-0 rounded-[11px] bg-tone-soft"
          transition={{ duration: reduce ? 0 : 0.28, ease: EASE_SWAP }}
          aria-hidden
        />
      ) : null}
      <input type="radio" name="leave-type" value={type} checked={checked} onChange={onPick} className="sr-only" />
      <span className="relative flex items-center gap-1.5 text-[13px] font-semibold">
        <Icon className={cn("size-4 shrink-0", checked ? "text-tone-ink" : "text-subtle-foreground")} aria-hidden />
        {type}
      </span>
      <span className="relative text-xs text-muted-foreground">{hint}</span>
    </label>
  );
}

function SummaryRow({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="min-w-0">
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-subtle-foreground">{sub}</span>
      </dt>
      <dd className={cn("shrink-0 font-semibold tabular-nums", warn && "text-rose-700 dark:text-rose-300")}>{value}</dd>
    </div>
  );
}
