"use client";

import * as React from "react";
import { Check, MessageSquarePlus } from "lucide-react";
import { aud } from "@/lib/utils";
import { BUILDER_CHECKLISTS, BUILDER_CLAIMS, type DocCategory } from "@/data/jobs";
import { DEVELOPER } from "@/data/portal";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { TERMS } from "./data";

const CATS: DocCategory[] = ["Build", "Land", "Finance"];

/** Locale's invoice states as the builder sees them. */
const INVOICE_VIEW: Record<string, { label: string; tone: PillTone }> = {
  Draft: { label: "Being prepared", tone: "neutral" },
  Approved: { label: "Sent to you", tone: "pending" },
  Paid: { label: "Paid", tone: "ok" },
};

/**
 * Developer › Terms and requirements — "every builder does things a little bit
 * differently, they have different terms, conditions, requirements". Locale
 * holds them in one place so its consultants can sell five builders without
 * learning five rulebooks: the builder's terms, the documents Locale's deal
 * submission needs for this builder (the same checklist Sales and Operations
 * use), Locale's fees and its invoices so far.
 */
export function TermsRequirements() {
  const { invoices, notify } = useLaunchpad();
  const checklist = BUILDER_CHECKLISTS[DEVELOPER] ?? [];
  const fees = Object.entries(BUILDER_CLAIMS[DEVELOPER] ?? {});
  const mine = invoices.filter((i) => i.builder === DEVELOPER);
  const [asking, setAsking] = React.useState(false);
  const [change, setChange] = React.useState("");

  const request = () => {
    const text = change.trim();
    if (!text) return;
    notify(
      `${DEVELOPER} asked to change its terms (Developer portal): “${text.length > 80 ? `${text.slice(0, 77)}…` : text}”`,
    );
    confirm("Change request sent", "Locale Operations updates your terms once it's agreed");
    setChange("");
    setAsking(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Terms and requirements"
        description="Every builder does things a little differently. This is how Locale's consultants see yours, so they can sell your homes without learning your rulebook."
        actions={
          <Button variant="outline" onClick={() => setAsking(true)}>
            <MessageSquarePlus aria-hidden /> Request a change
          </Button>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Reveal index={0} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Your terms</CardTitle>
              <CardDescription>Shown to consultants beside every package of yours.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl>
                {TERMS.map((t) => (
                  <div
                    key={t.label}
                    className="grid gap-1 border-t border-hairline py-2.5 first:border-t-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-3"
                  >
                    <dt className="text-xs font-medium text-muted-foreground">{t.label}</dt>
                    <dd className="text-[13px]">{t.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={1} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>What Locale needs with each sale</CardTitle>
              <CardMeta>{checklist.filter((c) => c.req).length} required</CardMeta>
              <CardDescription>
                Your deal-submission checklist. Locale Operations checks every pack before it reaches you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {CATS.map((cat) => {
                const items = checklist.filter((c) => c.cat === cat);
                if (!items.length) return null;
                return (
                  <div key={cat} className="border-t border-hairline pt-2.5 pb-1 first:border-t-0 first:pt-0">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{cat}</p>
                    <ul className="mt-1">
                      {items.map((c) => (
                        <li key={c.ref} className="flex items-center gap-2.5 py-1.5">
                          <Check className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
                          <span className="min-w-0 flex-1 text-[13px]">{c.name}</span>
                          {c.req ? (
                            <Pill tone="neutral" variant="caps">
                              Required
                            </Pill>
                          ) : (
                            <span className="text-xs text-subtle-foreground">If it applies</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={2} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Locale&rsquo;s fees</CardTitle>
              <CardDescription>
                Locale invoices you when one of your clients reaches each milestone. Amounts excl GST.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul>
                {fees.map(([milestone, amount]) => (
                  <li
                    key={milestone}
                    className="flex items-center justify-between gap-3 border-t border-hairline py-2.5 first:border-t-0"
                  >
                    <span className="text-[13px]">{milestone}</span>
                    <span className="text-[13px] font-semibold tabular-nums">{aud(amount)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={3} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Invoices from Locale</CardTitle>
              <CardMeta>{mine.length}</CardMeta>
            </CardHeader>
            <CardContent>
              <ul>
                {mine.map((i) => {
                  const view = INVOICE_VIEW[i.status] ?? { label: i.status, tone: "neutral" as const };
                  return (
                    <li key={i.id} className="flex items-center gap-3 border-t border-hairline py-2.5 first:border-t-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">
                          <span className="font-mono text-xs text-muted-foreground">{i.id}</span> · {i.client}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          Job {i.job} · {i.stage}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums">{aud(i.amount)}</span>
                      <Pill tone={view.tone} variant="caps">
                        {view.label}
                      </Pill>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        icon={MessageSquarePlus}
        title="Request a change to your terms"
        description="Goes to Locale Operations. Consultants keep seeing your current terms until the change is agreed and updated."
        footer={
          <>
            <Button variant="outline" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button onClick={request} disabled={!change.trim()}>
              Send request
            </Button>
          </>
        }
      >
        <Field label="What should change?" htmlFor="terms-change">
          <Textarea
            id="terms-change"
            rows={4}
            maxLength={500}
            placeholder="Our build time for single storey is now 30 weeks from site start."
            value={change}
            onChange={(e) => setChange(e.target.value)}
          />
        </Field>
      </Dialog>
    </div>
  );
}
