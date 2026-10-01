"use client";

import * as React from "react";
import { Building2, Camera, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { RateBar } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { ALL_PLANS, BUILD_HOMES, type BuildHome } from "../data";
import { useSalesState } from "../sales-state";
import { Footnote } from "../parts";

const PLANS = [ALL_PLANS, ...Array.from(new Set(BUILD_HOMES.map((h) => h.plan)))];

/**
 * Sales › Under construction — every home being built, filterable by floor
 * plan so a rep can show a client one like theirs. The plan filter lives in
 * the Sales state (the mockup kept it on the Sales component).
 */
export function UnderConstruction() {
  const { plan, setPlan } = useSalesState();
  const [photosOf, setPhotosOf] = React.useState<BuildHome | null>(null);
  const [photosOpen, setPhotosOpen] = React.useState(false);
  const shown = plan === ALL_PLANS ? BUILD_HOMES : BUILD_HOMES.filter((h) => h.plan === plan);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Building2 className="size-5 text-tone-ink" aria-hidden />
            Under construction
            <Pill tone="neutral" className="font-sans tracking-normal tabular-nums">
              {BUILD_HOMES.length} homes
            </Pill>
          </span>
        }
        description="Every home being built, with its floor plan and progress. Filter by plan to show a client a home like the one they are buying, and see what is close to handover."
      />

      <div className="flex flex-col gap-3">
        <SlidingTabs
          ariaLabel="Filter by floor plan"
          value={plan}
          onChange={setPlan}
          items={PLANS.map((p) => ({
            value: p,
            label: p,
            count: p === ALL_PLANS ? undefined : BUILD_HOMES.filter((h) => h.plan === p).length,
          }))}
          className="self-start"
        />

        <ul className="flex flex-col gap-2.5">
          {shown.map((h, i) => {
            const near = h.pct >= 90;
            return (
              <Reveal as="li" key={`${plan}:${h.jobNo}`} index={i}>
                <Card
                  className={cn(
                    "px-4 py-3.5",
                    near ? "border-tone-line" : undefined,
                  )}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="font-mono text-xs font-semibold tabular-nums">{h.jobNo}</span>
                    <span className="text-[13px]">{h.addr}</span>
                    {near ? <Pill tone="tone">Nearing handover</Pill> : null}
                    <span className="ml-auto text-xs text-muted-foreground">{h.builder}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Home className="size-3" aria-hidden />
                      <strong className="font-medium text-foreground">{h.plan}</strong> · {h.storey}
                    </span>
                    <span>
                      Now: <strong className="font-medium text-foreground">{h.stage}</strong>
                    </span>
                    <span>
                      Next: {h.next} · {h.eta}
                    </span>
                  </div>
                  <RateBar
                    value={h.pct / 100}
                    tone={near ? "tone" : "neutral"}
                    delay={Math.min(i * 0.06, 0.3)}
                    label={`${h.pct}% built`}
                    className="mt-2.5"
                  />
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <div className="flex gap-1.5" aria-hidden>
                      {Array.from({ length: Math.min(h.photos, 4) }).map((_, p) => (
                        <span
                          key={p}
                          className="flex h-[34px] w-[46px] items-center justify-center rounded-md border border-hairline bg-muted"
                        >
                          <Home className="size-3.5 text-subtle-foreground" />
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-subtle-foreground">
                      {h.photos} site photos · from the {h.builder} portal, {h.shot}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto text-tone-ink"
                      onClick={() => {
                        setPhotosOf(h);
                        setPhotosOpen(true);
                      }}
                    >
                      View photos
                    </Button>
                  </div>
                </Card>
              </Reveal>
            );
          })}
        </ul>

        <Footnote>
          Photos are pulled from the builder portal when the polling agent runs, so a rep can see progress without
          driving out.
        </Footnote>
      </div>

      <Dialog
        open={photosOpen}
        onClose={() => setPhotosOpen(false)}
        icon={Camera}
        size="lg"
        title={photosOf ? `${photosOf.jobNo} · ${photosOf.addr}` : ""}
        description={
          photosOf ? `${photosOf.photos} site photos · from the ${photosOf.builder} portal, ${photosOf.shot}` : undefined
        }
        footer={
          <Button variant="outline" onClick={() => setPhotosOpen(false)}>
            Close
          </Button>
        }
      >
        {photosOf ? (
          <div className="flex flex-col gap-3">
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: photosOf.photos }).map((_, p) => (
                <li
                  key={p}
                  className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-lg border border-hairline bg-muted text-subtle-foreground"
                >
                  <Home className="size-5" aria-hidden />
                  <span className="text-xs tabular-nums">
                    Photo {p + 1} of {photosOf.photos}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Now: <strong className="font-medium text-foreground">{photosOf.stage}</strong> · Next: {photosOf.next} ·{" "}
              {photosOf.eta}
            </p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
