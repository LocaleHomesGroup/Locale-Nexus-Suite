"use client";

import { BadgeCheck, CircleCheck, Clock, MapPin, Mic, Quote } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { RateBar, RingGauge } from "@/components/ui/progress";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { BRIEF, CONCERNS, FACTORS, MATCHES, PRE_SALE, matchScore, type MatchOption } from "./data";
import { useClientJob } from "./parts";

/**
 * Client › My options — "I go to one place and I get multiple options." The
 * consultation was recorded, AI read what the client wants out of it, and
 * every package Locale sells was scored against that brief. The top four are
 * here, with why each scored as it did; the consultant endorsed the highest.
 * The client chose long ago, but the reasons stay, so they can always see why.
 */
export function MyOptions() {
  const { job } = useClientJob();
  const ranked = [...MATCHES].sort((a, b) => matchScore(b) - matchScore(a));
  const top = ranked[0];
  // The client's choice is their job's builder.
  const chosen = MATCHES.find((m) => m.builder === job.builder);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My options"
        description="One place, several builders. Your consultation was matched against every package Locale sells, and these four came out on top."
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Reveal index={0} className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>What you told us</CardTitle>
              <CardMeta>
                <Mic className="size-3" aria-hidden /> {PRE_SALE.consultation?.date}
              </CardMeta>
              <CardDescription>
                From your recorded consultation with {job.rep}, read by AI and checked by {job.rep}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[7rem_minmax(0,1fr)]">
                {BRIEF.map((b) => (
                  <div key={b.label} className="contents">
                    <dt className="text-xs font-medium text-muted-foreground">{b.label}</dt>
                    <dd className="text-[13px]">{b.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 border-t border-hairline pt-3">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  What worried you
                </p>
                <ul className="mt-2 space-y-2.5">
                  {CONCERNS.map((c) => (
                    <li key={c.said} className="flex gap-2.5">
                      <Quote className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-[13px] italic">&ldquo;{c.said}&rdquo;</span>
                        <span className="block text-xs text-muted-foreground">{c.answer}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={1} className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>How we score a match</CardTitle>
              <CardDescription>
                Each option gets a score out of 100 from four things, weighted by what matters most to you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {FACTORS.map((f) => (
                  <li key={f.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium">{f.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {Math.round(f.weight * 100)}% of the score
                      </span>
                    </div>
                    <RateBar
                      value={f.weight / 0.4}
                      tone="neutral"
                      label={`${f.label} is ${Math.round(f.weight * 100)}% of the score`}
                    />
                    <p className="mt-1 text-xs text-subtle-foreground">{f.detail}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-lg bg-muted/70 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                Your consultant sees the same scores and recommends the highest.
                {chosen ? ` You chose ${chosen.design} by ${chosen.builder} on ${job.saleWon}.` : null}
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {ranked.map((m, i) => (
          <Reveal key={m.builder} index={i + 2} className="min-w-0">
            <OptionCard option={m} rank={i + 1} endorsedBy={m === top ? job.rep : undefined} chosen={m === chosen} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function OptionCard({
  option: m,
  rank,
  endorsedBy,
  chosen,
}: {
  option: MatchOption;
  rank: number;
  endorsedBy?: string;
  chosen: boolean;
}) {
  const score = matchScore(m);
  return (
    <Card tone={chosen ? "accent" : "default"} className="h-full">
      <CardHeader className="items-start pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground tabular-nums">Option {rank}</p>
          <CardTitle as="h3" className="mt-0.5">
            {m.design} <span className="font-sans text-[13px] font-medium text-muted-foreground">by {m.builder}</span>
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{m.spec}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {endorsedBy ? (
              <Pill tone="tone" icon={BadgeCheck}>
                Endorsed by {endorsedBy}
              </Pill>
            ) : null}
            {chosen ? (
              <Pill tone="ok" icon={CircleCheck}>
                Your choice
              </Pill>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <RingGauge value={score / 100} size={60} stroke={6}>
            {score}
          </RingGauge>
          <span className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">Match</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-hairline bg-canvas/60 px-3 py-2.5">
          <Figure label="Package" value={aud(m.land + m.build)} strong />
          <Figure label="Land" value={aud(m.land)} />
          <Figure label="Build" value={aud(m.build)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" aria-hidden /> {m.estate}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3" aria-hidden /> {m.weeks} weeks to build
          </span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {FACTORS.map((f) => (
            <li key={f.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-medium tabular-nums">{m.factors[f.key]}</span>
              </div>
              <RateBar value={m.factors[f.key] / 100} label={`${f.label} ${m.factors[f.key]} out of 100`} />
            </li>
          ))}
        </ul>
        <p className={cn("mt-3 text-[13px] leading-relaxed", chosen ? "text-foreground" : "text-muted-foreground")}>
          {m.why}
        </p>
      </CardContent>
    </Card>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{label}</p>
      <p
        className={cn("truncate text-[13px] tabular-nums", strong ? "font-bold" : "font-medium text-muted-foreground")}
      >
        {value}
      </p>
    </div>
  );
}
