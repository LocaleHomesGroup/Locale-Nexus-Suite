"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import {
  AtSign,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  CreditCard,
  FileText,
  Hourglass,
  IdCard,
  Mail,
  Network,
  RotateCcw,
  Save,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_SWAP } from "@/lib/motion";
import { confirm } from "@/state/launchpad-store";
import { ORG_SEED, formatIsoDate, orgDepartment, tenure } from "@/components/modules/hr/data";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import {
  BILL_TO,
  CURRENCY,
  EMPLOYEE,
  EMPLOYEE_TODAY,
  PROCESSORS,
  RATES,
  money,
  paymentComplete,
  processor,
  type PaymentMethod,
  type ProcessorId,
  type SenderDetails,
} from "./data";
import { savePayment, saveSender, useInvoices } from "./invoice-store";
import { LogoBox } from "./InvoiceSheet";
import { Detail } from "./parts";

const MANAGER = ORG_SEED.find((p) => p.id === EMPLOYEE.managerId)!;
const DEPT = orgDepartment(EMPLOYEE.department).name;

/**
 * Employee › Profile — HRIS's employee Profile (the record and the ID card)
 * with its contractor Profile's invoice sections: Invoice details prefill the
 * sender block on every new invoice, and Payment method is how Accounts pays
 * you (HRIS's Payment Gateway). Your rates sit beside them, read-only: Locale
 * sets them. Edits stay in this session.
 */
