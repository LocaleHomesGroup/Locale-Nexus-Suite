"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Database, FileDown, FolderOpen, RotateCcw, Save } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { DURATION, EASE_SWAP } from "@/lib/motion";
import { confirm } from "@/state/launchpad-store";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { SearchInput } from "@/components/ui/input";
import { NoMatches } from "@/components/ui/states";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { TweenNumber } from "../tween-number";
import { CATALOGUE, SNAPSHOT_LABEL, STEPS, modelsForBlock, stepIndex, type StepId } from "./catalogue";
import { price, type Pricing } from "./pricing";
import {
  clientName,
  colourLabel,
  contactValid,
  goToStep,
  loadQuote,
  nextStep,
  prevStep,
  saveContact,
  saveQuote,
  startOver,
  useEstimate,
  useHomeScope,
  type Estimate,
} from "./store";
import { FigureRow, signed } from "./parts";
import { ClientStep } from "./steps/ClientStep";
import { BuilderStep, ColourStep, ElevationStep, ModelStep, RangeStep } from "./steps/PickSteps";
import { SiteCostStep, SiteVariationsStep } from "./steps/SiteSteps";
import { PricingStep, VariationsStep } from "./steps/PriceSteps";
import { PdfStep, SummaryStep } from "./steps/OutputSteps";

/**
 * Sales › Rapid costing › HomeScope: Locale's AWS estimator (HomeScope) rebuilt
 * in Launchpad, step for step: client, builder, model, spec range, front
 * elevation, site costs, site cost variations, colour, pricing, variations and
 * summary. Launchpad adds a twelfth step, the Locale Homes quote PDF.
 *
 * The shell is the Pay run's wizard (HRIS's Payroll Wizard): a step strip,
 * a progress bar over the body, Back and Continue under it. Continue opens the
 * next step only when this one has what it needs, and says what's missing;
 * any step already reached can be reopened from the strip. The price follows
 * every choice in the card beside the steps.
 *
 * Prices come from a snapshot of HomeScope's Monday boards (catalogue.json).
 * Saving keeps the quote in Launchpad; nothing is written to Monday.
 */

/** Each step's heading and what to do there. */
function intro(id: StepId, p: Pricing): { title: string; body: string } {
  const b = p.builder?.name ?? "the builder";
  switch (id) {
    case "client":
      return { title: "Let's get started with the client's details", body: "Find the client in HubSpot or enter them, pick who's preparing the estimate, then describe the block. Its frontage decides which designs you'll see." };
    case "builder":
      return { title: "Choose the builder", body: "Select from our builder partners. Only builders with a design that suits this block are listed." };
    case "model":
      return { title: "Select the model", body: `Choose from ${b}'s designs for this block, grouped by the frontage they suit.` };
    case "range":
      return { title: "Choose the specification range", body: `Select the specification level for the ${b} ${p.model?.name ?? "design"}. Each is priced for this model.` };
    case "elevation":
      return { title: "Select the front elevation", body: "Choose the architectural style for the home's front elevation." };
    case "siteCosts":
      return { title: "Select the site cost", body: `Choose from ${b}'s fixed site cost options, or enter a provisional sum.` };
    case "siteVariations":
      return { title: "Site costs variations", body: "Title timing, the block's BAL, coastal and noise ratings, and anything else the site needs." };
    case "colour":
      return { title: "Choose the colour scheme", body: `Leave colours to pre-start, or choose one of ${b}'s schemes now.` };
    case "pricing":
      return { title: "Building price", body: "The base price for the selected specifications. Edit it if the builder has quoted a different figure." };
    case "variations":
      return { title: "Variations", body: "Customise the build. An included item is charged, an excluded one is credited, and bolt-ons are this model's packages." };
    case "summary":
      return { title: "Complete estimate summary", body: "Review the final selections and pricing. Saving keeps the quote in Launchpad under its number, ready for the PDF." };
    case "pdf":
      return { title: "Generate the quote PDF", body: "A Locale Homes estimate for the client. Choose what it shows, add a note, then download it." };
  }
}

