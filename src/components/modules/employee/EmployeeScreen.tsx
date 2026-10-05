"use client";

import { useTabParam } from "@/hooks/useTabParam";
import { useNavBadge } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { useInvoices } from "./invoice-store";
import { uninvoicedWeeks } from "./parts";
import { EmployeeOverview } from "./EmployeeOverview";
import { EmployeeInvoices } from "./EmployeeInvoices";
import { EmployeeProfile } from "./EmployeeProfile";
import { EmployeeDepartment } from "./EmployeeDepartment";

const TABS = ["overview", "invoices", "profile", "department"] as const;

/**
 * The Employee portal — what a Locale staff member sees of their own work,
 * modelled on Simple HRIS's employee dashboard (Overview, Profile, the team
 * tab named for your department) with its contractor dashboard's invoices,
 * because Locale's offshore team is paid by invoice. KPI Results and MESA
 * aren't here yet.
 *
 * Staff preview it as Jan Kane Reroma, AI Engineer in AI & Growth. Their
 * department is HR's live org chart; their hours, rates and invoices are
 * sample figures until time tracking and Xero are connected.
 */
export function EmployeeScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  const { invoices } = useInvoices();
  const ready = uninvoicedWeeks(invoices).length;
  useNavBadge("employee:invoices", { count: ready, tone: "pending", label: ready === 1 ? "week to invoice" : "weeks to invoice" });

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "overview" ? (
          <EmployeeOverview />
        ) : tab === "invoices" ? (
          <EmployeeInvoices />
        ) : tab === "profile" ? (
          <EmployeeProfile />
        ) : (
          <EmployeeDepartment />
        )}
      </TabPanels>
    </PageContainer>
  );
}
