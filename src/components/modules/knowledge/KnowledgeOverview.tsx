"use client";

import { BookOpen, FilePenLine, ShieldCheck, Sparkles } from "lucide-react";
import { DashboardOverview, type OverviewKpi } from "../overview/DashboardOverview";
import { CATEGORIES, CATEGORY_SLUGS, type Category, type Material } from "./data";

const isNew = (m: Material) => m.meta === "New";
/** "Updated 2 Aug" — August is the prototype's current month. */
const isUpdatedThisMonth = (m: Material) => /^Updated \d+ Aug$/.test(m.meta);
const isRequired = (m: Material) => m.meta.startsWith("Required");

/**
 * Knowledge › Overview — the library at a glance, then one card per category.
 * Reads the screen's materials, so something added in a category counts here.
 * `counts` are the category totals the rail shows.
 */
export function KnowledgeOverview({ materials, counts }: { materials: Record<Category, Material[]>; counts: number[] }) {
  const tally = (test: (m: Material) => boolean) => CATEGORIES.map((c) => materials[c.name].filter(test).length);
  const fresh = tally(isNew);
  const updated = tally(isUpdatedThisMonth);
  const total = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
  // The category with the most of something: where its card leads.
  const busiest = (ns: number[]) => ns.indexOf(Math.max(...ns));
  const to = (i: number) => `knowledge:${CATEGORY_SLUGS[CATEGORIES[i].name]}`;
  const required = CATEGORIES.flatMap((c, i) => materials[c.name].filter(isRequired).map((m) => ({ m, i })));

  const top = (ns: number[]) => `${ns[busiest(ns)]} in ${CATEGORIES[busiest(ns)].name}`;

  const byCategory: OverviewKpi[] = CATEGORIES.map((c, i) => ({
    label: c.name,
    value: counts[i],
    sub: fresh[i] ? `${fresh[i]} new this month` : updated[i] ? `${updated[i]} updated in August` : "nothing new this month",
    icon: c.icon,
    to: to(i),
  }));

  return (
    <DashboardOverview
      title="Knowledge overview"
      description="What’s in the library, and what changed this month."
      headline={[
        { label: "Materials", value: total(counts), sub: `across ${CATEGORIES.length} categories`, icon: BookOpen, to: to(0) },
        { label: "New this month", value: total(fresh), sub: total(fresh) ? top(fresh) : "nothing new yet", icon: Sparkles, to: to(busiest(fresh)) },
        {
          label: "Updated in August",
          value: total(updated),
          sub: total(updated) ? top(updated) : "nothing updated yet",
          icon: FilePenLine,
          to: to(busiest(updated)),
        },
        {
          label: "Required reading",
          value: required.length,
          sub: required.length ? required[0].m.title : "nothing required",
          icon: ShieldCheck,
          to: to(required[0]?.i ?? 0),
        },
      ]}
      moreLabel="By category"
      more={byCategory}
    />
  );
}
