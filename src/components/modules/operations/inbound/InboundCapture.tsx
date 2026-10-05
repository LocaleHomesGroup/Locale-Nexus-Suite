"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { FileUp, MessageSquareText, Radar } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SAMPLE_PORTAL, SAMPLE_UPDATES, type SampleUpdateState } from "./data";

/**
 * Inbound capture and portal polling, as the screen will look — nested under
 * CRM dash sync in the rail, tagged Preview.
 *
 * A mock of the finished screen: an upload area, and the list of proposed
 * updates a builder's file would produce, laid out the way the real one will
 * be. The sample rows are invented and nothing here reads a job. Two short
 * notes carry how it works and what it saves.
 *
 * Nothing on this page does anything. There is no file input, no form and no
 * action. Every control is a real `disabled` control rather than a lookalike,
 * so someone who tries one is told by the browser it isn't available, instead
 * of a click that silently does nothing. Each panel says once that it is a
 * preview — the difference between a roadmap and a bug report.
 */
export function InboundCapture() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inbound capture"
        description="Builders already tell us what has happened, in a weekly file or an email. Bring it straight in, check it, and approve it — instead of typing it out again."
        actions={
          <Pill variant="caps" tone="neutral">
            Coming soon
          </Pill>
        }
      />

      <Reveal index={0}>
        <Card>
          <CardHeader>
            <FileUp className="size-4 text-tone-ink" aria-hidden />
            <CardTitle>Upload a builder update</CardTitle>
            <CardMeta>
              <Pill tone="neutral">Preview of the finished screen</Pill>
            </CardMeta>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-dashed border-border bg-canvas px-5 py-6 dark:bg-white/[0.02]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileUp className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Drop a builder file here</span>
                  <span className="block text-xs text-muted-foreground">A spreadsheet, or the builder&rsquo;s weekly email</span>
                </span>
              </div>
              <Button size="sm" disabled>
                Choose a file
              </Button>
            </div>

            <Prose>
              Launchpad matches each update to a job and shows you the list below. Nothing reaches Monday or HubSpot
              until you approve it.
            </Prose>

            <div className="min-w-0 overflow-hidden rounded-lg border border-hairline">
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead className="pl-4">Job</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {SAMPLE_UPDATES.map((u) => (
                    <TableRow key={`${u.job}-${u.milestone}`}>
                      <TableCell className="pl-4 font-mono text-xs font-semibold">{u.job}</TableCell>
                      <TableCell>{u.client}</TableCell>
                      <TableCell>{u.milestone}</TableCell>
                      <TableCell className="tabular-nums">
                        {u.date ?? <span className="text-xs text-subtle-foreground">Add the builder&rsquo;s date to approve</span>}
                      </TableCell>
                      <TableCell>
                        <StateCell state={u.state} />
                      </TableCell>
                      <TableCell className="pr-4 text-right whitespace-nowrap">
                        {/* A line already recorded has nothing to approve, so the
                            mock doesn't offer it — a mock that offers an action the
                            real screen wouldn't is a review of the wrong screen. */}
                        {u.state === "duplicate" ? (
                          <span className="text-xs text-subtle-foreground">No change needed</span>
                        ) : (
                          <PreviewActions />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Explain>
              <strong className="font-semibold text-foreground">How it will work.</strong> Upload the builder&rsquo;s
              file, or forward their weekly email. Launchpad reads it, matches each line to a job, and lists what
              changed. You approve the ones that are right and dismiss the rest. Approving does exactly what completing
              a milestone does today, so the same checks apply — including asking for the builder&rsquo;s date when the
              file does not carry one.
            </Explain>

            <Prose>
              <strong className="font-semibold text-foreground">What it saves.</strong> A builder&rsquo;s weekly update
              can carry dozens of completed milestones across dozens of jobs. Today each one is read off an email and
              typed in by hand.
            </Prose>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal index={1}>
        <Card>
          <CardHeader>
            <Radar className="size-4 text-tone-ink" aria-hidden />
            <CardTitle>Builder portal updates</CardTitle>
            <CardMeta>
              <Pill tone="neutral">Preview of the finished screen</Pill>
            </CardMeta>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Prose>
              Further out than the upload above, and the same idea without the email: Launchpad checks each
              builder&rsquo;s portal for you and brings back what changed.
            </Prose>

            <div className="min-w-0 overflow-hidden rounded-lg border border-hairline">
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead className="pl-4">Job</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Found in the portal</TableHead>
                    <TableHead>
                      <span className="sr-only">Detail</span>
                    </TableHead>
                    <TableHead className="pr-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {SAMPLE_PORTAL.map((p) => (
                    <TableRow key={`${p.job}-${p.change}`}>
                      <TableCell className="pl-4 font-mono text-xs font-semibold">{p.job}</TableCell>
                      <TableCell>{p.client}</TableCell>
                      <TableCell>{p.change}</TableCell>
                      <TableCell className="text-xs text-subtle-foreground">{p.detail}</TableCell>
                      <TableCell className="pr-4 text-right whitespace-nowrap">
                        <PreviewActions />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Explain>
              <strong className="font-semibold text-foreground">How it will work.</strong> Launchpad checks the portals
              on a schedule and puts anything it finds in your{" "}
              <Link
                href="/operations?tab=review"
                className="rounded-sm font-medium text-tone-ink underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
              >
                review queue
              </Link>{" "}
              — the same one you use now. Nothing it finds is ever applied on its own, including moving a job to
              construction: the portal proposes it, and you confirm it.
            </Explain>

            <Prose>
              <strong className="font-semibold text-foreground">What it saves.</strong> Nobody has to remember to open
              six builder portals to find out what moved this week.
            </Prose>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <Card tone="muted">
          <CardHeader>
            <MessageSquareText className="size-4 text-tone-ink" aria-hidden />
            <CardTitle>Tell us what it needs to do</CardTitle>
          </CardHeader>
          <CardContent>
            <Prose>
              Neither of these is built yet, so nothing above is fixed. If the list is missing a column you would want,
              or the order of it is wrong, send it to Jerry — now is the cheapest time to change it.
            </Prose>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

function StateCell({ state }: { state: SampleUpdateState }) {
  if (state === "needs-date") return <Pill tone="pending">Needs a date</Pill>;
  if (state === "duplicate") return <Pill tone="neutral">Already recorded</Pill>;
  return <Pill tone="ok">Ready to approve</Pill>;
}

/** Real disabled buttons, not drawings of them. */
function PreviewActions() {
  return (
    <span className="inline-flex gap-1.5">
      <Button size="xs" disabled>
        Approve
      </Button>
      <Button size="xs" variant="outline" disabled>
        Dismiss
      </Button>
    </span>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <p className="max-w-[70ch] text-[13px] leading-relaxed text-muted-foreground">{children}</p>;
}

function Explain({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-[70ch] rounded-lg bg-muted px-3.5 py-3 text-xs leading-relaxed text-foreground/85">{children}</p>
  );
}
