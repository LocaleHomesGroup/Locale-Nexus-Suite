"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Label } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import {
  ORG_BRANDS,
  ORG_DEPARTMENTS,
  orgDepartment,
  orgDepartmentOf,
  orgReports,
  type OrgBrand,
  type OrgDepartmentId,
  type OrgPerson,
} from "./data";
import { addPerson, fillSeat, useOrg } from "./org-store";

/**
 * Add person: puts someone on the org chart under a department and manager,
 * or names the person taking a vacant seat. Opened from the chart's header
 * (blank), a seat's + (under that seat), a team's "Add to team" (into that
 * team) or a vacant seat's "Fill seat".
 */
export type AddTarget =
  | { mode: "add"; departmentId?: OrgDepartmentId; managerId?: string; team?: string }
  | { mode: "fill"; seatId: string };

const BRANDS = Object.keys(ORG_BRANDS) as OrgBrand[];

const DOT: Record<OrgBrand, string> = {
  homes: "bg-haven-300",
  financial: "bg-nectar-300",
  wealth: "bg-skyblue-300",
};

/** "Adam Orlando", or "the vacant Advocate Manager QLD seat". */
export const seatName = (p: OrgPerson) => p.name ?? `the vacant ${p.role} seat`;

const chip = (on: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
    on
      ? "border-tone-strong bg-tone-soft text-tone-ink"
      : "border-border bg-card text-muted-foreground hover:border-tone-line hover:text-foreground dark:bg-white/[0.03]",
  );

