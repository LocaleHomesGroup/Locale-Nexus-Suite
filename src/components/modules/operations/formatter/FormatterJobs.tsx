"use client";

import { CircleCheck, Clock, Download } from "lucide-react";
import { confirm } from "@/state/launchpad-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FORMATTER_JOBS } from "./data";

/** Doc formatter → Jobs: past formatting runs and their downloads (mockup `dm`, "jobs"). */
export function FormatterJobs() {
  return (
    <Reveal index={0}>
      <Card className="min-w-0 overflow-hidden">
        <Table className="min-w-[640px] text-[13px]">
          <caption className="sr-only">Doc formatter jobs</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
              <TableHead className="pl-4">Source file</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Download</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FORMATTER_JOBS.map((job) => {
              const complete = job.status === "Complete";
              return (
                <TableRow key={job.file}>
                  <TableCell className="pl-4 font-mono text-xs font-semibold">{job.file}</TableCell>
                  <TableCell className="text-muted-foreground">{job.template}</TableCell>
                  <TableCell>
                    <Pill tone={complete ? "ok" : "neutral"} variant="caps" icon={complete ? CircleCheck : Clock}>
                      {job.status}
                    </Pill>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{job.date}</TableCell>
                  <TableCell className="pr-4 text-right">
                    {complete ? (
                      <span className="inline-flex flex-col items-end">
                        <Button
                          variant="outline"
                          size="xs"
                          className="font-semibold text-tone-ink"
                          aria-label={`Download ${job.file}`}
                          onClick={() => confirm("Download started", `${job.file} · ${job.template}`)}
                        >
                          <Download aria-hidden /> Download
                        </Button>
                        <span className="mt-1 text-xs whitespace-nowrap text-subtle-foreground">{job.note}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-subtle-foreground">expired</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </Reveal>
  );
}
