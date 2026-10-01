"use client";

import * as React from "react";
import { Activity, AlertTriangle, House, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import type { SyncState } from "@/data/jobs";
import { useLaunchpad } from "@/state/launchpad-store";
import { PageHeader } from "@/components/ui/page";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { AutomatedSources } from "./AutomatedSources";
import { JobsTable } from "./JobsTable";
import { BulkUpdateDialog, useBulkUpdate } from "./BulkUpdateDialog";

export type SyncFilter = "all" | SyncState;

/**
 * CRM Dash Sync — the jobs list (mockup `h === "list"`): filter tiles, the
 * builder-portal inbox, the job table and the CSV bulk update.
 */
export function CrmDashSync() {
  const { jobs } = useLaunchpad();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<SyncFilter>("all");
  const bulk = useBulkUpdate();

  const pending = jobs.filter((j) => j.sync === "pending").length;
  const conflicts = jobs.filter((j) => j.sync === "conflict").length;
  const toggle = (f: SyncFilter) => setFilter((cur) => (cur === f ? "all" : f));

  const q = query.trim().toLowerCase();
  const rows = jobs
    .filter((j) => (filter === "all" ? true : j.sync === filter))
    .filter((j) => (q ? `${j.jobNo} ${j.client} ${j.builder} ${j.address}`.toLowerCase().includes(q) : true));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="CRM Dash Sync"
        description="Every job, served from Launchpad. Mirrored from HubSpot and Monday, refreshed within minutes."
        actions={
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              count={q ? rows.length : undefined}
              placeholder="Search job no, client, builder, address"
              aria-label="Search jobs"
              className="w-full sm:w-[22.5rem]"
            />
            <Button onClick={bulk.openDialog}>
              <Upload /> Bulk update
            </Button>
          </>
        }
      />

      <Reveal index={0}>
        <KpiGrid cols={4}>
          <KpiCard
            label="Active jobs"
            value={jobs.length}
            icon={House}
            tone="haven"
            onClick={() => setFilter("all")}
            active={false}
            hint={filter !== "all" ? "Show all" : "All jobs"}
          />
          <KpiCard label="Updates today" value={3} icon={Activity} tone="skyblue" />
          <KpiCard
            label="Pending sync"
            value={pending}
            icon={RefreshCw}
            tone="pending"
            onClick={() => toggle("pending")}
            active={filter === "pending"}
          />
          <KpiCard
            label="Sync conflicts"
            value={conflicts}
            icon={conflicts > 0 ? AlertTriangle : ShieldCheck}
            tone="ok"
            alert={conflicts > 0}
            pulse={conflicts > 0 && filter !== "conflict"}
            onClick={() => toggle("conflict")}
            active={filter === "conflict"}
          />
        </KpiGrid>
      </Reveal>

      <Reveal index={1}>
        <AutomatedSources />
      </Reveal>

      <Reveal index={2}>
        <JobsTable
          rows={rows}
          filter={filter}
          query={query}
          onClear={() => {
            setQuery("");
            setFilter("all");
          }}
        />
      </Reveal>

      <BulkUpdateDialog bulk={bulk} />
    </div>
  );
}
