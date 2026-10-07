import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  LEAVE_SEED,
  ORG_SEED,
  balanceAfter,
  leaveApprover,
  leaveLength,
  leaveOrder,
  leaveOverlap,
  leaveUsed,
  leaveWhen,
  othersOff,
  workingDays,
  type LeaveRequest,
} from "./data";
import { cancelLeave, decideLeave, fileLeave, leaveSnapshot, markLeaveSeen, undoLeave } from "./leave-store";

// The undo toasts (sonner) schedule on animation frames, which Node doesn't have.
globalThis.requestAnimationFrame ??= (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number;

/* ── Dates ─────────────────────────────────────────────────────────────── */

test("workingDays: Monday to Friday count, weekends don't", () => {
  assert.equal(workingDays("2026-10-19", "2026-10-23"), 5); // Mon–Fri
  assert.equal(workingDays("2026-10-16", "2026-10-19"), 2); // Fri–Mon
  assert.equal(workingDays("2026-10-17", "2026-10-18"), 0); // Sat–Sun
  assert.equal(workingDays("2026-10-16", "2026-10-16"), 1);
  assert.equal(workingDays("2026-10-20", "2026-10-19"), 0); // ends before it starts
});

test("leaveWhen: one day, a range in a month, across months and years", () => {
  assert.equal(leaveWhen("2026-10-16", "2026-10-16"), "16 Oct");
  assert.equal(leaveWhen("2026-10-19", "2026-10-23"), "19–23 Oct");
  assert.equal(leaveWhen("2026-09-30", "2026-10-02"), "30 Sep – 2 Oct");
  assert.equal(leaveWhen("2026-12-29", "2027-01-02"), "29 Dec – 2 Jan");
});

test("leaveLength: day or days", () => {
  assert.equal(leaveLength(1), "1 day");
  assert.equal(leaveLength(3), "3 days");
});

/* ── Who decides ───────────────────────────────────────────────────────── */

test("leaveApprover: a member's department head decides", () => {
  assert.equal(leaveApprover(ORG_SEED, "jan-kane-reroma")?.id, "jerry-delos-santos");
  assert.equal(leaveApprover(ORG_SEED, "keira-whitbread")?.id, "kellie-boyer");
});

test("leaveApprover: a head's own leave goes to their manager", () => {
  assert.equal(leaveApprover(ORG_SEED, "jerry-delos-santos")?.id, "adam-schaal");
  assert.equal(leaveApprover(ORG_SEED, "adam-schaal"), null);
});

/* ── Balances and clashes ──────────────────────────────────────────────── */

const req = (extra: Partial<LeaveRequest>): LeaveRequest => ({
  id: `t-${Math.random().toString(36).slice(2)}`,
  name: "Jan Kane Reroma",
  type: "Vacation",
  when: "",
  length: "",
  status: "Pending",
  days: 1,
  start: "2026-11-02",
  end: "2026-11-02",
  balance: 10,
  ...extra,
});

test("leaveUsed: pending and approved days count; declined and cancelled don't", () => {
  const list = [
    req({ days: 3 }),
    req({ days: 2, status: "Approved" }),
    req({ days: 5, status: "Declined" }),
    req({ days: 4, status: "Cancelled" }),
    req({ days: 1, type: "Sick" }),
    req({ days: 7, name: "Pablo Lopez" }),
  ];
  assert.equal(leaveUsed(list, "Jan Kane Reroma", "Vacation"), 5);
  assert.equal(leaveUsed(list, "Jan Kane Reroma", "Sick"), 1);
});

test("leaveOverlap: finds your own live leave on those days, not someone else's", () => {
  const list = [
    req({ start: "2026-11-02", end: "2026-11-04" }),
    req({ start: "2026-11-09", end: "2026-11-09", status: "Declined" }),
    req({ start: "2026-11-16", end: "2026-11-16", name: "Pablo Lopez" }),
  ];
  assert.ok(leaveOverlap(list, "Jan Kane Reroma", "2026-11-04", "2026-11-05"));
  assert.equal(leaveOverlap(list, "Jan Kane Reroma", "2026-11-09", "2026-11-09"), undefined);
  assert.equal(leaveOverlap(list, "Jan Kane Reroma", "2026-11-16", "2026-11-16"), undefined);
});

test("balanceAfter: none for leave that doesn't draw on a balance", () => {
  assert.equal(balanceAfter(req({ balance: 4, days: 1 })), 3);
  assert.equal(balanceAfter(req({ type: "Bereavement", balance: null })), null);
});

test("leaveOrder: pending soonest first, then decided newest first", () => {
  const list = [
    req({ id: "old", status: "Approved", start: "2026-03-01" }),
    req({ id: "later", start: "2026-12-01" }),
    req({ id: "recent", status: "Declined", start: "2026-09-01" }),
    req({ id: "soon", start: "2026-10-20" }),
  ];
  assert.deepEqual([...list].sort(leaveOrder).map((r) => r.id), ["soon", "later", "recent", "old"]);
});

/* ── The seed ──────────────────────────────────────────────────────────── */

test("seed: AI & Growth fills more than one page of approvals", () => {
  const dept = LEAVE_SEED.filter((r) => r.department === "ai");
  assert.ok(dept.length > 10);
  assert.ok(dept.every((r) => r.approver === "Jerry Delos Santos"));
  assert.ok(dept.every((r) => r.when === leaveWhen(r.start, r.end) && r.days === workingDays(r.start, r.end)));
});

test("seed: Kane's December leave shows Pablo's as cover", () => {
  const kane = LEAVE_SEED.find((r) => r.name === "Jan Kane Reroma" && r.start === "2026-12-22")!;
  assert.deepEqual(
    othersOff(kane, LEAVE_SEED).map((a) => a.name),
    ["Pablo Lopez"],
  );
});

/* ── The store ─────────────────────────────────────────────────────────── */

test("store: filing holds the request back for the undo window, then sends it", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let filed = 0;
    const r = req({
      id: "filed-1",
      start: "2027-01-11",
      end: "2027-01-11",
      seatId: "jan-kane-reroma",
      department: "ai",
      approver: "Jerry Delos Santos",
    });
    fileLeave(r, () => filed++);
    assert.ok(leaveSnapshot().filing.some((x) => x.id === "filed-1"));
    assert.ok(!leaveSnapshot().requests.some((x) => x.id === "filed-1"), "the manager hasn't got it yet");
    mock.timers.tick(6000);
    assert.ok(leaveSnapshot().requests.some((x) => x.id === "filed-1"));
    assert.equal(leaveSnapshot().filing.length, 0);
    assert.equal(filed, 1);
  } finally {
    mock.timers.reset();
  }
});

