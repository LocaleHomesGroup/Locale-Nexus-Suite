"use client";

import { DoorOpen, MapPin, Package, Percent, Scale, TrendingUp, Users } from "lucide-react";
import { DashboardOverview } from "../overview/DashboardOverview";
import { SUBURBS, statText, statValue, type Suburb, type WealthPackage } from "./data";

/** The suburb with the highest (or lowest) value of a stat. */
function best(label: string, pick: "max" | "min" = "max"): Suburb {
  return [...SUBURBS].sort((a, b) =>
    pick === "max" ? statValue(b, label) - statValue(a, label) : statValue(a, label) - statValue(b, label),
  )[0];
}

/** Every suburb sharing the top value: "Baldivis and Yanchep". */
function tiedAtTop(label: string): string {
  const top = statValue(best(label), label);
  return SUBURBS.filter((s) => statValue(s, label) === top)
    .map((s) => s.name)
    .join(" and ");
}

/**
 * Wealth › Overview. Packages come from the screen above it (so a package just
 * generated counts); the market figures are the suburb data the generator
 * loads. Alkimos and Yanchep's figures are the prototype's own placeholders
 * (see `./data`).
 */
export function WealthOverview({ packages }: { packages: WealthPackage[] }) {
  const thisMonth = packages.filter((p) => p.thisMonth);
  const growth = best("12-month growth");
  const vacancy = best("Vacancy rate", "min");
  const cheapest = best("Median house price", "min");
  const dearest = best("Median house price");
  const population = best("Population growth");
  const k = (s: Suburb) => `$${Math.round(statValue(s, "Median house price") / 1000)}k`;

  return (
    <DashboardOverview
      title="Wealth overview"
      description="Investor packages generated, and the suburbs they’re built on."
      headline={[
        {
          label: "Packages this month",
          value: thisMonth.length,
          sub: thisMonth.length ? thisMonth.map((p) => p.title.split(" — ")[0]).join(" · ") : "none yet",
          icon: Package,
          to: "wealth:generator",
        },
        { label: "Suburbs covered", value: SUBURBS.length, sub: SUBURBS.map((s) => s.name).join(", "), icon: MapPin, to: "wealth:generator" },
        { label: "Top gross yield", value: statText(best("Gross yield"), "Gross yield"), sub: tiedAtTop("Gross yield"), icon: Percent, to: "wealth:generator" },
        { label: "Strongest growth", value: statText(growth, "12-month growth"), sub: `${growth.name} · 12 months`, icon: TrendingUp, to: "wealth:generator" },
      ]}
      moreLabel="More from the suburb data"
      more={[
        { label: "Lowest vacancy", value: statText(vacancy, "Vacancy rate"), sub: vacancy.name, icon: DoorOpen, to: "wealth:generator" },
        {
          label: "Median price range",
          value: `${k(cheapest)}–${k(dearest)}`,
          sub: `${cheapest.name} to ${dearest.name}`,
          icon: Scale,
          to: "wealth:generator",
        },
        {
          label: "Population growth",
          value: statText(population, "Population growth"),
          sub: `${population.name}, the fastest`,
          icon: Users,
          to: "wealth:generator",
        },
      ]}
    />
  );
}
