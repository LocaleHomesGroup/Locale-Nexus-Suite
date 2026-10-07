"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ListPlus, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { SmoothSelect } from "@/components/ui/select";
import { TweenNumber } from "../../tween-number";
import { boltOnsFor, variationAreas, variationsIn, type HsBoltOn, type HsVariation } from "../catalogue";
import { siteVariationLines } from "../pricing";
import { addLine, lineAmount, patch, removeLine, updateLine, useEstimate, type Line } from "../store";
import { FigureRow, MeasureInput, MoneyInput, Panel, PanelTitle, Segmented, signed } from "../parts";
import { Note } from "./PickSteps";

/* ── Step 9: Pricing ───────────────────────────────────────────────────── */

/** HomeScope's price box: the base (editable), site costs, site cost variations and the final figure. */
export function PriceBox({ editable = false }: { editable?: boolean }) {
  const { estimate: e, pricing: p } = useEstimate();
  const reduce = useReducedMotion();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<number | null>(p.base);
  const computed = p.modelPrice + p.elevationPrice + p.colourPrice;

  return (
    <div className="rounded-xl border border-tone-line bg-tone-soft/60 px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3 py-1.5">
        <p className="flex-1 text-sm font-bold">Base build price</p>
        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <motion.form
              key="edit"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
              className="flex items-center gap-1"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (draft == null) return;
                patch({ baseOverride: draft === computed ? null : draft });
                setEditing(false);
              }}
            >
              <MoneyInput ariaLabel="Base build price" autoFocus value={draft} onChange={setDraft} className="w-36" />
              <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save base price" disabled={draft == null}>
                <Check />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(false)}>
                <X />
              </Button>
            </motion.form>
          ) : (
            <motion.div key="show" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.15 }} className="flex items-center gap-1">
              <span className="text-lg font-bold tabular-nums">
                <TweenNumber value={p.displayedBase} format={aud} />
              </span>
              {editable ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Edit base build price"
                  onClick={() => {
                    setDraft(p.base);
                    setEditing(true);
                  }}
                >
                  <Pencil />
                </Button>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {e.baseOverride != null ? (
        <p className="-mt-1 mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          Edited from {aud(computed)}.
          <Button variant="link" size="xs" className="h-auto" onClick={() => patch({ baseOverride: null })}>
            <RotateCcw /> Reset
          </Button>
        </p>
      ) : p.bundled > 0 ? (
        <p className="-mt-1 mb-1 text-xs text-muted-foreground">Includes the {aud(p.bundled)} delayed-title allowance.</p>
      ) : null}
      <FigureRow label={`Site cost amount (${e.siteCost.kind === "option" ? "fixed" : "provisional sum siteworks"})`}>
        <TweenNumber value={p.siteCost} format={(n) => signed(n)} />
      </FigureRow>
      <FigureRow label="Site cost variations amount">
        <TweenNumber value={p.siteVariations} format={(n) => signed(n)} />
      </FigureRow>
      {p.charge > 0 ? (
        <FigureRow label="Variations charge">
          <TweenNumber value={p.charge} format={(n) => signed(n)} />
        </FigureRow>
      ) : null}
      {p.credit > 0 ? (
        <FigureRow label="Variations credit">
          <TweenNumber value={p.credit} format={(n) => signed(n, "−")} />
        </FigureRow>
      ) : null}
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-tone-line pt-2.5">
        <p className="text-sm font-bold">Final build price</p>
        <p className="text-xl font-bold tabular-nums">
          <TweenNumber value={p.final} format={aud} />
        </p>
      </div>
    </div>
  );
}

