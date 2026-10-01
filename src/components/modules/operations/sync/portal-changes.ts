import {
  BUILDER_CLAIMS,
  MILESTONE_HUBSPOT_STAGE,
  PRECON_HUBSPOT_PROPERTY,
  STATUS_LABEL,
  type Job,
} from "@/data/jobs";
import type { PortalUpdate } from "@/data/seed";
import { aud } from "@/lib/utils";
import { HUBSPOT_STAGE_ORDER, type SyncSystem } from "./types";

/** One field a portal update would change, in the system it writes to. */
export interface FieldChange {
  sys: SyncSystem;
  field: string;
  from: string;
  to: string;
  /** Shown instead of from → to when the system isn't written to. */
  note?: string;
}

/**
 * Exactly what accepting a portal update writes, field by field, worked out
 * from the job as it stands now. The "Accept all" confirmation lists these so
 * a person sees every change before anything leaves Launchpad.
 */
export function portalChanges(u: PortalUpdate, job: Job | undefined): FieldChange[] {
  if (u.kind === "move") {
    return [
      { sys: "Monday", field: "Board", from: "Sales board", to: "Construction Pipeline, 8 milestone subitems" },
      { sys: "Monday", field: "Date to Site", from: "Not set", to: u.date },
      {
        sys: "HubSpot",
        field: "Pipeline and stage",
        from: `Sales · ${job?.hsStage ?? "Sale Won"}`,
        to: "Construction (WA) · Site Start",
      },
    ];
  }

  const list = u.kind === "precon" ? job?.precon : job?.milestones;
  const m = list?.find((x) => x.name === u.milestone);
  const from = m
    ? m.status === "done"
      ? `Completed · ${m.date || "no date"}`
      : STATUS_LABEL[m.status]
    : "Not started";
  const changes: FieldChange[] = [
    { sys: "Monday", field: `${u.milestone} subitem`, from, to: `Completed · ${u.date}` },
  ];

  if (u.kind === "precon") {
    const property = PRECON_HUBSPOT_PROPERTY[u.milestone];
    changes.push(
      property
        ? { sys: "HubSpot", field: property, from: "Not set", to: u.date }
        : { sys: "HubSpot", field: u.milestone, from: "", to: "", note: "Not mapped to a HubSpot property, so nothing changes there" },
    );
  } else {
    const stage = MILESTONE_HUBSPOT_STAGE[u.milestone];
    const current = job?.hsStage ?? "";
    if (stage && HUBSPOT_STAGE_ORDER.indexOf(stage) > HUBSPOT_STAGE_ORDER.indexOf(current)) {
      changes.push({ sys: "HubSpot", field: "Deal stage", from: current || "Not set", to: stage });
    } else if (stage) {
      changes.push({ sys: "HubSpot", field: `${u.milestone} date`, from: "Not set", to: u.date });
    }
  }

  const claim = job ? BUILDER_CLAIMS[job.builder]?.[u.milestone] : undefined;
  if (claim) {
    changes.push({ sys: "Xero", field: "Draft invoice", from: "None", to: `${aud(claim)} + GST, waits for approval in Accounts` });
  }
  return changes;
}