export function EmployeeProfile() {
  const record = EMPLOYEE.record;
  // Tenure on the portal's own clock, so server and client agree.
  const today = React.useMemo(() => new Date(`${EMPLOYEE_TODAY}T12:00:00`), []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profile"
        description="Your record at Locale, your rates, and the details every invoice you send carries."
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={0}>
            <Card>
              <CardHeader>
                <CardTitle>Employment</CardTitle>
                <CardMeta>From Horilla</CardMeta>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Detail index={0} icon={IdCard} label="Employee ID" mono>
                    {record?.employeeId}
                  </Detail>
                  <Detail index={1} icon={Building2} label="Department">
                    {DEPT}
                  </Detail>
                  <Detail index={2} icon={Briefcase} label="Position">
                    {EMPLOYEE.role}
                  </Detail>
                  <Detail index={3} icon={Network} label="Reports to">
                    {MANAGER.name} · {MANAGER.role}
                  </Detail>
                  <Detail index={4} icon={CalendarDays} label="Started">
                    {record ? formatIsoDate(record.commenced) : null}
                  </Detail>
                  <Detail index={5} icon={Hourglass} label="Tenure">
                    {record ? tenure(record.commenced, today) : null}
                  </Detail>
                  <Detail index={6} icon={Mail} label="Work email" mono>
                    {record?.workEmail}
                  </Detail>
                  <Detail index={7} icon={AtSign} label="Personal email" mono>
                    {record?.personalEmail}
                  </Detail>
                </dl>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={1}>
            <InvoiceDetailsCard />
          </Reveal>

          <Reveal index={2}>
            <PaymentMethodCard />
          </Reveal>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={1}>
            <IdBadge />
          </Reveal>
          <Reveal index={2}>
            <Card>
              <CardHeader>
                <CardTitle>Your rates</CardTitle>
                <CardMeta>Sample</CardMeta>
                <CardDescription>
                  Set by Locale. Talk to {MANAGER.name} about a change; every new invoice uses these.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-hairline rounded-lg border border-hairline text-[13px]">
                  <Rate label="Regular" value={`${money(RATES.regular)}/h`} sub={`Up to ${RATES.overtimeAfter}h in a pay week`} />
                  <Rate label="Overtime" value={`${money(RATES.overtime)}/h`} sub={`Every hour after ${RATES.overtimeAfter}h`} />
                  <Rate label="Pay week" value="Sun–Sat" sub="One invoice a week, sent after it closes" />
                  <Rate label="Currency" value={CURRENCY} sub={`Billed to ${BILL_TO.company}`} />
                </dl>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Rate({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
      <dt>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-subtle-foreground">{sub}</span>
      </dt>
      <dd className="font-semibold whitespace-nowrap tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The staff card — HRIS's ID card in Locale's colours: charcoal, the silver
 * wordmark, your photo initials and record. A sheen crosses it once as it
 * arrives and again on hover; it never loops.
 */
function IdBadge() {
  const reduce = useReducedMotion();
  const [sweep, setSweep] = React.useState(0);
  const record = EMPLOYEE.record;
  return (
    <div
      onMouseEnter={() => setSweep((n) => n + 1)}
      className="relative overflow-hidden rounded-2xl border border-black/10 bg-charcoal p-5 text-silver shadow-lg shadow-black/15 dark:border-white/10"
    >
      {reduce ? null : (
        <motion.span
          key={sweep}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent"
          initial={{ x: "0%" }}
          animate={{ x: "400%" }}
          transition={{ duration: 1.4, ease: EASE_SWAP, delay: sweep ? 0 : 0.5 }}
        />
      )}
      <div className="flex items-start justify-between gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/locale-logo-silver.svg" alt="Locale Property Group" className="h-7 w-auto" draggable={false} />
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
          Staff
        </span>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Avatar name={EMPLOYEE.name} tone="haven" size="lg" />
        <div className="min-w-0">
          <p className="truncate font-heading text-[17px] font-bold text-white">{EMPLOYEE.name}</p>
          <p className="truncate text-xs text-silver/75">{EMPLOYEE.role}</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4">
        <BadgeLine label="Department">{DEPT}</BadgeLine>
        <BadgeLine label="Employee ID" mono>
          {record?.employeeId ?? "—"}
        </BadgeLine>
        <BadgeLine label="Started">{record ? formatIsoDate(record.commenced) : "—"}</BadgeLine>
        <BadgeLine label="Paid by">Weekly invoice</BadgeLine>
      </dl>
    </div>
  );
}

function BadgeLine({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold tracking-[0.12em] text-haven-300 uppercase">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-[13px] text-white", mono && "font-mono text-xs")}>{children}</dd>
    </div>
  );
}

/* ── Invoice details (HRIS contractor Profile › Invoice Form) ──────────── */

const sameSender = (a: SenderDetails, b: SenderDetails) =>
  (Object.keys(a) as (keyof SenderDetails)[]).every((k) => (a[k] ?? "") === (b[k] ?? ""));

function InvoiceDetailsCard() {
  const { sender } = useInvoices();
  const [draft, setDraft] = React.useState(sender);
  const logoInput = React.useRef<HTMLInputElement>(null);
  const dirty = !sameSender(draft, sender);
  const set = (patch: Partial<SenderDetails>) => setDraft((d) => ({ ...d, ...patch }));

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("That logo is over 5 MB", { description: "Use a PNG, JPG or SVG under 5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && set({ logo: reader.result });
    reader.readAsDataURL(file);
  };

  const save = () => {
    saveSender({
      ...draft,
      entityName: draft.entityName.trim(),
      name: draft.name.trim(),
      address: draft.address.trim(),
      cityStateZip: draft.cityStateZip.trim(),
      country: draft.country.trim(),
    });
    confirm("Invoice details saved", "Every new invoice starts with them");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-4 text-tone-ink" aria-hidden /> Invoice details
        </CardTitle>
        <CardDescription>These fill the sender block on every new invoice. You can still change them on an invoice.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <LogoBox logo={draft.logo} name={draft.entityName || draft.name} className="size-20" />
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => logoInput.current?.click()}>
                <Upload /> {draft.logo ? "Change logo" : "Upload logo"}
              </Button>
              {draft.logo ? (
                <Button variant="ghost" size="sm" onClick={() => set({ logo: null })}>
                  <X /> Remove
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-subtle-foreground">PNG, JPG or SVG, up to 5 MB. Without one, invoices show your initials.</p>
            <input ref={logoInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={onLogo} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Entity or company name" htmlFor="pf-entity" hint="Your business name, or your own if you invoice as yourself">
            <Input id="pf-entity" value={draft.entityName} onChange={(e) => set({ entityName: e.target.value })} />
          </Field>
          <Field label="Your name" htmlFor="pf-name">
            <Input id="pf-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Street address" htmlFor="pf-address" className="sm:col-span-2">
            <Input
              id="pf-address"
              value={draft.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="Street address"
            />
          </Field>
          <Field label="City, state and postcode" htmlFor="pf-city">
            <Input id="pf-city" value={draft.cityStateZip} onChange={(e) => set({ cityStateZip: e.target.value })} />
          </Field>
          <Field label="Country" htmlFor="pf-country">
            <Input id="pf-country" value={draft.country} onChange={(e) => set({ country: e.target.value })} />
          </Field>
        </div>
      </CardContent>
      <SaveBar dirty={dirty} onReset={() => setDraft(sender)} onSave={save} />
    </Card>
  );
}

/* ── Payment method (HRIS contractor Profile › Payment Gateway) ────────── */

function PaymentMethodCard() {
  const reduce = useReducedMotion();
  const { payment } = useInvoices();
  const [draft, setDraft] = React.useState<PaymentMethod | null>(payment);
  const proc = draft ? processor(draft.processor) : null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(payment);

  const pick = (id: ProcessorId) => setDraft((d) => (d?.processor === id ? d : { processor: id, fields: {} }));
  const setField = (key: string, value: string) =>
    setDraft((d) => (d ? { ...d, fields: { ...d.fields, [key]: value } } : d));

  const save = () => {
    if (draft && !paymentComplete(draft)) {
      toast.error("Fill in every required field", { description: `${proc?.label} needs them all to pay you.` });
      return;
    }
    savePayment(draft);
    confirm("Payment method saved", draft ? `${proc?.label} · new invoices carry it` : "New invoices go without one");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4 text-tone-ink" aria-hidden /> Payment method
        </CardTitle>
        {payment ? (
          <CardMeta>
            <Pill tone="ok" className="px-2 py-0">
              <BadgeCheck className="size-3" aria-hidden /> On file
            </Pill>
          </CardMeta>
        ) : null}
        <CardDescription>How Accounts pays your invoices. It&apos;s printed on each one you send.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PROCESSORS.map((p) => {
            const active = draft?.processor === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pick(p.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[13px] font-medium transition-[border-color,background-color,box-shadow] focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                  active
                    ? "border-tone-strong bg-tone-soft text-foreground shadow-sm ring-1 ring-tone-line"
                    : "border-border bg-card text-muted-foreground hover:border-tone-line hover:bg-tone-soft/60 hover:text-foreground",
                )}
              >
                <p.icon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                {active ? <Check className="size-3.5 shrink-0 text-tone-ink" aria-hidden /> : null}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {proc && draft ? (
            <motion.div
              key={proc.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduce ? 0 : 0.24, ease: EASE_SWAP }}
              className="overflow-hidden"
            >
              <p className="mb-3 rounded-lg bg-tone-soft px-3.5 py-2.5 text-xs text-tone-ink">{proc.blurb}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {proc.fields.map((f) => (
                  <Field key={f.key} label={f.optional ? `${f.label} (optional)` : f.label} htmlFor={`pm-${f.key}`}>
                    <Input
                      id={`pm-${f.key}`}
                      type={f.type ?? "text"}
                      value={draft.fields[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={cn(f.mono && "font-mono text-xs")}
                      autoComplete="off"
                    />
                  </Field>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.18 }}
              className="text-xs text-muted-foreground"
            >
              Nothing chosen yet. Pick one and its details appear here.
            </motion.p>
          )}
        </AnimatePresence>
      </CardContent>
      <SaveBar dirty={dirty} onReset={() => setDraft(payment)} onSave={save} />
    </Card>
  );
}

/** Reset and Save, live only while the card has unsaved changes. */
function SaveBar({ dirty, onReset, onSave }: { dirty: boolean; onReset: () => void; onSave: () => void }) {
  return (
    <CardFooter className="justify-between">
      <span className="text-xs text-subtle-foreground" aria-live="polite">
        {dirty ? "Unsaved changes" : "Saved"}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReset} disabled={!dirty}>
          <RotateCcw /> Reset
        </Button>
        <Button size="sm" onClick={onSave} disabled={!dirty}>
          <Save /> Save
        </Button>
      </div>
    </CardFooter>
  );
}
