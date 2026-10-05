"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Banknote, Building2, Eye, Pencil, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, PANEL_VARIANTS } from "@/lib/motion";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { Field, Input } from "@/components/ui/input";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { AutoHeight } from "@/components/ui/list-motion";
import { DatePicker, formatDayLong, toIso } from "@/components/ui/date-picker";
import {
  OVERTIME_MULTIPLIER,
  formatIsoDate,
  joinName,
  orgDepartment,
  orgTone,
  roundCents,
  splitName,
  type MasterRow,
  type OrgDepartmentId,
  type OrgPerson,
  type PayRate,
  type RecordEdit,
} from "../data";
import {
  TRANSFER_DEPARTMENTS,
  cancelTransfer,
  scheduleTransfer,
  transferBlock,
  transferNow,
  updateProfile,
  type OrgState,
  type ProfileChange,
} from "../org-store";
import { cancelRateChange, changeRates, money, overtimeBasis, usePay } from "../pay-store";
import { BookedMove, FieldError, MoneyInput, Notice, datePresets, parseMoney, reportsTo, shortDate } from "./parts";

type EditTab = "profile" | "rates" | "department";
const TABS: EditTab[] = ["profile", "rates", "department"];

// The tab you last used opens next time, so a run of transfers or rate changes stays one click each.
let tabMemory: EditTab = "profile";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Edit — HRIS's People record editor for the master list, in three tabs:
 * Profile (name in parts, position, emails, start date, mobile, location),
 * Pay rates (hourly and overtime, from an effective date) and Department (a
 * move, today or booked). Every save waits out the 6s undo window before it
 * reaches Horilla. The employee ID is Horilla's and never editable here.
 */
