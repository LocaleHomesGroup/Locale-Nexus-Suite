"use client";

import { SmoothSelect } from "@/components/ui/select";
import { useViewer } from "@/state/live-data";

/** Until sign-in exists, the live Sales screens act for the rep picked here (kept in the URL as ?as=). */
export function ViewingAs() {
  const { viewer, reps, setViewer } = useViewer();
  if (reps.length === 0) return null;
  return (
    <SmoothSelect
      value={viewer?.id ?? ""}
      onChange={setViewer}
      options={reps.map((r) => ({ value: r.id, label: r.name }))}
      leading="Viewing as"
      size="sm"
      align="end"
      ariaLabel={viewer ? `Viewing as ${viewer.name}` : "Viewing as"}
    />
  );
}
