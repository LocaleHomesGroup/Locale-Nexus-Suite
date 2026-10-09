import type { MondayClient } from "./client";

/**
 * A MondayClient whose answers come from `handler`. Tests only. Write handlers
 * that look at the document's root field ("items_page", "activity_logs", ...).
 */
export function fakeMonday(
  handler: (document: string, variables: Record<string, unknown>) => unknown,
): MondayClient & { documents: string[] } {
  const stats: MondayClient["stats"] = { calls: 0, complexity: 0, lastComplexity: null };
  const documents: string[] = [];
  return {
    stats,
    documents,
    async query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
      stats.calls += 1;
      documents.push(document);
      return handler(document, variables) as T;
    },
  };
}
