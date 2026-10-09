"use server";

import type { LiveFile } from "@/data/live/types";
import { getDb } from "@/server/db/postgres";
import { loadItemFiles } from "@/server/read/files";

/** The files on a Monday job or lot, for the job page and Exclusive Land's "Plans and files". */
export async function listItemFiles(itemId: number): Promise<LiveFile[]> {
  if (!Number.isSafeInteger(itemId) || itemId <= 0) return [];
  const db = getDb();
  if (!db) return [];
  return loadItemFiles(db, itemId);
}
