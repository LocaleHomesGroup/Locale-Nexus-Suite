"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Check, FileSpreadsheet, RefreshCw, Upload } from "lucide-react";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { clockStamp } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BULK_FILE, BULK_ROWS } from "./data";

type Phase = "preview" | "running" | "done";
interface BulkStep {
  state: "done" | "pending";
  label: string;
  meta: string;
}

/**
 * The CSV bulk update (mockup `hc`): preview the matched rows, then write both
 * matches to Launchpad → Monday → HubSpot on the prototype's timings. The run
 * goes through the store's `later`, so closing the dialog mid-run ("you can
 * keep working") doesn't stop it; reopening shows where it got to.
 */
export function useBulkUpdate() {
  const { updateJob, logActivity, later } = useLaunchpad();
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("preview");
  const [steps, setSteps] = React.useState<BulkStep[]>([]);

  const openDialog = React.useCallback(() => {
    if (phase !== "running") {
      setPhase("preview");
      setSteps([]);
    }
    setOpen(true);
  }, [phase]);

  const close = React.useCallback(() => setOpen(false), []);

  const finish = React.useCallback(() => {
    setOpen(false);
    setPhase("preview");
    setSteps([]);
  }, []);

  const apply = React.useCallback(() => {
    setPhase("running");
    setSteps([
      { state: "done", label: "2 updates written to Launchpad", meta: clockStamp() },
      { state: "pending", label: "Monday subitems updating", meta: "" },
    ]);
    later(() => {
      setSteps((s) => [
        s[0],
        { state: "done", label: "Monday · 25431 and 25211 subitems set, Date Completed filled", meta: clockStamp() },
        { state: "pending", label: "HubSpot updating", meta: "" },
      ]);
    }, 1200);
    later(() => {
      setSteps((s) => [
        s[0],
        s[1],
        {
          state: "done",
          label: "HubSpot · date properties set, stages → Practical Completion, Plate Height",
          meta: clockStamp(),
        },
      ]);
      updateJob(1, (j) => ({
        hsStage: "Practical Completion",
        lastSource: "CSV import, just now",
        milestones: j.milestones.map((m) =>
          m.name === "Practical Completion" ? { ...m, status: "done", date: "04 Aug 2026" } : m,
        ),
      }));
      updateJob(2, (j) => ({
        hsStage: "Plate Height",
        lastSource: "CSV import, just now",
        milestones: j.milestones.map((m) => (m.name === "Plate Height" ? { ...m, status: "done", date: "01 Aug 2026" } : m)),
      }));
      logActivity("import", "Bulk update applied", `2 rows matched by job number, 1 skipped · ${BULK_FILE}`, [
        "Monday",
        "HubSpot",
      ]);
      setPhase("done");
      confirm("2 updates synced · 1 skipped row reported");
    }, 2400);
  }, [later, logActivity, updateJob]);

  return { open, phase, steps, openDialog, close, finish, apply };
}

export type BulkUpdate = ReturnType<typeof useBulkUpdate>;

export function BulkUpdateDialog({ bulk }: { bulk: BulkUpdate }) {
  const reduce = useReducedMotion();
  const { open, phase, steps, close, finish, apply } = bulk;

  return (
    <Dialog
      open={open}
      onClose={phase === "done" ? finish : close}
      size="lg"
      icon={FileSpreadsheet}
      title="Bulk update"
      description="Upload a CSV or paste rows from an email · matched by job number"
      footer={
        phase === "preview" ? (
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={apply}>Apply 2 updates</Button>
          </>
        ) : phase === "running" ? (
          <p className="mr-auto py-1.5 text-xs text-muted-foreground">
            Syncing — you can keep working, this finishes on its own…
          </p>
        ) : (
          <Button onClick={finish}>Done</Button>
        )
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="rounded-xl border-[1.5px] border-dashed border-border px-4 py-4 text-center">
          <p className="text-[13px]">
            <Upload className="mr-1 inline size-3.5 -translate-y-px text-muted-foreground" aria-hidden />
            Drop a CSV here, or <span className="font-semibold text-haven-700 dark:text-haven-300">browse</span>
          </p>
          <p className="mt-1 text-[11px] text-subtle-foreground">
            Columns: job number, milestone, builder date · template available
          </p>
        </div>

        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-semibold">
            Preview · <span className="font-mono text-[11px] font-medium">{BULK_FILE}</span>
          </p>
          <div className="overflow-hidden rounded-lg border border-hairline">
            <Table className="text-xs">
              <TableHeader>
                <tr>
                  <TableHead className="h-8">Job no</TableHead>
                  <TableHead className="h-8">Milestone</TableHead>
                  <TableHead className="h-8">Builder date</TableHead>
                  <TableHead className="h-8">Match</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {BULK_ROWS.map((r) => (
                  <TableRow key={r.jobNo} className="hover:bg-transparent dark:hover:bg-transparent">
                    <TableCell className="py-2 font-mono text-[11px] font-semibold">{r.jobNo}</TableCell>
                    <TableCell className="py-2">{r.milestone}</TableCell>
                    <TableCell className="py-2 whitespace-nowrap tabular-nums">{r.date}</TableCell>
                    <TableCell className="py-2">
                      {r.match === "ok" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                          <Check className="size-3.5" aria-hidden /> Matched
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> No job found — will be skipped
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {phase === "preview" ? (
          <p className="rounded-lg bg-skyblue-100 px-3 py-2.5 text-xs leading-relaxed text-skyblue-950 dark:bg-skyblue-950/50 dark:text-skyblue-100">
            2 of 3 rows ready. Applying writes each update to Launchpad, then Monday and HubSpot — every row appears in
            the sync trail. Skipped rows are reported for follow-up.
          </p>
        ) : (
          <div className="rounded-lg bg-canvas px-3.5 py-2.5 dark:bg-white/[0.03]" aria-live="polite">
            <ul>
              {steps.map((s, i) => (
                <motion.li
                  key={`${i}-${s.state}`}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
                  className="flex items-center gap-2 py-1 text-[12.5px]"
                >
                  {s.state === "done" ? (
                    <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Done" />
                  ) : (
                    <RefreshCw
                      className="size-3.5 shrink-0 animate-spin text-amber-600 motion-reduce:animate-none dark:text-amber-400"
                      aria-label="In progress"
                    />
                  )}
                  <span className="min-w-0 flex-1">{s.label}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-subtle-foreground tabular-nums">{s.meta}</span>
                </motion.li>
              ))}
            </ul>
            {phase === "done" ? (
              <motion.p
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
                className="mt-1.5 flex items-center gap-2 border-t border-hairline pt-2 text-[12.5px] font-semibold text-haven-700 dark:text-haven-300"
              >
                <Check className="size-3.5" aria-hidden /> 2 updates synced · 1 skipped row reported to sync health
              </motion.p>
            ) : null}
          </div>
        )}
      </div>
    </Dialog>
  );
}
