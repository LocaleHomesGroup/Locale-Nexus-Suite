"use client";

import * as React from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { ArrowRight, AtSign, Briefcase, Crown, Eye, Radio, Sheet, SlidersHorizontal, UserX } from "lucide-react";
import { rowDelay } from "@/lib/motion";
import { hrefForKey } from "@/components/shell/dashboards";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { RateBar } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { ORG_DEPARTMENTS, masterList } from "@/components/modules/hr/data";
import { useOrg } from "@/components/modules/hr/org-store";
import { DashboardOverview } from "../overview/DashboardOverview";
import { ROLES, directory, pageOf, plural, type RoleKey } from "./data";
import { liveOf, useAdmin } from "./admin-store";
import { PersonAvatar } from "./parts";

const firstNames = (names: string[], max = 3) =>
  names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} and ${names.length - max} more`;

/**
 * Admin › Overview. Read from the same store as Roles & permissions and the
 * Global Master List, so granting a role or signing someone out moves these
 * cards. HRIS's Admin overview keeps a role breakdown; here it's Access by
 * dashboard, beside who's online.
 */
export function AdminOverview() {
  const reduce = useReducedMotion();
  const { people } = useOrg();
  const admin = useAdmin();
  const [now] = React.useState(() => Date.now());

  const rows = React.useMemo(() => masterList(people), [people]);
  const dir = React.useMemo(() => directory(rows, admin.offRoster), [rows, admin.offRoster]);
  const rolesOf = (key: string) => admin.grants[key] ?? [];

  const live = dir.map((p) => ({ p, live: liveOf(p, admin, now) }));
  const online = live.filter((x) => x.live.state !== "offline");
  const inactive = online.filter((x) => x.live.state === "inactive").length;
  const holding = dir.filter((p) => rolesOf(p.key).length > 0);
  const grants = holding.reduce((n, p) => n + rolesOf(p.key).length, 0);
  const noAccess = dir.filter((p) => p.row && p.email && rolesOf(p.key).length === 0);
  const admins = dir.filter((p) => rolesOf(p.key).includes("admin"));
  const offRoster = dir.filter((p) => !p.row);

  const holders = Object.fromEntries(ROLES.map((r) => [r.key, 0])) as Record<RoleKey, number>;
  for (const p of dir) for (const r of rolesOf(p.key)) holders[r] += 1;
  const used = ROLES.filter((r) => holders[r.key] > 0).length;
  const most = Math.max(1, ...Object.values(holders));

  // A section someone holds the dashboard for but can only view, or can't see.
  let narrowed = 0;
  const narrowedPeople = new Set<string>();
  for (const [who, perRole] of Object.entries(admin.access)) {
    for (const sections of Object.values(perRole)) {
      for (const level of Object.values(sections ?? {})) {
        if (level !== "edit") {
          narrowed += 1;
          narrowedPeople.add(who);
        }
      }
    }
  }

  return (
    <DashboardOverview
      title="Admin overview"
      description="Who can open which dashboard, who's online right now, and the accounts that aren't on the master list. Grants and live status are sample data until sign-in arrives."
      headline={[
        {
          label: "Online now",
          value: online.length,
          sub: inactive ? `${inactive} with the tab in the background` : "everyone online is active",
          icon: Radio,
          tone: "ok",
          to: "admin:people",
          query: { view: "online" },
        },
        {
          label: "With dashboard access",
          value: holding.length,
          sub: `of ${plural(dir.length, "person", "people")} in the directory`,
          icon: Eye,
          tone: "tone",
          to: "admin:roles",
        },
        {
          label: "Active grants",
          value: grants,
          sub: `across ${plural(used, "dashboard")}`,
          icon: Briefcase,
          tone: "charcoal",
          to: "admin:roles",
        },
        {
          label: "No dashboard yet",
          value: noAccess.length,
          sub: noAccess.length ? firstNames(noAccess.map((p) => p.name.split(" ")[0])) : "everyone has one",
          icon: UserX,
          tone: noAccess.length ? "pending" : "ok",
          to: "admin:roles",
        },
      ]}
      moreLabel="More from each section"
      more={[
        {
          label: "On the roster",
          value: rows.length,
          sub: `${ORG_DEPARTMENTS.length} departments`,
          icon: Sheet,
          to: "admin:people",
        },
        {
          label: "Admins",
          value: admins.length,
          sub: admins.length ? firstNames(admins.map((p) => p.name.split(" ")[0])) : "nobody yet",
          icon: Crown,
          tone: "charcoal",
          to: "admin:roles",
          query: { role: "admin" },
        },
        {
          label: "Off-roster accounts",
          value: offRoster.length,
          sub: "not on the master list",
          icon: AtSign,
          to: "admin:roles",
        },
        {
          label: "Sections narrowed",
          value: narrowed,
          sub: narrowed ? `View or Hidden · ${plural(narrowedPeople.size, "person", "people")}` : "every grant is on Edit",
          icon: SlidersHorizontal,
          to: "admin:roles",
        },
      ]}
    >
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Reveal index={2}>
          <Card>
            <CardHeader>
              <CardTitle>Access by dashboard</CardTitle>
              <CardMeta>{plural(grants, "grant")}</CardMeta>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 pt-1">
                {ROLES.map((r, i) => (
                  <li key={r.key}>
                    <Link
                      href={hrefForKey("admin:roles", { role: r.key })}
                      className="group block rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-tone-soft/60 focus-visible:ring-3 focus-visible:ring-ring/45"
                    >
                      <span className="mb-1.5 flex items-baseline gap-3 text-xs">
                        <r.dashboard.icon className="size-3.5 shrink-0 self-center text-subtle-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">{plural(holders[r.key], "person", "people")}</span>
                      </span>
                      <RateBar
                        value={holders[r.key] / most}
                        tone={r.key === "admin" ? "charcoal" : "tone"}
                        height="h-[6px]"
                        delay={rowDelay(i, reduce, 0.04, 0.4)}
                        label={`${r.label}: ${plural(holders[r.key], "person", "people")}`}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={3}>
          <Card>
            <CardHeader>
              <CardTitle>Online now</CardTitle>
              <CardMeta>
                <Link
                  href={hrefForKey("admin:people", { view: "online" })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-tone-ink underline-offset-4 hover:underline"
                >
                  Global Master List <ArrowRight className="size-3" aria-hidden />
                </Link>
              </CardMeta>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col">
                {online.map(({ p, live: l }) => {
                  const page = l.at ? pageOf(l.at) : null;
                  return (
                    <li key={p.key} className="border-t border-hairline first:border-t-0">
                      <Link
                        href={hrefForKey("admin:people", { person: p.key })}
                        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-tone-soft/60 focus-visible:ring-3 focus-visible:ring-ring/45"
                      >
                        <PersonAvatar person={p} live={l.state} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{p.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {page ? `${page.dashboard.title} · ${page.section}` : "Online"}
                          </span>
                        </span>
                        {l.state === "inactive" ? (
                          <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-300">Inactive</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </DashboardOverview>
  );
}
