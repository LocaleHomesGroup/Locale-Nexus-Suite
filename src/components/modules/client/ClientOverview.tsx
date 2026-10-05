"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  FileText,
  Gauge,
  HardHat,
  Home,
  KeyRound,
  Landmark,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { aud } from "@/lib/utils";
import { JOURNEY, journeyFor, nextStep } from "@/data/journey";
import { usePortal } from "@/state/portal-store";
import { hrefForKey } from "@/components/shell/dashboards";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { DashboardOverview } from "../overview/DashboardOverview";
import {
  BORROWING_CAPACITY,
  BUILD_CONTRACT,
  CLIENT_DOCS,
  MATCHES,
  PACKAGE_SPLIT,
  PACKAGE_TOTAL,
  PRE_APPROVAL,
  PROGRESS_PAYMENTS,
  matchScore,
} from "./data";
import { JourneyTimeline, PhotoStrip, TeamCard, When, lotLine, useClientJob } from "./parts";

/** Every milestone the client's home passes, site start to maintenance. */
const BUILD_STEPS = 8;

/**
 * Client › Overview — the client's whole journey at a glance: where they are,
 * what they can borrow and what their home costs, then the journey itself,
 * enquiry to keys, beside the people on their build and the builder's latest.
 */
export function ClientOverview() {
  const { job, lot } = useClientJob();
  const { updates, messages, unread } = usePortal();
  const stages = journeyFor(job);
  const at = stages.findIndex((s) => s.state === "current");
  const current = at >= 0 ? stages[at] : null;
  const next = nextStep(job);
  const built = job.milestones.filter((m) => m.status === "done");
  const lastBuilt = built[built.length - 1];
  const doneNames = new Set([...job.precon, ...job.milestones].filter((m) => m.status === "done").map((m) => m.name));
  const paid = PROGRESS_PAYMENTS.filter((p) => doneNames.has(p.milestone));
  const paidTotal = paid.reduce((sum, p) => sum + (BUILD_CONTRACT * p.pct) / 100, 0);
  const chosen = MATCHES.find((m) => m.builder === job.builder) ?? MATCHES[0];
  const ranked = [...MATCHES].sort((a, b) => matchScore(b) - matchScore(a));
  const ready = CLIENT_DOCS.filter((d) => !d.after || doneNames.has(d.after));
  const thread = messages.filter((m) => m.jobId === job.id);
  const unreadHere = thread.filter((m) => unread.has(m.id));
  const latest = updates.find((u) => u.jobId === job.id);

  return (
    <DashboardOverview
      title="Your home journey"
      description={
        <>
          {lot.design} by {job.builder} at {lotLine(lot)}. Everything from your first enquiry to your keys, in one
          place.
        </>
      }
      headline={[
        {
          label: "Where you are",
          value: current ? current.short : "Home",
          sub: current ? `Stage ${at + 1} of ${JOURNEY.length} · with ${current.who}` : "Journey complete",
          icon: Home,
          to: "client:build",
        },
        {
          label: "Build progress",
          value: `${Math.round((built.length / BUILD_STEPS) * 100)}%`,
          sub: lastBuilt ? `${lastBuilt.name}, ${lastBuilt.date}` : "Site start is next",
          icon: HardHat,
          to: "client:build",
        },
        {
          label: "You can borrow",
          value: aud(BORROWING_CAPACITY),
          sub: `Locale Financial · pre-approved ${PRE_APPROVAL.date}`,
          icon: Landmark,
          tone: "nectar",
          to: "client:finance",
        },
        {
          label: "Your package",
          value: aud(PACKAGE_TOTAL),
          sub: `Land ${aud(PACKAGE_SPLIT.land.amount)} · build ${aud(BUILD_CONTRACT)}`,
          icon: KeyRound,
          to: "client:finance",
        },
      ]}
      moreLabel="More about your home"
      more={[
        {
          label: "Next milestone",
          // On site, which of the eight build milestones is next; before that, the stage it belongs to.
          value: !next
            ? "—"
            : job.milestones.includes(next)
              ? `${built.length + 1} of ${BUILD_STEPS}`
              : (current?.short ?? "—"),
          sub: next ? `${next.name} · with ${current?.who ?? job.builder}` : "Nothing outstanding",
          icon: Gauge,
          to: "client:build",
        },
        {
          label: `Paid to ${job.builder}`,
          value: aud(paidTotal),
          sub: `${paid.length} of ${PROGRESS_PAYMENTS.length} progress payments`,
          icon: Banknote,
          to: "client:finance",
        },
        {
          label: "Your match score",
          value: matchScore(chosen),
          sub: `${chosen.design} · #${ranked.indexOf(chosen) + 1} of ${MATCHES.length} options`,
          icon: Sparkles,
          to: "client:options",
        },
        {
          label: "Documents ready",
          value: `${ready.length} of ${CLIENT_DOCS.length}`,
          sub: `${CLIENT_DOCS.length - ready.length} arrive by handover`,
          icon: FileText,
          to: "client:documents",
        },
        {
          label: "Unread messages",
          value: unreadHere.length,
          sub: unreadHere.length ? `Latest from ${unreadHere[unreadHere.length - 1].name}` : "You're up to date",
          icon: MessagesSquare,
          to: "client:messages",
        },
      ]}
    >
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Reveal index={2} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Enquiry to keys</CardTitle>
              <CardMeta>
                {stages.filter((s) => s.state === "done").length} of {stages.length} stages done
              </CardMeta>
              <CardDescription>
                Every step of buying and building your home, and who looks after you at each one.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-5">
              <JourneyTimeline stages={stages} />
            </CardContent>
          </Card>
        </Reveal>

        <div className="flex min-w-0 flex-col gap-5">
          {latest ? (
            <Reveal index={3}>
              <Card tone="accent">
                <CardHeader>
                  <CardTitle>Latest from {latest.builder}</CardTitle>
                  <CardMeta>
                    <When>{latest.when}</When>
                  </CardMeta>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="tone">{latest.milestone}</Pill>
                    {latest.fresh ? <Pill tone="ok">New</Pill> : null}
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed">{latest.note}</p>
                  <PhotoStrip count={latest.photos} label={`${latest.milestone} at ${lot.lot}`} />
                  <Link
                    href={hrefForKey("client:build")}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-tone-ink hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    All site updates <ArrowRight className="size-3" aria-hidden />
                  </Link>
                </CardContent>
              </Card>
            </Reveal>
          ) : null}
          <Reveal index={4}>
            <TeamCard job={job} />
          </Reveal>
        </div>
      </div>
    </DashboardOverview>
  );
}
