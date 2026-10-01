"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  DoorOpen,
  FileText,
  House,
  KeyRound,
  LoaderCircle,
  Percent,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DURATION, EASE_OUT, rowDelay } from "@/lib/motion";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { SEED_PACKAGES, SUBURBS, packageTitle, type Suburb, type WealthPackage } from "./data";

/**
 * Wealth — the mockup's `vm` (app.js 11711–11874), the Sky Blue sub-brand.
 * Pick a suburb and its market data loads into the tiles; Generate package
 * builds the brochure and puts it at the top of Recent packages.
 */
const STAT_ICON: Record<string, LucideIcon> = {
  "Median house price": House,
  "12-month growth": TrendingUp,
  "Median rent": KeyRound,
  "Gross yield": Percent,
  "Vacancy rate": DoorOpen,
  "Population growth": Users,
};

/** How long the simulated suburb lookup and package build take. */
const LOAD_MS = 450;
const GENERATE_MS = 1100;

export function WealthScreen() {
  const reduce = useReducedMotion();
  const { later } = useLaunchpad();
  const [suburbId, setSuburbId] = React.useState<Suburb["id"]>("baldivis");
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [packages, setPackages] = React.useState<WealthPackage[]>(SEED_PACKAGES);
  const suburb = SUBURBS.find((s) => s.id === suburbId) ?? SUBURBS[0];

  // Only the latest lookup may clear the skeleton when suburbs are switched quickly.
  const lookup = React.useRef(0);
  const onSuburb = (id: Suburb["id"]) => {
    if (id === suburbId) return;
    const ticket = ++lookup.current;
    setSuburbId(id);
    setLoading(true);
    later(() => {
      if (ticket === lookup.current) setLoading(false);
    }, LOAD_MS);
  };

  const onGenerate = () => {
    if (generating || loading) return;
    const title = packageTitle(suburb);
    setGenerating(true);
    later(() => {
      setGenerating(false);
      setPackages((prev) => [{ title, when: "Generated just now" }, ...prev.filter((p) => p.title !== title)]);
      confirm("Package generated", title);
    }, GENERATE_MS);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="text-skyblue-700 dark:text-skyblue-300">Wealth</span>}
        title="Wealth package generator"
        description="Suburb and property data loads automatically; no more hand-typed brochures."
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Reveal index={0} className="min-w-0">
          <Card className="border-skyblue-300 dark:border-skyblue-800/60">
            <CardContent className="pt-5 pb-5">
              <div className="space-y-1.5">
                <Label htmlFor="wealth-suburb">Suburb</Label>
                <SmoothSelect
                  id="wealth-suburb"
                  value={suburbId}
                  onChange={onSuburb}
                  options={SUBURBS.map((s) => ({ value: s.id, label: s.label }))}
                />
              </div>

              <p className="sr-only" aria-live="polite">
                {loading ? `Loading ${suburb.label} data` : `${suburb.label} data loaded`}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2" aria-busy={loading || undefined}>
                {loading
                  ? suburb.stats.map((s) => <Skeleton key={s.label} className="h-[74px] rounded-xl" />)
                  : suburb.stats.map((s) => (
                      <KpiCard
                        key={`${suburb.id}-${s.label}`}
                        size="sm"
                        tone="skyblue"
                        icon={STAT_ICON[s.label]}
                        label={s.label}
                        value={s.value}
                        className="border-skyblue-200 bg-skyblue-50/80 shadow-none dark:border-skyblue-900/60 dark:bg-black"
                      />
                    ))}
              </div>

              <Button
                size="lg"
                onClick={onGenerate}
                disabled={loading || generating}
                aria-busy={generating || undefined}
                className="mt-4 bg-charcoal text-skyblue-300 hover:bg-charcoal/90 dark:bg-skyblue-300 dark:text-skyblue-950 dark:hover:bg-skyblue-200"
              >
                {generating ? (
                  <>
                    <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles aria-hidden /> Generate package
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={1} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Recent packages</CardTitle>
              <CardMeta>{packages.length}</CardMeta>
            </CardHeader>
            <CardContent>
              <ul>
                <AnimatePresence initial={false}>
                  {packages.map((p, i) => (
                    <motion.li
                      key={p.title}
                      layout="position"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.14 } }}
                      transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
                      className="flex items-center gap-2.5 border-t border-hairline py-2 first:border-t-0"
                    >
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-skyblue-100 text-skyblue-800 dark:bg-skyblue-300/15 dark:text-skyblue-200"
                        aria-hidden
                      >
                        <FileText className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">{p.title}</span>
                      <span
                        className={
                          p.when === "Generated just now"
                            ? "text-[11px] font-medium whitespace-nowrap text-skyblue-700 dark:text-skyblue-300"
                            : "text-[11px] whitespace-nowrap text-muted-foreground"
                        }
                      >
                        {p.when}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </PageContainer>
  );
}
