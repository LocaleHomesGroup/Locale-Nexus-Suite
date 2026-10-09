"use client";

import * as React from "react";
import { toast } from "sonner";
import { Clock, ExternalLink, FolderOpen, HandCoins, Lock, Users } from "lucide-react";
import { useLaunchpad, confirm } from "@/state/launchpad-store";
import { useLiveData, useViewer } from "@/state/live-data";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import type { LiveFile, LiveLot } from "@/data/live/types";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { NoMatches } from "@/components/ui/states";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { LiveNote } from "@/components/ui/live-note";
import { FileList } from "@/components/ui/file-list";
import { listItemFiles } from "@/server/actions/files";
import { markLotSoldAction, placeHoldAction, releaseHoldAction } from "@/server/actions/land";
import type { LandActionResult } from "@/server/actions/land-rules";
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
import { ViewingAs } from "../ViewingAs";
import { viewLot } from "./live-lots";

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

/** "Any builder", or the builder the lot is packaged with. */
function builderLabel(builder: string): string {
  return builder === "Any builder" ? builder : `Builder: ${builder}`;
}

/** Where a lot is: its estate and its builder, leaving out whichever is missing (a live lot can have no estate). */
function lotWhere(lot: LandLot): string {
  return [lot.estate, builderLabel(lot.builder)].filter(Boolean).join(" · ");
}

/**
 * Exclusive land, on the Sales Manager dashboard and in the Sales Representative
 * portal: lots land developers give Locale alone to sell. A rep can place a
 * 24-hour hold on an available lot, or join the queue (three holds per lot)
 * behind someone else's. The holder marks the lot sold once the client's
 * deposit is in; otherwise the hold lapses and the next rep in the queue has it.
 *
 * Lots come from the Exclusive Land board in Monday; holds, the queue and sold
 * status are Launchpad's (decided 8 Oct). With a database connected the lots
 * are live and every action goes through the database's hold rules; without
 * one, the sample lots work as before.
 */
