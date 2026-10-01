"use client";

import * as React from "react";
import { toast } from "sonner";
import { aud } from "@/lib/utils";
import { useTabParam } from "@/hooks/useTabParam";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { useNavBadge } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { INVOICED_THIS_MONTH, SEED_CLAIMS, SEED_INVOICES, type BuilderInvoice, type ExpenseClaim } from "./data";
import { InvoicingTab } from "./InvoicingTab";
import { ReportsTab } from "./ReportsTab";
import { ExpensesTab, cents } from "./ExpensesTab";

const TABS = ["invoicing", "reports", "expenses"] as const;

/**
 * Accounts — the mockup's `hm` (app.js 10098–10855): Builder invoicing (default),
 * Reports and Expenses, kept in `?tab=` so Home's "3 draft invoices" and
 * "2 expense claims" shortcuts land on the right tab.
 *
 * Invoices and claims live here, not in the tabs, so an approval survives a tab
 * switch (the mockup held them in the module root too). Leaving Accounts resets
 * them — they are module-private, like the mockup's.
 */
export function AccountsScreen() {
  const [tab, , dir] = useTabParam(TABS, "invoicing");
  const { notify } = useLaunchpad();
  const [invoices, setInvoices] = React.useState<BuilderInvoice[]>(SEED_INVOICES);
  const [claims, setClaims] = React.useState<ExpenseClaim[]>(SEED_CLAIMS);

  const drafts = invoices.filter((i) => i.status === "Draft").length;
  const waiting = claims.filter((c) => c.status === "Awaiting approval").length;
  const invoicedThisMonth =
    INVOICED_THIS_MONTH + invoices.filter((i) => i.approvedNow).reduce((sum, i) => sum + i.amount, 0);

  // Waiting counts on the Accounts rail (amber: each is waiting on a decision).
  useNavBadge("accounts:invoicing", { count: drafts, tone: "pending", label: "drafts awaiting approval" });
  useNavBadge("accounts:expenses", { count: waiting, tone: "pending", label: "claims awaiting approval" });

  const approveInvoice = React.useCallback(
    (id: string) => {
      const inv = invoices.find((i) => i.id === id);
      if (!inv || inv.status !== "Draft") return;
      setInvoices((prev) => prev.map((u) => (u.id === id ? { ...u, status: "Approved", approvedNow: true } : u)));
      confirm(
        "Invoice approved in Xero and sent to the builder",
        `${inv.job} · ${inv.builder} · ${inv.stage} · ${aud(inv.amount)} + GST`,
      );
      notify(`Invoice approved — ${inv.job} ${inv.stage}`);
    },
    [invoices, notify],
  );

  const openInXero = React.useCallback(
    (id: string) => {
      const inv = invoices.find((i) => i.id === id);
      if (!inv) return;
      toast(`${inv.id} opened in Xero`, {
        description: `Draft for ${inv.builder} · ${inv.stage} · ${aud(inv.amount)} + GST`,
      });
    },
    [invoices],
  );

  const decideClaim = React.useCallback(
    (claim: string, decision: "Approved" | "Declined") => {
      const c = claims.find((x) => x.claim === claim);
      if (!c || c.status !== "Awaiting approval") return;
      setClaims((prev) => prev.map((x) => (x.claim === claim ? { ...x, status: decision } : x)));
      if (decision === "Approved") {
        confirm("Expense claim approved", `${c.claim} · ${c.staff} · ${cents(c.amount)} · coded ${c.code} · ${c.account} in Xero`);
      } else {
        toast("Expense claim declined", { description: `${c.claim} · ${c.staff} · ${cents(c.amount)}` });
      }
    },
    [claims],
  );

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "invoicing" ? (
          <InvoicingTab
            invoices={invoices}
            invoicedThisMonth={invoicedThisMonth}
            onApprove={approveInvoice}
            onOpenInXero={openInXero}
          />
        ) : tab === "reports" ? (
          <ReportsTab />
        ) : (
          <ExpensesTab claims={claims} onDecide={decideClaim} />
        )}
      </TabPanels>
    </PageContainer>
  );
}
