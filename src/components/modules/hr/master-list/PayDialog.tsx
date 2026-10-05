"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Banknote, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Field, Input } from "@/components/ui/input";
import { DatePicker, formatDayLong, toIso } from "@/components/ui/date-picker";
import { orgDepartment, orgTone, type MasterRow } from "../data";
import { money, overtimeBasis, requestPayment, usePay, type PaymentKind } from "../pay-store";
import { FieldError, MoneyInput, Notice, datePresets, parseMoney } from "./parts";

const KINDS: PaymentKind[] = ["Bonus", "Commission", "Overtime", "Reimbursement", "Back pay", "Other"];

/** Well above any real one-off payment; a figure past it is almost certainly a typo. */
const MAX_AMOUNT = 100_000;
const MAX_HOURS = 100;

/**
 * Pay — HRIS's People › Pay ("Send a payment") for the master list: a one-off
 * payment filed for payroll to send on the pay date. Overtime is paid by the
 * hour at the person's overtime rate; everything else is an amount. 6s to
 * undo, then it's with payroll. No money moves from the Launchpad.
 */
export function PayDialog({ row, today, onClose }: { row: MasterRow | null; today: Date; onClose: () => void }) {
  const reduce = useReducedMotion();
  const { rates } = usePay();
  const todayIso = toIso(today);
  const [kind, setKind] = React.useState<PaymentKind>("Bonus");
  const [amountStr, setAmountStr] = React.useState("");
  const [hoursStr, setHoursStr] = React.useState("");
  const [note, setNote] = React.useState("");
  const [payOn, setPayOn] = React.useState(todayIso);
  const [tried, setTried] = React.useState(false);

  // Each opening starts clean, so one person's figures never carry to the next.
  const rowId = row?.id ?? null;
  React.useEffect(() => {
    if (!rowId) return;
    setKind("Bonus");
    setAmountStr("");
    setHoursStr("");
    setNote("");
    setPayOn(todayIso);
    setTried(false);
  }, [rowId, todayIso]);

  const rate = row ? rates[row.id] : undefined;
  const byHours = kind === "Overtime";
  const hours = parseMoney(hoursStr);
  const amount = byHours ? (hours != null && rate ? Math.round(hours * rate.overtime * 100) / 100 : null) : parseMoney(amountStr);

  const error = byHours
    ? !rate
      ? "There's no overtime rate on file. Set one in Edit › Pay rates first."
      : hours == null || hours <= 0
        ? "Enter the overtime hours to pay."
        : hours > MAX_HOURS
          ? `That's over ${MAX_HOURS} hours. Check the figure.`
          : null
    : amount == null || amount <= 0
      ? "Enter an amount above $0."
      : amount > MAX_AMOUNT
        ? `That's over ${money(MAX_AMOUNT)}. Check the figure.`
        : null;

  const submit = () => {
    setTried(true);
    if (!row || error || amount == null) return;
    requestPayment(row.name, {
      personId: row.id,
      kind,
      amount,
      ...(byHours && rate && hours ? { hours, rate: rate.overtime } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      payOn,
    });
    onClose();
  };

  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      icon={Banknote}
      title={row ? `Pay ${row.name}` : ""}
      description="Files a one-off payment for payroll to send on the pay date. No money moves from here."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={tried && Boolean(error)}>
            <Send /> {amount && !error ? `Send ${money(amount)}` : "Send payment"}
          </Button>
        </>
      }
    >
      {row ? (
        // Enter in a text field sends, as in HRIS. Buttons keep their own Enter.
        <div
          className="flex flex-col gap-4"
          onKeyDown={(e) => {
            if (e.key !== "Enter" || (e.target as HTMLElement).tagName !== "INPUT") return;
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex min-w-0 items-center gap-3 rounded-lg border border-hairline bg-canvas/60 px-3 py-2.5">
            <Avatar name={row.name} tone={orgTone(row.brands)} size="sm" />
            <p className="min-w-0 text-[13px] leading-snug">
              <span className="block truncate font-medium">{row.name}</span>
              <span className="block text-xs break-words text-muted-foreground">
                <span className="font-mono">{row.record?.employeeId ?? "No ID yet"}</span> · {row.role} ·{" "}
                {orgDepartment(row.department).name}
              </span>
            </p>
          </div>

          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">What it&apos;s for</legend>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => {
                const on = k === kind;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setKind(k)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
                      on
                        ? "border-tone-strong bg-tone-soft text-tone-ink"
                        : "border-border bg-card text-foreground/80 hover:border-tone-line hover:bg-tone-soft/70 dark:bg-white/[0.03]",
                    )}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={byHours ? "hours" : "amount"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
              className="flex flex-col gap-1.5"
            >
              {byHours ? (
                rate ? (
                  <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                    <Field label="Overtime hours" htmlFor="pay-hours">
                      <Input
                        id="pay-hours"
                        inputMode="decimal"
                        autoComplete="off"
                        data-autofocus
                        value={hoursStr}
                        onChange={(e) => setHoursStr(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="0"
                        aria-invalid={tried && Boolean(error)}
                        className="tabular-nums"
                      />
                    </Field>
                    <p className="pb-1.5 text-xs text-muted-foreground">
                      × <span className="font-medium text-foreground tabular-nums">{money(rate.overtime)}</span>/hr overtime (
                      {overtimeBasis(rate)})
                    </p>
                  </div>
                ) : (
                  <Notice tone="amber">There&apos;s no overtime rate on file. Set one in Edit › Pay rates first.</Notice>
                )
              ) : (
                <Field label="Amount (AUD)" htmlFor="pay-amount">
                  <MoneyInput
                    id="pay-amount"
                    data-autofocus
                    value={amountStr}
                    onChange={setAmountStr}
                    placeholder="0.00"
                    aria-invalid={tried && Boolean(error)}
                    className="sm:max-w-56"
                  />
                </Field>
              )}
              {tried ? <FieldError>{error}</FieldError> : null}
            </motion.div>
          </AnimatePresence>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Note (optional)" htmlFor="pay-note">
              <Input
                id="pay-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={byHours ? "Which week, which job" : "What it's for"}
                maxLength={250}
              />
            </Field>
            <Field label="Pay on" htmlFor="pay-on">
              <DatePicker id="pay-on" value={payOn} onChange={setPayOn} min={todayIso} presets={datePresets(today)} ariaLabel="Pay on" />
            </Field>
          </div>

          <AnimatePresence initial={false}>
            {amount && !error ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <span className="block rounded-lg border border-tone-line bg-tone-soft/60 px-3 py-2.5 text-[13px]">
                  Paying <span className="font-semibold tabular-nums">{money(amount)}</span> · {kind.toLowerCase()}
                  {byHours && hours ? ` (${hours} h)` : ""} · on{" "}
                  <span className="font-semibold tabular-nums">{formatDayLong(payOn)}</span>
                </span>
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </Dialog>
  );
}
