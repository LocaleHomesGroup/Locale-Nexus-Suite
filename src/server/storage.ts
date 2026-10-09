import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readServerEnv, type ServerEnv } from "./env";
import { checkedToken } from "./mirror/limits";

/**
 * Files in Supabase Storage, reached only from the server with the service role
 * key. Both buckets are private: people download through short-lived signed URLs.
 */
export interface FileStore {
  ensureBucket(name: string, fileSizeLimit: number): Promise<void>;
  upload(bucket: string, path: string, body: Uint8Array, contentType: string): Promise<void>;
  signedUrl(bucket: string, path: string, seconds: number): Promise<string>;
}

export const BUCKETS = { mondayFiles: "monday-files", launchpadFiles: "launchpad-files" } as const;

/** How long one Storage request may take, so a stalled upload or signed-URL call can't hold a run. */
const REQUEST_TIMEOUT_MS = 60_000;

/** The client for the settings it was made with: other settings get a new one. */
let cached: { url: string; key: string; client: SupabaseClient } | null = null;

function storageClient(url: string, key: string): SupabaseClient {
  if (cached?.url !== url || cached.key !== key) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      // A request that brings its own signal keeps it; any other is abandoned after REQUEST_TIMEOUT_MS.
      global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) }) },
    });
    cached = { url, key, client };
  }
  return cached.client;
}

/**
 * Null when NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY isn't set. Throws for a key a header can't carry (a
 * line break, a space or a NUL in it): supabase-js sends the key as a header, and Node's error for a bad one quotes the
 * whole key, which would then reach a run's error, a response and the logs. The message thrown here names the setting
 * and quotes none of it.
 */
export function supabaseFileStore(env: ServerEnv = readServerEnv()): FileStore | null {
  if (!env.supabaseUrl || !env.serviceRoleKey) return null;
  const key = checkedToken(env.serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY");
  const storage = storageClient(env.supabaseUrl, key).storage;
  return {
    async ensureBucket(name, fileSizeLimit) {
      const { data } = await storage.getBucket(name);
      if (data) {
        const limitTooLow = !(typeof data.file_size_limit === "number" && data.file_size_limit >= fileSizeLimit);
        if (!data.public && !limitTooLow) return;
        // Files are only for signed URLs, so a public bucket goes back to private. A smaller limit (or none) would
        // refuse big files one at a time, each charged an attempt, so it is raised to what was asked.
        const { error } = await storage.updateBucket(name, { public: false, fileSizeLimit });
        if (error) {
          const problem = data.public ? "is public and couldn't be made private" : `has a size limit below ${fileSizeLimit} bytes, or none, and couldn't be updated`;
          throw new Error(`Storage: bucket ${name} ${problem}: ${error.message}`);
        }
        return;
      }
      const { error } = await storage.createBucket(name, { public: false, fileSizeLimit });
      if (error && !/already exists/i.test(error.message)) throw new Error(`Storage: ${error.message}`);
    },
    async upload(bucket, path, body, contentType) {
      const { error } = await storage.from(bucket).upload(path, body, { contentType, upsert: true });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
    },
    async signedUrl(bucket, path, seconds) {
      const { data, error } = await storage.from(bucket).createSignedUrl(path, seconds);
      if (error || !data?.signedUrl) throw new Error(`Storage: ${error?.message ?? "no signed URL"}`);
      return data.signedUrl;
    },
  };
}

/** An in-memory FileStore, for tests. Keys are "<bucket>/<path>". */
export function memoryFileStore(): FileStore & { files: Map<string, { body: Uint8Array; contentType: string }> } {
  const files = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    files,
    async ensureBucket() {},
    async upload(bucket, path, body, contentType) {
      files.set(`${bucket}/${path}`, { body, contentType });
    },
    async signedUrl(bucket, path) {
      return `memory://${bucket}/${path}`;
    },
  };
}
