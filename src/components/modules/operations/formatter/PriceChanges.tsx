"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Circle, Equal, Mail, Send, TrendingDown, TrendingUp, Upload } from "lucide-react";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Dialog } from "@/components/ui/dialog";
import { Reveal } from "@/components/ui/reveal";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRICE_CHANGES, PUBLISH_TARGETS, REPORT_ROUTING, REVIEW_THRESHOLD } from "./data";

const money = (n: number) => `$${n.toLocaleString("en-AU")}`;

/**
 * Doc formatter → Price changes (mockup `sm`): the new list against the last
 * published one, the change report to Sean, and Publish to Pricing.
 */
export function PriceChanges({
  reportSent,
  setReportSent,
  published,
  setPublished,
}: {
  reportSent: boolean;
  setReportSent: (v: boolean) => void;
  published: boolean;
  setPublished: (v: boolean) => void;
}) {
  const { notify } = useLaunchpad();
  const reduce = useReducedMotion();
  const [preview, setPreview] = React.useState(false);

  const changed = PRICE_CHANGES.filter((r) => r.now !== r.prev);
  const up = changed.filter((r) => r.now > r.prev).length;
  const down = changed.filter((r) => r.now < r.prev).length;
  const flagged = changed.filter((r) => Math.abs((r.now - r.prev) / r.prev) >= REVIEW_THRESHOLD);

  const sendReport = () => {
    setPreview(false);
    setReportSent(true);
    const msg = "Price change report sent to Sean";
    notify(msg, "ok");
    confirm(msg);
  };

  const publish = () => {
    setPublished(true);
    const msg = "Forma August 2026 published · Monday and PDF updated";
    notify(msg, "ok");
    confirm(msg);
  };

  return (
    <div className="flex flex-col gap-5">
      <Reveal index={0}>
        <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
          <TrendingUp className="size-4 shrink-0 text-tone-ink" aria-hidden />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">Forma · August 2026 against July 2026</p>
            <p className="text-xs text-muted-foreground">Compared automatically against the last published list</p>
          </div>
          <span className="ml-auto flex flex-wrap gap-2">
            <Pill tone="neutral" className="tabular-nums">
              {changed.length} changed
            </Pill>
            {flagged.length > 0 ? (
              <Pill tone="problem" className="tabular-nums">
                {flagged.length} over 4%
              </Pill>
            ) : null}
          </span>
        </Card>
      </Reveal>

      <Reveal index={1}>
        <KpiGrid cols={4}>
          <KpiCard label="Models changed" value={changed.length} icon={TrendingUp} />
          <KpiCard label="Increases" value={up} icon={TrendingUp} />
          <KpiCard label="Decreases" value={down} icon={TrendingDown} />
          <KpiCard label="Unchanged" value={PRICE_CHANGES.length - changed.length} icon={Equal} tone="charcoal" />
        </KpiGrid>
      </Reveal>

      <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Reveal index={2} className="min-w-0">
          <Card className="overflow-hidden">
            <Table className="min-w-[500px] text-[13px]">
                <caption className="sr-only">Forma price list, August 2026 against July 2026</caption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                    <TableHead className="pl-4">Model or allowance</TableHead>
                    <TableHead className="text-right">July</TableHead>
                    <TableHead className="text-right">August</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="pr-4 text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PRICE_CHANGES.map((r, i) => {
                    const diff = r.now - r.prev;
                    const pct = (diff / r.prev) * 100;
                    const review = Math.abs(pct) >= REVIEW_THRESHOLD * 100;
                    const tone =
                      diff > 0
                        ? "text-rose-700 dark:text-rose-300"
                        : diff < 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-subtle-foreground";
                    return (
                      <motion.tr
                        key={r.m}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.24, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.05, 0.35) } }}
                        className={cn(
                          "border-b border-hairline transition-colors",
                          review
                            ? "bg-rose-50 hover:bg-rose-100/70 dark:bg-rose-500/10 dark:hover:bg-rose-500/15"
                            : "hover:bg-tone-soft/60",
                        )}
                      >
                        <td className={cn("px-3 py-2 pl-4", diff !== 0 ? "font-medium" : "text-muted-foreground")}>
                          {r.m}
                          {review ? <span className="text-xs font-semibold text-rose-700 dark:text-rose-300"> · review</span> : null}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{money(r.prev)}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", diff !== 0 && "font-semibold")}>{money(r.now)}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", tone)}>
                          {diff === 0 ? "—" : `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}`}
                        </td>
                        <td className={cn("px-3 py-2 pr-4 text-right tabular-nums", tone)}>
                          {diff === 0 ? "—" : `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`}
                        </td>
                      </motion.tr>
                    );
                  })}
                </TableBody>
            </Table>
          </Card>
        </Reveal>

        <div className="flex min-w-0 flex-col gap-4">
          <Reveal index={3}>
            <Card className="border-tone-line">
              <CardHeader>
                <Send className="size-3.5 shrink-0 text-tone-ink" aria-hidden />
                <CardTitle className="text-sm">Price change report</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2.5 text-xs leading-relaxed text-muted-foreground">
                  Goes to Sean each time a list is published, so pricing changes are never found out after a quote has
                  gone out.
                </p>
                <dl>
                  {REPORT_ROUTING.map(([k, v]) => (
                    <div key={k} className="flex gap-2 py-0.5 text-xs">
                      <dt className="w-14 shrink-0 text-muted-foreground">{k}</dt>
                      <dd className={cn("min-w-0 break-words", k === "Attached" && "font-mono text-xs")}>{v}</dd>
                    </div>
                  ))}
                </dl>
                {reportSent ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <Check className="size-3.5" aria-hidden /> Sent to Sean just now
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setPreview(true)}>
                      <Mail className="size-3.5" aria-hidden /> Preview email
                    </Button>
                    <Button className="flex-1" onClick={sendReport}>
                      <Send className="size-3.5" aria-hidden /> Send report
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={4}>
            <Card tone={published ? "accent" : "default"} className="transition-colors">
              <CardHeader>
                <CardTitle className="text-sm">Publish this list</CardTitle>
              </CardHeader>
              <CardContent>
                <ul>
                  {PUBLISH_TARGETS.map(([k, v]) => (
                    <li key={k} className="flex items-baseline gap-2 border-t border-hairline py-1.5 text-xs">
                      {published ? (
                        <Check className="size-3 shrink-0 translate-y-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : (
                        <Circle className="size-3 shrink-0 translate-y-0.5 text-subtle-foreground" aria-hidden />
                      )}
                      <span>{k}</span>
                      <span className="ml-auto text-right text-muted-foreground">{v}</span>
                    </li>
                  ))}
                </ul>
                {published ? (
                  <p className="mt-2.5 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Published · now live in the Pricing tab
                  </p>
                ) : (
                  <Button size="lg" className="mt-3 w-full" onClick={publish}>
                    <Upload className="size-3.5" aria-hidden /> Publish to Pricing
                  </Button>
                )}
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>

      <Dialog
        open={preview}
        onClose={() => setPreview(false)}
        size="md"
        icon={Mail}
        title="Price change report · Forma August 2026"
        footer={
          <>
            <Button variant="outline" onClick={() => setPreview(false)}>
              Close
            </Button>
            <Button onClick={sendReport}>
              <Send className="size-3.5" aria-hidden /> Send to Sean
            </Button>
          </>
        }
      >
        <div className="rounded-lg bg-muted px-4 py-3.5 text-xs leading-[1.65] text-foreground">
          <p>Hi Sean,</p>
          <p className="mt-3">
            The Forma price list for August 2026 has been published. {changed.length} rates changed, {up} up and {down}{" "}
            down.
            {flagged.length > 0
              ? ` ${flagged.length} moved by more than 4 per cent and are worth a look: ${flagged.map((r) => r.m).join(", ")}.`
              : null}
          </p>
          <p className="mt-3">The formatted list is attached and the full comparison is in Launchpad under Pricing.</p>
          <p className="mt-3">
            Cheers,
            <br />
            Operations
          </p>
        </div>
      </Dialog>
    </div>
  );
}