export function EditPersonDialog({
  row,
  all,
  people,
  seats,
  org,
  counts,
  today,
  onClose,
  onView,
}: {
  row: MasterRow | null;
  all: MasterRow[];
  people: OrgPerson[];
  seats: Map<string, OrgPerson>;
  org: Pick<OrgState, "pending" | "scheduled" | "saving">;
  counts: Record<OrgDepartmentId, number>;
  today: Date;
  onClose: () => void;
  onView: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const [tab, setTab] = React.useState<EditTab>(tabMemory);
  const [dir, setDir] = React.useState(1);
  const pay = usePay();
  const profile = useProfileForm(row, all);
  const rates = useRatesForm(row, row ? pay.rates[row.id] : undefined, today);

  const go = (next: EditTab) => {
    setDir(TABS.indexOf(next) >= TABS.indexOf(tab) ? 1 : -1);
    tabMemory = next;
    setTab(next);
  };

  const savingProfile = row ? Boolean(org.saving[row.id]) : false;
  const savingRates = row ? Boolean(pay.pending[row.id]) : false;

  const footer = row ? (
    <>
      <Button variant="ghost" className="mr-auto" onClick={() => onView(row.id)} aria-label="View record">
        <Eye /> <span className="hidden sm:inline">View record</span>
      </Button>
      <Button variant="outline" onClick={onClose}>
        {tab === "department" ? "Close" : "Cancel"}
      </Button>
      {tab === "profile" ? (
        <Button onClick={() => profile.save() && onClose()} disabled={!profile.dirty || savingProfile}>
          Save changes
        </Button>
      ) : tab === "rates" ? (
        <Button onClick={() => rates.save() && onClose()} disabled={!rates.dirty || savingRates}>
          {rates.booking ? "Book new rates" : "Save rates"}
        </Button>
      ) : null}
    </>
  ) : null;

  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      size="lg"
      icon={Pencil}
      title={row ? `Edit ${row.name}` : ""}
      description="Their record, pay rates and department. Changes reach Horilla after 6 seconds to undo."
      footer={footer}
    >
      {row ? (
        <div className="flex flex-col gap-4">
          <SlidingTabs
            value={tab}
            onChange={go}
            ariaLabel="Edit"
            className="self-start"
            items={[
              { value: "profile" as EditTab, label: "Profile", icon: UserRound },
              { value: "rates" as EditTab, label: "Pay rates", icon: Banknote },
              { value: "department" as EditTab, label: "Department", icon: Building2 },
            ]}
          />
          {/* A little room inside the clip, so focus rings at the panel's edge aren't cut. */}
          <div className="-mx-1">
            <AutoHeight>
              <AnimatePresence mode="wait" initial={false} custom={dir}>
                <motion.div
                  key={tab}
                  custom={dir}
                  variants={PANEL_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: reduce ? 0 : 0.22, ease: EASE_SWAP }}
                  className="px-1 py-1"
                >
                  {tab === "profile" ? (
                    <ProfilePanel row={row} form={profile} saving={savingProfile} />
                  ) : tab === "rates" ? (
                    <RatesPanel row={row} form={rates} saving={savingRates} booked={pay.scheduled[row.id]} today={today} />
                  ) : (
                    <DepartmentPanel row={row} people={people} seats={seats} org={org} counts={counts} today={today} onDone={onClose} />
                  )}
                </motion.div>
              </AnimatePresence>
            </AutoHeight>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

/* ── Profile ───────────────────────────────────────────────────────────── */

interface ProfileFields {
  first: string;
  middle: string;
  last: string;
  preferredName: string;
  role: string;
  workEmail: string;
  personalEmail: string;
  commenced: string;
  mobile: string;
  location: string;
}

function profileFrom(row: MasterRow): ProfileFields {
  const r = row.record;
  return {
    ...splitName(row.name),
    preferredName: r?.preferredName ?? "",
    role: row.role,
    workEmail: r?.workEmail ?? "",
    personalEmail: r?.personalEmail ?? "",
    commenced: r?.commenced ?? "",
    mobile: r?.mobile ?? "",
    location: r?.location ?? "",
  };
}

const RECORD_FIELDS: { key: keyof RecordEdit & keyof ProfileFields; label: string; date?: boolean }[] = [
  { key: "workEmail", label: "work email" },
  { key: "personalEmail", label: "personal email" },
  { key: "commenced", label: "commencement date", date: true },
  { key: "preferredName", label: "preferred name" },
  { key: "mobile", label: "mobile" },
  { key: "location", label: "location" },
];

function useProfileForm(row: MasterRow | null, all: MasterRow[]) {
  const [fields, setFields] = React.useState<ProfileFields | null>(row ? profileFrom(row) : null);
  const [tried, setTried] = React.useState(false);
  const rowId = row?.id ?? null;
  // Each opening starts from the record as it is now.
  React.useEffect(() => {
    if (row) setFields(profileFrom(row));
    setTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId]);

  const set = (key: keyof ProfileFields, value: string) => setFields((f) => (f ? { ...f, [key]: value } : f));
  const base = row ? profileFrom(row) : null;
  const f = fields ?? base;
  const handover = Boolean(row?.takingOverFrom);
  const hasRecord = Boolean(row?.record);

  const errors: Partial<Record<keyof ProfileFields, string>> = {};
  if (f && row) {
    if (!f.first.trim()) errors.first = "Add a first name.";
    if (!f.last.trim()) errors.last = "Add a last name.";
    if (!handover && !f.role.trim()) errors.role = "Add their position.";
    if (hasRecord) {
      const work = f.workEmail.trim().toLowerCase();
      if (!work) errors.workEmail = "Add a work email.";
      else if (!EMAIL.test(work)) errors.workEmail = "That doesn't look like an email address.";
      else {
        const clash = all.find((r) => r.id !== row.id && r.record?.workEmail.toLowerCase() === work);
        if (clash) errors.workEmail = `That's already ${clash.name}'s work email.`;
      }
      if (f.personalEmail.trim() && !EMAIL.test(f.personalEmail.trim())) errors.personalEmail = "That doesn't look like an email address.";
      if (!f.commenced) errors.commenced = "Pick their commencement date.";
      if (f.mobile.trim() && !/^\+?[\d\s()-]{8,}$/.test(f.mobile.trim())) errors.mobile = "Digits, spaces and a leading + only.";
    }
  }

  const name = f ? joinName(f) : "";
  const changes: string[] = [];
  const change: ProfileChange = {};
  if (f && base && row) {
    if (name !== row.name) {
      change.name = name;
      changes.push(`name → ${name}`);
    }
    if (!handover && f.role.trim() !== row.role) {
      change.role = f.role.trim();
      changes.push(`position → ${change.role}`);
    }
    if (hasRecord) {
      const edits: RecordEdit = {};
      for (const { key, label, date } of RECORD_FIELDS) {
        const next = f[key].trim();
        if (next === base[key].trim()) continue;
        edits[key] = next;
        changes.push(next ? `${label} → ${date ? formatIsoDate(next) : next}` : `${label} removed`);
      }
      if (Object.keys(edits).length) change.edits = edits;
    }
  }

  const valid = Object.keys(errors).length === 0;
  const save = () => {
    setTried(true);
    if (!row || !valid || !changes.length) return false;
    updateProfile(row.id, change, changes.join(" · ").replace(/^./, (c) => c.toUpperCase()));
    return true;
  };

  return { fields: f, set, errors: tried ? errors : {}, liveErrors: errors, dirty: changes.length > 0, name, handover, hasRecord, save };
}

function ProfilePanel({
  row,
  form,
  saving,
}: {
  row: MasterRow;
  form: ReturnType<typeof useProfileForm>;
  saving: boolean;
}) {
  const f = form.fields;
  if (!f) return null;
  const e = form.errors;
  const text = (key: keyof ProfileFields, label: string, opts: { type?: string; placeholder?: string; disabled?: boolean; hint?: string } = {}) => (
    <Field label={label} htmlFor={`edit-${key}`} hint={opts.hint}>
      <Input
        id={`edit-${key}`}
        type={opts.type ?? "text"}
        value={f[key]}
        onChange={(ev) => form.set(key, ev.target.value)}
        placeholder={opts.placeholder}
        disabled={opts.disabled || saving}
        aria-invalid={Boolean(e[key])}
        aria-describedby={e[key] ? `edit-${key}-error` : undefined}
      />
      <FieldError id={`edit-${key}-error`}>{e[key]}</FieldError>
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      {saving ? <Notice>Their last change is still on its way to Horilla. Edit again in a few seconds.</Notice> : null}

      <fieldset className="min-w-0 rounded-lg border border-hairline bg-canvas/60 p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">Name</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {text("first", "First name")}
          {text("middle", "Middle name")}
          {text("last", "Last name")}
          {text("preferredName", "Preferred name", {
            placeholder: "Goes by",
            disabled: !form.hasRecord,
          })}
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground">
          Shows as{" "}
          <span className="font-medium text-foreground">
            {form.name || "—"}
            {f.preferredName.trim() ? ` (${f.preferredName.trim()})` : ""}
          </span>{" "}
          on the master list and the org chart.
        </p>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {text("role", "Position", {
          disabled: form.handover,
          hint: form.handover ? `Set by the ${row.role} seat they're taking over from ${row.takingOverFrom}.` : undefined,
        })}
        <Field label="Commencement date" htmlFor="edit-commenced">
          <DatePicker
            id="edit-commenced"
            value={f.commenced}
            onChange={(iso) => form.set("commenced", iso)}
            ariaLabel="Commencement date"
          />
          <FieldError>{e.commenced}</FieldError>
        </Field>
        {text("workEmail", "Work email", { type: "email", disabled: !form.hasRecord })}
        {text("personalEmail", "Personal email", { type: "email", disabled: !form.hasRecord })}
        {text("mobile", "Mobile", { type: "tel", placeholder: "04xx xxx xxx", disabled: !form.hasRecord })}
        {text("location", "Location", { placeholder: "Perth, WA", disabled: !form.hasRecord })}
      </div>

      <p className="text-xs text-subtle-foreground">
        {form.hasRecord ? (
          <>
            Employee ID <span className="font-mono">{row.record?.employeeId}</span> is Horilla&apos;s and can&apos;t be changed here.
          </>
        ) : (
          "Horilla hasn't issued their record yet. You can change their name and position now; the rest opens once it has."
        )}
      </p>
    </div>
  );
}

/* ── Pay rates ─────────────────────────────────────────────────────────── */

type Basis = "1.5" | "2" | "custom";

function basisOf(rate?: PayRate): Basis {
  if (!rate) return "1.5";
  const ratio = rate.overtime / rate.hourly;
  return Math.abs(ratio - 1.5) < 0.005 ? "1.5" : Math.abs(ratio - 2) < 0.005 ? "2" : "custom";
}

function useRatesForm(row: MasterRow | null, rate: PayRate | undefined, today: Date) {
  const todayIso = toIso(today);
  const [hourly, setHourly] = React.useState("");
  const [basis, setBasis] = React.useState<Basis>("1.5");
  const [custom, setCustom] = React.useState("");
  const [effective, setEffective] = React.useState(todayIso);
  const [tried, setTried] = React.useState(false);
  const rowId = row?.id ?? null;
  React.useEffect(() => {
    setHourly(rate ? rate.hourly.toFixed(2) : "");
    setBasis(basisOf(rate));
    setCustom(rate ? rate.overtime.toFixed(2) : "");
    setEffective(todayIso);
    setTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, todayIso]);

  const h = parseMoney(hourly);
  const overtime = basis === "custom" ? parseMoney(custom) : h != null ? roundCents(h * Number(basis)) : null;

  const errors: { hourly?: string; overtime?: string } = {};
  if (h == null || h <= 0) errors.hourly = "Enter an hourly rate above $0.";
  else if (h > 1000) errors.hourly = "That's over $1,000 an hour. Check the figure.";
  if (basis === "custom") {
    if (overtime == null || overtime <= 0) errors.overtime = "Enter an overtime rate.";
    else if (h != null && overtime < h) errors.overtime = "Overtime can't be below the hourly rate.";
  }

  const dirty = h != null && overtime != null && (!rate || h !== rate.hourly || overtime !== rate.overtime);
  const valid = !errors.hourly && !errors.overtime;
  const booking = effective > todayIso;

  const save = () => {
    setTried(true);
    if (!row || !valid || !dirty || h == null || overtime == null) return false;
    changeRates(row.id, row.name, { hourly: h, overtime }, effective, todayIso);
    return true;
  };

  return {
    hourly,
    setHourly,
    basis,
    setBasis,
    custom,
    setCustom,
    effective,
    setEffective,
    h,
    overtime,
    errors: tried ? errors : {},
    dirty,
    booking,
    current: rate,
    todayIso,
    save,
  };
}

/** "+3.6%" in emerald, "−2.0%" in rose. */
function Delta({ from, to }: { from: number; to: number }) {
  if (from === to || !from) return null;
  const pct = ((to - from) / from) * 100;
  return (
    <span className={cn("ml-1 text-xs tabular-nums", pct > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
      {pct > 0 ? "+" : "−"}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function RatesPanel({
  row,
  form,
  saving,
  booked,
  today,
}: {
  row: MasterRow;
  form: ReturnType<typeof useRatesForm>;
  saving: boolean;
  booked?: PayRate;
  today: Date;
}) {
  const reduce = useReducedMotion();
  const cur = form.current;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-hairline bg-canvas/60 px-3 py-2.5 text-[13px]">
        {cur ? (
          <>
            <span>
              <span className="text-muted-foreground">Now </span>
              <span className="font-semibold tabular-nums">{money(cur.hourly)}</span>/hr
            </span>
            <span>
              <span className="text-muted-foreground">Overtime </span>
              <span className="font-semibold tabular-nums">{money(cur.overtime)}</span>/hr · {overtimeBasis(cur)}
            </span>
            <span className="text-xs text-muted-foreground">since {formatIsoDate(cur.effective)}</span>
          </>
        ) : (
          <span className="text-muted-foreground">No pay rate on file for {row.name} yet.</span>
        )}
      </div>

      {saving ? <Notice>Their last rate change is still on its way to Horilla. Edit again in a few seconds.</Notice> : null}
      {booked ? (
        <Notice
          action={
            <Button variant="outline" size="sm" onClick={() => cancelRateChange(row.id, row.name)}>
              Cancel change
            </Button>
          }
        >
          Changing to <span className="font-semibold tabular-nums">{money(booked.hourly)}</span>/hr, overtime{" "}
          <span className="font-semibold tabular-nums">{money(booked.overtime)}</span>/hr, on{" "}
          <span className="font-semibold tabular-nums">{formatDayLong(booked.effective)}</span>
          <span className="block text-xs text-muted-foreground">Booked in Horilla · saving again replaces it.</span>
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Hourly rate (AUD)" htmlFor="rate-hourly">
          <MoneyInput
            id="rate-hourly"
            unit="/hr"
            value={form.hourly}
            onChange={form.setHourly}
            disabled={saving}
            aria-invalid={Boolean(form.errors.hourly)}
          />
          <FieldError>{form.errors.hourly}</FieldError>
        </Field>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="rate-overtime" className="text-xs font-medium text-muted-foreground">
              Overtime rate
            </label>
            <div className="flex gap-1" role="group" aria-label="Overtime basis">
              {(
                [
                  ["1.5", "1.5×"],
                  ["2", "2×"],
                  ["custom", "Custom"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={form.basis === value}
                  disabled={saving}
                  onClick={() => {
                    if (value === "custom" && form.overtime != null) form.setCustom(form.overtime.toFixed(2));
                    form.setBasis(value);
                  }}
                  className={cn(
                    "rounded-full border px-2 py-px text-[11px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
                    form.basis === value
                      ? "border-tone-strong bg-tone-soft text-tone-ink"
                      : "border-border text-muted-foreground hover:border-tone-line hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <MoneyInput
            id="rate-overtime"
            unit="/hr"
            value={form.basis === "custom" ? form.custom : form.overtime != null ? form.overtime.toFixed(2) : ""}
            onChange={form.setCustom}
            readOnly={form.basis !== "custom"}
            disabled={saving}
            aria-invalid={Boolean(form.errors.overtime)}
            className={cn(form.basis !== "custom" && "bg-muted/50 text-muted-foreground")}
          />
          {form.basis !== "custom" ? (
            <p className="text-xs text-subtle-foreground">
              {form.basis === "1.5" ? "Time and a half" : "Double time"} of the hourly rate. Pick Custom to set it yourself.
            </p>
          ) : (
            <FieldError>{form.errors.overtime}</FieldError>
          )}
        </div>
      </div>

      <Field
        label="Effective from"
        htmlFor="rate-effective"
        hint={
          form.booking
            ? `Books the change for ${formatDayLong(form.effective)}. Horilla applies it on the day.`
            : "Today: it applies straight away, with 6 seconds to undo."
        }
      >
        <DatePicker
          id="rate-effective"
          value={form.effective}
          onChange={form.setEffective}
          min={form.todayIso}
          presets={datePresets(today)}
          ariaLabel="Effective from"
          className="sm:max-w-64"
        />
      </Field>

      <AnimatePresence initial={false}>
        {form.dirty && form.h != null && form.overtime != null ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg border border-tone-line bg-tone-soft/60 px-3 py-2.5 text-[13px] sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Hourly </span>
                {cur ? <span className="tabular-nums">{money(cur.hourly)} → </span> : null}
                <span className="font-semibold tabular-nums">{money(form.h)}</span>
                {cur ? <Delta from={cur.hourly} to={form.h} /> : null}
              </p>
              <p>
                <span className="text-muted-foreground">Overtime </span>
                {cur ? <span className="tabular-nums">{money(cur.overtime)} → </span> : null}
                <span className="font-semibold tabular-nums">{money(form.overtime)}</span>
                {cur ? <Delta from={cur.overtime} to={form.overtime} /> : null}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p className="text-xs text-subtle-foreground">
        AUD before super. Overtime defaults to time and a half ({OVERTIME_MULTIPLIER}×) of the hourly rate.
      </p>
    </div>
  );
}

/* ── Department ────────────────────────────────────────────────────────── */

/**
 * Move someone to another department. With the effective date on today, one
 * click on a department moves them (6s to undo, then Horilla); a later date
 * books the move for that day. Heads, the managing director, the board and
 * anyone mid-handover stay put, and the panel says why.
 */
function DepartmentPanel({
  row,
  people,
  seats,
  org,
  counts,
  today,
  onDone,
}: {
  row: MasterRow;
  people: OrgPerson[];
  seats: Map<string, OrgPerson>;
  org: Pick<OrgState, "pending" | "scheduled" | "saving">;
  counts: Record<OrgDepartmentId, number>;
  today: Date;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const todayIso = toIso(today);
  const [effective, setEffective] = React.useState(todayIso);
  const block = transferBlock(people, org.pending, row.id);
  const booked = org.scheduled[row.id];
  const now = effective <= todayIso;
  const reports = people.filter((p) => p.managerId === row.id).length;

  const choose = (to: OrgDepartmentId) => {
    if (now) transferNow(row.id, to);
    else scheduleTransfer(row.id, to, effective);
    onDone();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3 rounded-lg border border-hairline bg-canvas/60 px-3 py-2.5">
        <Avatar name={row.name} tone={orgTone(row.brands)} size="sm" />
        <p className="min-w-0 text-[13px] leading-snug">
          <span className="block truncate font-medium">{row.role}</span>
          <span className="block text-xs break-words text-muted-foreground">
            {orgDepartment(row.department).name} · reports to {reportsTo(row, seats) ?? "no one"}
          </span>
        </p>
      </div>

      {block ? (
        <Notice tone="amber">{block}</Notice>
      ) : (
        <>
          {booked ? <BookedMove booked={booked} onCancel={() => cancelTransfer(row.id)} /> : null}

          <Field
            label="Effective date"
            htmlFor="transfer-effective"
            hint={
              now
                ? "Today: a department click moves them straight away, with 6 seconds to undo."
                : `A department click books the move for ${formatDayLong(effective)}. Horilla applies it on the day.`
            }
          >
            <DatePicker
              id="transfer-effective"
              value={effective}
              onChange={setEffective}
              min={todayIso}
              presets={datePresets(today)}
              ariaLabel="Effective date"
              className="sm:max-w-64"
            />
          </Field>

          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-medium text-muted-foreground">
              Move to
              {reports ? (
                <span className="mt-0.5 block font-normal text-subtle-foreground">
                  Their {reports} {reports === 1 ? "report stays" : "reports stay"} in {orgDepartment(row.department).name} under a
                  vacant {row.role} seat.
                </span>
              ) : null}
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TRANSFER_DEPARTMENTS.map((d, i) => {
                const isCurrent = d.id === row.department;
                const head = seats.get(d.headId);
                const isBooked = booked?.to === d.id;
                return (
                  <motion.button
                    key={d.id}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => choose(d.id)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: reduce ? 0 : 0.06 + i * 0.03 }}
                    className={cn(
                      "group flex min-w-0 items-start gap-3 rounded-xl border bg-card p-3 text-left outline-none",
                      "transition-[translate,border-color,background-color,box-shadow] duration-200 ease-out focus-visible:ring-3 focus-visible:ring-ring/45 motion-reduce:transition-none",
                      isCurrent
                        ? "cursor-default border-dashed border-border bg-canvas/60"
                        : "border-border hover:-translate-y-0.5 hover:border-tone-line hover:bg-tone-soft/50 hover:shadow-sm motion-reduce:hover:translate-y-0",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isCurrent ? "bg-muted text-subtle-foreground" : "bg-tone-soft text-tone-ink group-hover:bg-tone-fill group-hover:text-tone-on-fill",
                      )}
                      aria-hidden
                    >
                      <Building2 className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold">{d.name}</span>
                        {isCurrent ? (
                          <Pill tone="neutral" className="px-2 py-0">
                            Current
                          </Pill>
                        ) : isBooked ? (
                          <Pill tone="tone" className="px-2 py-0">
                            Booked
                          </Pill>
                        ) : (
                          <ArrowRight
                            className="size-3.5 shrink-0 -translate-x-1 text-tone-ink opacity-0 transition-[opacity,translate] duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                            aria-hidden
                          />
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs break-words text-muted-foreground">
                        {head?.name ?? "No head"} · {counts[d.id]} {counts[d.id] === 1 ? "person" : "people"}
                      </span>
                      {!isCurrent ? (
                        <span className="mt-1 block text-xs font-medium text-tone-ink">
                          {now ? "Move now" : `Move on ${shortDate(effective, today)}`}
                        </span>
                      ) : null}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}
