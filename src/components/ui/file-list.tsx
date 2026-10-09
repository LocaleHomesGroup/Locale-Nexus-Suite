"use client";

import { Download, FileText, Hourglass, TriangleAlert } from "lucide-react";
import type { LiveFile } from "@/data/live/types";
import { Reveal } from "@/components/ui/reveal";
import { formatFileSize } from "@/lib/file-size";

/** What the list says about a file that will never be copied. Typed on the view's copyError, so a new kind needs wording here. */
const COPY_PROBLEM: Record<NonNullable<LiveFile["copyError"]>, string> = {
  too_large: "Too large to copy (over 50 MB)",
  failed: "Couldn't be copied",
};

/**
 * Files copied from Monday. A file still being copied says so on the right, as "Open" does. One that will never be
 * copied says why on a line under its name instead: that wording is too long to share the row with the name, and on
 * the right it left the name almost no width.
 */
export function FileList({ files, empty }: { files: LiveFile[]; empty: string }) {
  if (files.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {files.map((f, i) => {
        // A ready file never shows a problem.
        const problem = !f.ready && f.copyError ? COPY_PROBLEM[f.copyError] : null;
        return (
          <Reveal
            as="li"
            key={f.assetId}
            index={i}
            className="flex items-center gap-2.5 rounded-lg border border-hairline bg-card px-3 py-2"
          >
            <FileText className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-foreground" title={f.name}>{f.name}</p>
              <p className="text-xs text-subtle-foreground">{[f.milestone, formatFileSize(f.size)].filter(Boolean).join(" · ")}</p>
              {problem ? (
                <p className="mt-0.5 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden /> {problem}
                </p>
              ) : null}
            </div>
            {f.ready ? (
              <a
                href={`/api/files/monday/${f.assetId}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${f.name} in a new tab`}
                className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-tone-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45"
              >
                <Download className="size-3.5" aria-hidden /> Open
              </a>
            ) : problem ? null : (
              <span className="inline-flex items-center gap-1 text-xs text-subtle-foreground">
                <Hourglass className="size-3.5" aria-hidden /> Copying
              </span>
            )}
          </Reveal>
        );
      })}
    </ul>
  );
}
