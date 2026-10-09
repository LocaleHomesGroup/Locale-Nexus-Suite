"use client";

import { CloudOff, Radio } from "lucide-react";
import { asOfLabel } from "@/data/live/as-of";
import { useLiveState } from "@/state/live-data";

/**
 * Says where a live screen's data comes from: "Live from Monday · as of
 * 10:42am", or "as of 11:59pm on Thu 8 Oct" when Monday's last sync wasn't on
 * the day of the read. Adds "read only during the Dash Sync hold" where asked.
 * Shows the error when the database couldn't be read, and nothing with no
 * database.
 */
export function LiveNote({ readOnly = false }: { readOnly?: boolean }) {
  const state = useLiveState();
  if (state.kind === "off") return null;
  if (state.kind === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
        <CloudOff className="size-3.5 shrink-0" aria-hidden />
        {state.message}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-subtle-foreground">
      <Radio className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      Live from Monday · as of {asOfLabel(state.value.asOf, state.value.readAt)}
      {readOnly ? " · read only during the Dash Sync hold" : ""}
    </span>
  );
}
