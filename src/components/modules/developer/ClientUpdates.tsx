"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, LoaderCircle, Send } from "lucide-react";
import { DURATION, EASE_OUT, rowDelay } from "@/lib/motion";
import { undoable } from "@/lib/undoable";
import { CONSTRUCTION_MILESTONES } from "@/data/jobs";
import { CLIENT_JOB_ID, DEVELOPER } from "@/data/portal";
import { usePortal } from "@/state/portal-store";
import { useDashboardSwitch } from "@/components/shell/dashboard-switch";
import { hrefForKey } from "@/components/shell/dashboards";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { SmoothSelect } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { useDeveloperJobs } from "./parts";

const PHOTO_COUNTS = ["0", "1", "2", "3", "4", "6"] as const;
type PhotoCount = (typeof PHOTO_COUNTS)[number];

/**
 * Developer › Client updates — "trying to communicate through that process".
 * Once a client is on site the builder posts a site update here and it lands
 * in the client's portal (My build and Messages) with Locale copied, instead
 * of the consultant chasing the builder for news to pass on. Sending waits out
 * the usual undo window, like every write that leaves the sender's hands.
 */
export function ClientUpdates() {
  const reduce = useReducedMotion();
  const params = useSearchParams();
  const { navigate } = useDashboardSwitch();
  const { updates, postUpdate } = usePortal();
  // Clients with a build under way: those are the ones with site news to send.
  const onSite = useDeveloperJobs().filter((d) => d.job.milestones.length > 0);
  const asked = Number(params.get("job"));
  const [jobId, setJobId] = React.useState(() =>
    String(onSite.find((d) => d.job.id === asked)?.job.id ?? onSite[0]?.job.id ?? ""),
  );
  const target = onSite.find((d) => String(d.job.id) === jobId);
  const defaultMilestone = (id: string) => {
    const j = onSite.find((d) => String(d.job.id) === id)?.job;
    const reached = j?.milestones.filter((m) => m.status === "done") ?? [];
    return reached[reached.length - 1]?.name ?? CONSTRUCTION_MILESTONES[0];
  };
  const [milestone, setMilestone] = React.useState<string>(() => defaultMilestone(jobId));
  const [note, setNote] = React.useState("");
  const [photos, setPhotos] = React.useState<PhotoCount>("3");
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const sent = updates.filter((u) => u.builder === DEVELOPER);
  const clientOf = (id: number) => onSite.find((d) => d.job.id === id)?.job.client ?? "A Locale client";

  const onJob = (id: string) => {
    setJobId(id);
    setMilestone(defaultMilestone(id));
  };

  const send = () => {
    if (!target || sending) return;
    if (note.trim().length < 10) {
      setError("Tell your client what happened on site: a sentence or two.");
      document.getElementById("update-note")?.focus();
      return;
    }
    setError(null);
    setSending(true);
    const update = {
      jobId: target.job.id,
      builder: DEVELOPER,
      client: target.job.client,
      milestone,
      note: note.trim(),
      photos: Number(photos),
    };
    undoable({
      message: `Sending ${target.job.client} a ${milestone} update`,
      description: `To their Client portal${update.photos ? ` with ${update.photos} photos` : ""} · Locale copied`,
      commit: () => {
        postUpdate(update);
        setSending(false);
        setNote("");
      },
      undo: () => setSending(false),
      done: { message: "Update sent", description: `${target.job.client} has it in their Client portal` },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Client updates"
        description="Send your Locale clients a site update. It lands in their Client portal straight away, with their consultant and Locale Operations copied."
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Reveal index={0} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>New site update</CardTitle>
              <CardDescription>For clients with a build under way.</CardDescription>
            </CardHeader>
            {onSite.length === 0 ? (
              <CardContent>
                <EmptyState
                  title="No clients on site yet"
                  description="Updates open up once a Locale client's build has started."
                />
              </CardContent>
            ) : (
              <>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Client" htmlFor="update-client">
                      <SmoothSelect
                        id="update-client"
                        value={jobId}
                        onChange={onJob}
                        options={onSite.map((d) => ({
                          value: String(d.job.id),
                          label: d.job.client,
                          hint: `${d.lot.design} · ${d.lot.suburb}`,
                        }))}
                      />
                    </Field>
                    <Field label="Milestone" htmlFor="update-milestone">
                      <SmoothSelect
                        id="update-milestone"
                        value={milestone}
                        onChange={setMilestone}
                        options={CONSTRUCTION_MILESTONES.map((m) => ({ value: m, label: m }))}
                      />
                    </Field>
                  </div>
                  <Field label="What happened on site" htmlFor="update-note">
                    <Textarea
                      id="update-note"
                      rows={4}
                      maxLength={500}
                      placeholder="Plastering is finished and the kitchen goes in next week."
                      value={note}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? "update-note-error" : undefined}
                      onChange={(e) => {
                        setNote(e.target.value);
                        if (error) setError(null);
                      }}
                    />
                  </Field>
                  {error ? (
                    <p id="update-note-error" role="alert" className="-mt-2 text-xs text-rose-700 dark:text-rose-300">
                      {error}
                    </p>
                  ) : null}
                  <Field
                    label="Site photos"
                    htmlFor="update-photos"
                    hint="Photos attach from your site app; the prototype counts them."
                  >
                    <SmoothSelect
                      id="update-photos"
                      value={photos}
                      onChange={setPhotos}
                      options={PHOTO_COUNTS.map((n) => ({ value: n, label: n === "0" ? "No photos" : `${n} photos` }))}
                    />
                  </Field>
                </CardContent>
                <CardFooter className="flex-wrap justify-end">
                  {target?.job.id === CLIENT_JOB_ID ? (
                    <Button variant="ghost" className="mr-auto" onClick={() => navigate(hrefForKey("client:build"))}>
                      Preview their Client portal <ArrowUpRight aria-hidden />
                    </Button>
                  ) : null}
                  <Button onClick={send} disabled={sending} aria-busy={sending || undefined}>
                    {sending ? (
                      <>
                        <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden /> Sending…
                      </>
                    ) : (
                      <>
                        <Send aria-hidden /> Send update
                      </>
                    )}
                  </Button>
                </CardFooter>
              </>
            )}
          </Card>
        </Reveal>

        <Reveal index={1} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Sent updates</CardTitle>
              <CardMeta>{sent.length}</CardMeta>
            </CardHeader>
            <CardContent>
              <ul>
                <AnimatePresence initial={false}>
                  {sent.map((u, i) => (
                    <motion.li
                      key={u.id}
                      layout="position"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
                      className="border-t border-hairline py-3 first:border-t-0 first:pt-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium">{clientOf(u.jobId)}</span>
                        <Pill tone="tone">{u.milestone}</Pill>
                        {u.fresh ? <Pill tone="ok">Just sent</Pill> : null}
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{u.when}</span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{u.note}</p>
                      {u.photos ? <p className="mt-1 text-xs text-subtle-foreground">{u.photos} photos</p> : null}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
