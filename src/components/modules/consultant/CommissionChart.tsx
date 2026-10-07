"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChartColumn, Crown } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { Pill } from "@/components/ui/pill";
import { COMMISSION_PER_SALE } from "../sales/progress/data";
import { commissionRecord, monthLabel, monthlyCommission, type MonthTotal } from "../sales/progress/commission";

/**
 * Haven a step deeper for marks. The dataviz validator passes it on the white
 * card and the black one (lightness band, chroma floor, 3:1); the tone's own
 * haven-500 reads 2.5:1 on white.
 */
export const BAR = "bg-[#14a394]";
/** The month under way: the same bar, hatched, because it isn't finished. */
export const IN_PROGRESS = "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.34) 0 3px, transparent 3px 7px)";

const PLOT_H = 176;
/** Room above the plot for the best month's label. */
const HEAD = 24;
/** A column slot narrower than this has no room for the month under way's label beside the best month's. */
const LABEL_SLOT = 46;
const TIP_W = 156;
const TIP_H = 64;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "$28.8k", "$5k", "$0". */
const kAud = (n: number) => (n < 1000 ? aud(n) : `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`);

/** A zero-based axis on round steps, at most four bands. */
function niceScale(max: number): { top: number; ticks: number[] } {
  const steps = [1_000, 2_000, 5_000, 10_000, 20_000, 25_000, 50_000, 100_000];
  const step = steps.find((s) => Math.ceil(max / s) <= 4) ?? Math.ceil(max / 400_000) * 100_000;
  const top = Math.max(step, Math.ceil(max / step) * step);
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step) };
}

function useMeasuredWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Sales Representative › Overview: the rep's commission by month for the last
 * twelve, with this year's total, their best month and the monthly average
 * above it. Hand-rolled like Leadership's charts (HRIS § 19): real pixels, a
 * zero-based axis, columns that grow on a transform, a per-month readout on
 * hover or the arrow keys, and a table twin for assistive tech.
 */