/** Step 9: the price so far, and what the base and the site cost variations are made of. */
export function PricingStep() {
  const { estimate: e, pricing: p } = useEstimate();
  const site = siteVariationLines(e, p);
  return (
    <div className="flex flex-col gap-4">
      <PriceBox editable />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <p className="text-lg font-bold tabular-nums">{aud(p.displayedBase)}</p>
          <p className="mb-2 text-xs text-muted-foreground">Base building price includes:</p>
          <ul className="flex flex-col gap-1 text-[13px]">
            <li>• {p.builder?.name} – {p.model?.name}</li>
            <li>• {p.range?.name} specification range</li>
            <li>• {e.elevation} front elevation{p.elevationPrice ? ` (${aud(p.elevationPrice)})` : ""}</li>
            {e.colourMode === "choose" && e.colour ? <li>• {e.colour}{p.colourPrice ? ` (${aud(p.colourPrice)})` : ""}</li> : null}
            {p.bundled ? <li>• Delayed-title allowance {aud(p.bundled)}</li> : null}
          </ul>
        </Panel>
        <Panel>
          <p className="text-lg font-bold tabular-nums">{aud(p.siteVariations)}</p>
          <p className="mb-2 text-xs text-muted-foreground">Site cost variations include:</p>
          {site.length ? (
            <ul className="flex flex-col gap-1 text-[13px]">
              {site.map((l) => (
                <li key={l.label} className="flex justify-between gap-3">
                  <span>{l.label}</span>
                  <span className="tabular-nums">{l.note ? <span className="text-xs text-muted-foreground">in base · </span> : null}{aud(l.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground">None on this estimate.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ── Step 10: Variations ───────────────────────────────────────────────── */

const CUSTOM = "__custom";

interface Draft {
  inclusion: Line["inclusion"];
  pricing: Line["pricing"];
  qty: number | null;
  /** The final amount typed over the rate × qty, if any. */
  amount: number | null;
}

const freshDraft = (): Draft => ({ inclusion: "include", pricing: "fixed", qty: 1, amount: null });

/** Step 10: add catalogue, custom and bolt-on variations; edit quantities in the table. */
export function VariationsStep() {
  const { estimate: e, pricing: p } = useEstimate();
  const b = p.builder;
  if (!b) return null;
  const boltOns = boltOnsFor(b, e.model);

  return (
    <div className="flex flex-col gap-4">
      <AddVariation />
      {boltOns.length ? <AddBoltOn items={boltOns} model={e.model ?? ""} /> : null}
      <SelectedVariations lines={e.lines} charge={p.charge} credit={p.credit} />
    </div>
  );
}

function AddVariation() {
  const { pricing: p } = useEstimate();
  const b = p.builder!;
  const areas = variationAreas(b);
  const [area, setArea] = React.useState<string>("");
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<HsVariation | null>(null);
  const [custom, setCustom] = React.useState({ description: "", amount: null as number | null });
  const [draft, setDraft] = React.useState<Draft>(freshDraft);

  const items = area && area !== CUSTOM ? variationsIn(b, area) : [];
  const term = query.trim().toLowerCase();
  const shown = term ? items.filter((v) => `${v.description} ${v.code}`.toLowerCase().includes(term)) : items;

  const reset = () => {
    setPicked(null);
    setCustom({ description: "", amount: null });
    setDraft(freshDraft());
  };

  const add = () => {
    const qty = draft.qty ?? 1;
    if (area === CUSTOM) {
      if (!custom.description.trim() || !custom.amount) return;
      addLine({
        source: "custom",
        area: "Custom",
        code: "",
        description: custom.description.trim(),
        unit: "",
        qty: 1,
        inclusion: draft.inclusion,
        pricing: draft.pricing,
        unitCharge: custom.amount,
        unitCredit: custom.amount,
      });
    } else if (picked) {
      const unit = draft.amount != null ? draft.amount / qty : null;
      addLine({
        source: "catalogue",
        area: picked.area,
        code: picked.code,
        description: picked.description,
        unit: picked.unit,
        qty,
        inclusion: draft.inclusion,
        pricing: draft.pricing,
        unitCharge: draft.inclusion === "include" && unit != null ? unit : picked.charge,
        unitCredit: draft.inclusion === "exclude" && unit != null ? unit : picked.credit,
      });
    } else return;
    reset();
  };

  const canAdd = area === CUSTOM ? Boolean(custom.description.trim() && custom.amount) : Boolean(picked && (draft.qty ?? 0) > 0);

  return (
    <Panel>
      <PanelTitle icon={ListPlus}>Add variations</PanelTitle>
      <Field label="Select area" htmlFor="hs-area-pick" className="max-w-sm">
        <SmoothSelect
          id="hs-area-pick"
          value={area}
          onChange={(v) => {
            setArea(v);
            setQuery("");
            reset();
          }}
          placeholder="Choose an area"
          options={[
            { value: CUSTOM, label: "Custom", hint: "your own description and amount" },
            ...areas.map((a) => ({ value: a, label: a, hint: String(variationsIn(b, a).length) })),
          ]}
        />
      </Field>

      {area === CUSTOM ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Field label="Description" htmlFor="hs-custom-desc">
            <Input
              id="hs-custom-desc"
              autoFocus
              placeholder="e.g. Upgrade the front door handle set"
              value={custom.description}
              onChange={(ev) => setCustom({ ...custom, description: ev.target.value })}
            />
          </Field>
          <Field label="Amount" htmlFor="hs-custom-amount">
            <MoneyInput id="hs-custom-amount" value={custom.amount} onChange={(amount) => setCustom({ ...custom, amount })} />
          </Field>
        </div>
      ) : area ? (
        <div className="mt-3 flex flex-col gap-2">
          {items.length > 6 ? <SearchInput value={query} onChange={setQuery} placeholder={`Search ${area}`} count={shown.length} /> : null}
          <ItemList
            label={`${area} items`}
            items={shown.map((v) => ({ key: `${v.code}|${v.description}`, description: v.description, code: v.code, unit: v.unit, charge: v.charge, credit: v.credit }))}
            pickedKey={picked ? `${picked.code}|${picked.description}` : null}
            onPick={(key) => {
              const v = items.find((x) => `${x.code}|${x.description}` === key) ?? null;
              setPicked(v);
              setDraft({ ...freshDraft(), inclusion: "include" });
            }}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-subtle-foreground">Pick an area to see {b.name}&apos;s priced items, or Custom for your own line.</p>
      )}

      {area === CUSTOM || picked ? (
        <DraftControls
          draft={draft}
          setDraft={setDraft}
          unit={area === CUSTOM ? "" : picked!.unit}
          rates={area === CUSTOM ? null : { charge: picked!.charge, credit: picked!.credit }}
          customAmount={area === CUSTOM ? (custom.amount ?? 0) : null}
        />
      ) : null}

      <Button className="mt-3 w-full" variant="outline" disabled={!canAdd} onClick={add}>
        <Plus /> Add variation
      </Button>
    </Panel>
  );
}

/** The model's bolt-on pricing (HomeScope's "Bolt-On Options – Brandon Dunes"). */
function AddBoltOn({ items, model }: { items: HsBoltOn[]; model: string }) {
  const [picked, setPicked] = React.useState<HsBoltOn | null>(null);
  const [draft, setDraft] = React.useState<Draft>(freshDraft);

  const add = () => {
    if (!picked) return;
    const unit = draft.amount;
    addLine({
      source: "boltOn",
      area: `Bolt On Pricing - ${model}`,
      code: "",
      description: picked.description,
      unit: "",
      qty: 1,
      inclusion: draft.inclusion,
      pricing: draft.pricing,
      unitCharge: draft.inclusion === "include" && unit != null ? unit : picked.charge,
      unitCredit: draft.inclusion === "exclude" && unit != null ? unit : picked.credit,
    });
    setPicked(null);
    setDraft(freshDraft());
  };

  return (
    <Panel>
      <PanelTitle icon={Sparkles} right={<Pill tone="tone">{items.length} options</Pill>}>
        Bolt-on options <span className="font-normal text-muted-foreground">– {model}</span>
      </PanelTitle>
      <ItemList
        label={`Bolt-on options for the ${model}`}
        items={items.map((v) => ({ key: v.description, description: v.description, code: "", unit: "", charge: v.charge, credit: v.credit }))}
        pickedKey={picked?.description ?? null}
        onPick={(key) => {
          setPicked(items.find((x) => x.description === key) ?? null);
          setDraft(freshDraft());
        }}
      />
      {picked ? <DraftControls draft={draft} setDraft={setDraft} unit="" rates={{ charge: picked.charge, credit: picked.credit }} customAmount={null} fixedQty /> : null}
      <Button className="mt-3 w-full" variant="outline" disabled={!picked} onClick={add}>
        <Plus /> Add bolt-on
      </Button>
    </Panel>
  );
}

/** A scrollable pick list of priced items: long descriptions wrap instead of stretching a dropdown. */
function ItemList({
  label,
  items,
  pickedKey,
  onPick,
}: {
  label: string;
  items: { key: string; description: string; code: string; unit: string; charge: number; credit: number }[];
  pickedKey: string | null;
  onPick: (key: string) => void;
}) {
  const reduce = useReducedMotion();
  if (!items.length) return <p className="py-3 text-center text-xs text-muted-foreground">Nothing matches.</p>;
  return (
    <div role="listbox" aria-label={label} className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card">
      {items.map((v, i) => {
        const on = v.key === pickedKey;
        return (
          <motion.button
            key={v.key}
            type="button"
            role="option"
            aria-selected={on}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : 0.2, delay: rowDelay(i, reduce, 0.015, 0.15) }}
            onClick={() => onPick(v.key)}
            className={cn(
              "flex w-full items-start gap-3 border-b border-hairline px-3 py-2 text-left transition-colors last:border-b-0 focus-visible:bg-tone-soft focus-visible:outline-none",
              on ? "bg-tone-soft" : "hover:bg-tone-soft/50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
                on ? "border-tone-strong bg-tone-fill text-tone-on-fill" : "border-zinc-300 dark:border-zinc-600",
              )}
            >
              {on ? <Check className="size-2.5" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] leading-snug text-pretty">{v.description}</span>
              {v.code || v.unit ? (
                <span className="mt-0.5 block font-mono text-xs text-subtle-foreground">{[v.code, v.unit && `per ${v.unit.toLowerCase()}`].filter(Boolean).join(" · ")}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-right text-xs tabular-nums">
              <span className="block font-semibold text-foreground">{v.charge ? `+${aud(v.charge)}` : "No rate"}</span>
              {v.credit ? <span className="block text-muted-foreground">credit {aud(v.credit)}</span> : null}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Include or exclude, fixed or provisional, quantity, and the final amount (editable, as in HomeScope). */
function DraftControls({
  draft,
  setDraft,
  unit,
  rates,
  customAmount,
  fixedQty = false,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  unit: string;
  rates: { charge: number; credit: number } | null;
  customAmount: number | null;
  fixedQty?: boolean;
}) {
  const reduce = useReducedMotion();
  const qty = draft.qty ?? 0;
  const rate = rates ? (draft.inclusion === "include" ? rates.charge : rates.credit) : (customAmount ?? 0);
  const computed = rates ? lineAmount({ qty, inclusion: draft.inclusion, unitCharge: rates.charge, unitCredit: rates.credit }) : rate;
  const final = draft.amount ?? computed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT }}
      className="mt-3 flex flex-col gap-3 rounded-lg border border-tone-line bg-tone-soft/40 p-3"
    >
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <Field label="Type">
          <Segmented
            label="Type"
            value={draft.inclusion}
            onChange={(inclusion) => setDraft({ ...draft, inclusion, amount: null })}
            options={[
              { value: "include", label: "Include · charge" },
              {
                value: "exclude",
                label: "Exclude · credit",
                disabled: rates != null && rates.credit === 0,
                title: rates != null && rates.credit === 0 ? "This item has no credit rate" : undefined,
              },
            ]}
          />
        </Field>
        <Field label="Pricing">
          <Segmented
            label="Pricing"
            value={draft.pricing}
            onChange={(pricing) => setDraft({ ...draft, pricing })}
            options={[
              { value: "fixed", label: "Fixed" },
              { value: "provisional", label: "Provisional" },
            ]}
          />
        </Field>
        {rates && !fixedQty ? (
          <Field label="Quantity" htmlFor="hs-qty" className="w-28">
            <MeasureInput id="hs-qty" value={draft.qty} onChange={(q) => setDraft({ ...draft, qty: q, amount: null })} unit={unit ? unit.toLowerCase() : "×"} />
          </Field>
        ) : null}
      </div>
      {rates ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground tabular-nums">
          {unit ? <span>Unit: {unit}</span> : null}
          {!fixedQty ? <span>Qty: {qty}</span> : null}
          <span>
            Price/item: {draft.inclusion === "include" ? "+" : "−"}
            {aud(rate)}
          </span>
          <span className="ml-auto flex items-center gap-2">
            Final amount
            <MoneyInput ariaLabel="Final amount" value={final} onChange={(amount) => setDraft({ ...draft, amount })} className="w-32" />
          </span>
        </div>
      ) : null}
    </motion.div>
  );
}

function SelectedVariations({ lines, charge, credit }: { lines: Line[]; charge: number; credit: number }) {
  const reduce = useReducedMotion();
  return (
    <section>
      <PanelTitle
        right={
          lines.length ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              Charges {signed(charge)} · Credits {signed(credit, "−")}
            </span>
          ) : null
        }
      >
        Selected variations
      </PanelTitle>
      {lines.length ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-border bg-canvas text-left text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase dark:bg-white/[0.02]">
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="w-24 px-3 py-2 font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="w-10 px-2 py-2">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {lines.map((l) => (
                  <motion.tr
                    key={l.id}
                    layout="position"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12, transition: { duration: reduce ? 0 : 0.14 } }}
                    transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT }}
                    className="border-b border-hairline last:border-b-0"
                  >
                    <td className="px-3 py-2 align-top">
                      <p className="leading-snug text-pretty">{l.description}</p>
                      <p className="text-xs text-subtle-foreground">{l.source === "boltOn" ? "Bolt-on" : l.area}</p>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="flex flex-wrap items-center gap-1">
                        {l.inclusion === "include" ? "Charge" : "Credit"}
                        {l.source === "boltOn" ? <Pill tone="charcoal">Bolt-On</Pill> : null}
                        {l.pricing === "provisional" ? <Pill tone="pending">Provisional</Pill> : null}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {l.source === "catalogue" ? (
                        <MeasureInput value={l.qty} onChange={(q) => q != null && q > 0 && updateLine(l.id, { qty: q })} unit="" className="w-20" />
                      ) : (
                        <span className="tabular-nums">{l.qty}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-top font-semibold tabular-nums text-foreground">
                      {signed(l.amount, l.inclusion === "include" ? "+" : "−")}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <Button size="icon-xs" variant="ghost" aria-label={`Remove ${l.description}`} onClick={() => removeLine(l.id)}>
                        <Trash2 />
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      ) : (
        <Note>No variations yet. Anything added shows here and in the price.</Note>
      )}
    </section>
  );
}