/** What stops a step's Continue, in words. Null when it's ready. */
function blocker(id: StepId, e: Estimate): string | null {
  switch (id) {
    case "client": {
      if (e.contacts.some((c) => !contactValid(c))) return "Add the client's first name, last name and email";
      if (!e.address.trim()) return "Enter the site address";
      if (!e.lotSize) return "Enter the total lot size";
      if (!e.corner && e.min == null && e.max == null) return "Set a frontage, or tick Corner block";
      if (!e.corner && e.min != null && e.max != null && e.min > e.max) return "The minimum frontage is over the maximum";
      const block = { corner: e.corner, min: e.min, max: e.max };
      if (!CATALOGUE.builders.some((b) => modelsForBlock(b, block).length)) return "No design suits this block";
      return null;
    }
    case "builder":
      return e.builder ? null : "Pick a builder";
    case "model":
      return e.model ? null : "Pick a model";
    case "range":
      return e.range ? null : "Pick a spec range";
    case "elevation":
      return e.elevation ? null : "Pick a front elevation";
    case "colour":
      return e.colourMode === "choose" && !e.colour ? "Pick a scheme, or leave it to pre-start" : null;
    default:
      return null;
  }
}

function StepBody({ id }: { id: StepId }) {
  switch (id) {
    case "client":
      return <ClientStep />;
    case "builder":
      return <BuilderStep />;
    case "model":
      return <ModelStep />;
    case "range":
      return <RangeStep />;
    case "elevation":
      return <ElevationStep />;
    case "siteCosts":
      return <SiteCostStep />;
    case "siteVariations":
      return <SiteVariationsStep />;
    case "colour":
      return <ColourStep />;
    case "pricing":
      return <PricingStep />;
    case "variations":
      return <VariationsStep />;
    case "summary":
      return <SummaryStep />;
    case "pdf":
      return <PdfStep />;
  }
}

