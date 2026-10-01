"use client";

import * as React from "react";
import { CircleCheck, Download, FileText, FileX, ListChecks, RefreshCw, ScanText, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Dialog } from "@/components/ui/dialog";
import { Reveal } from "@/components/ui/reveal";
import {
  DEFAULT_TEMPLATE,
  SAMPLE_FILE,
  SHEET_ROWS,
  confidenceOf,
  type Confidence,
  type ExtractedField,
} from "./data";
import type { PickedFile } from "./UploadStep";

/** A quiet wash on the rows that need a person; the chip and input border say why. */
const ROW_TONE: Record<Confidence, string> = {
  high: "",
  check: "bg-amber-50/70 dark:bg-amber-500/10",
  missing: "bg-rose-50/70 dark:bg-rose-500/10",
};

const INPUT_TONE: Record<Confidence, string> = {
  high: "border-hairline",
  check: "border-amber-400 dark:border-amber-500/60",
  missing: "border-rose-400 dark:border-rose-500/60",
};

/** Spreadsheet cell fill for a value that came from the upload. */
const CELL_TONE: Record<Confidence, string> = {
  high: "bg-tone-soft",
  check: "bg-amber-50 dark:bg-amber-500/10",
  missing: "bg-rose-50 dark:bg-rose-500/10",
};

/**
 * New job → review. Every extracted value carries a confidence score; only the
 * amber (check) and rose (not found) rows need a person. Edits update the
 * output preview on the right as you type.
 */
