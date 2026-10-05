"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, CalendarCheck2, CalendarX2, Hash, House, SearchX, ShieldCheck } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { PageHeader } from "@/components/ui/page";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { useNavReselect } from "@/components/shell/nav-state";
import { JobsTable } from "./JobsTable";
import { JobViewDialog } from "./JobViewDialog";
import { FilterBar } from "./FilterBar";
import {
  DIMENSIONS,
  DIMENSION_LABEL,
  FILTER_LABEL,
  TILE_FILTERS,
  TILE_MATCH,
  facet,
  filterOptions,
  isAwaiting,
  matchesSearch,
  needsBuilderDate,
  needsSync,
  type Dimension,
  type FilterOption,
  type JobFilters,
  type TileFilter,
} from "./filters";

const NO_FILTERS = Object.fromEntries(DIMENSIONS.map((d) => [d, ""])) as JobFilters;

/**
 * CRM dash sync — every job, served from Launchpad: the filters, the four tiles,
 * the table and the line that says what the table is showing.
 *
 * The filters and the tile narrow the same list, so they carry each other: a
 * tile counts the jobs matching the search and the filters, and the table shows
 * the tile's share of them. Nothing here ever widens the list behind the
 * person's back.
 */
export function CrmDashSync() {
  const { jobs } = useLaunchpad();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = React.useState("");
  // The job open in the View dialog. Read live from the store, so a sync that
  // lands while it is open shows in it.
  const [viewingId, setViewingId] = React.useState<number | null>(null);
  const viewing = viewingId === null ? undefined : jobs.find((j) => j.id === viewingId);
  // Re-clicking CRM dash sync in the rail clears the search too.
  useNavReselect("operations:jobs", () => setQuery(""));

  const raw = params.get("filter") ?? "all";
  const filter: TileFilter = (TILE_FILTERS as readonly string[]).includes(raw) ? (raw as TileFilter) : "all";
  const selected = Object.fromEntries(DIMENSIONS.map((d) => [d, params.get(d) ?? ""])) as JobFilters;

  const setParams = (patch: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  // A tile already showing is the way back to everything.
  const toggle = (f: TileFilter) => setParams({ filter: filter === f ? "" : f });
  const clearFilters = () => setParams(NO_FILTERS);

  const options = React.useMemo(
    () => Object.fromEntries(DIMENSIONS.map((d) => [d, filterOptions(jobs, d)])) as Record<Dimension, FilterOption[]>,
    [jobs],
  );

  // A value no job carries (an old or mistyped link) shows nothing rather than
  // everything, and says which control it was.
  const unrecognised = DIMENSIONS.filter((d) => selected[d] && !options[d].some((o) => o.value === selected[d]));
  const named = unrecognised.map((d) => DIMENSION_LABEL[d].toLowerCase()).join(" and ");
  const hasFilters = DIMENSIONS.some((d) => selected[d]);

  const q = query.trim().toLowerCase();
  const matching =
    unrecognised.length > 0
      ? []
      : jobs.filter((j) => DIMENSIONS.every((d) => !selected[d] || facet(j, d) === selected[d]) && matchesSearch(j, q));
  const counts = {
    total: matching.length,
    awaiting: matching.filter(isAwaiting).length,
    attention: matching.filter(needsBuilderDate).length,
    sync: matching.filter(needsSync).length,
  };
  const shown = matching.filter(TILE_MATCH[filter]);

  const narrowed = Boolean(q) || hasFilters;
  const emptyText =
    unrecognised.length > 0
      ? `Nothing is shown because the ${named} in this link ${unrecognised.length === 1 ? "is" : "are"} not a value you can filter by.`
      : matching.length === 0 && narrowed
        ? // A search and a filter fail the same way and want different advice,
          // so the sentence names whichever is actually narrowing.
          `Nothing matches ${[q ? `“${query.trim()}”` : "", hasFilters ? "the filters you have set" : ""]
            .filter(Boolean)
            .join(" with ")}. Widen the search, or clear the filters.`
        : filter !== "all"
          ? `No job is currently ${FILTER_LABEL[filter].toLowerCase()}. Tap the tile again to see everything.`
          : "No jobs are mirrored here yet.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="CRM dash sync"
        description="Every job, served from Launchpad. Edit here once and it goes to Monday and HubSpot."
        actions={
          <SearchInput
            value={query}
            onChange={setQuery}
            count={q ? shown.length : undefined}
            placeholder="Search job number, client or address"
            aria-label="Search jobs"
            className="w-full sm:w-[22.5rem]"
          />
        }
      />

      <Reveal index={0} className="flex flex-col gap-2.5">
        <FilterBar
          value={selected}
          options={options}
          onChange={(d, v) => setParams({ [d]: v })}
          onClear={clearFilters}
        />
      </Reveal>

      {unrecognised.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>That filter is not one we recognise</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-w-[70ch] text-[13px] leading-relaxed text-muted-foreground">
              The {named} in this link {unrecognised.length === 1 ? "is" : "are"} not among the values you can filter
              by, so nothing is being shown rather than everything. Choose from the controls above, or{" "}
              <Button variant="link" className="text-[13px]" onClick={clearFilters}>
                clear the filters
              </Button>
              .
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Reveal index={1}>
        <KpiGrid cols={4}>
          <KpiCard
            label="Jobs"
            value={counts.total}
            icon={House}
            onClick={() => setParams({ filter: "" })}
            active={false}
            hint={filter !== "all" ? "Show all" : q ? `Matching “${query.trim()}”` : "Everything you may see"}
          />
          <KpiCard
            label="Awaiting a job number"
            wrapLabel
            value={counts.awaiting}
            icon={Hash}
            tone="pending"
            onClick={() => toggle("awaiting")}
            active={filter === "awaiting"}
          />
          <KpiCard
            label="Completed, no builder date"
            wrapLabel
            value={counts.attention}
            icon={counts.attention > 0 ? CalendarX2 : CalendarCheck2}
            tone="ok"
            alert={counts.attention > 0}
            onClick={() => toggle("attention")}
            active={filter === "attention"}
          />
          <KpiCard
            label="Sync needs attention"
            wrapLabel
            value={counts.sync}
            icon={counts.sync > 0 ? AlertTriangle : ShieldCheck}
            tone="ok"
            alert={counts.sync > 0}
            pulse={counts.sync > 0 && filter !== "sync"}
            onClick={() => toggle("sync")}
            active={filter === "sync"}
          />
        </KpiGrid>
      </Reveal>

      <Reveal index={2} className="flex flex-col gap-2.5">
        <JobsTable
          rows={shown}
          onView={(job) => setViewingId(job.id)}
          replayKey={`${filter}|${DIMENSIONS.map((d) => selected[d]).join("|")}`}
          empty={
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
                <SearchX className="size-6" aria-hidden />
              </div>
              <h3 className="text-sm font-semibold">Nothing to show</h3>
              <p className="mt-1.5 max-w-md text-xs text-muted-foreground">{emptyText}</p>
              {narrowed || unrecognised.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-full"
                  onClick={() => {
                    setQuery("");
                    clearFilters();
                  }}
                >
                  Clear search and filters
                </Button>
              ) : filter !== "all" ? (
                <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => toggle(filter)}>
                  Show all jobs
                </Button>
              ) : null}
            </div>
          }
        />
        {/* The tiles count everything; this line is about the table under them. */}
        <p className="text-xs text-subtle-foreground tabular-nums">
          Showing {shown.length} of {counts.total} job{counts.total === 1 ? "" : "s"}
          {hasFilters ? " matching these filters" : ""}
          {filter === "all" ? "" : ` · ${FILTER_LABEL[filter]}`}.
        </p>
      </Reveal>

      <p className="text-xs text-subtle-foreground">
        Bulk upload and builder-portal polling are not built yet.{" "}
        <Link
          href="/operations?tab=jobs&view=inbound"
          className="inline-flex items-center gap-1 rounded-sm font-medium text-tone-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45"
        >
          See where this is going <ArrowRight className="size-3" aria-hidden />
        </Link>
      </p>

      <JobViewDialog job={viewing} open={viewing !== undefined} onClose={() => setViewingId(null)} />
    </div>
  );
}
