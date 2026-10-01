import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import type { SyncState } from "@/data/jobs";
import { cn } from "@/lib/utils";

/**
 * A job's mirror state across HubSpot and Monday. "Syncing" spins (stops under
 * reduced motion — the word still says it); "Conflict" needs a human.
 */
export function SyncBadge({ sync, className }: { sync: SyncState; className?: string }) {
  if (sync === "ok") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300", className)}>
        <Check className="size-3" aria-hidden /> HS · Mon
      </span>
    );
  }
  if (sync === "pending") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300", className)}>
        <RefreshCw className="size-3 animate-spin motion-reduce:animate-none" aria-hidden /> Syncing
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-rose-700 dark:text-rose-300", className)}>
      <AlertTriangle className="size-3" aria-hidden /> Conflict
    </span>
  );
}
