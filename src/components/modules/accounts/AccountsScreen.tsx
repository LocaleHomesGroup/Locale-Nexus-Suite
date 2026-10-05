"use client";

import * as React from "react";
import { toast } from "sonner";
import { aud } from "@/lib/utils";
import { useTabParam } from "@/hooks/useTabParam";
import { useLaunchpad } from "@/state/launchpad-store";
import { useNavBadge } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { invoicedThisMonth } from "./data";
import { InvoicingTab } from "./InvoicingTab";
import { ReportsTab } from "./ReportsTab";
import { ExpensesTab } from "./ExpensesTab";
import { AccountsOverview } from "./AccountsOverview";

const TABS = ["overview", "invoicing", "reports", "expenses"] as const;

/**
 * Accounts — the mockup's `hm` (app.js 10098–10855): an Overview (the default),
 * Builder invoicing, Reports and Expenses, kept in `?tab=` so Home's "3 draft invoices" and
 * "2 expense claims" shortcuts land on the right tab.
 *
 * Invoices and claims live in the shared Launchpad store, so an approval here
 * is what Home's My day and Jarvis read, and it survives leaving Accounts.
 *
 * Approving an invoice or deciding a claim is an external write (Xero, the
 * builder's inbox, the claimant), so it waits out an undo window first: the
 * row says "Sending" / "Approving…", the toast offers Undo, and only when the
 * window closes does the status change.
 */
export function AccountsScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  const { invoices, sendingInvoices, approveInvoices, claims, decidingClaims, decideClaim } = useLaunchpad();

  // An item inside its undo window is still waiting: nothing has been sent yet.
  const drafts = invoices.filter((i) => i.status === "Draft").length;
  const waiting = claims.filter((c) => c.status === "Awaiting approval").length;

  // Waiting counts on the Accounts rail (amber: each is waiting on a decision).
  useNavBadge("accounts:invoicing", { count: drafts, tone: "pending", label: "drafts awaiting approval" });
  useNavBadge("accounts:expenses", { count: waiting, tone: "pending", label: "claims awaiting approval" });

  const approveInvoice = React.useCallback((id: string) => approveInvoices([id]), [approveInvoices]);

  const openInXero = React.useCallback(
    (id: string) => {
      const inv = invoices.find((i) => i.id === id);
      if (!inv) return;
      toast(`${inv.id} opened in Xero`, {
        description: `${inv.status} · ${inv.builder} · ${inv.stage} · ${aud(inv.amount)} + GST`,
      });
    },
    [invoices],
  );

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "overview" ? (
          <AccountsOverview />
        ) : tab === "invoicing" ? (
          <InvoicingTab
            invoices={invoices}
            sending={sendingInvoices}
            invoicedThisMonth={invoicedThisMonth(invoices)}
            onApprove={approveInvoice}
            onApproveMany={approveInvoices}
            onOpenInXero={openInXero}
          />
        ) : tab === "reports" ? (
          <ReportsTab />
        ) : (
          <ExpensesTab claims={claims} deciding={decidingClaims} onDecide={decideClaim} />
        )}
      </TabPanels>
    </PageContainer>
  );
}