export function AddPersonDialog({
  open,
  target,
  onClose,
  onAdded,
}: {
  open: boolean;
  target: AddTarget | null;
  onClose: () => void;
  /** The seat that was added or filled, and the seat it hangs under (for its department). */
  onAdded: (id: string, anchorId: string) => void;
}) {
  const { people, pending } = useOrg();
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [dept, setDept] = React.useState<OrgDepartmentId | "">("");
  const [managerId, setManagerId] = React.useState("");
  const [team, setTeam] = React.useState("");
  const [brands, setBrands] = React.useState<OrgBrand[]>([]);
  const [isNew, setIsNew] = React.useState(true);
  // Picking a team suggests its role; once the role is typed, leave it alone.
  const roleTyped = React.useRef(false);
  const nameId = React.useId();
  const roleId = React.useId();
  const deptId = React.useId();
  const managerFieldId = React.useId();
  const teamLabelId = React.useId();
  const brandLabelId = React.useId();

  const byId = React.useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const seat = target?.mode === "fill" ? byId.get(target.seatId) : undefined;
  const manager = managerId ? byId.get(managerId) : undefined;

  // Who can take a report: every seat drawn in the department except team
  // members (a team is one block on the chart), board seats and assistants
  // (drawn beside it), and seats still inside their undo window.
  const managers = React.useMemo(
    () =>
      dept
        ? people.filter((p) => !p.link && !p.team && !pending[p.id] && orgDepartmentOf(people, p.id) === dept)
        : [],
    [people, pending, dept],
  );

  const teamsUnder = (id: string) => [
    ...new Set(
      orgReports(people, id)
        .filter((p) => p.team)
        .map((p) => p.team!),
    ),
  ];
  const teams = managerId ? teamsUnder(managerId) : [];

  /** Team (or none) under a manager: its brand and role become the defaults. */
  const applyTeam = (mid: string, t: string) => {
    setTeam(t);
    const member = t ? orgReports(people, mid).find((p) => p.team === t) : undefined;
    setBrands(member?.brands ?? byId.get(mid)?.brands ?? []);
    if (!roleTyped.current) setRole(member?.role ?? "");
  };

  const pickDept = (d: OrgDepartmentId) => {
    setDept(d);
    const head = orgDepartment(d).headId;
    setManagerId(head);
    applyTeam(head, "");
  };

  const pickManager = (mid: string) => {
    setManagerId(mid);
    applyTeam(mid, "");
  };

  // A fresh form each time it opens, placed where it was opened from. Reads the
  // chart as it is at that moment: an add committing while the form is open
  // must not wipe what's been typed.
  React.useEffect(() => {
    if (!open || !target) return;
    setName("");
    setIsNew(true);
    roleTyped.current = false;
    if (target.mode === "fill") return;
    const d = target.departmentId ?? (target.managerId ? orgDepartmentOf(people, target.managerId) : "");
    setDept(d);
    const mid = target.managerId ?? (d ? orgDepartment(d).headId : "");
    setManagerId(mid);
    if (mid) applyTeam(mid, target.team ?? "");
    else {
      setTeam("");
      setBrands([]);
      setRole("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target]);

  const canSubmit = seat ? name.trim().length > 0 : Boolean(name.trim() && role.trim() && manager);

  const submit = () => {
    if (!canSubmit) return;
    if (seat) {
      fillSeat(seat.id, name.trim(), isNew);
      onAdded(seat.id, seat.id);
    } else {
      const id = addPerson({
        name: name.trim(),
        role: role.trim(),
        managerId,
        team: team || undefined,
        brands,
        isNew,
      });
      onAdded(id, managerId);
    }
    onClose();
  };

  const deptName = dept ? orgDepartment(dept).name : null;
  const reportsUnderSeat = seat ? orgReports(people, seat.id).length : 0;

  const description = seat
    ? `Name the new ${seat.role}.${
        reportsUnderSeat ? ` The ${reportsUnderSeat} people under the seat stay under it.` : ""
      } Horilla updates once the undo window closes.`
    : manager && deptName
      ? `They'll sit under ${seatName(manager)} in ${deptName}${
          team ? `, in ${team}` : ""
        }. Horilla updates once the undo window closes.`
      : "Choose their department and who they report to. Horilla updates once the undo window closes.";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={seat ? "Fill vacant seat" : "Add person"}
      icon={UserPlus}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            <UserPlus /> {seat ? "Fill seat" : deptName ? `Add to ${deptName}` : "Add person"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {seat ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department" htmlFor={deptId}>
              <SmoothSelect
                id={deptId}
                value={dept}
                onChange={pickDept}
                placeholder="Choose a department"
                options={ORG_DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Field>
            <Field label="Reports to" htmlFor={managerFieldId}>
              <SmoothSelect
                id={managerFieldId}
                value={managerId}
                onChange={pickManager}
                align="end"
                placeholder={dept ? "Choose a manager" : "Choose a department first"}
                options={managers.map((p) => ({
                  value: p.id,
                  label: p.name ?? "Vacant",
                  hint: p.role,
                }))}
              />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor={nameId}>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jordan Lee"
              autoComplete="off"
              data-autofocus
            />
          </Field>
          {seat ? (
            <Field label="Role" htmlFor={roleId}>
              <Input id={roleId} value={seat.role} readOnly disabled />
            </Field>
          ) : (
            <Field label="Role" htmlFor={roleId}>
              <Input
                id={roleId}
                value={role}
                onChange={(e) => {
                  roleTyped.current = true;
                  setRole(e.target.value);
                }}
                placeholder="e.g. New Home Advocate"
                autoComplete="off"
              />
            </Field>
          )}
        </div>

        {!seat && teams.length > 0 ? (
          <div className="space-y-1.5">
            <Label id={teamLabelId}>Team</Label>
            <div role="radiogroup" aria-labelledby={teamLabelId} className="flex flex-wrap gap-1.5">
              {["", ...teams].map((t) => (
                <button
                  key={t || "own"}
                  type="button"
                  role="radio"
                  aria-checked={team === t}
                  onClick={() => applyTeam(managerId, t)}
                  className={chip(team === t)}
                >
                  {t || "Their own seat"}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {seat ? null : (
          <div className="space-y-1.5">
            <Label id={brandLabelId}>
              Brand <span className="font-normal text-subtle-foreground">· none for group services</span>
            </Label>
            <div role="group" aria-labelledby={brandLabelId} className="flex flex-wrap gap-1.5">
              {BRANDS.map((b) => {
                const on = brands.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setBrands((cur) => (on ? cur.filter((x) => x !== b) : [...cur, b]))}
                    className={chip(on)}
                  >
                    <span className={cn("size-2 rounded-full ring-1 ring-black/10 ring-inset", DOT[b])} aria-hidden />
                    {ORG_BRANDS[b].label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2.5 text-[13px]">
          <Checkbox checked={isNew} onChange={(e) => setIsNew(e.target.checked)} />
          Mark as new
          <span className="text-xs text-subtle-foreground">· shows a New tag on the chart</span>
        </label>

        {/* Enter in a text field submits. */}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden />
      </form>
    </Dialog>
  );
}
