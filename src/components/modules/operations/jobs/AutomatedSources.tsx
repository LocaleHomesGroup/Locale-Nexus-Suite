"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Inbox, RefreshCw } from "lucide-react";
import type { PortalUpdate } from "@/data/seed";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SystemTag } from "@/components/ui/pill";
import { useOperationsSync, type PortalSyncState } from "../sync/OperationsSyncProvider";
import { portalChanges } from "../sync/portal-changes";
import { AUTOMATED_SOURCES, SOURCE_LOG, type SourceHealth } from "./data";

const DOT: Record<SourceHealth, string> = {
  connected: "bg-emerald-500 dark:bg-emerald-400",
  building: "bg-amber-500 dark:bg-amber-400",
  manual: "bg-zinc-400 dark:bg-zinc-500",
};

/**
 * Automated sources — which builder portals are wired in, the updates they
 * found that are waiting for a human, and the latest poll results.
 */
export function AutomatedSources() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automated sources</CardTitle>
        <CardMeta>Builder portals polled every 30 min</CardMeta>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-wrap gap-2" aria-label="Builder portal adapters">
          {AUTOMATED_SOURCES.map((s) => (
            <li
              key={s.builder}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1 text-xs dark:bg-white/[0.03]"
            >
              <span className={cn("size-[7px] shrink-0 rounded-full", DOT[s.health])} aria-hidden />
              <span className="font-semibold">{s.builder}</span>
              <span className="text-muted-foreground">{s.status}</span>
            </li>
          ))}
        </ul>

        <PortalInbox />

        <ul className="border-t border-hairline pt-2">
          {SOURCE_LOG.map((l) => (
            <li key={l.text} className="flex gap-2.5 py-1 text-xs">
              <span className="w-16 shrink-0 whitespace-nowrap text-subtle-foreground tabular-nums">{l.when}</span>
              <span className="min-w-0 text-foreground/85">{l.text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function updateSummary(u: PortalUpdate) {
  return u.kind === "move" ? `${u.milestone} (${u.date}), proposes move to construction` : `${u.milestone} completed ${u.date}`;
}

/**
 * Portal and email updates the adapters found. Nothing syncs until someone
 * accepts it. An accepted update stays here, marked syncing, until every
 * system has confirmed, then leaves the inbox.
 */
function PortalInbox() {
  const { portalUpdates } = useLaunchpad();
  const { acceptPortalUpdate, acceptPortalUpdates, dismissPortalUpdate, portalSync, viewTrail } = useOperationsSync();
  const reduce = useReducedMotion();
  const [confirming, setConfirming] = React.useState(false);

  const waiting = portalUpdates.filter((u) => !portalSync[u.id]);
  const n = waiting.length;

  return (
    <>
      <AnimatePresence initial={false}>
        {portalUpdates.length > 0 ? (
          <motion.section
            key="inbox"
            aria-label="Portal updates awaiting review"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.16 } }}
            transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
            className="rounded-lg border border-tone-line bg-tone-soft px-3.5 py-2.5"
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold text-foreground">
                <Inbox className="size-3.5 shrink-0 text-tone-ink" aria-hidden />
                <span className="tabular-nums">
                  {n > 0
                    ? `${n} portal update${n > 1 ? "s" : ""} awaiting review · nothing syncs until a human approves`
                    : "Accepted updates are syncing · nothing else is waiting"}
                </span>
              </p>
              {n > 1 ? (
                <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
                  Accept all {n}
                </Button>
              ) : null}
            </div>
            <ul>
              <AnimatePresence initial={false}>
                {portalUpdates.map((u, i) => (
                  <motion.li
                    key={u.id}
                    layout="position"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: { duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(i, reduce) },
                    }}
                    exit={{ opacity: 0, x: reduce ? 0 : -14, transition: { duration: reduce ? 0 : 0.14 } }}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-tone-line/60 py-2"
                  >
                    <div className="min-w-0 flex-1 basis-64 text-xs">
                      <p className="leading-snug">
                        <span className="font-semibold">
                          {u.jobNo ? <span className="font-mono text-xs">{u.jobNo}</span> : "No job no"} · {u.client}
                        </span>
                        <span className="text-muted-foreground"> · {updateSummary(u)}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-subtle-foreground">{u.source}</p>
                    </div>
                    <RowActions
                      update={u}
                      sync={portalSync[u.id]}
                      onAccept={() => acceptPortalUpdate(u)}
                      onDismiss={() => dismissPortalUpdate(u.id)}
                      onView={viewTrail}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <AcceptAllDialog
        open={confirming}
        updates={waiting}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          acceptPortalUpdates(waiting);
        }}
      />
    </>
  );
}

function RowActions({
  update: u,
  sync,
  onAccept,
  onDismiss,
  onView,
}: {
  update: PortalUpdate;
  sync: PortalSyncState | undefined;
  onAccept: () => void;
  onDismiss: () => void;
  onView: (trailId: string) => void;
}) {
  if (sync) {
    const synced = sync.state === "synced";
    return (
      <div className="ml-auto flex shrink-0 items-center gap-3" role="status">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            synced ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
          )}
        >
          {synced ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {synced ? "Synced" : "Syncing to Monday and HubSpot"}
        </span>
        <Button variant="link" size="xs" className="h-auto px-0 text-xs" onClick={() => onView(sync.trailId)}>
          View sync trail
        </Button>
      </div>
    );
  }
  return (
    <div className="ml-auto flex shrink-0 gap-1.5">
      <Button size="sm" onClick={onAccept}>
        {u.kind === "move" ? "Accept and move" : "Accept and sync"}
      </Button>
      <Button size="sm" variant="outline" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}

/** "Accept all" confirmation: every field each update writes, old → new, and where it lands. */
function AcceptAllDialog({
  open,
  updates,
  onClose,
  onConfirm,
}: {
  open: boolean;
  updates: PortalUpdate[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { jobs } = useLaunchpad();
  // Keep the list on screen while the dialog plays its close.
  const last = React.useRef(updates);
  if (open) last.current = updates;
  const list = last.current;
  const n = list.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={Inbox}
      title={`Accept ${n} portal updates`}
      description="Each change is saved to Launchpad, then written to the system shown. Syncing runs in the background, so you can keep working."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" onClick={onConfirm}>
            <RefreshCw aria-hidden /> Accept and sync {n} updates
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-3">
        {list.map((u) => {
          const job = jobs.find((j) => j.id === u.jobId);
          const changes = portalChanges(u, job);
          return (
            <li key={u.id} className="rounded-lg border border-hairline">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-hairline px-3 py-2">
                <span className="text-[13px] font-semibold">
                  {u.jobNo ? <span className="font-mono text-xs">{u.jobNo}</span> : "No job no"} · {u.client}
                </span>
                <span className="text-xs text-muted-foreground">
                  {u.builder} · {updateSummary(u)}
                </span>
                <span className="text-xs text-subtle-foreground sm:ml-auto">{u.source}</span>
              </div>
              <table className="w-full text-xs">
                <caption className="sr-only">
                  Changes for {u.jobNo || u.client}: field, current value, new value
                </caption>
                <tbody>
                  {changes.map((c) => (
                    <tr key={`${c.sys}-${c.field}`} className="border-t border-hairline first:border-t-0">
                      <td className="w-20 py-1.5 pl-3 align-top">
                        <SystemTag>{c.sys}</SystemTag>
                      </td>
                      <th scope="row" className="py-1.5 pr-3 text-left align-top font-medium">
                        {c.field}
                      </th>
                      <td className="py-1.5 pr-3 align-top text-muted-foreground">
                        {c.note ? (
                          c.note
                        ) : (
                          <>
                            <span className="sr-only">From </span>
                            {c.from}
                            <ArrowRight className="mx-1.5 inline size-3 text-subtle-foreground" aria-hidden />
                            <span className="sr-only"> to </span>
                            <span className="font-medium text-foreground">{c.to}</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
