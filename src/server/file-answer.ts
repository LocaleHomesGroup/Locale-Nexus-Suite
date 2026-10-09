import type { LiveFile } from "@/data/live/types";

/** What the download route does for one asset: send the browser to its file, or answer with an error. */
export type FileAnswer =
  | { kind: "redirect"; path: string }
  | { kind: "error"; status: 404 | 409 | 410; error: string };

/**
 * What a file that will never be copied answers, by why. Typed on the view's copyError, so a new kind can't compile
 * until it has its text here, and so can't fall through to the 409 "try again" below.
 */
const NEVER_COPIED: Record<NonNullable<LiveFile["copyError"]>, string> = {
  too_large: "This file is too large to copy from Monday (over 50 MB). Open it in Monday.",
  failed: "This file couldn't be copied from Monday. Open it in Monday.",
};

/**
 * Decides the answer from what the database knows about an asset. A copy error comes before the path, so a file that
 * will never copy says so (410) instead of looking like one still on its way (409). The view never gives a path and a
 * copy error together, but if it did, the copy error would win. Pure: the route signs the path and does the redirect.
 */
export function fileAnswer(found: { path: string | null; copyError: LiveFile["copyError"] } | null): FileAnswer {
  if (found === null) return { kind: "error", status: 404, error: "File not found" };
  if (found.copyError) return { kind: "error", status: 410, error: NEVER_COPIED[found.copyError] };
  // Falsy, not just null: an empty path has never been treated as a file that is there.
  if (!found.path) {
    return { kind: "error", status: 409, error: "This file hasn't been copied from Monday yet. Try again in a few minutes." };
  }
  return { kind: "redirect", path: found.path };
}