export default function HomeScope() {
  const { estimate: e, step, reached, quoteNo, dirty, pricing: p } = useEstimate();
  const reduce = useReducedMotion();
  const [loading, setLoading] = React.useState(false);
  const [restarting, setRestarting] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const current = STEPS[step];
  const text = intro(current.id, p);

  const prev = React.useRef(step);
  const dir = React.useRef(1);
  if (prev.current !== step) {
    dir.current = step > prev.current ? 1 : -1;
    prev.current = step;
  }

  // A new step starts at its top: bring the card back into view if it scrolled away.
  React.useEffect(() => {
    const el = cardRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [step, reduce]);

  const summary = stepIndex("summary");
  const hint = blocker(current.id, e);
  // Saving checks every step before it, in case one was reopened and emptied.
  const unready = current.id === "summary" ? STEPS.slice(0, summary).find((s) => blocker(s.id, e)) : undefined;

  const onContinue = () => {
    if (current.id === "client") for (const c of e.contacts) if (c.editing && contactValid(c)) saveContact(c.id);
    if (current.id === "summary") {
      if (!quoteNo || dirty) {
        const q = saveQuote();
        confirm(dirty ? `${q.no} updated` : `Quote saved as ${q.no}`, `${clientName(q.estimate)} · ${aud(p.final)}`);
      } else goToStep(stepIndex("pdf"));
      return;
    }
    nextStep();
  };

  const continueLabel =
    current.id === "summary" ? (!quoteNo ? "Save quote" : dirty ? "Save changes" : "Continue to PDF") : `Continue to ${STEPS[step + 1]?.short.toLowerCase()}`;
  const begun = reached > 0 || e.address !== "" || e.contacts.some((c) => c.firstName || c.email);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="HomeScope"
        description="Build a client's estimate step by step: the block, builder, design, site costs, colour and variations. The price follows every choice, and the last step prints the Locale Homes quote."
        actions={
          <>
            <Pill tone="neutral" icon={Database} title="Prices are a snapshot of HomeScope's Monday boards">
              Price snapshot · {SNAPSHOT_LABEL}
            </Pill>
            {quoteNo ? (
              <Pill tone={dirty ? "pending" : "tone"} icon={FileDown}>
                {quoteNo}
                {dirty ? " · unsaved changes" : ""}
              </Pill>
            ) : null}
            <Button variant="outline" onClick={() => setLoading(true)}>
              <FolderOpen /> Load existing quote
            </Button>
            {begun ? (
              <Button variant="ghost" onClick={() => (quoteNo && !dirty ? startOver() : setRestarting(true))}>
                <RotateCcw /> Start over
              </Button>
            ) : null}
          </>
        }
      />

      <StepStrip step={step} reached={reached} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div ref={cardRef} className="min-w-0 scroll-mt-4">
        <Card className="flex min-w-0 flex-col overflow-hidden">
          <Progress step={step} final={p.modelPrice > 0 ? p.final : 0} />
          <div className="min-w-0 px-4 py-5 sm:px-6">
            <TabPanels value={current.id} dir={dir.current} variant="slide">
              <header className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-tone-ink uppercase">
                  Step {step + 1} · {current.label}
                </p>
                <h2 className="mt-0.5 font-heading text-lg font-bold tracking-tight">{text.title}</h2>
                <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-pretty text-muted-foreground">{text.body}</p>
              </header>
              <StepBody id={current.id} />
            </TabPanels>
          </div>
          <footer className="mt-auto flex items-center justify-between gap-3 border-t border-hairline bg-canvas/60 px-4 py-3 sm:px-6">
            <Button variant="ghost" disabled={step === 0} onClick={prevStep}>
              <ArrowLeft /> Back
            </Button>
            <div className="flex min-w-0 items-center gap-3">
              {hint || unready ? (
                <span className="hidden truncate text-xs text-subtle-foreground sm:block" role="status">
                  {hint ?? `${unready!.label}: ${blocker(unready!.id, e)}`}
                </span>
              ) : null}
              <span className="hidden shrink-0 font-mono text-xs text-subtle-foreground md:block">
                Step {step + 1} of {STEPS.length}
              </span>
              {current.id !== "pdf" ? (
                <Button variant={current.id === "summary" ? "brand" : "default"} disabled={Boolean(hint || unready)} onClick={onContinue}>
                  {current.id === "summary" && (!quoteNo || dirty) ? <Save /> : null}
                  {continueLabel}
                  {current.id === "summary" && (!quoteNo || dirty) ? null : <ArrowRight />}
                </Button>
              ) : null}
            </div>
          </footer>
        </Card>
        </div>

        <EstimateCard />
      </div>

      <LoadQuoteDialog open={loading} onClose={() => setLoading(false)} />
      <Dialog
        open={restarting}
        onClose={() => setRestarting(false)}
        title="Start a new estimate?"
        icon={RotateCcw}
        iconTone="pending"
        description={
          quoteNo
            ? `Clears the changes made since ${quoteNo} was saved. ${quoteNo} itself stays in Load existing quote.`
            : "Clears the client, the block and every choice on this estimate. It hasn't been saved, so it can't be loaded again."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setRestarting(false)}>
              Keep working
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                startOver();
                setRestarting(false);
              }}
            >
              Clear and start over
            </Button>
          </>
        }
      />
    </div>
  );
}

/**
 * The twelve steps in a strip that scrolls sideways when it must. Reached
 * steps are buttons; the current one wears the gliding highlight, finished
 * ones a tick.
 */