test("store: a decision commits after the window, with who decided and when", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const r = leaveSnapshot().requests.find((x) => x.id === "filed-1")!;
    let told = 0;
    decideLeave(r, "Approved", { by: "Jerry Delos Santos", on: "2026-10-04", onDecided: () => told++ });
    assert.equal(leaveSnapshot().deciding["filed-1"], "Approved");
    mock.timers.tick(6000);
    const after = leaveSnapshot().requests.find((x) => x.id === "filed-1")!;
    assert.equal(after.status, "Approved");
    assert.equal(after.decidedBy, "Jerry Delos Santos");
    assert.equal(after.decidedOn, "2026-10-04");
    assert.equal(told, 1);
  } finally {
    mock.timers.reset();
  }
});

test("store: a decision on a request filed in the portal waits as news for its requester", () => {
  assert.ok(leaveSnapshot().unseen.includes("filed-1"), "the approval of filed-1 is news");
  markLeaveSeen(["filed-1"]);
  assert.ok(!leaveSnapshot().unseen.includes("filed-1"));
});

test("store: HR's own queue (no portal seat) makes no news", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const hr = leaveSnapshot().requests.find((x) => x.status === "Pending" && !x.seatId)!;
    decideLeave(hr, "Approved", { by: "HR" });
    mock.timers.tick(6000);
    assert.ok(!leaveSnapshot().unseen.includes(hr.id));
  } finally {
    mock.timers.reset();
  }
});

test("store: undo inside the window keeps the request pending", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const r = leaveSnapshot().requests.find((x) => x.status === "Pending")!;
    decideLeave(r, "Declined", { by: "HR" });
    undoLeave(r.id);
    mock.timers.tick(6000);
    assert.equal(leaveSnapshot().requests.find((x) => x.id === r.id)!.status, "Pending");
    assert.equal(leaveSnapshot().deciding[r.id], undefined);
  } finally {
    mock.timers.reset();
  }
});

test("store: only a pending request can be cancelled", () => {
  const pending = leaveSnapshot().requests.find((x) => x.status === "Pending" && x.name === "Jan Kane Reroma")!;
  assert.equal(cancelLeave(pending.id)?.status, "Cancelled");
  assert.equal(leaveSnapshot().requests.find((x) => x.id === pending.id)!.status, "Cancelled");
  assert.equal(cancelLeave("filed-1"), null, "approved leave stays");
});
