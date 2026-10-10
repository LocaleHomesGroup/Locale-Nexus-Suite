"use client";

import * as React from "react";
import type { HsBuilder, HsRate } from "@/data/homescope";
import { aud, cn } from "@/lib/utils";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Column<T> {
  label: string;
  cell: (row: T) => React.ReactNode;
  align?: "right";
}

/** A blank value as a dash. */
const opt = (v: React.ReactNode) => (v == null || v === "" ? <Dash /> : v);
const money = (n: number) => aud(n);
/** Variations shown before a search narrows them: some builders have 700. */
const VARIATION_CAP = 100;

function Section<T>({
  index,
  title,
  meta,
  rows,
  columns,
  rowKey,
  tools,
}: {
  index: number;
  title: string;
  meta: string;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, n: number) => string;
  tools?: React.ReactNode;
}) {
  return (
    <Reveal index={index}>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="flex flex-wrap items-end gap-3 border-b border-hairline pb-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardMeta className="text-xs text-muted-foreground">{meta}</CardMeta>
          </div>
          {tools ? <div className="ml-auto">{tools}</div> : null}
        </CardHeader>
        {rows.length ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                  {columns.map((c, i) => (
                    <TableHead
                      key={c.label}
                      className={cn(i === 0 && "pl-5", i === columns.length - 1 && "pr-5", c.align === "right" && "text-right")}
                    >
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, n) => (
                  <TableRow key={rowKey(r, n)}>
                    {columns.map((c, i) => (
                      <TableCell
                        key={c.label}
                        className={cn(
                          "tabular-nums",
                          i === 0 && "pl-5 font-medium",
                          i === columns.length - 1 && "pr-5",
                          c.align === "right" && "text-right",
                        )}
                      >
                        {c.cell(r)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="px-5 py-4 text-[13px] text-muted-foreground">None on Monday for this builder.</p>
        )}
      </Card>
    </Reveal>
  );
}

const RATE_COLUMNS: Column<HsRate>[] = [
  { label: "Option", cell: (r) => r.name },
  { label: "Floor area", cell: (r) => opt(r.area == null ? null : `${r.area} m²`), align: "right" },
  { label: "Price", cell: (r) => money(r.price), align: "right" },
];

/** Everything HomeScope can quote for one builder, board by board, as last imported. */
export function BuilderCatalogue({ builder: b }: { builder: HsBuilder }) {
  const [q, setQ] = React.useState("");
  const letters = [...new Set(b.ranges.map((r) => r.column))].sort();
  const rangeName = (letter: string) => b.ranges.filter((r) => r.column === letter).map((r) => r.name).join(" / ") || `Range ${letter}`;
  const needle = q.trim().toLowerCase();
  const matching = needle
    ? b.variations.filter((v) => `${v.area} ${v.code} ${v.description}`.toLowerCase().includes(needle))
    : b.variations;
  const shown = matching.slice(0, VARIATION_CAP);

  return (
    <div className="flex flex-col gap-5">
      <Section
        index={0}
        title="Designs"
        meta={`${b.models.length} on the Models board, priced by spec range`}
        rows={b.models}
        rowKey={(m, n) => `${m.name}-${n}`}
        columns={[
          { label: "Design", cell: (m) => m.name },
          { label: "Frontage", cell: (m) => opt(m.frontage == null ? null : `${m.frontage} m`), align: "right" },
          { label: "Beds", cell: (m) => opt(m.beds), align: "right" },
          { label: "Baths", cell: (m) => opt(m.baths), align: "right" },
          { label: "House", cell: (m) => opt(m.houseArea == null ? null : `${m.houseArea} m²`), align: "right" },
          { label: "Block", cell: (m) => opt(m.corner ? "Corner" : m.blockType) },
          ...letters.map((l) => ({
            label: rangeName(l),
            cell: (m: HsBuilder["models"][number]) => (m.prices[l] == null ? <Dash /> : money(m.prices[l])),
            align: "right" as const,
          })),
        ]}
      />
      <Section
        index={1}
        title="Spec ranges"
        meta="Which price column each range reads"
        rows={[...b.ranges].sort((x, y) => x.position - y.position)}
        rowKey={(r) => r.name}
        columns={[
          { label: "Range", cell: (r) => r.name },
          { label: "Level", cell: (r) => r.level },
          { label: "Price column", cell: (r) => `Specs Range ${r.column} Price` },
        ]}
      />
      <Section
        index={2}
        title="Front elevations"
        meta={`${b.elevations.length} styles`}
        rows={b.elevations}
        rowKey={(e, n) => `${e.name}-${n}`}
        columns={[
          { label: "Style", cell: (e) => e.name },
          { label: "Price", cell: (e) => (e.price ? money(e.price) : "Included"), align: "right" },
        ]}
      />
      <Section
        index={3}
        title="Colour schemes"
        meta="Included in the price"
        rows={b.colours}
        rowKey={(c, n) => `${c.name}-${n}`}
        columns={[
          { label: "Scheme", cell: (c) => c.name },
          { label: "Description", cell: (c) => opt(c.description) },
        ]}
      />
      <Section
        index={4}
        title="Site works"
        meta="The fixed site cost options"
        rows={b.siteCosts}
        rowKey={(s, n) => `${s.name}-${n}`}
        columns={[
          { label: "Option", cell: (s) => s.name },
          { label: "Work type", cell: (s) => opt(s.workType) },
          { label: "Cost type", cell: (s) => opt(s.costType) },
          { label: "Price", cell: (s) => money(s.price), align: "right" },
        ]}
      />
      <Section
        index={5}
        title="Delayed title allowance"
        meta={b.bundleAllowance ? "Included in the base build price" : "Added when titles are later than the price hold"}
        rows={b.allowances}
        rowKey={(a, n) => `${a.due}-${n}`}
        columns={[
          { label: "When", cell: (a) => a.due },
          { label: "Price hold", cell: (a) => `${a.holdMonths} months`, align: "right" },
          { label: "Type", cell: (a) => a.type },
          { label: "Value", cell: (a) => (a.type.toLowerCase().includes("percent") ? `${a.value}%` : money(a.value)), align: "right" },
          { label: "Monthly step", cell: (a) => (a.monthlyStep ? `${a.monthlyStep}%` : <Dash />), align: "right" },
          { label: "Top-up", cell: (a) => (a.initial ? money(a.initial) : <Dash />), align: "right" },
        ]}
      />
      <Section index={6} title="BAL ratings" meta="Bushfire attack level" rows={b.bal} rowKey={(r, n) => `${r.name}-${r.area}-${n}`} columns={RATE_COLUMNS} />
      <Section index={7} title="Coastal distance" meta="How near the sea the block is" rows={b.coastal} rowKey={(r, n) => `${r.name}-${r.area}-${n}`} columns={RATE_COLUMNS} />
      <Section index={8} title="Noise package" meta="Road and rail noise" rows={b.noise} rowKey={(r, n) => `${r.name}-${r.area}-${n}`} columns={RATE_COLUMNS} />
      <Section
        index={9}
        title="Variations"
        meta={
          matching.length > shown.length
            ? `Showing ${shown.length} of ${matching.length}. Search to narrow`
            : `${matching.length} of ${b.variations.length}`
        }
        tools={<SearchInput value={q} onChange={setQ} placeholder="Search variations" count={needle ? matching.length : undefined} />}
        rows={shown}
        rowKey={(v, n) => `${v.code}-${n}`}
        columns={[
          { label: "Area", cell: (v) => v.area },
          { label: "Code", cell: (v) => opt(v.code) },
          { label: "Description", cell: (v) => <span className="line-clamp-2 font-normal">{v.description}</span> },
          { label: "Unit", cell: (v) => opt(v.unit) },
          { label: "Charge", cell: (v) => money(v.charge), align: "right" },
          { label: "Credit", cell: (v) => (v.credit ? money(v.credit) : <Dash />), align: "right" },
        ]}
      />
      <Section
        index={10}
        title="Bolt-on pricing"
        meta="Per design"
        rows={Object.entries(b.boltOns)}
        rowKey={([model]) => model}
        columns={[
          { label: "Design", cell: ([model]) => model },
          { label: "Items", cell: ([, items]) => items.length, align: "right" },
          { label: "Total charge", cell: ([, items]) => money(items.reduce((s, i) => s + i.charge, 0)), align: "right" },
        ]}
      />
    </div>
  );
}
