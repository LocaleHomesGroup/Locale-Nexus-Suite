import { test } from "node:test";
import assert from "node:assert/strict";
import { readServerEnv } from "./env";
import { supabaseFileStore } from "./storage";

const url = "https://store.example.test";
const settings = (key: string) => readServerEnv({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key });

test("storage: a service-role key a header can't carry is refused by name, and none of it is quoted", (t) => {
  // supabase-js would send the key as a header, and Node's error for a bad one quotes all of it.
  const fetched = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("a request was sent");
  });
  // Invented keys, each with a character a header can't hold.
  const bad = ["test-key-abc\ndef", "test-key-abc\r\ndef", "test-key abc", "test-key-abc\tdef", "test-key-abc\0def"];
  for (const key of bad) {
    assert.throws(
      () => supabaseFileStore(settings(key)),
      (e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        assert.match(message, /SUPABASE_SERVICE_ROLE_KEY/, JSON.stringify(key));
        assert.ok(!message.includes("test-key") && !message.includes("def") && !message.includes("abc"), `none of ${JSON.stringify(key)} is quoted`);
        return true;
      },
    );
  }
  assert.equal(fetched.mock.calls.length, 0, "fetch was never called");
});

test("storage: a key with only blanks around it is fine, and so is an ordinary one", () => {
  // readServerEnv trims what it reads: a pasted key with a trailing newline is the common case, and isn't an error.
  assert.ok(supabaseFileStore(settings("  test-key-abc\n")));
  assert.ok(supabaseFileStore(settings(["not", "a", "real", "key"].join("-"))));
});
