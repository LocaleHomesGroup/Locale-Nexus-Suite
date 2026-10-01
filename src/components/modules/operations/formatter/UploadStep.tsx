"use client";

import * as React from "react";
import { Check, Circle, FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { OUTPUT_TEMPLATES, SAMPLE_FILE } from "./data";

export interface PickedFile {
  name: string;
  size: string;
}

/**
 * New job → upload. The drop zone is simulated: clicking it (or dropping any
 * file on it) picks the sample Forma price list; clicking again removes it.
 */
export function UploadStep({
  file,
  setFile,
  template,
  setTemplate,
  onStart,
}: {
  file: PickedFile | null;
  setFile: (f: PickedFile | null) => void;
  template: string;
  setTemplate: (t: string) => void;
  onStart: () => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const ready = Boolean(file && template);
  const labelId = React.useId();

  return (
    <Card className="w-full px-5 py-6 sm:px-7">
      <button
        type="button"
        onClick={() => setFile(file ? null : { ...SAMPLE_FILE })}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          setFile({ ...SAMPLE_FILE });
        }}
        aria-label={file ? `${file.name}, ${file.size}. Click to remove` : "Choose a file to format"}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center rounded-xl border-[1.5px] border-dashed px-5 py-7 text-center transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
          file || dragging
            ? "border-haven-400 bg-haven-50 dark:border-haven-600 dark:bg-haven-950/40"
            : "border-border bg-canvas hover:border-haven-300 hover:bg-haven-50/50 dark:bg-white/[0.02] dark:hover:border-haven-800 dark:hover:bg-haven-950/25",
        )}
      >
        {file ? (
          <>
            <FileText className="size-6.5 text-haven-700 dark:text-haven-300" aria-hidden />
            <span className="mt-2 font-mono text-[13px] font-semibold">{file.name}</span>
            <span className="mt-0.5 text-[11.5px] text-muted-foreground">{file.size} · click to remove</span>
          </>
        ) : (
          <>
            <Upload className="size-6.5 text-muted-foreground" aria-hidden />
            <span className="mt-2 text-[13px]">
              Drop a file here, or{" "}
              <span className="font-semibold text-haven-700 underline-offset-2 hover:underline dark:text-haven-300">
                browse
              </span>
            </span>
            <span className="mt-0.5 text-[11.5px] text-subtle-foreground">PDF, XLSX, XLS or CSV · up to 25 MB</span>
          </>
        )}
      </button>

      <p id={labelId} className="mt-5 mb-2 text-xs font-semibold">
        Output template
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
        {OUTPUT_TEMPLATES.map((t) => {
          const on = template === t.name;
          return (
            <button
              key={t.name}
              type="button"
              aria-pressed={on}
              onClick={() => setTemplate(t.name)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                on
                  ? "border-haven-300 bg-haven-50 dark:border-haven-800 dark:bg-haven-950/40"
                  : "border-hairline bg-card hover:border-haven-300 dark:hover:border-haven-800",
              )}
            >
              {on ? (
                <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : (
                <Circle className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
              )}
              <span className="min-w-0 flex-1 text-[12.5px]">{t.name}</span>
              <Pill tone={t.brand === "Wealth" ? "skyblue" : "haven"} className="px-2 py-px text-[11px]">
                {t.brand}
              </Pill>
            </button>
          );
        })}
      </div>

      <Button variant={ready ? "default" : "secondary"} size="lg" className="mt-4 w-full" disabled={!ready} onClick={onStart}>
        {ready ? "Start" : "Choose a file and template to start"}
      </Button>
    </Card>
  );
}
