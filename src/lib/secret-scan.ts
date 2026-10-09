/**
 * Token shapes that must never reach git. The repo is public, and GitHub's
 * secret scanning doesn't cover Monday tokens, so `npm run check:secrets`
 * runs this over staged files before every commit (.githooks/pre-commit).
 */
export interface SecretFinding {
  path: string;
  line: number;
  name: string;
}

interface SecretPattern {
  name: string;
  pattern: RegExp;
}

const PATTERNS: readonly SecretPattern[] = [
  // Monday personal and app tokens are HS256 JWTs whose payload opens {"tid":
  { name: "Monday API token", pattern: /eyJhbGciOiJIUzI1NiJ9\.eyJ0aWQiOj[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/ },
  // HubSpot private app tokens and service keys: pat-<region>-<uuid>
  {
    name: "HubSpot private app token",
    pattern: /\bpat-[a-z]{2}\d-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/,
  },
  // The same with "pat-" (and part of the uuid) cut off, as committed in 15676f1.
  {
    name: "HubSpot token fragment",
    pattern: /(?<!pat-)\b[a-z]{2}\d-[0-9a-f]{4,8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/,
  },
  { name: "Hubstaff organization token", pattern: /\bhsoat_[A-Za-z0-9_-]{16,}/ },
  { name: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}/ },
  // Supabase's legacy anon and service_role keys, and other HS256 JWTs. Monday's
  // tokens have a different header (no "typ"), so they aren't reported twice.
  { name: "JWT (such as a Supabase legacy key)", pattern: /\beyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "Postgres URL with a password", pattern: /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s<>]{6,}@[a-z0-9.-]+/i },
  // NAME=value where NAME says secret: catches anything pasted into an env file.
  {
    name: "Secret-looking assignment",
    pattern: /^\s*#?\s*(?:export\s+)?[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|_KEY|_PAT)\s*=\s*["']?[^\s"'#]{8,}/,
  },
];

export function scanText(path: string, text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const { name, pattern } of PATTERNS) {
      if (pattern.test(line)) findings.push({ path, line: i + 1, name });
    }
  });
  return findings;
}