export function ExclusiveLand() {
  const { lots: sampleLots, setLots: setSampleLots } = useSalesState();
  const live = useLiveData();
  const { viewer } = useViewer();
  const now = useNow(30_000);
  const { notify } = useLaunchpad();
  const [estate, setEstate] = React.useState<string>("All estates");
  const [holdLot, setHoldLot] = React.useState<LandLot | null>(null);
  const [holdOpen, setHoldOpen] = React.useState(false);
  const [soldLot, setSoldLot] = React.useState<LandLot | null>(null);
  const [soldOpen, setSoldOpen] = React.useState(false);
  const [filesLot, setFilesLot] = React.useState<LandLot | null>(null);
  // Null while loading. "failed" is a lookup that failed, which is not the same as a lot with no plans or files.
  const [files, setFiles] = React.useState<LiveFile[] | "failed" | null>(null);
  // The lots with an action out, so a card locks only its own buttons.
  const [busy, setBusy] = React.useState<ReadonlySet<string>>(() => new Set());
  // The same lots as a ref, which a handler from an earlier render still sees (state it would see stale).
  const inFlight = React.useRef<Set<string>>(new Set());
  // A dialog keeps its old handlers while it fades out (about 180 ms), so a quick second click on its button reaches
  // them again. Each dialog takes one submit per opening.
  const holdSent = React.useRef(false);
  const soldSent = React.useRef(false);
  // Which "Plans and files" lookup may fill the dialog: only the latest.
  const filesRequest = React.useRef(0);
  const [client, setClient] = React.useState("");
  const clientId = React.useId();

  // Before mount, render at the time the data was read, so server and browser agree. That is readAt:
  // asOf is Monday's last sync and can be hours old.
  const at = now ?? (live ? Date.parse(live.readAt) : 0);
  const lots: LandLot[] = live ? live.lots.map((l) => viewLot(l, viewer?.id ?? null, at)) : sampleLots;
  // Live lots bring their own estates; the sample lots keep the sample chips.
  const estates: string[] = live
    ? ["All estates", ...[...new Set(lots.map((l) => l.estate).filter(Boolean))].sort()]
    : [...ESTATE_FILTERS];
  const shown = lots.filter((l) =>
    live ? estate === "All estates" || l.estate === estate : lotMatchesEstate(l, estate as EstateFilter),
  );
  const liveLot = (id: string): LiveLot | undefined => live?.lots.find((l) => l.id === id);
  const myHold = (id: string) => liveLot(id)?.holds.find((h) => h.staffId === viewer?.id);

  const patch = (id: string, p: Partial<LandLot>) =>
    setSampleLots((prev) => prev.map((l) => (l.id === id ? { ...l, ...p } : l)));

  /** Runs a hold action against the database, redraws from what it returns, and gives back the lot as the viewer sees it. */
  const runLive = async (lotId: string, action: () => Promise<LandActionResult>): Promise<LandLot | null> => {
    // One action at a time per lot: a second for a lot that already has one out is dropped, not queued.
    if (!live || inFlight.current.has(lotId)) return null;
    inFlight.current.add(lotId);
    setBusy((prev) => new Set(prev).add(lotId));
    try {
      const r = await action();
      if (r.lots) live.setLots(r.lots);
      if (!r.ok) {
        toast.error(r.error);
        return null;
      }
      if (!r.lots) {
        toast.success("Done. The board catches up when you refresh.");
        return null;
      }
      const updated = r.lots.find((l) => l.id === lotId);
      return updated ? viewLot(updated, viewer?.id ?? null, Date.now()) : null;
    } catch (e) {
      // A lost reply can follow an action the server already committed, so don't say it failed.
      console.error("[exclusive-land] action failed:", e);
      toast.error("Couldn't confirm that went through. Refresh to see the latest board.");
      return null;
    } finally {
      inFlight.current.delete(lotId);
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(lotId);
        return next;
      });
    }
  };

  /**
   * Places a live hold for the viewer. The database starts it at once or queues it,
   * and the confirmation says which, with the lines given for each case.
   */
  const placeLive = async (lot: LandLot, who: string, lines: { started: (held: LandLot) => string; queued: string }) => {
    if (!viewer) return;
    const result = await runLive(lot.id, () => placeHoldAction(lot.id, viewer.id, who));
    if (result?.mine) {
      confirm(`24-hour hold placed · ${lot.lot}`, lines.started(result));
      notify(`24-hour hold placed on ${lot.lot}`);
    } else if (result?.queuedAt) {
      confirm(`Joined the hold queue · ${ordinal(result.queuedAt)} of ${HOLD_QUEUE_MAX}`, lines.queued);
    }
  };

  /** Runs an action on the viewer's own hold on a live lot. True when it went through. */
  const onMyHold = async (lot: LandLot, action: (holdId: string, staffId: string) => Promise<LandActionResult>) => {
    const hold = myHold(lot.id);
    if (!viewer || !hold) return false;
    return (await runLive(lot.id, () => action(hold.id, viewer.id))) !== null;
  };

  const noViewer = () => {
    if (live && !viewer) {
      toast.error("Pick who you're viewing as first.");
      return true;
    }
    return false;
  };

  const startHold = (lot: LandLot) => {
    if (noViewer()) return;
    holdSent.current = false;
    setHoldLot(lot);
    setClient("");
    setHoldOpen(true);
  };

  const placeHold = async () => {
    if (!holdLot || holdSent.current) return;
    holdSent.current = true;
    const lot = holdLot;
    const who = client.trim();
    setHoldOpen(false);
    if (live) {
      await placeLive(lot, who, {
        started: (held) =>
          held.expires
            ? `Every rep sees it as soon as their board loads. ${held.expires}.`
            : "Every rep sees it as soon as their board loads.",
        queued: `${lot.lot}. Someone held it just before you. You're told the moment their hold ends.`,
      });
      return;
    }
    const expires = holdExpiry();
    patch(lot.id, {
      status: "hold",
      holder: who ? `${CURRENT_REP} for ${who}` : CURRENT_REP,
      expires: `Hold expires ${expires} tomorrow`,
      queue: 1,
      mine: true,
    });
    confirm(`24-hour hold placed · ${lot.lot}`, `Every rep sees it now. Expires ${expires} tomorrow.`);
    notify(`24-hour hold placed on ${lot.lot}`);
  };

  const startSold = (lot: LandLot) => {
    soldSent.current = false;
    setSoldLot(lot);
    setSoldOpen(true);
  };

  const markSold = async () => {
    if (!soldLot || soldSent.current) return;
    soldSent.current = true;
    const lot = soldLot;
    const queued = (lot.queue ?? 1) > 1;
    setSoldOpen(false);
    if (live) {
      if (!(await onMyHold(lot, (holdId, staffId) => markLotSoldAction(holdId, staffId, "")))) return;
    } else {
      patch(lot.id, { status: "sold", expires: undefined, queue: undefined, queuedAt: undefined });
    }
    confirm(
      `Sold · ${lot.lot}`,
      queued ? "Deposit received. The reps in the hold queue are told it's gone." : "Deposit received. It's off the available list for every rep.",
    );
    notify(`${lot.lot} sold · deposit received`);
  };

  const releaseHold = async (lot: LandLot) => {
    if (live) {
      if (!(await onMyHold(lot, releaseHoldAction))) return;
    } else {
      patch(lot.id, { status: "available", holder: undefined, expires: undefined, queue: undefined, mine: false });
    }
    confirm(`Hold released · ${lot.lot}`, "The next rep in the queue has it now, or it's available again.");
  };

  const joinQueue = async (lot: LandLot) => {
    if (live) {
      if (noViewer()) return;
      await placeLive(lot, "", {
        started: () => "The hold ahead of yours had ended, so the lot is yours for 24 hours.",
        queued: `${lot.lot}. You're told the moment that hold ends.`,
      });
      return;
    }
    const place = (lot.queue ?? 1) + 1;
    patch(lot.id, { queue: place, queuedAt: place });
    confirm(
      `Joined the hold queue · ${ordinal(place)} of ${HOLD_QUEUE_MAX}`,
      `${lot.lot}. You're told the moment that hold ends.`,
    );
  };

  const leaveQueue = async (lot: LandLot) => {
    if (live) {
      if (!(await onMyHold(lot, releaseHoldAction))) return;
    } else {
      patch(lot.id, { queue: Math.max(1, (lot.queue ?? 2) - 1), queuedAt: undefined });
    }
    confirm(`Left the hold queue · ${lot.lot}`);
  };

  const closeFiles = () => {
    filesRequest.current += 1; // a reply still on its way is for a dialog that has gone
    setFilesLot(null);
  };

  const openFiles = async (lot: LandLot) => {
    const itemId = liveLot(lot.id)?.mondayItemId;
    if (!live || !itemId) {
      confirm(`Plans and files · ${lot.lot}`, "They come from the Exclusive Land board in Monday once live data is connected.");
      return;
    }
    // Only the latest lookup fills the dialog: a slower reply for a lot the rep has since closed, or moved on from, is dropped.
    const request = ++filesRequest.current;
    setFilesLot(lot);
    setFiles(null);
    const found = await listItemFiles(itemId).catch(() => "failed" as const);
    if (request === filesRequest.current) setFiles(found);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exclusive land"
        description="Lots land developers have given Locale alone to sell. Place a 24-hour hold to lock one in for your client, and up to three holds queue per lot."
        actions={
          <>
            <LiveNote />
            {live ? (
              <ViewingAs />
            ) : (
              <span className="text-xs text-subtle-foreground">Lots from the Exclusive Land board in Monday. Holds are kept in Launchpad.</span>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <SlidingTabs
          ariaLabel="Filter by estate"
          value={estate}
          onChange={setEstate}
          items={estates.map((e) => ({ value: e, label: e }))}
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
                  busy={busy.has(lot.id)}
                  onHold={() => startHold(lot)}
                  onSold={() => startSold(lot)}
                  onRelease={() => void releaseHold(lot)}
                  onJoin={() => void joinQueue(lot)}
                  onLeave={() => void leaveQueue(lot)}
                  onFiles={() => void openFiles(lot)}
                />
              </Reveal>
            ))}
          </ul>
        )}

        <Footnote className="text-xs">
          Holds expire after 24 hours unless the client&apos;s deposit is in, and the next rep in the queue is told.
          Lots come from the Exclusive Land board in Monday; holds are kept here.
        </Footnote>
      </div>

      <Dialog
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        icon={Lock}
        title="Place 24-hour hold"
        description={
          holdLot
            ? `${holdLot.lot} is locked to you for 24 hours. If no deposit comes in, the hold expires and the next rep in the queue is told.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setHoldOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => void placeHold()}>
              <Lock aria-hidden /> Place hold
            </Button>
          </>
        }
      >
        {holdLot ? (
          <div className="flex flex-col gap-3">
            <LotSummary lot={holdLot} />
            <Field label="For client" htmlFor={clientId} hint="Optional. Every rep sees it on the hold.">
              <Input
                id={clientId}
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g. W. and K. Tan"
                autoComplete="off"
                maxLength={120}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void placeHold();
                }}
              />
            </Field>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={soldOpen}
        onClose={() => setSoldOpen(false)}
        icon={HandCoins}
        title="Mark as sold"
        description={
          soldLot
            ? `Only once the client's deposit is in. ${soldLot.lot} moves to Sold for every rep, and any holds queued behind yours end.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setSoldOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => void markSold()}>
              <HandCoins aria-hidden /> Deposit received
            </Button>
          </>
        }
      >
        {soldLot ? <LotSummary lot={soldLot} holder /> : null}
      </Dialog>

      <Dialog
        open={filesLot !== null}
        onClose={closeFiles}
        icon={FolderOpen}
        title="Plans and files"
        description={filesLot?.lot}
        footer={
          <Button variant="outline" onClick={closeFiles}>
            Close
          </Button>
        }
      >
        {files === null ? (
          <p className="text-xs text-muted-foreground">Loading files…</p>
        ) : files === "failed" ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">Couldn&apos;t load the files right now. Try again in a moment.</p>
        ) : (
          <FileList files={files} empty="No plans or files on this lot in Monday yet." />
        )}
      </Dialog>
    </div>
  );
}

