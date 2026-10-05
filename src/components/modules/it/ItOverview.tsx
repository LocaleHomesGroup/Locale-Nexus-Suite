"use client";

import { CircleAlert, CircleCheck, KeyRound, Laptop, LifeBuoy, ShieldCheck, Smartphone, Timer } from "lucide-react";
import { DashboardOverview } from "../overview/DashboardOverview";
import { ASSETS } from "../hr/data";
import { PROJECTS } from "../projects/data";
import { IT_SAMPLE, type Ticket } from "./data";

/**
 * IT › Overview. Tickets come from the screen above it, so one raised on the
 * Help desk counts here. Devices are HR's asset register and LastPass is the
 * Projects list: IT reads them, it doesn't own them. Time to resolve and the
 * phishing module are samples (see `IT_SAMPLE`).
 */
export function ItOverview({ tickets }: { tickets: Ticket[] }) {
  const open = tickets.filter((t) => t.status !== "Resolved");
  const fresh = open.filter((t) => t.status === "Open").length;
  const urgent = open.filter((t) => t.priority === "High");
  const resolved = tickets.filter((t) => t.status === "Resolved");
  const repair = ASSETS.filter((a) => a.status === "In repair");
  const spare = ASSETS.filter((a) => a.status === "Available");
  const lastPass = PROJECTS.find((p) => p.name.includes("LastPass"));
  const ids = (ts: Ticket[]) => (ts.length <= 2 ? ts.map((t) => `#${t.id}`).join(" and ") : `${ts.length} tickets`);

  return (
    <DashboardOverview
      title="IT overview"
      description="The help desk queue, and the devices and rollouts behind it."
      headline={[
        {
          label: "Open tickets",
          value: open.length,
          sub: !open.length
            ? "the queue is clear"
            : fresh
              ? `${fresh} new · ${open.length - fresh} in progress`
              : `${open.length} in progress`,
          icon: LifeBuoy,
          to: "it:helpdesk",
        },
        {
          label: "High priority",
          value: urgent.length,
          sub: urgent.length ? `#${urgent[0].id} ${urgent[0].title.split(" — ")[0]}` : "none open",
          icon: CircleAlert,
          tone: urgent.length ? "pending" : "ok",
          to: "it:helpdesk",
        },
        { label: "Resolved", value: resolved.length, sub: resolved.length ? ids(resolved) : "none yet", icon: CircleCheck, tone: "ok", to: "it:helpdesk" },
        { label: "Time to resolve", value: IT_SAMPLE.medianResolve, sub: "median, last 30 days", icon: Timer, to: "it:helpdesk", sample: true },
      ]}
      moreLabel="Devices and security"
      more={[
        {
          label: "Devices in repair",
          value: repair.length,
          sub: repair.length ? `${repair[0].name} · ${repair[0].tag}` : "none",
          icon: Smartphone,
          to: "hr:assets",
        },
        { label: "Spare devices", value: spare.length, sub: spare.length ? `${spare[0].name} · ${spare[0].tag}` : "none", icon: Laptop, to: "hr:assets" },
        {
          label: "LastPass rollout",
          value: lastPass ? `${lastPass.progress}%` : "—",
          sub: lastPass ? `${lastPass.state.toLowerCase()} · Projects` : "not started",
          icon: KeyRound,
          to: "projects:board",
        },
        {
          label: "Phishing module",
          value: `${IT_SAMPLE.phishingDone} of ${IT_SAMPLE.phishingDue}`,
          sub: "completed this year",
          icon: ShieldCheck,
          to: "knowledge:security",
          sample: true,
        },
      ]}
    />
  );
}
