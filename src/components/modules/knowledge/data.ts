/**
 * Knowledge base — the mockup's `Sm`: five categories (with their total
 * material counts) and the latest materials in each. Static prototype data.
 *
 * Two titles are added to the mockup's lists so that Home's "Popular right now"
 * links resolve here: "Deal submission checklist — all builders" (Builder
 * guides) and "How milestones sync to HubSpot and Monday" (Systems reference).
 * Home's third link, "Leave request process", is the mockup's existing
 * "Leave request and approval" SOP.
 */
import { BarChart3, ClipboardCheck, Home, Lock, Settings, type LucideIcon } from "lucide-react";

export type Category =
  | "SOPs and processes"
  | "Builder guides"
  | "Sales training"
  | "IT and security"
  | "Systems reference";

export type MaterialKind = "doc" | "video";

export interface Material {
  /** Set on materials added in this session (titles may repeat). */
  id?: string;
  title: string;
  /** "Updated 2 Aug", "New", "Video · 18 min", "Required annually". */
  meta: string;
  kind: MaterialKind;
}

export const CATEGORIES: { name: Category; count: number; icon: LucideIcon }[] = [
  { name: "SOPs and processes", count: 24, icon: ClipboardCheck },
  { name: "Builder guides", count: 18, icon: Home },
  { name: "Sales training", count: 12, icon: BarChart3 },
  { name: "IT and security", count: 15, icon: Lock },
  { name: "Systems reference", count: 21, icon: Settings },
];

/** URL slug for each category — the Knowledge rail links to `/knowledge?cat=<slug>`. */
export const CATEGORY_SLUGS: Record<Category, string> = {
  "SOPs and processes": "sops",
  "Builder guides": "builders",
  "Sales training": "training",
  "IT and security": "security",
  "Systems reference": "systems",
};

export function categoryForSlug(slug: string | null): Category {
  const hit = (Object.entries(CATEGORY_SLUGS) as [Category, string][]).find(([, s]) => s === slug);
  return hit ? hit[0] : CATEGORIES[0].name;
}

export const MATERIALS: Record<Category, Material[]> = {
  "SOPs and processes": [
    { title: "Sale Won handover checklist", meta: "Updated 2 Aug", kind: "doc" },
    { title: "Moving a job to construction", meta: "Updated 24 Jul", kind: "doc" },
    { title: "Resolving a sync conflict", meta: "New", kind: "doc" },
    { title: "Monthly builder price update", meta: "Updated 1 Aug", kind: "doc" },
    { title: "Leave request and approval", meta: "Updated 12 Jun", kind: "doc" },
  ],
  "Builder guides": [
    { title: "Deal submission checklist — all builders", meta: "Updated 6 Aug", kind: "doc" },
    { title: "Forma · deal submission requirements", meta: "Updated 6 Aug", kind: "doc" },
    { title: "Move Homes · PBA pack and delayed titles", meta: "Updated 6 Aug", kind: "doc" },
    { title: "New Choice · 27-item acceptance checklist", meta: "Updated 6 Aug", kind: "doc" },
    { title: "New Era · attachments and contract timing", meta: "Updated 6 Aug", kind: "doc" },
    { title: "La Vida · RevUp and submissions inbox", meta: "Updated 6 Aug", kind: "doc" },
  ],
  "Sales training": [
    { title: "Onboarding: your first fortnight", meta: "Video · 18 min", kind: "video" },
    { title: "Running a first appointment", meta: "Video · 24 min", kind: "video" },
    { title: "Quoting with Rapid costing", meta: "Video · 11 min", kind: "video" },
    { title: "Handling discount conversations", meta: "Video · 9 min", kind: "video" },
    { title: "Deal submission walkthrough", meta: "Video · 15 min", kind: "video" },
  ],
  "IT and security": [
    { title: "Phishing awareness module", meta: "Required annually", kind: "doc" },
    { title: "Password manager setup", meta: "Updated 18 Jul", kind: "doc" },
    { title: "Reporting a security incident", meta: "Updated 4 Jun", kind: "doc" },
  ],
  "Systems reference": [
    { title: "Launchpad: what lives where", meta: "New", kind: "doc" },
    { title: "How milestones sync to HubSpot and Monday", meta: "New", kind: "doc" },
    { title: "Field ownership: who owns which field", meta: "New", kind: "doc" },
    { title: "Job number formats by builder", meta: "New", kind: "doc" },
  ],
};

/**
 * Home's "Popular right now" titles, verbatim, with the search that surfaces
 * each one here and the category it lives in (so the rail highlights it).
 */
export const POPULAR: { label: string; query: string; cat: string }[] = [
  { label: "Deal submission checklist — all builders", query: "Deal submission checklist", cat: "builders" },
  { label: "How milestones sync to HubSpot and Monday", query: "How milestones sync", cat: "systems" },
  { label: "Leave request process", query: "Leave request", cat: "sops" },
];
