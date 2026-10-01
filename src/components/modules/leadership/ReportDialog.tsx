"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { REPORT_SUMMARY, type Metric } from "./data";
import type { CustomDashboardState } from "./useCustomDashboard";

/**
 * Leadership report — the export preview behind "Generate report". Downloads
 * are simulated: each one lands in Notifications (as the mockup's notify did)
 * and confirms with a toast. The dialog stays open so both formats can be taken.
 */
export function ReportDialog({ state, kpis }: { state: CustomDashboardState; kpis: Metric[] }) {
  const { notify } = useLaunchpad();
  const { reportOpen, setReportOpen, period, selected } = state;

  const download = (format: "Excel" | "PDF") => {
    const msg = `Leadership report downloaded as ${format}`;
    notify(msg, "ok");
    confirm(msg);
  };

  return (
    <Dialog
      open={reportOpen}
      onClose={() => setReportOpen(false)}
      title="Leadership report"
      description={`${period} · generated 7 August 2026 · ${selected.length} metrics`}
      icon={FileText}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => setReportOpen(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={() => download("Excel")}>
            <FileSpreadsheet /> Excel
          </Button>
          <Button onClick={() => download("PDF")}>
            <Download /> Download PDF
          </Button>
        </>
      }
    >
      <div className="rounded-lg border border-haven-300 bg-haven-50 px-3.5 py-3 text-xs leading-relaxed text-foreground dark:border-haven-800 dark:bg-haven-950/40">
        <strong className="font-semibold">Summary.</strong>
        {REPORT_SUMMARY}
      </div>

      {kpis.length > 0 ? (
        <ul className="mt-3">
          {kpis.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-baseline gap-x-2.5 border-t border-hairline py-2 text-xs"
            >
              <span className="text-muted-foreground">{m.label}</span>
              <span className="ml-auto font-semibold tabular-nums">{m.value}</span>
              <span className="text-[11px] text-subtle-foreground tabular-nums">{m.delta}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-[11px] text-subtle-foreground">
        Figures are as at the last sync. Commission values are payable to Locale, not contract value.
      </p>
    </Dialog>
  );
}
