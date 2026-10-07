"use client";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardRow, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { LEAVE_BALANCES, personTone, upcomingLeave } from "../data";
import { useLeave } from "../leave-store";
import { LeaveQueue } from "../LeaveQueue";

/**
 * HR › Leave — the approval queue Home's My day and "Leave request" shortcut
 * land on. It holds everyone's requests, including those filed in the
 * Employee portal, which name the department head who decides them; HR can
 * decide them too, as HRIS's HR dashboard can. The queue (`LeaveQueue`) is
 * shared with a department manager's Employee › Leave › Approvals. Upcoming
 * booked leave and the approver's own balances sit below it.
 */
export function HrLeaveTab() {
  const { requests } = useLeave();
  const booked = upcomingLeave(requests);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leave"
        description="Approvals here update Horilla and Xero automatically via the live leave workflow."
      />

      <LeaveQueue requests={requests} by="HR" showApprover />

      <div className="grid items-start gap-5 md:grid-cols-2">
        <Reveal index={2}>
          <Card>
            <CardHeader>
              <CardTitle>Team leave booked</CardTitle>
              <CardMeta>{booked.length} upcoming</CardMeta>
            </CardHeader>
            <CardContent>
              {booked.map((a) => (
                <CardRow key={a.name + a.start} className="flex items-center gap-2.5 py-2">
                  <Avatar name={a.name} tone={personTone(a.name)} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {a.type} · {a.when}
                  </span>
                </CardRow>
              ))}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={3}>
          <Card>
            <CardHeader>
              <CardTitle>Your balances</CardTitle>
              <CardMeta>Shannan Hart</CardMeta>
            </CardHeader>
            <CardContent>
              {LEAVE_BALANCES.map((b) => (
                <CardRow key={b.label} className="flex items-baseline py-2 text-xs">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span
                    className={cn(
                      "ml-auto font-semibold tabular-nums",
                      b.value === "accruing" && "font-medium text-subtle-foreground",
                    )}
                  >
                    {b.value}
                  </span>
                </CardRow>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
