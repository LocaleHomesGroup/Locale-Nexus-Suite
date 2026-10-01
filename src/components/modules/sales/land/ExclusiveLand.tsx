"use client";

import * as React from "react";
import { Clock, ExternalLink, Lock, Users } from "lucide-react";
import { useLaunchpad, confirm } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { NoMatches } from "@/components/ui/states";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import {
  CURRENT_REP,
  ESTATE_FILTERS,
  HOLD_QUEUE_MAX,
  lotMatchesEstate,
  type EstateFilter,
  type LandLot,
} from "../data";
import { useSalesState } from "../sales-state";
import { Footnote } from "../parts";

/** "11:42am" — the clock time a 24-hour hold placed now runs out tomorrow. */
function holdExpiry(): string {
  return new Date()
    .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s/g, "")
    .toLowerCase();
}

function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

/**
 * Sales › Exclusive land — lots builders allocate to Locale only. A rep can
 * place a 24-hour hold on an available lot, or join the queue (three holds
 * per lot) behind someone else's. Every change is what updates the Exclusive
 * Land board in Monday.
 */
export function ExclusiveLand() {
  const { lots, setLots } = useSalesState();
  const { notify } = useLaunchpad();
  const [estate, setEstate] = React.useState<EstateFilter>("All estates");
  const [holdLot, setHoldLot] = React.useState<LandLot | null>(null);
  const [holdOpen, setHoldOpen] = React.useState(false);
  const [client, setClient] = React.useState("");
  const clientId = React.useId();

  const shown = lots.filter((l) => lotMatchesEstate(l, estate));

  const patch = (id: string, p: Partial<LandLot>) => setLots((prev) => prev.map((l) => (l.id === id ? { ...l, ...p } : l)));

  const startHold = (lot: LandLot) => {
    setHoldLot(lot);
    setClient("");
    setHoldOpen(true);
  };

  const placeHold = () => {
    if (!holdLot) return;
    const at = holdExpiry();
    const who = client.trim();
    patch(holdLot.id, {
      status: "hold",
      holder: who ? `${CURRENT_REP} for ${who}` : CURRENT_REP,
      expires: `Hold expires ${at} tomorrow`,
      queue: 1,
      mine: true,
    });
    setHoldOpen(false);
    confirm(`24-hour hold placed · ${holdLot.lot}`, `Monday board updated. Expires ${at} tomorrow.`);
    notify(`24-hour hold placed on ${holdLot.lot} · Exclusive Land board updated`);
  };

  const releaseHold = (lot: LandLot) => {
    patch(lot.id, { status: "available", holder: undefined, expires: undefined, queue: undefined, mine: false });
    confirm(`Hold released · ${lot.lot}`, "The lot is available again on the Monday board.");
  };

  const joinQueue = (lot: LandLot) => {
    const place = (lot.queue ?? 1) + 1;
    patch(lot.id, { queue: place, queuedAt: place });
    confirm(
      `Joined the hold queue · ${ordinal(place)} of ${HOLD_QUEUE_MAX}`,
      `${lot.lot}. You're notified the moment ${lot.holder}'s hold lapses.`,
    );
  };

  const leaveQueue = (lot: LandLot) => {
    patch(lot.id, { queue: Math.max(1, (lot.queue ?? 2) - 1), queuedAt: undefined });
    confirm(`Left the hold queue · ${lot.lot}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Sales"
        title="Exclusive land"
        description="Lots allocated exclusively to Locale by our builders. Place a 24-hour hold to lock one in for your client — up to three holds queue per lot."
        actions={<span className="text-xs text-subtle-foreground">Synced from the Exclusive Land board in Monday</span>}
      />

      <div className="flex flex-col gap-3">
        <SlidingTabs
          ariaLabel="Filter by estate"
          value={estate}
          onChange={setEstate}
          items={ESTATE_FILTERS.map((e) => ({ value: e, label: e }))}
          className="self-start"
        />

        {shown.length === 0 ? (
          <Card>
            <NoMatches query={estate} onClear={() => setEstate("All estates")} />
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((lot, i) => (
              <Reveal as="li" key={`${estate}:${lot.id}`} index={i}>
                <LotCard
                  lot={lot}
                  onHold={() => startHold(lot)}
                  onRelease={() => releaseHold(lot)}
                  onJoin={() => joinQueue(lot)}
                  onLeave={() => leaveQueue(lot)}
                  onFiles={() => confirm(`Plans and files · ${lot.lot}`, "Opening from the Exclusive Land board in Monday.")}
                />
              </Reveal>
            ))}
          </ul>
        )}

        <Footnote className="text-xs">
          Holds auto-expire after 24 hours and the next rep in the queue is notified. Placing a hold updates the Monday
          board instantly.
        </Footnote>
      </div>

      <Dialog
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        icon={Lock}
        title="Place 24-hour hold"
        description={
          holdLot
            ? `${holdLot.lot} is locked to you for 24 hours and the Exclusive Land board in Monday updates straight away. If it isn't converted, the hold expires and the next rep in the queue is notified.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setHoldOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={placeHold}>
              <Lock aria-hidden /> Place hold
            </Button>
          </>
        }
      >
        {holdLot ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-canvas px-3 py-2.5">
              <p className="text-[13px] font-semibold">{holdLot.lot}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {holdLot.estate} · Exclusive: {holdLot.builder}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-haven-700 tabular-nums dark:text-haven-300">
                {holdLot.price}
              </p>
            </div>
            <Field label="For client" htmlFor={clientId} hint="Optional — shows on the hold in Monday.">
              <Input
                id={clientId}
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g. W. and K. Tan"
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") placeHold();
                }}
              />
            </Field>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function LotCard({
  lot,
  onHold,
  onRelease,
  onJoin,
  onLeave,
  onFiles,
}: {
  lot: LandLot;
  onHold: () => void;
  onRelease: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onFiles: () => void;
}) {
  const queue = lot.queue ?? 1;
  const queueFull = queue >= HOLD_QUEUE_MAX;
  return (
    <Card
      className={cn(
        "flex h-full flex-col px-4 py-3.5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        lot.status === "available" && "border-haven-300 dark:border-haven-700",
        lot.status === "sold" && "opacity-65",
      )}
    >
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold">{lot.lot}</h2>
        <span className="ml-auto">
          {lot.status === "available" ? (
            <Pill tone="haven">Available</Pill>
          ) : lot.status === "hold" ? (
            <Pill tone="skyblue">On hold</Pill>
          ) : (
            <Pill tone="neutral">Sold</Pill>
          )}
        </span>
      </div>
      <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
        {lot.estate} · Exclusive: {lot.builder}
      </p>
      <p className="text-[13px] font-semibold text-haven-700 tabular-nums dark:text-haven-300">{lot.price}</p>
      <p className="my-0.5 text-xs text-muted-foreground tabular-nums">{lot.specs}</p>
      <p
        className={cn(
          "text-xs",
          lot.titled === "Titled" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
        )}
      >
        {lot.titled}
      </p>
      {lot.note ? (
        <p className="mt-2 rounded-md bg-skyblue-100 px-2.5 py-1.5 text-[11px] text-skyblue-950 dark:bg-skyblue-500/15 dark:text-skyblue-100">
          {lot.note}
        </p>
      ) : null}
      {lot.status === "hold" ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
          <Clock className="size-3 shrink-0" aria-hidden />
          {lot.holder} · {lot.expires}
        </p>
      ) : null}
      {lot.status === "hold" && lot.queuedAt ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="size-3 shrink-0" aria-hidden />
          You&apos;re {ordinal(lot.queuedAt)} of {HOLD_QUEUE_MAX} in the hold queue
        </p>
      ) : null}
      {lot.status === "sold" ? <p className="mt-2 text-[11px] text-subtle-foreground">Sold by {lot.holder}</p> : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        {lot.status === "available" ? (
          <Button size="sm" onClick={onHold}>
            Place 24-hour hold
          </Button>
        ) : null}
        {lot.status === "hold" && lot.mine ? (
          <Button size="sm" variant="outline" onClick={onRelease}>
            Release hold
          </Button>
        ) : null}
        {lot.status === "hold" && !lot.mine && !lot.queuedAt ? (
          <Button
            size="sm"
            variant="outline"
            className="border-foreground/70"
            disabled={queueFull}
            onClick={onJoin}
          >
            {queueFull ? "Hold queue full" : `Join hold queue (${queue + 1} of ${HOLD_QUEUE_MAX})`}
          </Button>
        ) : null}
        {lot.status === "hold" && lot.queuedAt ? (
          <Button size="sm" variant="outline" onClick={onLeave}>
            Leave queue
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" className="text-haven-700 hover:text-haven-800 dark:text-haven-300 dark:hover:text-haven-200" onClick={onFiles}>
          Plans and files <ExternalLink className="size-3" aria-hidden />
        </Button>
      </div>
    </Card>
  );
}
