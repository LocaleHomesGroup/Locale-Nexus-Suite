"use client";

import { toast } from "sonner";
import { Clock, Download, FileText, PenLine, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { confirm } from "@/state/launchpad-store";
import { usePortal } from "@/state/portal-store";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { CLIENT_DOCS, RETENTION_YEARS, type ClientDoc, type DocGroup } from "./data";
import { useClientJob } from "./parts";

const GROUPS: DocGroup[] = ["Your package", "Finance", "Your build", "At handover"];

/**
 * Client › Documents — every document for the home, from the quote to the
 * keys. A document arrives with the milestone that produces it (read from the
 * job), so the handover pack appears the day the keys do. Under them, the
 * data promise from the meeting: records kept for seven years under Locale's
 * retention policy, and the client's own say on whether Locale may learn from
 * their journey after that.
 */
export function ClientDocuments() {
  const { job } = useClientJob();
  const { learnConsent, setLearnConsent } = usePortal();
  const doneOn = new Map(
    [...job.precon, ...job.milestones].filter((m) => m.status === "done").map((m) => [m.name, m.date]),
  );
  const isReady = (d: ClientDoc) => !d.after || doneOn.has(d.after);
  const ready = CLIENT_DOCS.filter(isReady).length;

  const onConsent = (on: boolean) => {
    setLearnConsent(on);
    confirm(
      on ? "Thanks — Locale can learn from your journey" : "Your journey won't be kept",
      on
        ? `After ${RETENTION_YEARS} years, an anonymised copy stays so Locale can improve the journey for other buyers.`
        : `Your records are deleted after the ${RETENTION_YEARS}-year retention period.`,
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Documents"
        description={`Every document for your home, from your quote to your keys. ${ready} of ${CLIENT_DOCS.length} are here; the rest arrive with the milestone that produces them.`}
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {GROUPS.map((g, gi) => {
          const docs = CLIENT_DOCS.filter((d) => d.group === g);
          return (
            <Reveal key={g} index={gi} className="min-w-0">
              <Card>
                <CardHeader>
                  <CardTitle>{g}</CardTitle>
                  <CardMeta>
                    {docs.filter(isReady).length} of {docs.length}
                  </CardMeta>
                </CardHeader>
                <CardContent>
                  <ul>
                    {docs.map((d) => {
                      const here = isReady(d);
                      const date = d.after ? doneOn.get(d.after) : undefined;
                      return (
                        <li
                          key={d.file}
                          className="flex items-center gap-3 border-t border-hairline py-2.5 first:border-t-0"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-lg",
                              here
                                ? "bg-tone-tint text-tone-ink"
                                : "border border-dashed border-border text-subtle-foreground",
                            )}
                          >
                            <FileText className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-[13px] font-medium", !here && "text-muted-foreground")}>
                              {d.name}
                            </p>
                            {here ? (
                              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                <span className="truncate font-mono">{d.file}</span>
                                {d.signed ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                                    <PenLine className="size-3" aria-hidden /> Signed{date ? ` ${date}` : ""}
                                  </span>
                                ) : date ? (
                                  <span className="tabular-nums">{date}</span>
                                ) : null}
                              </p>
                            ) : (
                              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="size-3" aria-hidden /> Arrives at {d.after}
                              </p>
                            )}
                          </div>
                          {here ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Download ${d.name}`}
                              onClick={() =>
                                toast("Downloads open once the document store is connected", {
                                  description: `${d.file} · this is the static prototype.`,
                                })
                              }
                            >
                              <Download aria-hidden />
                            </Button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>
          );
        })}
      </div>

      <Reveal index={GROUPS.length}>
        <Card>
          <CardHeader>
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-tone-chip-a to-tone-chip-b text-white shadow"
            >
              <ShieldCheck className="size-4" />
            </span>
            <CardTitle>Your data</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <p className="max-w-[70ch] text-[13px] leading-relaxed text-muted-foreground">
              Locale keeps your records — documents, messages and every step of your journey — for {RETENTION_YEARS}{" "}
              years after handover, under its data retention policy. After that they are deleted, unless you say we can
              keep an anonymised copy.
            </p>
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-hairline bg-canvas/60 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">Let Locale learn from my journey</p>
                <p className="mt-0.5 max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
                  After {RETENTION_YEARS} years, keep an anonymised copy so Locale can study what went well and what
                  could be better for the next buyer. No names, addresses or bank details. You can change this at any
                  time.
                </p>
              </div>
              <Switch
                checked={learnConsent}
                onCheckedChange={onConsent}
                label="Let Locale learn from my journey"
                className="mt-0.5"
              />
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
