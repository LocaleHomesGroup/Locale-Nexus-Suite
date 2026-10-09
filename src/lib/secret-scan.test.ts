import { test } from "node:test";
import assert from "node:assert/strict";
import { scanText } from "./secret-scan";

// Built at runtime: a literal token here would block committing this file.
const JWT_HEAD = "eyJhbGciOiJIUzI1NiJ9" + ".";
const fakeMonday = JWT_HEAD + "eyJ0aWQiOj" + "A".repeat(40) + "." + "b".repeat(30);
const fakeHubSpot = "pat-" + "ap1-" + "1234abcd-12ab-34cd-56ef-1234567890ab";
// Invented: never reuse a real (even leaked) value in a test.
const fakeFragment = "ap1-" + "1111-2222-3a3b-4c4d-5e5f6a7b8c9d";
const fakeHubstaff = "hsoat_" + "x".repeat(24);

test("secret-scan: finds a Monday token, even commented out", () => {
  const found = scanText(".env.example", `# MONDAY_API_TOKEN=${fakeMonday}\n`);
  assert.deepEqual(found.map((f) => f.name), ["Monday API token", "Secret-looking assignment"]);
  assert.equal(found[0].line, 1);
});

test("secret-scan: finds HubSpot tokens, including one with its prefix cut off", () => {
  assert.equal(scanText("a.ts", `const t = "${fakeHubSpot}";`)[0]?.name, "HubSpot private app token");
  assert.equal(scanText("a.md", `token ${fakeFragment} here`)[0]?.name, "HubSpot token fragment");
});

test("secret-scan: finds Hubstaff tokens and filled-in secret assignments", () => {
  assert.equal(scanText("a.txt", fakeHubstaff)[0]?.name, "Hubstaff organization token");
  assert.equal(scanText(".env", "CRON_SECRET=abcdefghijklmnop")[0]?.name, "Secret-looking assignment");
});

test("secret-scan: empty assignments, ordinary code and settings that aren't secret pass", () => {
  const text = [
    "SUPABASE_DB_URL=",
    "HUBSPOT_TOKEN=",
    "MONDAY_DAILY_CALL_CAP=2000",
    "LAUNCHPAD_ENV=local",
    "export const TOKEN_HEADER = \"Authorization\";",
    "const key = row.key;",
  ].join("\n");
  assert.deepEqual(scanText(".env.example", text), []);
});

test("secret-scan: reports the line each finding is on", () => {
  const found = scanText("x.env", `A=1\nB=2\nHUBSTAFF_TOKEN=${fakeHubstaff}\n`);
  assert.ok(found.length > 0);
  assert.ok(found.every((f) => f.line === 3));
});

test("secret-scan: Supabase keys and database URLs with a password", () => {
  const supabaseSecret = "sb_secret_" + "TestOnly0123456789abcdef";
  const dbUrl = "postgres://launchpad_app.testref:" + "TestOnlyPassw0rd" + "@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres";
  assert.equal(scanText("a.ts", `const k = "${supabaseSecret}";`)[0]?.name, "Supabase secret key");
  assert.equal(scanText("a.ts", `const url = "${dbUrl}";`)[0]?.name, "Postgres URL with a password");
  assert.deepEqual(scanText("a.txt", "postgres://example"), [], "no password, nothing to find");
});

test("secret-scan: a whole HubSpot token is one finding, not two", () => {
  const token = "pat-" + "na1-" + "11111111-2222-3333-4444-555555555555";
  assert.deepEqual(scanText("a.txt", `x ${token}`).map((f) => f.name), ["HubSpot private app token"]);
});

test("secret-scan: a bare HS256 JWT, such as a Supabase legacy key, is caught once", () => {
  const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" + "." + "eyJ" + "x".repeat(20) + "." + "y".repeat(20);
  assert.deepEqual(scanText("a.ts", `const key = "${jwt}";`).map((f) => f.name), ["JWT (such as a Supabase legacy key)"]);
  assert.deepEqual(scanText("a.ts", `const key = "${"eyJhbGciOiJIUzI1NiJ9" + "." + "eyJ0aWQiOj" + "A".repeat(40) + "." + "b".repeat(30)}";`).map((f) => f.name), ["Monday API token"]);
});
