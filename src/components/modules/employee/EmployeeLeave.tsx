"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { useTabParam } from "@/hooks/useTabParam";
import { useLaunchpad } from "@/state/launchpad-store";
import { orgDepartment, personTone, upcomingLeave } from "@/components/modules/hr/data";
import { useLeave } from "@/components/modules/hr/leave-store";
import { LeaveQueue } from "@/components/modules/hr/LeaveQueue";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardRow, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { EMPLOYEE_TODAY } from "./data";
import { useLeaveRoute } from "./leave-route";
import { FileLeave } from "./LeaveForm";
import { LeaveHistory } from "./LeaveHistory";

const VIEWS = ["new", "requests", "approvals"] as const;

/**
 * Employee › Leave — HRIS's employee Leave (New request and My requests) as
 * rail items, plus Approvals, where your department's head decides. The
 * prototype has no sign-in, so Approvals previews what the head of your
 * department sees (Jerry Delos Santos for AI & Growth); with roles, only
 * department managers will have it. Filing puts the request in their
 * Approvals and their Launchpad Notifications; the portal has no inbox, so
 * the decision comes back as a badge on My requests and a New row there.
 * Filing a request opens My requests, as HRIS does.
 */
export function EmployeeLeave() {
  const [view, setView, dir] = useTabParam(VIEWS, "new", "view");
  return (
    <TabPanels value={view} dir={dir}>
      {view === "new" ? (
        <FileLeave onFiled={() => setView("requests")} />
      ) : view === "requests" ? (
        <LeaveHistory />
      ) : (
        <LeaveApprovals />
      )}
    </TabPanels>
  );
}

/**
 * Employee › Leave › Approvals — the department head's queue: every request
 * that names them as approver, with the same evidence, undo window and paging
 * as HR › Leave. A decision reaches the requester's My requests, and HR sees
 * it in the Launchpad's Notifications.
 */
function LeaveApprovals() {
  const { notify } = useLaunchpad();
  const { requests } = useLeave();
  const { department, approver } = useLeaveRoute();
  const dept = orgDepartment(department);

  const mine = React.useMemo(
    () => (approver ? requests.filter((r) => r.approver === approver.name) : []),
    [requests, approver],
  );
  const team = new Set(mine.map((r) => r.name));
  const booked = upcomingLeave(requests).filter((a) => team.has(a.name));

  if (!approver) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Approvals" description="Nobody heads your department on the org chart yet, so there's no one to approve leave." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Approvals"
        description={`Leave requests from ${dept.name}, for its head to approve or decline. Whoever filed one sees the decision in their My requests.`}
      />

      <Reveal index={0}>
        <div className="flex items-center gap-3 rounded-xl border border-tone-line bg-tone-soft px-4 py-3">
          <Avatar name={approver.name ?? approver.role} tone={personTone(approver.name ?? "")} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">
              Viewing as {approver.name}
              <span className="font-normal text-muted-foreground"> · {approver.role}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              A preview: once sign-in arrives, only department managers will see Approvals.
            </p>
          </div>
          <Eye className="size-4 shrink-0 text-tone-ink" aria-hidden />
        </div>
      </Reveal>

      <LeaveQueue
        requests={mine}
        by={approver.name ?? approver.role}
        on={EMPLOYEE_TODAY}
        pendingLabel="Awaiting you"
        revealFrom={1}
        onDecided={(r, decision) =>
          notify(
            `${approver.name} ${decision === "Approved" ? "approved" : "declined"} ${r.name}'s ${r.type.toLowerCase()} leave, ${r.when} (Employee portal)`,
          )
        }
      />

      <Reveal index={3}>
        <Card>
          <CardHeader>
            <CardTitle>{dept.name} booked off</CardTitle>
            <CardMeta>{booked.length} upcoming</CardMeta>
          </CardHeader>
          <CardContent>
            {booked.length ? (
              booked.map((a) => (
                <CardRow key={a.name + a.start} className="flex items-center gap-2.5 py-2">
                  <Avatar name={a.name} tone={personTone(a.name)} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {a.type} · {a.when}
                  </span>
                </CardRow>
              ))
            ) : (
              <p className="py-2 text-xs text-muted-foreground">No approved leave coming up.</p>
            )}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
