"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Circle, ExternalLink, FolderOpen, Upload } from "lucide-react";
import type { Job } from "@/data/jobs";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DOCUMENT_SLOTS } from "../data";

/**
 * Documents — upload slots that rename to the naming convention and file to
 * both systems. Uploading is simulated: the slot fills, the file is named
 * `<job no>_<Slot>.pdf` and the audit log records it.
 */
export function DocumentsCard({ job }: { job: Job }) {
  const { logActivity } = useLaunchpad();
  const reduce = useReducedMotion();
  const [uploaded, setUploaded] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(DOCUMENT_SLOTS.map((d) => [d.slug, d.uploaded])),
  );
  // Only a slot filled just now pops its tick; null on first paint, so server and client agree.
  const [justUploaded, setJustUploaded] = React.useState<string | null>(null);
  // The convention keys on the job number; a job without one files under its HubSpot record ID.
  const prefix = job.jobNo || job.recordId;

  const upload = (label: string, slug: string) => {
    const file = `${prefix}_${slug}.pdf`;
    setUploaded((u) => ({ ...u, [slug]: true }));
    setJustUploaded(slug);
    logActivity(
      "details",
      `${label} uploaded`,
      `Renamed to ${file} · filed to HubSpot and the Monday item`,
      ["Monday", "HubSpot"],
      job.id,
    );
    confirm(`${label} uploaded`, `Renamed to ${file} and filed in HubSpot and Monday`);
  };

  return (
    <Card>
      <CardHeader>
        <FolderOpen className="size-4 text-tone-ink" aria-hidden />
        <CardTitle>Documents</CardTitle>
        <CardMeta>Renamed automatically on upload</CardMeta>
        <CardDescription>
          Drop a file on a slot and it is renamed to the convention and filed in both systems. No manual renaming.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1.5">
          {DOCUMENT_SLOTS.map((d) => {
            const has = uploaded[d.slug];
            const file = `${prefix}_${d.slug}.pdf`;
            return (
              <li
                key={d.slug}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border border-hairline px-3 py-2",
                  has ? "bg-card" : "bg-canvas dark:bg-white/[0.02]",
                )}
              >
                <motion.span
                  key={String(has)}
                  initial={justUploaded === d.slug ? { scale: 0.6 } : false}
                  animate={{ scale: 1 }}
                  transition={{ duration: reduce ? 0 : 0.3, ease: EASE_OUT }}
                  className="flex shrink-0"
                >
                  {has ? (
                    <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-label="Uploaded" />
                  ) : (
                    <Circle className="size-3.5 text-subtle-foreground" aria-label="Not uploaded" />
                  )}
                </motion.span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground">{d.label}</p>
                  <p className="text-xs break-words text-subtle-foreground">
                    {has ? (
                      <span className="font-mono">{file}</span>
                    ) : (
                      <>
                        Not uploaded · will be named <span className="font-mono">{file}</span>
                      </>
                    )}
                  </p>
                </div>
                {!has ? (
                  <Button
                    variant="outline"
                    size="xs"
                    className="text-tone-ink"
                    onClick={() => upload(d.label, d.slug)}
                    aria-label={`Upload ${d.label}`}
                  >
                    <Upload /> Upload
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-2.5 text-xs text-subtle-foreground">
          Slots follow Alison&apos;s naming requirements. Files sync to HubSpot and the Monday item.
        </p>
      </CardContent>
    </Card>
  );
}

/** Open in — jump to the source records. External links are simulated in the prototype. */
export function OpenInCard({ job }: { job: Job }) {
  const open = (system: string, what: string) =>
    confirm(`Opening the ${system} ${what}`, `Record ID ${job.recordId} · opens in a new tab in the live app`);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open in</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-x-5 gap-y-2">
        <Button variant="link" className="h-auto gap-1.5 px-0 text-[13px] font-semibold" onClick={() => open("HubSpot", "deal")}>
          HubSpot deal <ExternalLink className="size-3.5" aria-hidden />
        </Button>
        <Button variant="link" className="h-auto gap-1.5 px-0 text-[13px] font-semibold" onClick={() => open("Monday", "item")}>
          Monday item <ExternalLink className="size-3.5" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}
