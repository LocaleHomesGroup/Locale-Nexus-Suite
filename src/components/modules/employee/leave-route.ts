"use client";

import * as React from "react";
import { useOrg } from "@/components/modules/hr/org-store";
import { leaveApprover, orgDepartmentOf, type OrgDepartmentId, type OrgPerson } from "@/components/modules/hr/data";
import { useLeave } from "@/components/modules/hr/leave-store";
import { EMPLOYEE_ID } from "./data";

/**
 * Where your leave goes: your department and its head, from HR's live org
 * chart, so a transfer or a new head re-routes requests at once.
 */
export function useLeaveRoute(): { department: OrgDepartmentId; approver: OrgPerson | null } {
  const { people } = useOrg();
  return React.useMemo(
    () => ({ department: orgDepartmentOf(people, EMPLOYEE_ID), approver: leaveApprover(people, EMPLOYEE_ID) }),
    [people],
  );
}

/**
 * Decisions on your requests you haven't looked at yet. The portal has no
 * inbox, so this is how you hear back: a badge on My requests, and the rows
 * marked New when you open it.
 */
export function useLeaveNews(): string[] {
  const { requests, unseen } = useLeave();
  return React.useMemo(
    () => unseen.filter((id) => requests.some((r) => r.id === id && r.seatId === EMPLOYEE_ID)),
    [requests, unseen],
  );
}

/** Requests waiting on the head of your department: what the Approvals badge counts. */
export function useApprovalsWaiting(): number {
  const { requests } = useLeave();
  const { approver } = useLeaveRoute();
  return approver?.name ? requests.filter((r) => r.approver === approver.name && r.status === "Pending").length : 0;
}
