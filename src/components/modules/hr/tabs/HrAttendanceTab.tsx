"use client";

import { AlertTriangle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardFooter } from "@/components/ui/card";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { ATTENDANCE, ATTENDANCE_FOOTNOTE, personTone, type AttendanceStatus } from "../data";

/** Status carries a verdict: here is emerald, not yet in is amber, home and leave are neutral information. */
const STATUS_TONE: Record<AttendanceStatus, PillTone> = {
  Present: "ok",
  WFH: "skyblue",
  "On leave": "neutral",
  "Not yet in": "pending",
};

/** HR › Attendance — today's check-ins from Horilla. */
export function HrAttendanceTab() {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="HR"
        title="Attendance"
        description="Today's check-ins from Horilla · validate exceptions before payroll."
      />

      <Reveal index={0}>
        <Card className="min-w-0 overflow-hidden">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                <TableHead className="pl-5">Employee</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead>Check out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead className="pr-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ATTENDANCE.map((r, i) => (
                <motion.tr
                  key={r.name}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.04) }}
                  className="border-b border-hairline transition-colors hover:bg-haven-50/60 dark:hover:bg-haven-950/25"
                >
                  <TableCell className="pl-5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.name} tone={personTone(r.name)} size="sm" />
                      <span className="font-medium whitespace-nowrap">{r.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.checkIn ?? <Dash />}</TableCell>
                  <TableCell className="tabular-nums">{r.checkOut ?? <Dash />}</TableCell>
                  <TableCell className="text-muted-foreground">{r.hours ?? <Dash />}</TableCell>
                  <TableCell className="pr-5">
                    <Pill tone={STATUS_TONE[r.status]} variant="caps">
                      {r.status}
                    </Pill>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
          <CardFooter className="text-[11px] text-muted-foreground">
            <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            {ATTENDANCE_FOOTNOTE}
          </CardFooter>
        </Card>
      </Reveal>
    </div>
  );
}
