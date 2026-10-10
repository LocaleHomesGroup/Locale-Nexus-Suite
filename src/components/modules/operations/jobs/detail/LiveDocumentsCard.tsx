"use client";

import * as React from "react";
import { FolderOpen } from "lucide-react";
import type { Job } from "@/data/jobs";
import type { LiveFile } from "@/data/live/types";
import { listItemFiles } from "@/server/actions/files";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { FileList } from "@/components/ui/file-list";

/** A live job's files as copied from Monday: the job's own and each milestone's. Read only during the hold. */
export function LiveDocumentsCard({ job }: { job: Job }) {
  // Null while loading. "failed" is a lookup that failed, which is not the same as a job with no files.
  const [files, setFiles] = React.useState<LiveFile[] | "failed" | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listItemFiles(job.id).then(
      (f) => !cancelled && setFiles(f),
      () => !cancelled && setFiles("failed"),
    );
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  return (
    <Card>
      <CardHeader>
        <FolderOpen className="size-4 text-tone-ink" aria-hidden />
        <CardTitle>Documents</CardTitle>
        <CardMeta>{files === null ? "Loading" : files === "failed" ? "Unavailable" : `${files.length} from Monday`}</CardMeta>
        <CardDescription>
          Files on this job and its milestones in Monday, copied into Launchpad. Uploading here waits for the Dash
          Sync go-live.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {files === null ? (
          <p role="status" className="text-xs text-muted-foreground">
            Loading files…
          </p>
        ) : files === "failed" ? (
          <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
            Couldn&apos;t load the files right now. Try again in a moment.
          </p>
        ) : (
          <FileList files={files} empty="No files on this job in Monday." />
        )}
      </CardContent>
    </Card>
  );
}
