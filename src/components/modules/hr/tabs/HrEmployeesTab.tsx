"use client";

import { MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { EMPLOYEES, personTone } from "../data";

/** HR › Employees — the directory cards. Each person wears their division's sub-brand (personTone). */
export function HrEmployeesTab() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employees"
        description="Directory, work information and records · mirrored from Horilla."
      />

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EMPLOYEES.map((e, i) => (
          <Reveal key={e.name} as="li" index={i}>
            <Card className="flex items-center gap-3 px-4 py-3.5">
              <Avatar name={e.name} tone={personTone(e.name)} size="md" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">{e.name}</p>
                <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                  <span>{e.role}</span>
                  <span aria-hidden>·</span>
                  <span>{e.division}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="size-2.5 text-subtle-foreground" aria-hidden />
                    {e.location}
                  </span>
                </p>
              </div>
            </Card>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