export function ExtractionReview({
  file,
  template,
  fields,
  setFields,
  downloaded,
  onRerun,
  onConfirm,
}: {
  file: PickedFile | null;
  template: string;
  fields: ExtractedField[];
  setFields: React.Dispatch<React.SetStateAction<ExtractedField[]>>;
  downloaded: boolean;
  onRerun: () => void;
  onConfirm: () => void;
}) {
  const [lowConfidenceOpen, setLowConfidenceOpen] = React.useState(false);
  const idBase = React.useId();

  const levels = fields.map(confidenceOf);
  const toCheck = fields.filter((_, i) => levels[i] === "check");
  const checkCount = toCheck.length;
  const missingCount = levels.filter((l) => l === "missing").length;
  const extracted = fields.filter((f) => f.v).length;

  const edit = (k: string, v: string) =>
    setFields((prev) => prev.map((f) => (f.k === k ? { ...f, v, resolved: v.trim().length > 0 } : f)));

  const onConfirmClick = () => {
    if (checkCount > 0) setLowConfidenceOpen(true);
    else onConfirm();
  };

  return (
    <div className="flex flex-col gap-5">
      <Reveal index={0}>
        <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
          <FileText className="size-4 shrink-0 text-tone-ink" aria-hidden />
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] font-semibold">{file ? file.name : SAMPLE_FILE.name}</p>
            <p className="text-xs text-muted-foreground">Uploaded just now · 6 pages · 13 fields detected</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs font-semibold">{template || DEFAULT_TEMPLATE}</p>
            <p className="text-xs text-muted-foreground">Version 3 · active</p>
          </div>
        </Card>
      </Reveal>

      <Reveal index={1}>
        <KpiGrid cols={3}>
          <KpiCard label="Fields extracted" value={`${extracted} / ${fields.length}`} icon={ScanText} />
          <KpiCard
            label="Needs review"
            value={checkCount}
            icon={checkCount > 0 ? TriangleAlert : CircleCheck}
            tone={checkCount > 0 ? "pending" : "ok"}
            pulse={checkCount > 0}
            sub={checkCount > 0 ? "lower confidence · check these" : "all confirmed"}
          />
          <KpiCard
            label="Missing"
            value={missingCount}
            icon={missingCount > 0 ? FileX : CircleCheck}
            tone="ok"
            alert={missingCount > 0}
            pulse={missingCount > 0}
            sub={missingCount > 0 ? "not found in the upload" : "nothing missing"}
          />
        </KpiGrid>
      </Reveal>

      <div className="grid items-start gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Extracted fields */}
        <Reveal index={2} className="min-w-0">
          <Card>
            <CardHeader className="pb-1.5">
              <ListChecks className="size-3.5 text-subtle-foreground" aria-hidden />
              <h2 className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Extracted fields
              </h2>
            </CardHeader>
            <CardContent className="max-h-[520px] overflow-y-auto px-3.5 pb-3.5">
              <div className="flex flex-col gap-1.5">
                {fields.map((f, i) => {
                  const level = levels[i];
                  const id = `${idBase}-${i}`;
                  return (
                    <div key={f.k} className={cn("rounded-md px-2.5 py-2", ROW_TONE[level])}>
                      <div className="mb-1 flex items-center gap-2">
                        <label htmlFor={id} className="min-w-0 flex-1 text-xs text-muted-foreground">
                          {f.k}
                        </label>
                        <ConfidenceChip level={level} c={f.c} />
                      </div>
                      <Input
                        id={id}
                        value={f.v}
                        placeholder={f.k.includes("date") ? "dd/mm/yyyy" : "$0,000"}
                        onChange={(e) => edit(f.k, e.target.value)}
                        aria-invalid={level === "missing" ? true : undefined}
                        className={cn("h-7 text-[13px] tabular-nums", INPUT_TONE[level])}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </Reveal>

        {/* Output preview */}
        <Reveal index={3} className="min-w-0">
          <Card>
            <CardHeader className="pb-0">
              <h2 className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Output preview
              </h2>
              <span className="ml-auto flex items-end gap-0.5 self-end" aria-hidden>
                {["Price list", "Notes"].map((sheet, i) => (
                  <span
                    key={sheet}
                    className={cn(
                      "rounded-t-md border border-b-0 px-2.5 py-1 text-xs",
                      i === 0 ? "border-border bg-muted text-foreground" : "border-transparent text-subtle-foreground",
                    )}
                  >
                    {sheet}
                  </span>
                ))}
              </span>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[420px] table-fixed border-collapse text-xs tabular-nums">
                  <caption className="sr-only">Formatted price list, sheet “Price list”</caption>
                  <colgroup>
                    <col className="w-[28px]" />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="bg-muted text-xs text-subtle-foreground">
                      {["", "A", "B", "C"].map((h, i) => (
                        <th
                          key={h || "corner"}
                          scope="col"
                          className={cn("px-1.5 py-0.5 text-center font-normal", i < 3 && "border-r border-hairline")}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SHEET_ROWS.map((row) => {
                      const level = row.kind === "field" ? levels[row.b] : null;
                      const fill =
                        row.kind === "hdr"
                          ? "bg-charcoal text-silver dark:bg-white/10 dark:text-foreground"
                          : row.kind === "sub"
                            ? "bg-muted font-semibold"
                            : level
                              ? CELL_TONE[level]
                              : "bg-card";
                      const b = row.kind === "field" ? fields[row.b]?.v : row.kind === "sub" ? row.b : "";
                      const c =
                        row.kind === "field" ? (row.c != null ? fields[row.c]?.v : "") : row.kind === "sub" ? row.c : "";
                      return (
                        <tr key={row.n} className="border-t border-hairline">
                          <th
                            scope="row"
                            className="border-r border-hairline bg-muted px-1.5 py-1 text-center text-xs font-normal text-subtle-foreground"
                          >
                            {row.n}
                          </th>
                          <td
                            className={cn(
                              "truncate border-r border-hairline px-2 py-1",
                              fill,
                              row.kind === "hdr" && "text-xs font-semibold tracking-[0.08em]",
                            )}
                            colSpan={row.kind === "hdr" ? 3 : undefined}
                          >
                            {row.a}
                          </td>
                          {row.kind === "hdr" ? null : (
                            <>
                              <td className={cn("truncate border-r border-hairline px-2 py-1", fill)}>{b}</td>
                              <td className={cn("truncate px-2 py-1", fill)}>{c}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-subtle-foreground">
                Highlighted cells are filled from your upload. Edits on the left update here instantly.
              </p>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={onRerun}>
                  <RefreshCw className="size-3.5" aria-hidden /> Re-run extraction
                </Button>
                <Button variant={missingCount > 0 ? "secondary" : "default"} disabled={missingCount > 0} onClick={onConfirmClick}>
                  {missingCount > 0 ? null : <Download className="size-3.5" aria-hidden />}
                  {missingCount > 0
                    ? `${missingCount} field${missingCount > 1 ? "s" : ""} still missing`
                    : downloaded
                      ? "Downloaded"
                      : "Confirm and download"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <Dialog
        open={lowConfidenceOpen}
        onClose={() => setLowConfidenceOpen(false)}
        icon={TriangleAlert}
        iconTone="pending"
        title="Some fields were lower confidence"
        description="These were auto-filled and not confirmed by you:"
        footer={
          <>
            <Button variant="outline" onClick={() => setLowConfidenceOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setLowConfidenceOpen(false);
                onConfirm();
              }}
            >
              <Download className="size-3.5" aria-hidden /> Download anyway
            </Button>
          </>
        }
      >
        <ul>
          {toCheck.map((f) => (
            <li key={f.k} className="border-t border-hairline py-1.5 text-xs first:border-t-0">
              {f.k} · <span className="font-medium text-amber-700 tabular-nums dark:text-amber-300">{f.c}%</span> ·{" "}
              <span className="tabular-nums">{f.v}</span>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}

function ConfidenceChip({ level, c }: { level: Confidence; c: number }) {
  if (level === "high") {
    return (
      <Pill tone="ok" className="px-2 py-px text-xs">
        high
      </Pill>
    );
  }
  return (
    <Pill
      tone={level === "check" ? "pending" : "problem"}
      icon={TriangleAlert}
      className="px-2 py-px text-xs tabular-nums"
    >
      {level === "check" ? `${c}% — check` : "not found"}
    </Pill>
  );
}