/** The lot at the top of a dialog: address, estate, builder and price, and who holds it when asked. */
function LotSummary({ lot, holder = false }: { lot: LandLot; holder?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-canvas px-3 py-2.5">
      <p className="text-[13px] font-semibold">{lot.lot}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {lotWhere(lot)}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-foreground tabular-nums">{lot.price}</p>
      {holder && lot.holder ? <p className="mt-1 text-xs text-muted-foreground">Held by {lot.holder}</p> : null}
    </div>
  );
}

function LotCard({
  lot,
  busy,
  onHold,
  onSold,
  onRelease,
  onJoin,
  onLeave,
  onFiles,
}: {
  lot: LandLot;
  busy: boolean;
  onHold: () => void;
  onSold: () => void;
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
        lot.status === "available" && "border-tone-line",
        lot.status === "sold" && "opacity-65",
      )}
    >
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold">{lot.lot}</h2>
        <span className="ml-auto">
          {lot.status === "available" ? (
            <Pill tone="ok">Available</Pill>
          ) : lot.status === "hold" ? (
            <Pill tone="pending">On hold</Pill>
          ) : (
            <Pill tone="neutral">Sold</Pill>
          )}
        </span>
      </div>
      <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
        {lotWhere(lot)}
      </p>
      <p className="text-[13px] font-semibold text-foreground tabular-nums">{lot.price}</p>
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
        <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground">
          {lot.note}
        </p>
      ) : null}
      {lot.status === "hold" ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
          <Clock className="size-3 shrink-0" aria-hidden />
          {lot.holder} · {lot.expires}
        </p>
      ) : null}
      {lot.status === "hold" && lot.queuedAt ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3 shrink-0" aria-hidden />
          You&apos;re {ordinal(lot.queuedAt)} of {HOLD_QUEUE_MAX} in the hold queue
        </p>
      ) : null}
      {lot.status === "sold" && lot.holder ? <p className="mt-2 text-xs text-subtle-foreground">Sold by {lot.holder}</p> : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        {lot.status === "available" ? (
          <Button size="sm" disabled={busy} onClick={onHold}>
            Place 24-hour hold
          </Button>
        ) : null}
        {lot.status === "hold" && lot.mine ? (
          <>
            <Button size="sm" disabled={busy} onClick={onSold}>
              Deposit received
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={onRelease}>
              Release hold
            </Button>
          </>
        ) : null}
        {lot.status === "hold" && !lot.mine && !lot.queuedAt ? (
          <Button
            size="sm"
            variant="outline"
            className="border-foreground/70"
            disabled={queueFull || busy}
            onClick={onJoin}
          >
            {queueFull ? "Hold queue full" : `Join hold queue (${queue + 1} of ${HOLD_QUEUE_MAX})`}
          </Button>
        ) : null}
        {lot.status === "hold" && lot.queuedAt ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onLeave}>
            Leave queue
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" className="text-tone-ink hover:text-foreground" onClick={onFiles}>
          Plans and files <ExternalLink className="size-3" aria-hidden />
        </Button>
      </div>
    </Card>
  );
}
