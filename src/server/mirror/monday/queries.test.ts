import { test } from "node:test";
import assert from "node:assert/strict";
import { isWriteOperation, withComplexity } from "./client";
import { Q } from "./queries";

test("queries: every document is a read the client sends, with complexity added once", () => {
  for (const [name, document] of Object.entries(Q)) {
    assert.equal(isWriteOperation(document), false, `${name} must read as a query`);
    const sent = withComplexity(document);
    assert.equal(sent.split("complexity {").length - 1, 1, `${name} gets complexity once`);
    assert.equal(isWriteOperation(sent), false, `${name} is still a query once complexity is added`);
  }
});

/** A document with its string literals blanked, so a bracket or a dollar sign inside one doesn't count. */
const bare = (document: string) => document.replace(/"(?:\\.|[^"\\\n])*"/g, '""');

// No GraphQL parser is installed and Monday can't be called from tests, so a typo in a document (a lost brace, a
// variable renamed in one place) would only show up as a 400 from Monday in production. These three catch it here.

test("queries: brackets balance in every document", () => {
  const opener: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (const [name, document] of Object.entries(Q)) {
    const open: string[] = [];
    for (const ch of bare(document)) {
      if ("([{".includes(ch)) open.push(ch);
      else if (ch in opener) assert.equal(open.pop(), opener[ch], `${name}: a ${ch} has no matching opener`);
    }
    assert.deepEqual(open, [], `${name}: brackets left open`);
  }
});

test("queries: every variable a document declares is used, and every one it uses is declared", () => {
  for (const [name, document] of Object.entries(Q)) {
    const head = /^\s*query\s*(\([^)]*\))?/.exec(document);
    const declared = new Set((head?.[1] ?? "").match(/\$\w+/g));
    const used = new Set(bare(document.slice(head?.[0].length ?? 0)).match(/\$\w+/g));
    assert.deepEqual([...used].sort(), [...declared].sort(), `${name}: the variables declared and used differ`);
  }
});

test("queries: a call that returns a list sets its limit, because Monday's defaults are small (25 boards)", () => {
  const lists = /\b(boards|items|users|updates|workspaces|activity_logs|items_page|next_items_page)\(([^)]*)\)/g;
  for (const [name, document] of Object.entries(Q)) {
    for (const [, field, args] of document.matchAll(lists)) {
      // Reading one board by its id needs no limit; anything else could return more than the default.
      if (!/\blimit:/.test(args)) assert.equal(`${field}(${args})`, "boards(ids: $board)", `${name}: ${field} has no limit`);
    }
  }
});
