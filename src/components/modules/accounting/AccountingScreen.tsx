"use client";

import { useTabParam } from "@/hooks/useTabParam";
import { useNavBadge } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { useRun } from "./payrun-store";
import { AccountingOverview } from "./AccountingOverview";
import { PayRun } from "./payrun/PayRun";
import { PayHistory } from "./PayHistory";

const TABS = ["overview", "payrun", "history"] as const;

/**
 * Accounting: where the company accountant pays Locale's offshore team, who
 * invoice from the Employee portal. Simple HRIS's Accounting view with its
 * Payroll Wizard cut down to what an invoice-only payroll needs (the Pay run),
 * and its Reports kept as Pay history.
 *
 * Accounts (builder invoicing, expenses) is the money coming in; this is the
 * staff pay going out.
 */
export function AccountingScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  const { run } = useRun();
  useNavBadge("accounting:payrun", {
    count: run.pending.length,
    tone: "pending",
    label: run.pending.length === 1 ? "invoice to review" : "invoices to review",
  });

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "overview" ? <AccountingOverview /> : tab === "payrun" ? <PayRun /> : <PayHistory />}
      </TabPanels>
    </PageContainer>
  );
}
