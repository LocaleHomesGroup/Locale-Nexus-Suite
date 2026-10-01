/**
 * Projects — the mockup's `bm`: every internal build, its owner, progress and
 * state, plus the Launchpad V1 board. Static prototype data.
 */

export type ProjectState = "In build" | "Validation" | "Deploying";

export interface Project {
  name: string;
  owner: string;
  /** 0–100 */
  progress: number;
  state: ProjectState;
}

export const PROJECTS: Project[] = [
  { name: "Launchpad V1 · CRM Dash Sync", owner: "Jerry", progress: 45, state: "In build" },
  { name: "Locale Pricing Hub", owner: "Jerry", progress: 30, state: "In build" },
  { name: "Finance Health Check form", owner: "Pablo", progress: 80, state: "Validation" },
  { name: "LastPass rollout", owner: "Pablo", progress: 65, state: "Deploying" },
];

export type BoardColumn = "To do" | "In progress" | "Done";

export const BOARD: { column: BoardColumn; items: string[] }[] = [
  {
    column: "To do",
    items: ["Entra app registration session", "Capture sandbox stage IDs", "Field matrix session w/ Shannan"],
  },
  {
    column: "In progress",
    items: ["Monday → HubSpot milestone sync", "Supabase schema + RLS", "v0 UI pass"],
  },
  {
    column: "Done",
    items: ["Board + automation audit", "Launchpad UI build", "Test workspace mirrors"],
  },
];
