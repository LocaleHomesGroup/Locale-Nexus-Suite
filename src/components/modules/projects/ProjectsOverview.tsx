"use client";

import { CircleCheck, ClipboardList, Columns3, Flag, Gauge, Rocket } from "lucide-react";
import { DashboardOverview } from "../overview/DashboardOverview";
import { BOARD, PROJECTS } from "./data";

/** Projects › Overview — every figure from the projects list and the Launchpad V1 board. */
export function ProjectsOverview() {
  const inBuild = PROJECTS.filter((p) => p.state === "In build").length;
  const average = Math.round(PROJECTS.reduce((n, p) => n + p.progress, 0) / PROJECTS.length);
  const closest = [...PROJECTS].sort((a, b) => b.progress - a.progress)[0];
  const deploying = PROJECTS.find((p) => p.state === "Deploying");
  const column = (c: string) => BOARD.find((b) => b.column === c)?.items ?? [];
  const todo = column("To do").length;
  const doing = column("In progress").length;
  const done = column("Done");

  return (
    <DashboardOverview
      title="Projects overview"
      description="Internal builds, who owns them and how close each one is."
      headline={[
        { label: "Active projects", value: PROJECTS.length, sub: `${inBuild} in build`, icon: ClipboardList, to: "projects:board" },
        { label: "Average progress", value: `${average}%`, sub: `across all ${PROJECTS.length}`, icon: Gauge, to: "projects:board" },
        { label: "Closest to done", value: `${closest.progress}%`, sub: closest.name, icon: Flag, to: "projects:board" },
        { label: "Board tasks open", value: todo + doing, sub: `${todo} to do · ${doing} in progress`, icon: Columns3, to: "projects:board" },
      ]}
      moreLabel="More from the project board"
      more={[
        { label: "Done on the board", value: done.length, sub: done.length ? `incl. ${done[0]}` : "nothing yet", icon: CircleCheck, tone: "ok", to: "projects:board" },
        {
          label: "Deploying",
          value: deploying ? `${deploying.progress}%` : "—",
          sub: deploying ? `${deploying.name} · ${deploying.owner}` : "nothing deploying",
          icon: Rocket,
          to: "projects:board",
        },
      ]}
    />
  );
}
