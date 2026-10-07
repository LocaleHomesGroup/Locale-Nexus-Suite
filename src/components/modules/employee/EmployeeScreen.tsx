"use client";

import { useTabParam } from "@/hooks/useTabParam";
import { useNavBadge } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { useInvoices } from "./invoice-store";
import { uninvoicedWeeks } from "./parts";
import { useApprovalsWaiting, useLeaveNews } from "./leave-route";
import { EmployeeOverview } from "./EmployeeOverview";
import { EmployeeInvoices } from "./EmployeeInvoices";
import { EmployeeLeave } from "./EmployeeLeave";
import { EmployeeProfile } from "./EmployeeProfile";
import { EmployeeDepartment } from "./EmployeeDepartment";

const TABS = ["overview", "invoices", "leave", "profile", "department"] as const;

/**
 * The Employee portal — what a Locale staff member sees of their own work,
 * modelled on Simple HRIS's employee dashboard (Overview, Leave, Profile, the
 * team tab named for your department) with its contractor dashboard's
 * invoices, because Locale's offshore team is paid by invoice. KPI Results
 * and MESA aren't here yet.
 *
 * Staff preview it as Jan Kane Reroma, AI Engineer in AI & Growth. Their
 * department is HR's live org chart; their hours, rates, invoices and leave
 * balances are sample figures until time tracking, Xero and Horilla are
 * connected. Leave › Approvals previews the department head's queue.
 */
export function EmployeeScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  const { invoices } = useInvoices();
  const ready = uninvoicedWeeks(invoices).length;
  useNavBadge("employee:invoices", { count: ready, tone: "pending", label: ready === 1 ? "week to invoice" : "weeks to invoice" });
  // Leave on the rail: amber for requests waiting on your department head,
  // grey for decisions on your own requests you haven't seen. Leave sums both.
  const waiting = useApprovalsWaiting();
  const news = useLeaveNews().length;
  useNavBadge("employee:leave:approvals", {
    count: waiting,
    tone: "pending",
    label: waiting === 1 ? "leave request to approve" : "leave requests to approve",
  });
  useNavBadge("employee:leave:requests", { count: news, tone: "neutral", label: news === 1 ? "decision back" : "decisions back" });
  useNavBadge("employee:leave", {
    count: waiting + news,
    tone: waiting ? "pending" : "neutral",
    label: "leave to approve or decisions back",
  });

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "overview" ? (
          <EmployeeOverview />
        ) : tab === "invoices" ? (
          <EmployeeInvoices />
        ) : tab === "leave" ? (
          <EmployeeLeave />
        ) : tab === "profile" ? (
          <EmployeeProfile />
        ) : (
          <EmployeeDepartment />
        )}
      </TabPanels>
    </PageContainer>
  );
}
