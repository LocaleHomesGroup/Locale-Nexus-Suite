"use client";

import {
  AtSign,
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  Hourglass,
  IdCard,
  Layers,
  Mail,
  MapPin,
  Network,
  Pencil,
  Phone,
  ReceiptText,
  Smile,
  Tag,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { formatDayLong } from "@/components/ui/date-picker";
import { formatIsoDate, orgDepartment, orgTone, tenure, type MasterRow, type OrgPerson } from "../data";
import type { OrgState } from "../org-store";
import { money, overtimeBasis, usePay } from "../pay-store";
import { BookedMove, Detail, DetailGroup, EMAIL_LINK, Email, Notice, brandWords, reportsTo, shortDate, type Mode } from "./parts";

/**
 * View: one person's full record — HRIS's master-list detail grid in four
 * groups (employment, contact, pay, reporting line), plus any booked move or
 * rate change and the one-off payments filed for them here. Pay and Edit sit
 * in the footer. The tiles cascade in behind the dialog's own entrance.
 */
export function RecordDialog({
  row,
  people,
  seats,
  org,
  today,
  onClose,
  onOpen,
}: {
  row: MasterRow | null;
  people: OrgPerson[];
  seats: Map<string, OrgPerson>;
  org: Pick<OrgState, "pending" | "scheduled" | "saving">;
  today: Date;
  onClose: () => void;
  onOpen: (id: string, mode: Mode) => void;
}) {
  const pay = usePay();
  const record = row?.record;
  const seat = row ? seats.get(row.id) : undefined;
  const reports = row ? people.filter((p) => p.managerId === row.id && !p.link) : [];
  const booked = row ? org.scheduled[row.id] : undefined;
  const rate = row ? pay.rates[row.id] : undefined;
  const bookedRate = row ? pay.scheduled[row.id] : undefined;
  const payments = row ? pay.payments.filter((p) => p.personId === row.id).slice(0, 4) : [];
  const status = !row
    ? null
    : org.saving[row.id] || pay.pending[row.id]
      ? { label: "Saving…", tone: "neutral" as const }
      : org.pending[row.id] === "moving"
        ? { label: "Moving…", tone: "neutral" as const }
        : row.takingOverFrom
          ? { label: "In transition", tone: "pending" as const }
          : row.isNew
            ? { label: "New starter", tone: "tone" as const }
            : { label: "Active", tone: "ok" as const };

  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      size="lg"
      icon={IdCard}
      title={row?.name ?? ""}
      description={row ? `${row.role} · ${orgDepartment(row.department).name}` : null}
      footer={
        row ? (
          <>
            <Button variant="outline" className="mr-auto" onClick={onClose}>
              Close
            </Button>
            <Button variant="outline" onClick={() => onOpen(row.id, "pay")}>
              <Banknote /> Pay
            </Button>
            <Button onClick={() => onOpen(row.id, "edit")}>
              <Pencil /> Edit
            </Button>
          </>
        ) : null
      }
    >
      {row ? (
        <div className="flex flex-col gap-5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={row.name} tone={orgTone(row.brands)} size="lg" />
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{record?.employeeId ?? "No ID yet"}</span>
              <Pill tone="neutral">{orgDepartment(row.department).name}</Pill>
              {status ? (
                <Pill tone={status.tone} variant="caps">
                  {status.label}
                </Pill>
              ) : null}
            </div>
          </div>

          {booked ? <BookedMove booked={booked} /> : null}

          <DetailGroup title="Employment">
            <Detail index={0} icon={IdCard} label="Employee ID" mono>
              {record?.employeeId}
            </Detail>
            <Detail index={1} icon={Briefcase} label="Position">
              {row.role}
              {row.takingOverFrom ? (
                <span className="block text-xs text-amber-700 dark:text-amber-300">Taking over from {row.takingOverFrom}</span>
              ) : null}
            </Detail>
            <Detail index={2} icon={Building2} label="Department">
              {orgDepartment(row.department).name}
            </Detail>
            <Detail index={3} icon={Tag} label="Sub-brand">
              {brandWords(row)}
            </Detail>
            <Detail index={4} icon={CalendarDays} label="Commencement date">
              {record ? formatIsoDate(record.commenced) : null}
            </Detail>
            <Detail index={5} icon={Hourglass} label="Tenure">
              {record ? tenure(record.commenced, today) : null}
            </Detail>
          </DetailGroup>

          <DetailGroup title="Contact">
            <Detail index={6} icon={Mail} label="Work email" mono>
              {record ? (
                <a href={`mailto:${record.workEmail}`} className={EMAIL_LINK}>
                  <Email value={record.workEmail} />
                </a>
              ) : null}
            </Detail>
            <Detail index={7} icon={AtSign} label="Personal email" mono>
              {record?.personalEmail ? <Email value={record.personalEmail} /> : null}
            </Detail>
            <Detail index={8} icon={Smile} label="Preferred name">
              {record?.preferredName || null}
            </Detail>
            <Detail index={9} icon={Phone} label="Mobile">
              {record?.mobile ? (
                <a href={`tel:${record.mobile.replace(/[^\d+]/g, "")}`} className={EMAIL_LINK}>
                  {record.mobile}
                </a>
              ) : null}
            </Detail>
            <Detail index={10} icon={MapPin} label="Location">
              {record?.location || null}
            </Detail>
          </DetailGroup>

          <DetailGroup title="Pay">
            <Detail index={11} icon={Banknote} label="Hourly rate">
              {rate ? (
                <>
                  <span className="font-medium tabular-nums">{money(rate.hourly)}</span>
                  <span className="text-muted-foreground">/hr</span>
                </>
              ) : null}
            </Detail>
            <Detail index={12} icon={Clock} label="Overtime rate">
              {rate ? (
                <>
                  <span className="font-medium tabular-nums">{money(rate.overtime)}</span>
                  <span className="text-muted-foreground">/hr · {overtimeBasis(rate)}</span>
                </>
              ) : null}
            </Detail>
            <Detail index={13} icon={CalendarDays} label="Rates since" wide>
              {rate ? formatIsoDate(rate.effective) : null}
            </Detail>
            {bookedRate ? (
              <div className="sm:col-span-2">
                <Notice>
                  Changing to <span className="font-semibold tabular-nums">{money(bookedRate.hourly)}</span>/hr, overtime{" "}
                  <span className="font-semibold tabular-nums">{money(bookedRate.overtime)}</span>/hr, on{" "}
                  <span className="font-semibold tabular-nums">{formatDayLong(bookedRate.effective)}</span>
                </Notice>
              </div>
            ) : null}
            {payments.length ? (
              <Detail index={14} icon={ReceiptText} label="One-off payments" wide>
                <ul className="mt-1 divide-y divide-hairline">
                  {payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 first:pt-0 last:pb-0">
                      <span className="min-w-0">
                        <span className="font-medium tabular-nums">{money(p.amount)}</span> {p.kind.toLowerCase()}
                        {p.hours ? ` · ${p.hours} h at ${money(p.rate ?? 0)}` : ""}
                        {p.note ? <span className="text-muted-foreground"> · {p.note}</span> : null}
                      </span>
                      <span className={cn("text-xs whitespace-nowrap", p.status === "filing" ? "text-subtle-foreground" : "text-muted-foreground")}>
                        {p.status === "filing" ? "Filing…" : "With payroll"} · pays {shortDate(p.payOn, today)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Detail>
            ) : null}
          </DetailGroup>

          <DetailGroup title="Reporting line">
            <Detail index={15} icon={Network} label="Reports to">
              {reportsTo(row, seats)}
            </Detail>
            <Detail index={16} icon={Layers} label="Team">
              {seat?.team ?? null}
            </Detail>
            <Detail index={17} icon={Users} label={`Direct reports${reports.length ? ` · ${reports.length}` : ""}`} wide>
              {reports.length ? (
                <span className="mt-1 flex flex-wrap gap-1">
                  {reports.map((p) => (
                    <span
                      key={p.id}
                      className={cn(
                        "rounded-full border border-hairline bg-card px-2 py-0.5 text-xs",
                        !p.name && "border-dashed text-muted-foreground",
                      )}
                    >
                      {p.name ?? `Vacant · ${p.role}`}
                    </span>
                  ))}
                </span>
              ) : null}
            </Detail>
          </DetailGroup>
        </div>
      ) : null}
    </Dialog>
  );
}
