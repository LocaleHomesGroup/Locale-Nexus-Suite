import { OperationsSyncProvider } from "@/components/modules/operations/sync/OperationsSyncProvider";

/**
 * Operations keeps one sync engine across the jobs list and each job page, so
 * a sync trail started on the list (a portal update accepted) keeps running —
 * and stays on screen — when you open a job.
 */
export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return <OperationsSyncProvider>{children}</OperationsSyncProvider>;
}
