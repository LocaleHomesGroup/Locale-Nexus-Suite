"use client";

import { useLaunchpad } from "@/state/launchpad-store";
import { isChangesRequested } from "../sales/submissions/data";
import { useLocalSubmissions } from "../sales/submissions/local-submissions";

/** Submissions in My Deal Submissions that Ops sent back: the shared Nguyen submission and any the rep started. */
export function useChangesRequested(): number {
  const { submissionStatus } = useLaunchpad();
  const local = useLocalSubmissions();
  return [submissionStatus, ...local.map((s) => s.status)].filter(isChangesRequested).length;
}
