"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Briefcase,
  Check,
  DollarSign,
  FileText,
  House,
  Lock,
  Map as MapIcon,
  RefreshCw,
  Send,
  ShieldCheck,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useLaunchpad, confirm } from "@/state/launchpad-store";
import { aud, cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { ChoiceGroup, ToggleChip } from "./choice-chips";
import { TweenNumber } from "./tween-number";
import {
  BAL_ALLOWANCE,
  BAL_RATINGS,
  BUYER_TYPES,
  COASTAL_ALLOWANCE,
  COMMISSION_BASE,
  COMMISSION_DISCOUNT_SHARE,
  COSTING_BUILDERS,
  DEFAULT_LAND_PRICE,
  DISCOUNT_APPROVAL_THRESHOLD,
  DOUBLE_STOREY_LOADING,
  FINISHING_TOUCH_PROMO,
  GUIDELINES_FILE,
  HOUSE_BASE_PRICE,
  HOUSE_DESIGNS,
  JARVIS_READ_MS,
  NOISE_ALLOWANCE,
  SLOPE_ALLOWANCE,
  SLOPES,
  STOREYS,
  type BalRating,
  type BuyerType,
  type CostingBuilder,
  type HouseDesign,
  type Slope,
  type Storey,
} from "./data";

/**
 * Sales → Rapid costing (mockup `pm`). Price a job in the room: every rate is
 * read from the builder price list, the package total re-prices live, Jarvis
 * checks the quote against the estate's design guidelines, and a discount over
 * the rep's discretion is held until a sales manager approves it.
 */
export function RapidCosting() {
  const { notify } = useLaunchpad();
  const reduce = useReducedMotion();

  const [builder, setBuilder] = React.useState<CostingBuilder>("Forma");
  const [design, setDesign] = React.useState<HouseDesign>("The Aspen");
  const [storey, setStorey] = React.useState<Storey>("Single");
  const [bal, setBal] = React.useState<BalRating>("BAL-12.5");
  const [coastal, setCoastal] = React.useState(false);
  const [noise, setNoise] = React.useState(false);
  const [slope, setSlope] = React.useState<Slope>("Level");
  const [finishingTouch, setFinishingTouch] = React.useState(true);
  const [land, setLand] = React.useState(DEFAULT_LAND_PRICE);
  const [rebate, setRebate] = React.useState(0);
  const [discount, setDiscount] = React.useState(0);
  const [buyerType, setBuyerType] = React.useState<BuyerType>("Retail");
  const [saved, setSaved] = React.useState(false);
  const [approvalSent, setApprovalSent] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  // Jarvis "reads" the guidelines, then reports. Cancelled if the tab unmounts.
  React.useEffect(() => {
    if (!reading) return;
    const t = setTimeout(() => {
      setReading(false);
      setChecked(true);
    }, JARVIS_READ_MS);
    return () => clearTimeout(t);
  }, [reading]);

  const needsApproval = discount > DISCOUNT_APPROVAL_THRESHOLD;
  const commission = Math.max(0, Math.round(COMMISSION_BASE[buyerType] - discount * COMMISSION_DISCOUNT_SHARE));

  const basePrice = HOUSE_BASE_PRICE[design];
  const doubleLoading = storey === "Double" ? DOUBLE_STOREY_LOADING : 0;
  const balAllowance = BAL_ALLOWANCE[bal];
  const coastalAllowance = coastal ? COASTAL_ALLOWANCE : 0;
  const noiseAllowance = noise ? NOISE_ALLOWANCE : 0;
  const slopeAllowance = SLOPE_ALLOWANCE[slope];
  const finishing = finishingTouch ? FINISHING_TOUCH_PROMO : 0;
  const siteCosts = balAllowance + coastalAllowance + noiseAllowance + slopeAllowance;
  const buildTotal = basePrice + doubleLoading + siteCosts + finishing - rebate;
  const packageTotal = buildTotal + land - discount;

  const breakdown: BreakdownRow[] = [
    { key: "base", label: "Base price", sub: design, value: basePrice },
    ...(doubleLoading > 0 ? [{ key: "double", label: "Double storey loading", value: doubleLoading }] : []),
    ...(balAllowance > 0 ? [{ key: "bal", label: `${bal} allowance`, value: balAllowance }] : []),
    ...(coastalAllowance > 0 ? [{ key: "coastal", label: "Coastal allowance", value: coastalAllowance }] : []),
    ...(noiseAllowance > 0 ? [{ key: "noise", label: "Noise attenuation", value: noiseAllowance }] : []),
    ...(slopeAllowance > 0 ? [{ key: "slope", label: slope, value: slopeAllowance }] : []),
    ...(finishing > 0 ? [{ key: "finishing", label: "Finishing Touch", value: finishing }] : []),
    ...(rebate > 0 ? [{ key: "rebate", label: "Developer rebate", value: rebate, neg: true }] : []),
    { key: "build", label: "Build total", value: buildTotal, strong: true },
    { key: "land", label: "Land", value: land },
    ...(discount > 0 ? [{ key: "discount", label: "Client discount", value: discount, neg: true }] : []),
    { key: "package", label: "Package total", value: packageTotal, strong: true },
  ];

  const requirements = [
    { label: "Minimum home size 180 sqm", ok: true, note: "The Aspen is 192 sqm" },
    {
      label: "Coastal allowance under 1km",
      ok: coastal,
      note: coastal ? "Included in this costing" : "Not in this costing — add it",
    },
    {
      label: "BAL assessment required",
      ok: bal !== "BAL-12.5",
      note: bal !== "BAL-12.5" ? `${bal} allowance included` : "Block is bushfire prone — confirm rating",
    },
    {
      label: "Double storey permitted",
      ok: storey === "Single",
      note: storey === "Single" ? "Single storey, not applicable" : "Check estate rules before quoting",
    },
  ];

  const saveBlocked = needsApproval && !approvalSent;

  const requestApproval = () => {
    setApprovalSent(true);
    notify(`Discount approval requested · ${design} · $${discount.toLocaleString("en-AU")}`, "red");
    confirm("Sent to sales manager", `Discount approval requested · ${design} · ${aud(discount)}`);
  };

  const saveToDeal = () => {
    setSaved(true);
    notify("Costing saved to the deal and attached to submission", "ok");
    confirm("Costing saved to the deal and attached to submission");
  };

  const exportCosting = () => {
    confirm("Costing exported", `${design} · ${builder} · ${aud(packageTotal)}`);
  };

  const fade = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4, transition: { duration: reduce ? 0 : 0.14 } },
    transition: { duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT },
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rapid costing"
        description="Price a job in the room with the client. Rates come from the current builder price list, so a costing can never be built on a stale spreadsheet."
        actions={<Pill tone="neutral">Forma price list v3 · effective 1 August 2026</Pill>}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_0.85fr]">
        {/* ── The inputs ─────────────────────────────────────────────── */}
        <Reveal index={0} className="min-w-0">
          <Card>
            <CardContent className="flex flex-col divide-y divide-hairline pt-1 pb-2">
              <Section icon={House} title="The home">
                <ChoiceGroup label="Builder" value={builder} onChange={setBuilder} options={COSTING_BUILDERS} />
                <ChoiceGroup label="House design" value={design} onChange={setDesign} options={HOUSE_DESIGNS} />
                <ChoiceGroup label="Storey" value={storey} onChange={setStorey} options={STOREYS} />
              </Section>

              <Section icon={MapIcon} title="The block">
                <ChoiceGroup label="BAL rating" value={bal} onChange={setBal} options={BAL_RATINGS} />
                <ChoiceGroup label="Slope" value={slope} onChange={setSlope} options={SLOPES} />
                <div role="group" aria-label="Site conditions and promotions" className="flex flex-wrap gap-1.5">
                  <ToggleChip on={coastal} onClick={() => setCoastal(!coastal)}>
                    Coastal, under 1km
                  </ToggleChip>
                  <ToggleChip on={noise} onClick={() => setNoise(!noise)}>
                    Noise attenuation
                  </ToggleChip>
                  <ToggleChip on={finishingTouch} onClick={() => setFinishingTouch(!finishingTouch)}>
                    Finishing Touch promo
                  </ToggleChip>
                </div>
              </Section>

              <Section
                icon={ShieldCheck}
                title="Compliance check"
                badge={<Pill tone="tone">Jarvis</Pill>}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {checked ? (
                    <motion.div
                      key="result"
                      {...fade}
                      className="rounded-xl border border-border bg-card px-3.5 py-3 shadow-xs"
                    >
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        <span className="font-mono text-xs text-foreground">{GUIDELINES_FILE}</span> · 4 requirements
                        found
                      </p>
                      <ul aria-live="polite">
                        {requirements.map((r) => (
                          <li key={r.label} className="flex items-baseline gap-2 border-t border-hairline py-1.5">
                            {r.ok ? (
                              <Check
                                className="size-3 shrink-0 translate-y-0.5 text-emerald-600 dark:text-emerald-400"
                                aria-label="Met"
                              />
                            ) : (
                              <TriangleAlert
                                className="size-3 shrink-0 translate-y-0.5 text-amber-600 dark:text-amber-400"
                                aria-label="Needs attention"
                              />
                            )}
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-xs transition-colors",
                                  r.ok ? "text-foreground" : "font-medium text-amber-800 dark:text-amber-300",
                                )}
                              >
                                {r.label}
                              </p>
                              <p className="text-xs text-muted-foreground">{r.note}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-xs text-subtle-foreground">
                        Caught before submission, not after contracts. Jarvis flags; a human decides.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="drop"
                      {...fade}
                      type="button"
                      disabled={reading}
                      aria-busy={reading}
                      onClick={() => setReading(true)}
                      className="flex w-full flex-col items-center rounded-xl border-[1.5px] border-dashed border-border bg-canvas px-4 py-4 text-center transition-colors hover:border-tone-line hover:bg-tone-soft/60 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none disabled:cursor-progress"
                    >
                      {reading ? (
                        <RefreshCw className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
                      ) : (
                        <Upload className="size-5 text-muted-foreground" aria-hidden />
                      )}
                      <span className="mt-1.5 text-[13px] font-medium" aria-live="polite">
                        {reading ? "Jarvis is reading the documents…" : "Drop the design guidelines, DAP or LDP"}
                      </span>
                      <span className="mt-0.5 text-xs text-subtle-foreground">
                        {reading
                          ? "Checking this costing against every requirement found"
                          : "Jarvis checks the quote against them before submission"}
                      </span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </Section>

              <Section icon={DollarSign} title="Land and rebates">
                <ChoiceGroup label="Buyer type" value={buyerType} onChange={setBuyerType} options={BUYER_TYPES} />
                <div className="flex flex-col">
                  <MoneyField id="rc-land" label="Land price" value={land} onChange={setLand} />
                  <MoneyField id="rc-rebate" label="Developer rebate" value={rebate} onChange={setRebate} />
                  <MoneyField id="rc-discount" label="Client discount" value={discount} onChange={setDiscount} />
                </div>
              </Section>
            </CardContent>
          </Card>
        </Reveal>

        {/* ── The live price ─────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4">
          <Reveal index={1}>
            <Card tone="inverse" className="px-5 py-4 shadow-lg shadow-black/15">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-zinc-300 uppercase">Package total</p>
              <p className="mt-1 font-heading text-[30px] leading-tight font-bold text-haven-300">
                <TweenNumber value={packageTotal} format={aud} countUp />
              </p>
              <p className="sr-only" aria-live="polite">
                Package total {aud(packageTotal)}
              </p>
              <p className="mt-1 text-xs text-zinc-300 tabular-nums">
                Build {aud(buildTotal)} + land {aud(land)}
              </p>
            </Card>
          </Reveal>

          <Reveal index={2}>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle as="h3" className="text-sm">
                  Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="relative pb-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {breakdown.map((row) => (
                    <motion.div
                      key={row.key}
                      layout="position"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0, x: 0 }}
                      exit={{ opacity: 0, x: -14, transition: { duration: reduce ? 0 : 0.14 } }}
                      transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
                      className={cn(
                        "flex items-baseline gap-2.5 border-t py-1.5",
                        row.strong ? "border-border" : "border-hairline",
                      )}
                    >
                      <span
                        className={cn(
                          row.strong ? "text-[13px] font-semibold text-foreground" : "text-xs text-muted-foreground",
                        )}
                      >
                        {row.label}
                      </span>
                      {row.sub ? <span className="text-xs text-subtle-foreground">{row.sub}</span> : null}
                      <span
                        className={cn(
                          "ml-auto tabular-nums",
                          row.strong ? "text-[13px] font-semibold" : "text-[13px]",
                          row.neg ? "text-emerald-700 dark:text-emerald-300" : "text-foreground",
                        )}
                      >
                        {row.neg ? "− " : ""}
                        <TweenNumber value={Math.abs(row.value)} format={aud} />
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={3}>
            <Card tone="accent" className="px-4 py-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Briefcase className="size-3.5 text-tone-ink" aria-hidden />
                Your commission
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Lock className="size-2.5" aria-hidden /> only you
                </span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">
                <TweenNumber value={commission} format={aud} />
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {buyerType} rate
                {discount > 0 ? ` · reduced by the ${aud(discount)} discount` : ""}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-subtle-foreground">
                Indicative until the rate card is confirmed. Visible to you, your manager and leadership only.
              </p>
            </Card>
          </Reveal>

          <AnimatePresence initial={false}>
            {discount > 0 ? (
              <motion.div key="discount" {...fade}>
                <Card
                  role="status"
                  className={cn(
                    "px-4 py-3.5",
                    needsApproval && "pulse-rose border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10",
                  )}
                >
                  <p
                    className={cn(
                      "flex items-center gap-2 text-xs font-semibold",
                      needsApproval ? "text-rose-700 dark:text-rose-300" : "text-foreground",
                    )}
                  >
                    {needsApproval ? (
                      <TriangleAlert className="size-3.5" aria-hidden />
                    ) : (
                      <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    )}
                    {needsApproval ? "Manager approval required" : "Within your discretion"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground tabular-nums">
                    {needsApproval
                      ? `A ${aud(discount)} discount needs a company contribution, so it cannot be submitted until a sales manager approves it.`
                      : `A ${aud(discount)} discount sits inside the builder's allowance, so no approval is needed.`}
                  </p>
                  {needsApproval ? (
                    <Button className="mt-2.5 w-full" disabled={approvalSent} onClick={requestApproval}>
                      {approvalSent ? (
                        <>
                          <Check /> Sent to sales manager
                        </>
                      ) : (
                        <>
                          <Send /> Send for manager approval
                        </>
                      )}
                    </Button>
                  ) : null}
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="min-w-[180px] flex-1" disabled={saveBlocked} onClick={saveToDeal}>
              {saveBlocked ? (
                <>
                  <Lock /> Approval needed first
                </>
              ) : saved ? (
                <>
                  <Check /> Saved to deal
                </>
              ) : (
                "Save to deal"
              )}
            </Button>
            <Button size="lg" variant="outline" onClick={exportCosting}>
              <FileText /> Export
            </Button>
          </div>
          <p className="text-center text-xs text-subtle-foreground">
            Saving attaches the Rapid Costing Tool document to the deal submission checklist.
          </p>
        </div>
      </div>
    </div>
  );
}

interface BreakdownRow {
  key: string;
  label: string;
  sub?: string;
  value: number;
  strong?: boolean;
  neg?: boolean;
}

/** A titled block inside the inputs card (the mockup's Baskerville sub-heads). */
function Section({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 py-4">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          {title}
        </CardTitle>
        {badge}
      </div>
      {children}
    </section>
  );
}

/** A whole-dollar field: digits only, grouped as you type. */
function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <label htmlFor={id} className="flex-1 text-xs text-muted-foreground">
        {label}
      </label>
      <span className="text-xs text-muted-foreground" aria-hidden>
        $
      </span>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={value.toLocaleString("en-AU")}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
        className="w-[110px] text-right text-[13px] tabular-nums"
      />
    </div>
  );
}