export function CommissionChart({ dates }: { dates: readonly string[] }) {
  const reduce = useReducedMotion();
  const months = React.useMemo(() => monthlyCommission(dates), [dates]);
  const year = commissionRecord(dates, "year");
  const best = commissionRecord(dates, "month")?.best ?? null;
  const done = months.filter((m) => !m.current);
  const average = done.length ? done.reduce((a, m) => a + m.amount, 0) / done.length : 0;
  const { top, ticks } = niceScale(Math.max(COMMISSION_PER_SALE, average, ...months.map((m) => m.amount)));
  const y = (amount: number) => Math.round((amount / top) * PLOT_H);

  const [active, setActive] = React.useState<number | null>(null);
  const [plotRef, plotWidth] = useMeasuredWidth<HTMLDivElement>();
  const slot = plotWidth / months.length;
  const range = `${monthLabel(months[0].key, "full")} to ${monthLabel(months[months.length - 1].key, "full")}`;

  const describe = (m: MonthTotal) =>
    `${monthLabel(m.key, "full")}: ${aud(m.amount)} from ${plural(m.sales, "sale")}${m.current ? " so far" : ""}${
      m.key === best?.key ? ", your best month" : ""
    }.`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = months.length - 1;
    const at = active ?? last;
    const next =
      e.key === "ArrowLeft"
        ? active === null ? last : Math.max(0, at - 1)
        : e.key === "ArrowRight"
          ? active === null ? last : Math.min(last, at + 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next !== null) {
      e.preventDefault();
      setActive(next);
    } else if (e.key === "Escape" && active !== null) {
      e.preventDefault();
      setActive(null);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <ChartColumn className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          Monthly commission
        </CardTitle>
        <CardMeta>
          <Pill tone="neutral">Placeholder rate</Pill>
        </CardMeta>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
              Earned in {year?.current.key ?? months[months.length - 1].key.slice(0, 4)}
            </dt>
            <dd className="mt-0.5 text-3xl leading-tight font-bold">
              <CountUp value={aud(year?.current.amount ?? 0)} />
            </dd>
            <dd className="text-xs text-subtle-foreground">{plural(year?.current.sales ?? 0, "sale")} so far</dd>
          </div>
          {best ? (
            <div className="min-w-0">
              <dt className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
                <Crown className="size-3 text-amber-500" aria-hidden /> Best month
              </dt>
              <dd className="mt-0.5 text-lg leading-tight font-bold">
                <CountUp value={aud(best.amount)} />
              </dd>
              <dd className="text-xs text-subtle-foreground">{monthLabel(best.key, "full")}</dd>
            </div>
          ) : null}
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
              <span className="h-px w-3 bg-foreground/45" aria-hidden /> Monthly average
            </dt>
            <dd className="mt-0.5 text-lg leading-tight font-bold">
              <CountUp value={aud(Math.round(average))} />
            </dd>
            <dd className="text-xs text-subtle-foreground">over the last {plural(done.length, "full month")}</dd>
          </div>
        </dl>

        <div
          role="group"
          tabIndex={0}
          aria-label={`Commission by month, ${range}. Use the arrow keys to read each month.`}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
        >
          <div className="flex">
            <div className="relative w-10 shrink-0" style={{ height: PLOT_H + HEAD }} aria-hidden>
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute right-2 translate-y-1/2 text-[10px] leading-none text-subtle-foreground tabular-nums"
                  style={{ bottom: y(t) }}
                >
                  {kAud(t)}
                </span>
              ))}
            </div>

            <div
              ref={plotRef}
              className="relative min-w-0 flex-1"
              style={{ height: PLOT_H + HEAD }}
              onPointerLeave={() => setActive(null)}
            >
              {ticks.map((t) => (
                <div
                  key={t}
                  className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-border" : "bg-hairline")}
                  style={{ bottom: y(t) }}
                  aria-hidden
                />
              ))}
              {average > 0 ? (
                <div className="absolute inset-x-0 h-px bg-foreground/45" style={{ bottom: y(average) }} aria-hidden />
              ) : null}

              <div className="absolute inset-0 flex items-end" aria-hidden>
                {months.map((m, i) => {
                  const isBest = m.key === best?.key;
                  const label = m.amount > 0 && (isBest || (m.current && slot >= LABEL_SLOT));
                  return (
                    <div
                      key={m.key}
                      onPointerEnter={() => setActive(i)}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                    >
                      {label ? (
                        <span
                          className={cn(
                            "mb-1 flex items-center gap-0.5 text-[11px] leading-none font-semibold whitespace-nowrap tabular-nums transition-opacity duration-200",
                            active !== null && active !== i && "opacity-40",
                          )}
                        >
                          {isBest ? <Crown className="size-3 text-amber-500" /> : null}
                          {kAud(m.amount)}
                        </span>
                      ) : null}
                      {m.amount > 0 ? (
                        <motion.div
                          className={cn(
                            "w-[62%] max-w-6 origin-bottom rounded-t-[4px] transition-opacity duration-200",
                            BAR,
                            active !== null && active !== i && "opacity-40",
                          )}
                          style={{ height: Math.max(3, y(m.amount)), backgroundImage: m.current ? IN_PROGRESS : undefined }}
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{
                            duration: reduce ? 0 : 0.9,
                            ease: EASE_SWAP,
                            delay: reduce ? 0 : Math.min(i * 0.05, 0.45),
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {active !== null && plotWidth > 0 ? (
                <Readout month={months[active]} index={active} slot={slot} plotWidth={plotWidth} barTop={y(months[active].amount)} best={months[active].key === best?.key} />
              ) : null}
            </div>
          </div>

          <div className="mt-1.5 ml-10 flex" aria-hidden>
            {months.map((m, i) => (
              <span
                key={m.key}
                className={cn(
                  "min-w-0 flex-1 text-center text-[10px] leading-tight text-subtle-foreground transition-colors",
                  active === i && "font-semibold text-foreground",
                )}
              >
                {slot > 0 && slot < 26 ? monthLabel(m.key).charAt(0) : monthLabel(m.key)}
                {i === 0 || m.key.endsWith("-01") ? <span className="block text-[9px]">{m.key.slice(0, 4)}</span> : null}
              </span>
            ))}
          </div>

          <p className="sr-only" aria-live="polite">
            {active !== null ? describe(months[active]) : ""}
          </p>
        </div>

        <table className="sr-only">
          <caption>Commission by month, {range}</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Sales</th>
              <th scope="col">Commission</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key}>
                <th scope="row">
                  {monthLabel(m.key, "full")}
                  {m.current ? " (so far)" : ""}
                </th>
                <td>{m.sales}</td>
                <td>{aud(m.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-xs text-subtle-foreground">
          A flat {aud(COMMISSION_PER_SALE)} a sale until Alison Carter confirms the commission formula. The striped column is
          this month so far.
        </p>
      </CardContent>
    </Card>
  );
}

/** The hovered month: above its column when there's room, beside it when the column is tall. */
function Readout({
  month,
  index,
  slot,
  plotWidth,
  barTop,
  best,
}: {
  month: MonthTotal;
  index: number;
  slot: number;
  plotWidth: number;
  barTop: number;
  best: boolean;
}) {
  const reduce = useReducedMotion();
  const cx = (index + 0.5) * slot;
  const clampX = (x: number) => Math.max(0, Math.min(plotWidth - TIP_W, x));
  const above = barTop + 28 + TIP_H <= PLOT_H + HEAD;
  const left = above
    ? clampX(cx - TIP_W / 2)
    : clampX(cx > plotWidth / 2 ? cx - slot * 0.4 - TIP_W - 6 : cx + slot * 0.4 + 6);
  const bottom = above ? barTop + 28 : Math.max(0, barTop - TIP_H);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.16, ease: EASE_OUT }}
      className="pointer-events-none absolute z-10 rounded-lg border border-border bg-white px-3 py-2 shadow-lg dark:bg-zinc-900"
      style={{ left, bottom, width: TIP_W }}
      aria-hidden
    >
      <p className="text-[11px] text-muted-foreground">
        {monthLabel(month.key, "full")}
        {month.current ? " · so far" : ""}
      </p>
      <p className="text-sm font-bold tabular-nums">{aud(month.amount)}</p>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {plural(month.sales, "sale")}
        {best ? (
          <>
            {" · "}
            <Crown className="size-3 text-amber-500" aria-hidden /> best month
          </>
        ) : null}
      </p>
    </motion.div>
  );
}
