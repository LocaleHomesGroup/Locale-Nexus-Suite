"use client";

import { X } from "lucide-react";
import { SmoothSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DIMENSIONS, DIMENSION_ALL, DIMENSION_LABEL, type Dimension, type FilterOption, type JobFilters } from "./filters";

/**
 * Builder, sales rep, brand and division. Each control applies on change —
 * four controls that each need an "apply" are four chances to look filtered and
 * not be — and one "Clear filters" resets all four, keeping the search and the
 * active tile.
 *
 * A value that survived in the URL but is not on offer stays selected, marked,
 * so the control shows what the page is actually doing rather than snapping
 * back to "all" and contradicting the table underneath it.
 */
export function FilterBar({
  value,
  options,
  onChange,
  onClear,
}: {
  value: JobFilters;
  options: Record<Dimension, FilterOption[]>;
  onChange: (d: Dimension, v: string) => void;
  onClear: () => void;
}) {
  const active = DIMENSIONS.some((d) => value[d]);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter jobs">
      {DIMENSIONS.map((d) => {
        const list = options[d];
        const unknown = value[d] && !list.some((o) => o.value === value[d]);
        return (
          <SmoothSelect
            key={d}
            size="sm"
            leading={DIMENSION_LABEL[d]}
            ariaLabel={DIMENSION_LABEL[d]}
            value={value[d]}
            onChange={(v) => onChange(d, v)}
            className="min-w-[10.5rem]"
            options={[
              { value: "", label: DIMENSION_ALL[d] },
              ...list.map((o) => ({ value: o.value, label: o.value, hint: o.count })),
              ...(unknown ? [{ value: value[d], label: `${value[d]} — not a value we know` }] : []),
            ]}
          />
        );
      })}
      {active ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X aria-hidden /> Clear filters
        </Button>
      ) : null}
    </div>
  );
}