function StepStrip({ step, reached }: { step: number; reached: number }) {
  const reduce = useReducedMotion();
  const listRef = React.useRef<HTMLOListElement>(null);

  React.useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>("[aria-current='step']");
    if (!list || !el || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: el.offsetLeft - list.clientWidth / 2 + el.offsetWidth / 2, behavior: reduce ? "auto" : "smooth" });
  }, [step, reduce]);

  return (
    <nav aria-label="HomeScope steps" className="min-w-0">
      <ol ref={listRef} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
        {STEPS.map((s, i) => {
          const isCurrent = i === step;
          const done = i < reached && !isCurrent;
          const open = i <= reached;
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                disabled={!open}
                onClick={() => goToStep(i)}
                title={open ? `Go to ${s.label}` : `${s.label} opens once the steps before it are done`}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg border py-1.5 pr-3 pl-1.5 text-xs font-medium whitespace-nowrap outline-none",
                  "transition-[background-color,border-color,color,opacity] duration-200 focus-visible:ring-3 focus-visible:ring-ring/45",
                  isCurrent
                    ? "border-transparent text-foreground"
                    : done
                      ? "border-emerald-200 bg-emerald-50/50 text-foreground hover:bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10"
                      : open
                        ? "border-border bg-card text-muted-foreground hover:border-tone-line hover:bg-tone-soft/40"
                        : "cursor-not-allowed border-border bg-card text-subtle-foreground opacity-60",
                )}
              >
                {isCurrent ? (
                  <motion.span
                    layoutId="hs-step"
                    aria-hidden
                    className="absolute inset-0 rounded-lg border border-tone-strong bg-tone-soft shadow-sm"
                    transition={{ duration: reduce ? 0 : DURATION.indicator, ease: EASE_SWAP }}
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cn(
                    "relative flex size-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums transition-colors duration-200",
                    isCurrent ? "bg-tone-fill text-tone-on-fill" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className="relative">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.short}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The bar over each step's body: it fills as the estimate moves on. Below xl it also carries the price. */
function Progress({ step, final }: { step: number; final: number }) {
  const reduce = useReducedMotion();
  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <div className="border-b border-hairline px-4 py-3 sm:px-6">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-tone-strong" aria-hidden />
          <span className="truncate text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Estimate progress
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {final > 0 ? (
            <span className="text-xs font-semibold tabular-nums xl:hidden">
              <TweenNumber value={final} format={aud} />
            </span>
          ) : null}
          <span className="rounded-md bg-tone-tint px-1.5 py-0.5 font-mono text-xs font-semibold text-tone-ink tabular-nums">{pct}%</span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`HomeScope: step ${step + 1} of ${STEPS.length}`}
      >
        <motion.div
          className="h-full w-full origin-left rounded-full bg-tone-strong"
          initial={false}
          animate={{ scaleX: pct / 100 }}
          transition={{ duration: reduce ? 0 : 0.55, ease: EASE_SWAP }}
        />
      </div>
    </div>
  );
}

/** Beside the steps: the final build price as it moves, what it's made of, and the choices so far. */
function EstimateCard() {
  const { estimate: e, pricing: p, reached } = useEstimate();
  const priced = p.modelPrice > 0;
  const choices: { label: string; value: string | null; step: StepId }[] = [
    { label: "Builder", value: p.builder?.name ?? null, step: "builder" },
    { label: "Model", value: p.model?.name ?? null, step: "model" },
    { label: "Spec range", value: p.range?.name ?? null, step: "range" },
    { label: "Elevation", value: e.elevation, step: "elevation" },
    { label: "Site costs", value: p.builder ? p.siteCostLabel : null, step: "siteCosts" },
    { label: "Colour", value: p.builder ? colourLabel(e) : null, step: "colour" },
  ];

  return (
    <aside aria-label="Estimate" className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-4">
      <Card tone="inverse" className="px-5 py-4 shadow-lg shadow-black/15">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-zinc-300 uppercase">Final build price</p>
        {/* Until a model and range are priced the figure would only be a site cost. */}
        <p className="mt-1 font-heading text-[30px] leading-tight font-bold text-haven-300">
          {priced ? <TweenNumber value={p.final} format={aud} countUp /> : <span className="text-zinc-500">$—</span>}
        </p>
        <p className="sr-only" aria-live="polite">
          {priced ? `Final build price ${aud(p.final)}` : "Not priced yet"}
        </p>
        <p className="mt-1 truncate text-xs text-zinc-300">
          {priced
            ? [p.builder?.name, p.model?.name, p.range?.name].join(" · ")
            : p.builder
              ? `${[p.builder.name, p.model?.name].filter(Boolean).join(" · ")}: pick a ${p.model ? "spec range" : "model"} to price it`
              : "Pick a builder and design to price it"}
        </p>
      </Card>
      <Card className="px-4 py-2">
        <FigureRow label="Base build price">
          <TweenNumber value={p.displayedBase} format={aud} />
        </FigureRow>
        <FigureRow label="Site costs">
          <TweenNumber value={p.siteCost} format={(n) => signed(n)} />
        </FigureRow>
        <FigureRow label="Site cost variations">
          <TweenNumber value={p.siteVariations} format={(n) => signed(n)} />
        </FigureRow>
        <FigureRow label="Variations">
          <TweenNumber value={p.charge - p.credit} format={(n) => (n < 0 ? signed(-n, "−") : signed(n))} />
        </FigureRow>
      </Card>
      <Card className="px-4 py-3">
        <p className="mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Choices so far</p>
        <ul className="flex flex-col">
          {choices.map((c) => {
            const i = stepIndex(c.step);
            return (
              <li key={c.label}>
                <button
                  type="button"
                  disabled={i > reached}
                  onClick={() => goToStep(i)}
                  className="flex w-full items-baseline gap-2 rounded-md px-1 py-1 text-left text-xs transition-colors hover:bg-tone-soft/50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="w-20 shrink-0 text-muted-foreground">{c.label}</span>
                  <span className={cn("min-w-0 flex-1 truncate", c.value ? "font-medium text-foreground" : "text-subtle-foreground")}>
                    {c.value ?? "Not chosen yet"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </aside>
  );
}

/** HomeScope's Load Existing Quote: search the quotes saved here and reopen one at its summary. */
function LoadQuoteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { saved, quoteNo, dirty } = useHomeScope();
  const [q, setQ] = React.useState("");
  const rows = React.useMemo(
    () =>
      saved.map((s) => {
        const p = price(s.estimate);
        return {
          no: s.no,
          client: clientName(s.estimate),
          emails: s.estimate.contacts.map((c) => c.email).join(" "),
          home: [p.builder?.name, p.model?.name, p.range?.name].filter(Boolean).join(" · "),
          final: p.final,
          when: new Date(s.savedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
          by: s.by,
        };
      }),
    [saved],
  );
  const term = q.trim().toLowerCase();
  const shown = term ? rows.filter((r) => `${r.no} ${r.client} ${r.emails}`.toLowerCase().includes(term)) : rows;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={FolderOpen}
      title="Load existing quote"
      description={
        dirty || (!quoteNo && saved.length)
          ? "Search by name, email or quote number. Loading replaces the estimate on screen and opens its summary."
          : "Search by name, email or quote number. The quote opens at its summary, with every step open to change."
      }
      footer={
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <SearchInput value={q} onChange={setQ} placeholder="Search by name, email or quote number" count={shown.length} className="max-w-none" autoFocus />
      <ul className="mt-3 flex flex-col gap-1.5">
        {shown.map((r) => (
          <li key={r.no}>
            <button
              type="button"
              onClick={() => {
                loadQuote(r.no);
                onClose();
                setQ("");
                confirm(`Loaded ${r.no}`, `${r.client} · ${aud(r.final)}`);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-tone-line hover:bg-tone-soft/50 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                r.no === quoteNo ? "border-tone-line bg-tone-soft/40" : "border-border",
              )}
            >
              <span className="font-mono text-xs text-muted-foreground">{r.no}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{r.client}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.home}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[13px] font-semibold tabular-nums">{aud(r.final)}</span>
                <span className="block text-xs text-subtle-foreground">
                  {r.when} · {r.by}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!shown.length ? <NoMatches query={q} onClear={() => setQ("")} className="py-8" /> : null}
    </Dialog>
  );
}
