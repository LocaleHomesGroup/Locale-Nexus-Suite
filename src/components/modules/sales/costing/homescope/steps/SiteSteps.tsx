"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarClock, Check, Hammer, Pencil, Plus, ShieldAlert, Trash2, Waves, Volume2, X } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { DatePicker, addDays, fromIso, toIso } from "@/components/ui/date-picker";
import { Field, Input } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { TweenNumber } from "../../tween-number";
import { areaBanded, floorAreas, ratesFor, type HsRate } from "../catalogue";
import { ruleText } from "../pricing";
import { addOther, chooseFloorArea, patch, removeOther, updateOther, useEstimate, type Estimate, type OtherItem } from "../store";
import { MoneyInput, Panel, PanelTitle } from "../parts";
import { Note } from "./PickSteps";

/** Step 6: the builder's fixed site cost options, or a provisional sum. */
export function SiteCostStep() {
  const { estimate: e, pricing: p } = useEstimate();
  const reduce = useReducedMotion();
  const b = p.builder;
  if (!b) return null;
  const provisional = e.siteCost.kind === "provisional";
  const choices = [
    ...b.siteCosts.map((c, i) => ({ key: `o${i}`, title: c.name, sub: c.workType, price: c.price, pick: () => patch({ siteCost: { kind: "option", index: i } }), on: e.siteCost.kind === "option" && e.siteCost.index === i })),
    {
      key: "ps",
      title: "Provisional Sum Siteworks",
      sub: "Enter the amount when the site needs its own estimate",
      price: null as number | null,
      pick: () => patch({ siteCost: { kind: "provisional", amount: e.siteCost.kind === "provisional" ? e.siteCost.amount : 0 } }),
      on: provisional,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Site cost option" className="flex flex-col gap-2">
        {choices.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={c.on}
            onClick={c.pick}
            className={cn(
              "relative isolate flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
              c.on ? "border-transparent" : "border-border bg-card hover:border-tone-line hover:bg-tone-soft/40 dark:bg-white/[0.02]",
            )}
          >
            {c.on ? (
              <motion.span
                layoutId="hs-site-cost"
                aria-hidden
                className="absolute inset-0 -z-10 rounded-xl border-[1.5px] border-tone-strong bg-tone-soft"
                transition={{ duration: reduce ? 0 : DURATION.indicator, ease: EASE_SWAP }}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
                c.on ? "border-tone-strong bg-tone-fill" : "border-zinc-300 dark:border-zinc-600",
              )}
            >
              {c.on ? <span className="size-1.5 rounded-full bg-tone-on-fill" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">{c.title}</span>
              {c.sub ? <span className="block text-xs text-muted-foreground">{c.sub}</span> : null}
            </span>
            {c.price != null ? <span className="text-[13px] font-semibold tabular-nums">{aud(c.price)}</span> : null}
          </button>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {provisional ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
          >
            <Field label="Provisional sum amount" htmlFor="hs-ps" className="max-w-xs pt-1">
              <MoneyInput
                id="hs-ps"
                autoFocus
                value={e.siteCost.kind === "provisional" ? e.siteCost.amount : 0}
                onChange={(amount) => patch({ siteCost: { kind: "provisional", amount: amount ?? 0 } })}
              />
            </Field>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="flex items-baseline justify-between gap-3 rounded-xl border border-tone-line bg-tone-soft/60 px-4 py-3">
        <p className="text-[13px] font-semibold">Site cost option: {p.siteCostLabel}</p>
        <p className="text-sm font-bold tabular-nums">
          Amount <TweenNumber value={p.siteCost} format={aud} />
        </p>
      </div>
    </div>
  );
}

/**
 * Step 7: delayed-title allowance, BAL, coastal and noise ratings, and any
 * other site item. Builders that price the ratings by floor area (LaVida,
 * New Choice) ask for the area first.
 */
export function SiteVariationsStep() {
  const { estimate: e, pricing: p } = useEstimate();
  const b = p.builder;
  if (!b) return null;
  const banded = areaBanded(b);
  const areas = floorAreas(b);
  const needsArea = banded && e.floorArea == null;

  return (
    <div className="flex flex-col gap-4">
      {banded ? (
        <Panel>
          <PanelTitle icon={Hammer}>Total floor area</PanelTitle>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Total floor area (m²)" htmlFor="hs-area" className="w-48">
              <SmoothSelect
                id="hs-area"
                value={e.floorArea == null ? "" : String(e.floorArea)}
                onChange={(v) => chooseFloorArea(Number(v), b)}
                placeholder="Select floor area"
                options={areas.map((a) => ({ value: String(a), label: `${a} m²` }))}
              />
            </Field>
            <p className="pb-2 text-xs text-muted-foreground">
              {b.name} prices BAL, coastal and noise by floor area.
              {p.model?.totalArea ? ` The ${p.model.name} is ${p.model.totalArea} m² in total.` : ""}
            </p>
          </div>
        </Panel>
      ) : null}

      <TitleAllowance />

      <div className="grid gap-3 md:grid-cols-3">
        <RatePicker label="BAL rating" icon={ShieldAlert} list="bal" rates={ratesFor(b.bal, e.floorArea)} value={e.bal} amount={p.bal} disabled={needsArea} />
        <RatePicker label="Coastal distance" icon={Waves} list="coastal" rates={ratesFor(b.coastal, e.floorArea)} value={e.coastal} amount={p.coastal} disabled={needsArea} />
        <RatePicker label="Noise package" icon={Volume2} list="noise" rates={ratesFor(b.noise, e.floorArea)} value={e.noise} amount={p.noise} disabled={needsArea} />
      </div>

      <OtherItems items={e.others} />

      <div className="flex items-baseline justify-between gap-3 rounded-xl border border-tone-line bg-tone-soft/60 px-4 py-3">
        <p className="text-[13px] font-semibold">Final site cost variations</p>
        <p className="text-sm font-bold tabular-nums">
          Total amount <TweenNumber value={p.siteVariations} format={aud} />
        </p>
      </div>
    </div>
  );
}

/** HomeScope's Title Allowances block: today and the title ETA give the months; past the hold, the builder's rule prices them. */
function TitleAllowance() {
  const { estimate: e, pricing: p } = useEstimate();
  const reduce = useReducedMotion();
  const b = p.builder!;
  const a = p.allowance;
  const rule = b.allowances[0];
  const tomorrow = toIso(addDays(fromIso(e.title.today) ?? new Date(), 1));
  const setTitle = (t: Partial<typeof e.title>) => patch({ title: { ...e.title, ...t } });

  return (
    <Panel>
      <PanelTitle
        icon={CalendarClock}
        right={
          e.title.eta ? (
            <Button size="xs" variant="ghost" onClick={() => setTitle({ eta: null })}>
              <X /> Remove
            </Button>
          ) : null
        }
      >
        Title allowances
      </PanelTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date" htmlFor="hs-today">
          <DatePicker id="hs-today" value={e.title.today} onChange={(today) => setTitle({ today })} />
        </Field>
        <Field label="Title ETA date" htmlFor="hs-eta" hint={rule ? `${b.name}: ${rule.due}, ${ruleText(rule, b.allowanceOnPrelim, aud)}` : undefined}>
          <DatePicker id="hs-eta" value={e.title.eta ?? ""} min={tomorrow} placeholder="When titles are expected" onChange={(eta) => setTitle({ eta })} />
        </Field>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Months to title", a.months],
          ["Price hold period", a.hold],
          ["Title delayed period", a.delay],
        ].map(([label, v]) => (
          <div key={label} className="rounded-lg border border-border bg-card px-3 py-2">
            <dt className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">
              {v} <span className="text-xs font-normal text-subtle-foreground">months</span>
            </dd>
          </div>
        ))}
      </dl>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={a.amount > 0 ? "priced" : e.title.eta ? "held" : "none"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
          className="mt-3"
        >
          {a.amount > 0 && a.rule ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-tone-line bg-tone-soft/60 px-3 py-2">
              <p className="text-xs">
                <span className="font-semibold">{a.rule.due}</span>
                <span className="text-muted-foreground"> · {ruleText(a.rule, b.allowanceOnPrelim, aud)}</span>
              </p>
              <p className="text-[13px] font-semibold tabular-nums">
                {b.bundleAllowance ? (
                  <>
                    <TweenNumber value={a.amount} format={aud} />{" "}
                    <span className="text-xs font-normal text-muted-foreground">included in base build price</span>
                  </>
                ) : (
                  <>
                    Amount <TweenNumber value={a.amount} format={aud} />
                  </>
                )}
              </p>
            </div>
          ) : e.title.eta ? (
            <Note>Titles land inside the {a.hold}-month price hold, so there is no delayed-title allowance.</Note>
          ) : (
            <Note>Add the title ETA if titles aren&apos;t registered yet. Anything past the price hold is priced here.</Note>
          )}
        </motion.div>
      </AnimatePresence>
    </Panel>
  );
}

function RatePicker({
  label,
  icon: Icon,
  list,
  rates,
  value,
  amount,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  list: "bal" | "coastal" | "noise";
  rates: HsRate[];
  value: string | null;
  amount: number;
  disabled: boolean;
}) {
  const id = `hs-${list}`;
  return (
    <Panel className="flex flex-col gap-2 p-3.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5 text-tone-ink" aria-hidden />
        {label}
      </label>
      {disabled ? (
        <p className="text-xs text-subtle-foreground">Pick the floor area first.</p>
      ) : (
        <SmoothSelect
          id={id}
          value={value ?? ""}
          onChange={(v) => patch({ [list]: v || null } as Partial<Estimate>)}
          placeholder={`Select ${label.toLowerCase()}`}
          options={[
            ...(value ? [{ value: "", label: <span className="text-muted-foreground">None</span> }] : []),
            ...rates.map((r) => ({ value: r.name, label: r.name, hint: aud(r.price) })),
          ]}
        />
      )}
      <p className="mt-auto text-right text-[13px] font-semibold tabular-nums">
        {value ? <TweenNumber value={amount} format={aud} /> : <span className="font-normal text-subtle-foreground">Not set</span>}
      </p>
    </Panel>
  );
}

/** HomeScope's "+ New Variation" on the site step: a titled amount, editable and removable. */
function OtherItems({ items }: { items: OtherItem[] }) {
  const reduce = useReducedMotion();
  const [draft, setDraft] = React.useState<{ title: string; price: number | null } | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);

  return (
    <Panel>
      <PanelTitle icon={Plus}>Other site items</PanelTitle>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {items.map((o) => (
            <motion.li
              key={o.id}
              layout="position"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -12, transition: { duration: reduce ? 0 : 0.14 } }}
              transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT }}
              className="flex items-center gap-2 border-b border-hairline py-2 last:border-b-0"
            >
              {editing === o.id ? (
                <>
                  <Input aria-label="Title" value={o.title} onChange={(ev) => updateOther(o.id, { title: ev.target.value })} className="flex-1" />
                  <MoneyInput ariaLabel="Price" value={o.price} onChange={(v) => updateOther(o.id, { price: v ?? 0 })} className="w-32" />
                  <Button size="icon-xs" variant="ghost" aria-label="Done" disabled={o.price <= 0} onClick={() => setEditing(null)}>
                    <Check />
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{o.title}</span>
                  <span className="text-[13px] font-semibold tabular-nums">{aud(o.price)}</span>
                  <Button size="icon-xs" variant="ghost" aria-label={`Edit ${o.title}`} onClick={() => setEditing(o.id)}>
                    <Pencil />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label={`Remove ${o.title}`} onClick={() => removeOther(o.id)}>
                    <Trash2 />
                  </Button>
                </>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <AnimatePresence initial={false} mode="wait">
        {draft ? (
          <motion.form
            key="draft"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!draft.price) return;
              addOther(draft.title, draft.price);
              setDraft(null);
            }}
            className={cn("flex flex-wrap items-end gap-2", items.length && "mt-2")}
          >
            <Field label="Title" htmlFor="hs-other-title" className="min-w-40 flex-1">
              <Input id="hs-other-title" autoFocus placeholder="e.g. Retaining wall" value={draft.title} onChange={(ev) => setDraft({ ...draft, title: ev.target.value })} />
            </Field>
            <Field label="Price" htmlFor="hs-other-price" className="w-36">
              <MoneyInput id="hs-other-price" value={draft.price} onChange={(price) => setDraft({ ...draft, price })} />
            </Field>
            <Button type="submit" size="sm" disabled={!draft.price}>
              <Check /> Add
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </motion.form>
        ) : (
          <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.15 }}>
            <Button variant="outline" size="sm" className={cn(items.length && "mt-2")} onClick={() => setDraft({ title: "", price: null })}>
              <Plus /> New variation
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
