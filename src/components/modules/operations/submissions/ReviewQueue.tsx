"use client";

import { ArrowRight, Check, Circle, Pencil, Send } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import {
  DELIVERY_METHODS,
  NGUYEN,
  OPS_CHECKLIST,
  PIPELINE_STAGES,
  STATIC_QUEUE,
  isChangesRequested,
  isInReview,
  isVerified,
  type QueueCard,
  type StageKey,
} from "./data";

type BoardCard = QueueCard & { live?: boolean };

/** The review queue — five stages from rep draft to builder accepted (mockup `lm`). */
export function ReviewQueue({ onOpen }: { onOpen: () => void }) {
  const { submissionDocs: docs, submissionStatus: status, go } = useLaunchpad();

  const uploaded = docs.filter((d) => d.file).length;
  const required = docs.filter((d) => d.req).length;
  const verified = docs.filter((d) => isVerified(d.state)).length;
  const inReview = isInReview(status);
  const approved = status === "approved";
  const changes = isChangesRequested(status);
  const base = { client: NGUYEN.client, builder: NGUYEN.builder, rep: NGUYEN.rep, live: true };

  // Where the live Nguyen submission sits depends on its status.
  const columns: Record<StageKey, BoardCard[]> = {
    draft: [
      ...(!inReview && !approved
        ? [
            {
              ...base,
              docs: `${uploaded}/${required}`,
              flag: changes ? "Changes requested · with rep" : "Rep completing documents",
            },
          ]
        : []),
      ...STATIC_QUEUE.draft,
    ],
    docs: STATIC_QUEUE.docs,
    review:
      inReview
        ? [
            {
              ...base,
              docs: `${uploaded}/${required}`,
              flag: `${verified} of ${uploaded} verified`,
              est: "Awaiting review",
            },
          ]
        : [],
    submitted: STATIC_QUEUE.submitted,
    accepted: [
      ...(approved ? [{ ...base, docs: "9/9", est: "Pack delivered · awaiting job no" }] : []),
      ...STATIC_QUEUE.accepted,
    ],
  };

  const canOpen = inReview || approved;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Submission review"
        description="Reps enter deal data once. It populates the builder's forms and HubSpot; nothing moves forward until the checklist is complete."
        actions={
          <>
            <p className="max-w-[200px] text-[11px] leading-snug text-subtle-foreground sm:text-right">
              Reps start submissions in Sales. Use this only when entering one for a rep.
            </p>
            <Button variant="outline" onClick={() => go("sales", "submissions")}>
              <Pencil className="size-3.5" aria-hidden /> Start on behalf of a rep
            </Button>
          </>
        }
      />

      {/* The board — scrolls sideways inside itself on narrow screens. */}
      <div className="min-w-0">
        <div className="grid grid-cols-[repeat(5,minmax(168px,1fr))] gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {PIPELINE_STAGES.map((stage, i) => {
            const cards = columns[stage.key];
            const last = i === PIPELINE_STAGES.length - 1;
            return (
              <Reveal
                key={stage.key}
                index={i}
                as="section"
                className="flex min-h-[220px] flex-col rounded-xl border border-border bg-canvas p-2.5 dark:bg-white/[0.02]"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                      last
                        ? "bg-haven-300 text-haven-950"
                        : "bg-skyblue-200 text-skyblue-950 dark:bg-skyblue-300/20 dark:text-skyblue-100",
                    )}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <h2 className="text-xs font-semibold">{stage.label}</h2>
                  <span className="ml-auto text-[11px] text-subtle-foreground tabular-nums">
                    {cards.length}
                    <span className="sr-only"> {cards.length === 1 ? "deal" : "deals"}</span>
                  </span>
                </div>
                <p className="mt-0.5 mb-2 text-[10.5px] text-muted-foreground">{stage.note}</p>
                <div className="flex flex-col gap-2">
                  {cards.map((card) => (
                    <BoardCardView
                      key={card.client}
                      card={card}
                      onOpen={card.live && canOpen ? onOpen : undefined}
                    />
                  ))}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Reveal index={5}>
          <Card>
            <CardHeader>
              <CardTitle>Ops review — M. and T. Nguyen</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col">
                {OPS_CHECKLIST.map(([label, done]) => (
                  <li key={label} className="flex items-center gap-2 py-1 text-xs">
                    {done ? (
                      <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    ) : (
                      <Circle className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
                    )}
                    <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                    <span className="sr-only">{done ? "(done)" : "(outstanding)"}</span>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" className="mt-3 w-full" disabled>
                <Send className="size-3.5" aria-hidden /> Send to Forma (2 items outstanding)
              </Button>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={6}>
          <Card>
            <CardHeader>
              <CardTitle>Builder delivery methods</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                {DELIVERY_METHODS.map(([builder, method]) => (
                  <div
                    key={builder}
                    className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5 text-xs"
                  >
                    <dt className="font-semibold">{builder}</dt>
                    <dd className="text-right text-muted-foreground">{method}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2.5 text-[11px] text-subtle-foreground">
                Approved packs are auto-delivered per builder; ops never re-keys data.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

function BoardCardView({ card, onOpen }: { card: BoardCard; onOpen?: () => void }) {
  const [have, need] = card.docs.split("/");
  const complete = have === need;

  const body = (
    <>
      <span className="block text-[12.5px] leading-snug font-semibold">{card.client}</span>
      <span className="my-1.5 flex items-center gap-1.5">
        <Pill tone="skyblue" className="px-2 py-px text-[11px]">
          {card.builder}
        </Pill>
        <span className="ml-auto inline-flex">
          <Avatar name={card.rep} tone="charcoal" size="xs" />
          <span className="sr-only">Rep {card.rep}</span>
        </span>
      </span>
      <span
        className={cn(
          "block text-[11px] font-medium tabular-nums",
          complete ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
        )}
      >
        Docs {card.docs}
      </span>
      {card.flag ? (
        <span className="mt-0.5 block text-[10.5px] text-amber-700 dark:text-amber-300">{card.flag}</span>
      ) : null}
      {card.est ? <span className="mt-0.5 block text-[10.5px] text-muted-foreground">{card.est}</span> : null}
      {onOpen ? (
        <span className="mt-2 flex items-center gap-1 text-[10.5px] font-semibold text-haven-700 dark:text-haven-300">
          Open review
          <ArrowRight className="size-3 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
        </span>
      ) : null}
    </>
  );

  const shell = "block w-full rounded-lg border bg-card px-3 py-2.5 text-left shadow-xs";

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          shell,
          "group cursor-pointer border-haven-300 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-haven-400 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none motion-reduce:transition-none dark:border-haven-800 dark:hover:border-haven-600",
        )}
      >
        {body}
      </button>
    );
  }
  return <div className={cn(shell, "border-border")}>{body}</div>;
}
