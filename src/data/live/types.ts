import type { Job } from "@/data/jobs";

/**
 * What the live screens read when a database is connected. Built on the server
 * (src/server/read/), passed to the browser through LiveDataProvider. With no
 * database there is no LiveData and every screen keeps its sample data.
 */
export interface RepOption {
  id: string;
  name: string;
}

export interface LiveHold {
  id: string;
  staffId: string;
  name: string;
  client: string | null;
  note: string | null;
  queuedAt: string;
  /** Set on the lot's active hold; null while queued. */
  startedAt: string | null;
  expiresAt: string | null;
}

export interface LiveLot {
  id: string;
  lot: string;
  estate: string | null;
  developer: string | null;
  /** Null: any builder. */
  builder: string | null;
  landPrice: number | null;
  packagePrice: number | null;
  design: string | null;
  areaSqm: number | null;
  frontageM: number | null;
  zoning: string | null;
  titleStatus: "titled" | "untitled" | "delayed" | null;
  titleEta: string | null;
  rebate: string | null;
  saleStatus: "available" | "sold";
  soldBy: string | null;
  soldClient: string | null;
  mondayItemId: number | null;
  removedFromMonday: boolean;
  /** Open holds: the active one first, then the queue in order. */
  holds: LiveHold[];
}

export interface LiveFile {
  assetId: number;
  name: string;
  size: number | null;
  /** Copied into Storage and ready to open. */
  ready: boolean;
  /** Why it will never be copied: over 50 MiB, or it failed three times. Null while ready or still copying. */
  copyError: "too_large" | "failed" | null;
  /** The milestone (subitem) it's on, or null for the job or lot itself. */
  milestone: string | null;
}

export type LiveData =
  | {
      status: "ok";
      /** Monday's last full sync (ISO), or the read time before the first one. */
      asOf: string;
      /** When the loader read the database (ISO). Holds are judged against it until the browser's clock takes over. */
      readAt: string;
      jobs: Job[];
      lots: LiveLot[];
      reps: RepOption[];
    }
  | { status: "error"; message: string };
